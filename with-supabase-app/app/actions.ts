"use server";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfo } from "@qatadaazzeh/atcoder-api";
import { getRecommendedProblems, type RecommendedProblem } from "@/lib/atcoder/recommendations";

export type MessagePart = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: MessagePart[];
};

export type Hint = {
  step: number;
  content: string;
};

export async function updatAtcoderHandle(handle: string): Promise<{ success: boolean; rating: number | null; handle: string | null }> {
    const supabase = await createClient();
  // getClaims() is faster than getUser() as it reads from JWT directly
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
        return { success: false, rating: null, handle: null };
    }
  const userId = claims.sub as string;
    try {
        // 핸들 유효성 검사 (AtCoder API로 유저 정보 확인)
        const atcoderUser = await fetchUserInfo(handle);
        const userName = atcoderUser.userName;

        // 레이팅 히스토리 먼저 갱신
        const historyResult = await refreshRatingHistory(userName);

        // 레이팅 히스토리에서 최신 레이팅 가져오기
        let userRating = atcoderUser.userRating;
        if (historyResult.success && historyResult.count > 0) {
          const { data: latestHistory } = await supabase
            .from("contest_history")
            .select("new_rating")
            .eq("atcoder_handle", userName)
            .order("end_time", { ascending: false })
            .limit(1)
            .single();

          if (latestHistory) {
            userRating = latestHistory.new_rating;
          }
        }

    const { error } = await supabase
      .from("user_info")
      .update({ atcoder_handle: userName, rating: userRating })
        .eq("id", userId);
        if (error) {
            return { success: false, rating: null, handle: null };
        }

        return { success: true, rating: userRating, handle: userName };
    } catch (error) {
        console.error("Failed to fetch Atcoder user info:", error);
        return { success: false, rating: null, handle: null };
    }
}

/**
 * 기존 AtCoder 핸들로 최신 레이팅을 갱신합니다.
 * 프로필 페이지 로드 시 호출됩니다.
 */
export interface SolvedProblem {
  id: string; // problem_id alias for consistency
  problem_id: string;
  contest_id: string;
  title: string | null;
  difficulty: number | null;
}

/**
 * AtCoder API에서 사용자의 풀이 목록을 가져옵니다 (내부 함수)
 */
async function fetchSolvedProblemsFromAPI(atcoderHandle: string): Promise<{
  problem_id: string;
  contest_id: string;
  solved_at: Date | null;
  status: 'AC' | 'WA';
}[]> {
  const allSubmissions: { problem_id: string; contest_id: string; result: string; epoch_second: number }[] = [];
  let fromSecond = 0;
  const maxCalls = 20;

  for (let i = 0; i < maxCalls; i++) {
    const response = await fetch(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${atcoderHandle}&from_second=${fromSecond}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error("Failed to fetch submissions");
      break;
    }

    const submissions = await response.json();
    if (submissions.length === 0) break;

    allSubmissions.push(...submissions);

    if (submissions.length < 500) break;

    const lastEpoch = Math.max(...submissions.map((s: { epoch_second: number }) => s.epoch_second));
    fromSecond = lastEpoch + 1;
  }

  // AC인 제출에서 고유 문제 ID 추출 (최초 AC 시간 저장)
  const acProblemsMap = new Map<string, { contest_id: string; solved_at: number }>();
  // WA만 있는 문제 추적 (최초 제출의 contest_id)
  const waProblemsMap = new Map<string, { contest_id: string }>();

  for (const sub of allSubmissions) {
    if (sub.result === "AC") {
      const existing = acProblemsMap.get(sub.problem_id);
      if (!existing || sub.epoch_second < existing.solved_at) {
        acProblemsMap.set(sub.problem_id, {
          contest_id: sub.contest_id,
          solved_at: sub.epoch_second,
        });
      }
    } else {
      // AC가 없는 문제에 대해서만 WA 추적
      if (!waProblemsMap.has(sub.problem_id)) {
        waProblemsMap.set(sub.problem_id, { contest_id: sub.contest_id });
      }
    }
  }

  const result: { problem_id: string; contest_id: string; solved_at: Date | null; status: 'AC' | 'WA' }[] = [];

  for (const [problem_id, data] of acProblemsMap.entries()) {
    result.push({
      problem_id,
      contest_id: data.contest_id,
      solved_at: new Date(data.solved_at * 1000),
      status: 'AC',
    });
  }

  for (const [problem_id, data] of waProblemsMap.entries()) {
    // AC로 풀린 문제는 제외
    if (!acProblemsMap.has(problem_id)) {
      result.push({
        problem_id,
        contest_id: data.contest_id,
        solved_at: null,
        status: 'WA',
      });
    }
  }

  return result;
}

/**
 * 사용자가 푼 문제 목록을 가져옵니다.
 * DB에서 먼저 조회하고, 없으면 API에서 가져와 DB에 저장합니다.
 */
export async function getSolvedProblems(atcoderHandle: string): Promise<SolvedProblem[]> {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;

    if (!claims) {
      // 로그인 안 된 경우 API에서 직접 가져오기 (캐싱 없음)
      return fetchAndEnrichProblems(atcoderHandle, null);
    }

    const userId = claims.sub as string;

    // DB에서 캐시된 풀이 목록 조회 (Supabase 기본 limit이 1000이므로 페이지네이션 사용)
    const allCachedProblems: { problem_id: string; contest_id: string }[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: pageData, error: pageError } = await supabase
        .from("user_solved_problems")
        .select("problem_id, contest_id")
        .eq("user_id", userId)
        .range(from, to);

      if (pageError || !pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        allCachedProblems.push(...pageData);
        hasMore = pageData.length === pageSize;
        page++;
      }
    }

    // 캐시가 있으면 사용
    if (allCachedProblems.length > 0) {
      return enrichProblemsWithInfo(allCachedProblems, supabase);
    }

    // 캐시가 없으면 API에서 가져와 저장
    return fetchAndEnrichProblems(atcoderHandle, userId);
  } catch (error) {
    console.error("Failed to get solved problems:", error);
    return [];
  }
}

/**
 * API에서 풀이 목록을 가져와 DB에 저장하고 문제 정보를 매칭합니다.
 */
async function fetchAndEnrichProblems(atcoderHandle: string, userId: string | null): Promise<SolvedProblem[]> {
  const supabase = await createClient();
  const apiProblems = await fetchSolvedProblemsFromAPI(atcoderHandle);

  if (apiProblems.length === 0) {
    return [];
  }

  // userId가 있으면 DB에 저장
  if (userId) {
    // 새로 추가되거나 변경된 것만 upsert (status WA→AC 업데이트 포함)
    const batchSize = 500;
    const batches = [];
    for (let i = 0; i < apiProblems.length; i += batchSize) {
      batches.push(apiProblems.slice(i, i + batchSize).map((p) => ({
        user_id: userId,
        problem_id: p.problem_id,
        contest_id: p.contest_id,
        solved_at: p.solved_at?.toISOString() || null,
        status: p.status,
        updated_at: new Date().toISOString(),
      })));
    }
    await Promise.all(batches.map((batch, i) =>
      supabase
        .from("user_solved_problems")
        .upsert(batch, { onConflict: "user_id,problem_id" })
        .then(({ error }) => {
          if (error) console.error("[fetchAndEnrichProblems] Upsert error at batch", i, error);
        })
    ));

    // 동기화 시간 업데이트
    await supabase
      .from("user_info")
      .update({ solved_problems_synced_at: new Date().toISOString() })
      .eq("id", userId);
  }

  // 문제 정보 매칭
  return enrichProblemsWithInfo(apiProblems, supabase);
}

/**
 * 풀이 목록에 문제 정보(제목, 난이도)를 매칭합니다.
 */
async function enrichProblemsWithInfo(
  problems: { problem_id: string; contest_id: string }[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<SolvedProblem[]> {
  const problemIds = problems.map((p) => p.problem_id);
  const problemInfoMap = new Map<string, { title: string; difficulty: number | null }>();

  // 100개씩 배치로 병렬 조회
  const batchSize = 100;
  const batches: string[][] = [];
  for (let i = 0; i < problemIds.length; i += batchSize) {
    batches.push(problemIds.slice(i, i + batchSize));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      supabase.from("problems").select("id, title, difficulty").in("id", batch)
    )
  );

  for (const { data: problemsData } of results) {
    if (problemsData) {
      for (const p of problemsData) {
        problemInfoMap.set(p.id, { title: p.title, difficulty: p.difficulty });
      }
    }
  }

  // 결과 생성
  const result: SolvedProblem[] = problems.map((p) => {
    const info = problemInfoMap.get(p.problem_id);
    return {
      id: p.problem_id,
      problem_id: p.problem_id,
      contest_id: p.contest_id,
      title: info?.title || null,
      difficulty: info?.difficulty ?? null,
    };
  });

  // 난이도 내림차순 정렬
  result.sort((a, b) => (b.difficulty ?? -1) - (a.difficulty ?? -1));

  return result;
}

/**
 * 사용자의 풀이 목록을 강제로 새로고침합니다.
 * 프로필 페이지의 "정보 갱신" 버튼에서 호출됩니다.
 */
export async function refreshSolvedProblems(atcoderHandle: string): Promise<SolvedProblem[]> {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;

    if (!claims) {
      return [];
    }

    const userId = claims.sub as string;

    // 강제로 API에서 가져와 DB 갱신
    return fetchAndEnrichProblems(atcoderHandle, userId);
  } catch (error) {
    console.error("Failed to refresh solved problems:", error);
    return [];
  }
}

export async function refreshAtcoderRating(): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return null;
  }
  const userId = claims.sub as string;

  // 현재 저장된 핸들 조회
  const { data: userData, error: fetchError } = await supabase
    .from("user_info")
    .select("atcoder_handle")
    .eq("id", userId)
    .single();

  if (fetchError || !userData?.atcoder_handle) {
    return null;
  }

  try {
    // 레이팅 히스토리 먼저 갱신
    const historyResult = await refreshRatingHistory(userData.atcoder_handle);

    // 레이팅 히스토리에서 최신 레이팅 가져오기
    let userRating = 0;
    if (historyResult.success && historyResult.count > 0) {
      const { data: latestHistory } = await supabase
        .from("contest_history")
        .select("new_rating")
        .eq("atcoder_handle", userData.atcoder_handle)
        .order("end_time", { ascending: false })
        .limit(1)
        .single();

      if (latestHistory) {
        userRating = latestHistory.new_rating;
      }
    } else {
      // 히스토리가 없으면 기존 방식으로 시도
      const atcoderUser = await fetchUserInfo(userData.atcoder_handle);
      userRating = atcoderUser.userRating;
    }

    // DB 업데이트
    const { error: updateError } = await supabase
      .from("user_info")
      .update({ rating: userRating })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update rating:", updateError);
      return null;
    }

    return userRating;
  } catch (error) {
    console.error("Failed to refresh AtCoder rating:", error);
    return null;
  }
}

export async function saveChatHistory(
  chatId: string | null,
  messages: Message[],
  title: string,
  problemUrl?: string | null,
  updateTitle: boolean = true,
  hints?: Hint[] | null
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return null;
  }
  const userId = claims.sub as string;

  try {
    const messagesJson = JSON.stringify(messages);

    if (chatId) {
      // 기존 채팅 업데이트
      const updateData: {
        messages: string;
        title?: string;
        hints?: Hint[] | null;
      } = {
        messages: messagesJson,
      };
      // 제목 업데이트가 허용된 경우에만 제목 업데이트
      if (updateTitle) {
        updateData.title = title;
      }
      // problem_url은 linkProblemToChat 도구에서만 설정하므로 여기서는 건드리지 않음
      if (hints !== undefined) {
        updateData.hints = hints;
      }
      const { data, error } = await supabase
        .from("chat_history")
        .update(updateData)
        .eq("id", chatId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Failed to update chat history:", error);
        return null;
      }
      return data.id;
    } else {
      // 새 채팅 생성
      const insertData: {
        user_id: string;
        messages: string;
        title: string;
        problem_url?: string | null;
        hints?: Hint[] | null;
      } = {
        user_id: userId,
        messages: messagesJson,
        title: title,
      };
      if (problemUrl !== undefined) {
        insertData.problem_url = problemUrl;
      }
      if (hints !== undefined) {
        insertData.hints = hints;
      }
      const { data, error } = await supabase
        .from("chat_history")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Failed to create chat history:", error);
        return null;
      }
      return data.id;
    }
  } catch (error) {
    console.error("Failed to save chat history:", error);
    return null;
  }
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  updated_at: string;
}

export async function getChatHistoryList(): Promise<ChatHistoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return [];
  }
  const userId = claims.sub as string;

  try {
    const { data, error } = await supabase
      .from("chat_history")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to get chat history list:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to get chat history list:", error);
    return [];
  }
}

export async function getChatByProblemUrl(
  problemUrl: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return null;
  }
  const userId = claims.sub as string;

  try {
    const { data, error } = await supabase
      .from("chat_history")
      .select("id")
      .eq("user_id", userId)
      .eq("problem_url", problemUrl)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // 채팅이 없으면 null 반환 (에러가 아닌 정상적인 경우)
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Failed to get chat by problem URL:", error);
      return null;
    }
    return data?.id || null;
  } catch (error) {
    console.error("Failed to get chat by problem URL:", error);
    return null;
  }
}

export async function getChatHistory(
  chatId: string
): Promise<{ messages: Message[]; title: string; problemUrl?: string | null; hints?: Hint[] | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return null;
  }
  const userId = claims.sub as string;

  try {
    const { data, error } = await supabase
      .from("chat_history")
      .select("messages, title, problem_url, hints")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Failed to get chat history:", error);
      return null;
    }

    const messages = JSON.parse(data.messages) as Message[];
    return { messages, title: data.title, problemUrl: data.problem_url, hints: data.hints };
  } catch (error) {
    console.error("Failed to get chat history:", error);
    return null;
  }
}

export async function getChatHints(chatId: string): Promise<Hint[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  const userId = claims.sub as string;

  try {
    const { data, error } = await supabase
      .from("chat_history")
      .select("hints")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Failed to get chat hints:", error);
      return null;
    }
    return data.hints ?? null;
  } catch (error) {
    console.error("Failed to get chat hints:", error);
    return null;
  }
}

export async function deleteChatHistory(chatId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return false;
  }
  const userId = claims.sub as string;

  try {
    // 먼저 해당 채팅이 존재하는지 확인
    const { data: chatData, error: fetchError } = await supabase
      .from("chat_history")
      .select("id, user_id")
      .eq("id", chatId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch chat before deletion:", fetchError);
      return false;
    }

    if (!chatData) {
      console.error("Chat not found:", chatId);
      return false;
    }

    if (chatData.user_id !== userId) {
      console.error("User does not own this chat:", { chatId, userId, chatUserId: chatData.user_id });
      return false;
    }

    // 삭제 실행
    const { error } = await supabase
      .from("chat_history")
      .delete()
      .eq("id", chatId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete chat history:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to delete chat history:", error);
    console.error("Error details:", error instanceof Error ? error.stack : String(error));
    return false;
  }
}

/**
 * Kenkoo API를 사용하여 문제 수집을 시작하는 Server Action
 * 이 방법이 훨씬 빠르고 효율적입니다.
 */
export async function startProblemCollectionFromKenkoo() {
  // 인증 확인
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    console.log("User not authenticated");
    return { success: false, error: "Not authenticated" };
  }

  try {
    const {
      collectAllProblemsFromKenkoo,
      populateContestsFromKenkooAPI,
      populateContestProblemsFromKenkooAPI,
    } = await import("@/lib/atcoder/problems");

    // 1. contests 수집 (먼저 실행)
    console.log("Starting contests collection...");
    const contestsResult = await populateContestsFromKenkooAPI();
    console.log(
      `Contests collection completed: Processed ${contestsResult.processed}, Saved ${contestsResult.saved}`
    );

    // 2. 문제 수집
    console.log("Starting problems collection...");
    const problemResult = await collectAllProblemsFromKenkoo();
    console.log(
      `Problems collection completed: Processed ${problemResult.processed}, Saved ${problemResult.saved}`
    );

    // 3. contest_problems 관계 수집
    console.log("Starting contest_problems collection...");
    const contestProblemResult = await populateContestProblemsFromKenkooAPI();
    console.log(
      `Contest_problems collection completed: Processed ${contestProblemResult.processed}, Saved ${contestProblemResult.saved}`
    );

    return {
      success: true,
      contests: contestsResult,
      problems: problemResult,
      contestProblems: contestProblemResult,
    };
  } catch (error) {
    console.error("Failed to collect problems from Kenkoo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 문제 수집을 시작하는 Server Action (기존 방식 - AtCoder 크롤링)
 * 주의: 이 작업은 매우 오래 걸릴 수 있습니다.
 */
export async function startProblemCollection(
  limit?: number,
  startFrom: number = 0
) {
  // 인증 확인 (관리자만 실행 가능하도록 할 수도 있음)
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    console.log("User not authenticated");
    return { success: false, error: "Not authenticated" };
  }

  try {
    // 동적 import로 문제 수집 함수 가져오기
    const { collectAllProblems } = await import("@/lib/atcoder/problems");
    const result = await collectAllProblems(limit, startFrom);
    return { success: true, ...result };
  } catch (error) {
    console.error("Failed to collect problems:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 토큰 사용량 관련 타입 및 함수
 */
export interface TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  request_count: number;
  hint_count: number;
}

export interface TokenUsageHistory {
  id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model: string;
  created_at: string;
}

/**
 * 이번 달 토큰 사용량 조회
 */
export async function getMonthlyTokenUsage(): Promise<TokenUsage> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      request_count: 0,
      hint_count: 0,
    };
  }

  const userId = claims.sub as string;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  try {
    const [{ data, error }, { data: hintsData }] = await Promise.all([
      supabase
        .from("token_usage")
        .select("input_tokens, output_tokens, total_tokens")
        .eq("user_id", userId)
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("chat_history")
        .select("hints")
        .eq("user_id", userId)
        .gte("created_at", monthStart.toISOString()),
    ]);

    if (error) {
      console.error("Failed to get monthly token usage:", error);
      return {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        request_count: 0,
        hint_count: 0,
      };
    }

    const hint_count = (hintsData || []).reduce(
      (acc, row) => acc + (Array.isArray(row.hints) ? row.hints.length : 0),
      0
    );

    const result = (data || []).reduce(
      (acc, row) => ({
        total_input_tokens: acc.total_input_tokens + (row.input_tokens || 0),
        total_output_tokens: acc.total_output_tokens + (row.output_tokens || 0),
        total_tokens: acc.total_tokens + (row.total_tokens || 0),
        request_count: acc.request_count + 1,
      }),
      {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        request_count: 0,
      }
    );

    return { ...result, hint_count };
  } catch (error) {
    console.error("Failed to get monthly token usage:", error);
    return {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      request_count: 0,
      hint_count: 0,
    };
  }
}

/**
 * 전체 토큰 사용량 조회
 */
export async function getTotalTokenUsage(): Promise<TokenUsage> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      request_count: 0,
      hint_count: 0,
    };
  }

  const userId = claims.sub as string;

  try {
    const [{ data, error }, { data: hintsData }] = await Promise.all([
      supabase
        .from("token_usage")
        .select("input_tokens, output_tokens, total_tokens")
        .eq("user_id", userId),
      supabase
        .from("chat_history")
        .select("hints")
        .eq("user_id", userId),
    ]);

    if (error) {
      console.error("Failed to get total token usage:", error);
      return {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        request_count: 0,
        hint_count: 0,
      };
    }

    const hint_count = (hintsData || []).reduce(
      (acc, row) => acc + (Array.isArray(row.hints) ? row.hints.length : 0),
      0
    );

    const result = (data || []).reduce(
      (acc, row) => ({
        total_input_tokens: acc.total_input_tokens + (row.input_tokens || 0),
        total_output_tokens: acc.total_output_tokens + (row.output_tokens || 0),
        total_tokens: acc.total_tokens + (row.total_tokens || 0),
        request_count: acc.request_count + 1,
      }),
      {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        request_count: 0,
      }
    );

    return { ...result, hint_count };
  } catch (error) {
    console.error("Failed to get total token usage:", error);
    return {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      request_count: 0,
      hint_count: 0,
    };
  }
}

/**
 * 최근 7일간 토큰 사용량 조회
 */
export async function getWeeklyTokenUsage(): Promise<
  { date: string; total_tokens: number; request_count: number }[]
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return [];
  }

  const userId = claims.sub as string;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const { data, error } = await supabase
      .from("token_usage")
      .select("total_tokens, created_at")
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to get weekly token usage:", error);
      return [];
    }

    // 날짜별로 그룹화
    const grouped = (data || []).reduce(
      (acc, row) => {
        const date = new Date(row.created_at).toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = { total_tokens: 0, request_count: 0 };
        }
        acc[date].total_tokens += row.total_tokens || 0;
        acc[date].request_count += 1;
        return acc;
      },
      {} as Record<string, { total_tokens: number; request_count: number }>
    );

    return Object.entries(grouped).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  } catch (error) {
    console.error("Failed to get weekly token usage:", error);
    return [];
  }
}

/**
 * AtCoder 레이팅 히스토리를 가져옵니다.
 */
export interface RatingHistoryEntry {
  ContestScreenName: string;
  ContestName: string;
  NewRating: number;
  OldRating: number;
  Performance: number;
  Increment: number;
  EndTime: string;
  IsRated: boolean;
  Place: number;
}

/**
 * DB에서 레이팅 히스토리를 조회합니다.
 */
export async function getRatingHistory(
  username: string
): Promise<RatingHistoryEntry[]> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("contest_history")
      .select("*")
      .eq("atcoder_handle", username)
      .order("end_time", { ascending: true });

    if (error) {
      console.error("Failed to fetch rating history from DB:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((entry) => ({
      ContestScreenName: entry.contest_screen_name,
      ContestName: entry.contest_name,
      NewRating: entry.new_rating,
      OldRating: entry.old_rating,
      Performance: entry.performance,
      Increment: entry.new_rating - entry.old_rating,
      EndTime: entry.end_time,
      IsRated: true,
      Place: entry.place,
    }));
  } catch (error) {
    console.error("Failed to fetch rating history:", error);
    return [];
  }
}

/**
 * AtCoder API에서 레이팅 히스토리를 가져와 DB에 저장합니다.
 */
export async function refreshRatingHistory(
  username: string
): Promise<{ success: boolean; count: number }> {
  const supabase = await createClient();

  try {
    // AtCoder API에서 히스토리 가져오기
    const response = await fetch(
      `https://atcoder.jp/users/${username}/history/json`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch rating history: ${response.status}`);
    }

    const data = await response.json();

    const entries = data
      .filter((entry: { IsRated: boolean }) => entry.IsRated)
      .map((entry: {
        ContestScreenName: string;
        ContestName: string;
        ContestNameEn: string;
        NewRating: number;
        OldRating: number;
        Performance: number;
        EndTime: string;
        Place: number;
      }) => ({
        atcoder_handle: username,
        contest_screen_name: entry.ContestScreenName,
        contest_name: entry.ContestName || entry.ContestNameEn,
        new_rating: entry.NewRating,
        old_rating: entry.OldRating,
        performance: entry.Performance,
        end_time: entry.EndTime,
        place: entry.Place,
      }));

    if (entries.length === 0) {
      return { success: true, count: 0 };
    }

    const { error } = await supabase
      .from("contest_history")
      .upsert(entries, { onConflict: "atcoder_handle,contest_screen_name" });

    if (error) {
      console.error("Failed to save rating history:", error);
      return { success: false, count: 0 };
    }

    return { success: true, count: entries.length };
  } catch (error) {
    console.error("Failed to refresh rating history:", error);
    return { success: false, count: 0 };
  }
}

/**
 * 모든 사용자의 AtCoder 레이팅을 수집하여 rating_history에 저장합니다.
 * 관리자가 일주일에 한 번 수동으로 실행합니다.
 */
export async function collectAllUserRatings(): Promise<{
  success: boolean;
  processed: number;
  saved: number;
  errors: string[];
}> {
  const supabase = await createClient();

  // 인증 확인
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return { success: false, processed: 0, saved: 0, errors: ["Not authenticated"] };
  }

  // atcoder_handle이 있는 모든 사용자 조회
  const { data: users, error } = await supabase
    .from("user_info")
    .select("id, atcoder_handle, rating")
    .not("atcoder_handle", "is", null);

  if (error || !users) {
    return {
      success: false,
      processed: 0,
      saved: 0,
      errors: [error?.message || "Failed to fetch users"],
    };
  }

  let savedCount = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      // AtCoder API에서 최신 레이팅 조회
      const atcoderUser = await fetchUserInfo(user.atcoder_handle);
      const currentRating = atcoderUser.userRating;

      // user_info 테이블 업데이트
      await supabase
        .from("user_info")
        .update({ rating: currentRating })
        .eq("id", user.id);

      // rating_history에 기록
      const { error: insertError } = await supabase.from("rating_history").insert({
        user_id: user.id,
        atcoder_handle: user.atcoder_handle,
        rating: currentRating,
      });

      if (insertError) {
        errors.push(`Failed to save history for ${user.atcoder_handle}: ${insertError.message}`);
      } else {
        savedCount++;
      }

      // Rate limiting (AtCoder API 보호)
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      errors.push(`Failed for ${user.atcoder_handle}: ${err}`);
    }
  }

  return {
    success: true,
    processed: users.length,
    saved: savedCount,
    errors,
  };
}

/**
 * 아카이브용: 사용자의 문제별 풀이 상태(AC/WA) 맵을 반환합니다.
 * DB에서 직접 조회하며, 데이터가 없으면 빈 맵을 반환합니다.
 */
export async function getProblemStatuses(
  atcoderHandle: string
): Promise<Map<string, 'AC' | 'WA'>> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) return new Map();

  const userId = claims.sub as string;

  const allRows: { problem_id: string; status: string }[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("user_solved_problems")
      .select("problem_id, status")
      .eq("user_id", userId)
      .range(from, to);

    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      hasMore = data.length === pageSize;
      page++;
    }
  }

  const map = new Map<string, 'AC' | 'WA'>();
  for (const row of allRows) {
    // AC가 이미 있으면 WA로 덮어쓰지 않음
    if (!map.has(row.problem_id) || row.status === 'AC') {
      map.set(row.problem_id, row.status as 'AC' | 'WA');
    }
  }

  // DB에 데이터가 없으면 API에서 가져와 저장 후 반환
  if (allRows.length === 0) {
    try {
      const apiProblems = await fetchSolvedProblemsFromAPI(atcoderHandle);
      if (apiProblems.length > 0) {
        // DB에 저장
        const batchSize = 500;
        for (let i = 0; i < apiProblems.length; i += batchSize) {
          const batch = apiProblems.slice(i, i + batchSize).map((p) => ({
            user_id: userId,
            problem_id: p.problem_id,
            contest_id: p.contest_id,
            solved_at: p.solved_at?.toISOString() || null,
            status: p.status,
          }));
          await supabase.from("user_solved_problems").insert(batch);
        }
        for (const p of apiProblems) {
          if (!map.has(p.problem_id) || p.status === 'AC') {
            map.set(p.problem_id, p.status);
          }
        }
      }
    } catch (e) {
      console.error("[getProblemStatuses] Failed to fetch from API:", e);
    }
  }

  return map;
}

/**
 * 연습 세션 관련 타입 및 함수
 */
export interface PracticeSession {
  id: string;
  problem_id: string;
  problem_title: string | null;
  difficulty: number | null;
  time_limit: number;
  elapsed_time: number;
  hints_used: number;
  solved: boolean;
  created_at: string;
}

/**
 * 사용자의 연습 세션 기록을 가져옵니다.
 */
export async function getPracticeSessions(): Promise<PracticeSession[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return [];
  }

  const userId = claims.sub as string;

  try {
    const { data, error } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to get practice sessions:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Failed to get practice sessions:", error);
    return [];
  }
}

/**
 * 연습 세션 통계를 가져옵니다.
 */
export interface PracticeStats {
  totalSessions: number;
  solvedCount: number;
  avgElapsedTime: number;
  avgHintsUsed: number;
}

export async function getPracticeStats(): Promise<PracticeStats> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return {
      totalSessions: 0,
      solvedCount: 0,
      avgElapsedTime: 0,
      avgHintsUsed: 0,
    };
  }

  const userId = claims.sub as string;

  try {
    const { data, error } = await supabase
      .rpc("get_practice_stats", { p_user_id: userId });

    if (error || !data || data.length === 0) {
      return {
        totalSessions: 0,
        solvedCount: 0,
        avgElapsedTime: 0,
        avgHintsUsed: 0,
      };
    }

    const row = data[0];
    return {
      totalSessions: Number(row.total_sessions),
      solvedCount: Number(row.solved_count),
      avgElapsedTime: Number(row.avg_elapsed_time),
      avgHintsUsed: Number(row.avg_hints_used),
    };
  } catch (error) {
    console.error("Failed to get practice stats:", error);
    return {
      totalSessions: 0,
      solvedCount: 0,
      avgElapsedTime: 0,
      avgHintsUsed: 0,
    };
  }
}

export async function getGachaRecommendations(
  userRating: number,
  fromEpoch?: number,
  contestType?: string
): Promise<RecommendedProblem[]> {
  return getRecommendedProblems(userRating, fromEpoch, contestType);
}

export async function updateUserLanguage(language: "ko" | "en" | "ja"): Promise<void> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return;

  await supabase
    .from("user_info")
    .update({ language })
    .eq("id", claims.sub);
}

export async function getUserLanguage(): Promise<"ko" | "en" | "ja" | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return null;

  const { data } = await supabase
    .from("user_info")
    .select("language")
    .eq("id", claims.sub)
    .single();

  return (data?.language as "ko" | "en" | "ja") ?? null;
}
