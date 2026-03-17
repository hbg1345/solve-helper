import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AtCoder Problems API에서 문제 난이도 정보를 가져옵니다.
 * https://kenkoooo.com/atcoder/resources/problem-models.json
 */
interface ProblemModel {
  slope?: number;
  intercept?: number;
  variance?: number;
  difficulty?: number;
  discrimination?: number;
  irt_loglikelihood?: number;
  irt_users?: number;
  is_experimental?: boolean;
}

/**
 * 문제 ID에서 문제 모델 키를 추출합니다.
 * 예: "https://atcoder.jp/contests/abc123/tasks/abc123_a" -> "abc123_a"
 */
function extractProblemId(problemUrl: string): string | null {
  try {
    const match = problemUrl.match(/\/tasks\/([^\/]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Kenkoo API의 문제 정보 인터페이스
 */
interface KenkooProblem {
  id: string;
  contest_id: string;
  problem_index: string;
  name: string;
  title?: string;
}

/**
 * Kenkoo contest-problem.json의 레코드 형식
 */
interface ContestProblem {
  contest_id: string;
  problem_id: string;
  problem_index: string;
}

/**
 * Kenkoo contest.json의 레코드 형식
 */
interface KenkooContest {
  id: string;
  start_epoch_second: number;
  duration_second: number;
  title: string;
  rate_change: string;
}

/**
 * DB에서 문제의 난이도 정보를 가져옵니다.
 */
async function getProblemDifficultyFromDB(
  problemId: string
): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("problems")
      .select("difficulty")
      .eq("id", problemId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.difficulty;
  } catch (error) {
    console.warn(
      `Error fetching difficulty from DB: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return null;
  }
}

/**
 * Kenkoo API에서 모든 문제 모델을 한 번에 가져옵니다.
 * 문제 ID를 키로, ProblemModel을 값으로 가진 Map을 반환합니다.
 */
let problemModelsCache: Map<string, ProblemModel> | null = null;
let problemModelsCacheTime: number = 0;
const PROBLEM_MODELS_CACHE_DURATION = 1000 * 60 * 60; // 1시간 캐시

async function getAllProblemModels(): Promise<Map<string, ProblemModel>> {
  const now = Date.now();

  // 캐시 확인
  if (
    problemModelsCache &&
    now - problemModelsCacheTime < PROBLEM_MODELS_CACHE_DURATION
  ) {
    return problemModelsCache;
  }

  try {
    const response = await fetch(
      "https://kenkoooo.com/atcoder/resources/problem-models.json"
    );

    if (!response.ok) {
      console.warn(`Failed to fetch problem models: HTTP ${response.status}`);
      return new Map();
    }

    const data = await response.json();
    problemModelsCache = new Map(Object.entries(data));
    problemModelsCacheTime = now;

    return problemModelsCache;
  } catch (error) {
    console.warn(
      `Error fetching all problem models: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return new Map();
  }
}

/**
 * AtCoder Problems API에서 문제 난이도 정보를 가져옵니다.
 * DB에 저장되어 있으면 DB에서 가져오고, 없으면 API에서 가져옵니다.
 */
async function getProblemDifficultyFromAPI(
  problemId: string
): Promise<number | null> {
  try {
    // 먼저 DB에서 확인
    const dbDifficulty = await getProblemDifficultyFromDB(problemId);
    if (dbDifficulty !== null) {
      return dbDifficulty;
    }

    // DB에 없으면 API에서 가져오기
    const problemModels = await getAllProblemModels();
    const model = problemModels.get(problemId);

    if (model && model.difficulty !== undefined) {
      return model.difficulty;
    }

    return null;
  } catch (error) {
    console.warn(
      `Error fetching problem difficulty from API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return null;
  }
}

export interface Problem {
  id: string; // Kenkoo problem ID (e.g., "abc138_a")
  title: string;
  difficulty: number | null; // IRT-based difficulty from Kenkoo API
  summary: string | null; // 한줄 요약 (optional)
}

/**
 * 문제 ID에서 콘테스트 ID를 추출합니다
 * 예: "abc138_a" -> "abc138"
 */
export function extractContestId(problemId: string): string {
  const match = problemId.match(/^([^_]+)/);
  return match ? match[1] : problemId;
}

/**
 * 문제 ID에서 문제 인덱스를 추출합니다.
 * 예: "abc138_a" -> "a"
 */
export function extractProblemIndex(problemId: string): string {
  const match = problemId.match(/_([^_]+)$/);
  return match ? match[1] : "";
}

/**
 * 콘테스트 필터 타입
 */
export type ContestFilter = "all" | "abc" | "arc" | "agc";

/**
 * DB에서 콘테스트별로 그룹화된 문제를 가져옵니다.
 * contest_problems 테이블과 problems 테이블을 JOIN하여 효율적으로 조회합니다.
 *
 * @param page - 페이지 번호 (1부터 시작)
 * @param contestsPerPage - 페이지당 콘테스트 수 (기본값: 30)
 * @param filter - 콘테스트 필터 (all, abc, arc, agc)
 * @param search - 검색어 (콘테스트 ID 또는 문제 제목 검색)
 */
export async function getProblemsGroupedByContest(
  page: number = 1,
  contestsPerPage: number = 30,
  filter: ContestFilter = "all",
  search: string = ""
): Promise<{
  grouped: Map<string, Problem[]>;
  totalContests: number;
}> {
  const supabase = await createClient();

  // 필터 패턴 생성
  const getFilterPattern = (f: ContestFilter): string | null => {
    switch (f) {
      case "abc": return "abc%";
      case "arc": return "arc%";
      case "agc": return "agc%";
      default: return null;
    }
  };
  const filterPattern = getFilterPattern(filter);
  const searchLower = search.toLowerCase();

  // 검색어가 있으면 문제 제목으로도 검색하여 해당 콘테스트 ID 수집
  let contestIdsFromTitleSearch: Set<string> | null = null;
  if (search) {
    const { data: matchingProblems } = await supabase
      .from("problems")
      .select("id")
      .ilike("title", `%${search}%`)
      .limit(1000);

    if (matchingProblems && matchingProblems.length > 0) {
      contestIdsFromTitleSearch = new Set(
        matchingProblems.map((p) => extractContestId(p.id))
      );
    }
  }

  // 1. contests 테이블 존재 여부 확인 및 전체 콘테스트 수 가져오기
  // 검색어가 있으면 콘테스트 ID 또는 문제 제목 매칭 콘테스트 모두 포함
  let totalContests = 0;

  if (search && contestIdsFromTitleSearch && contestIdsFromTitleSearch.size > 0) {
    // 문제 제목 매칭 콘테스트 + 콘테스트 ID 매칭 모두 가져오기
    const allMatchingContestIds = Array.from(contestIdsFromTitleSearch);

    // 콘테스트 ID로 직접 매칭되는 것도 추가
    let contestIdQuery = supabase
      .from("contests")
      .select("id")
      .ilike("id", `%${searchLower}%`);

    if (filterPattern) {
      contestIdQuery = contestIdQuery.ilike("id", filterPattern);
    }

    const { data: contestIdMatches } = await contestIdQuery;
    if (contestIdMatches) {
      contestIdMatches.forEach((c) => allMatchingContestIds.push(c.id));
    }

    // 중복 제거
    const uniqueContestIds = [...new Set(allMatchingContestIds)];

    // 필터 적용
    let filteredIds = uniqueContestIds;
    if (filterPattern) {
      const filterPrefix = filter; // abc, arc, agc
      filteredIds = uniqueContestIds.filter((id) => id.startsWith(filterPrefix));
    }

    totalContests = filteredIds.length;

    if (totalContests === 0) {
      return { grouped: new Map(), totalContests: 0 };
    }

    // 페이지네이션을 위해 해당 콘테스트들을 날짜순으로 정렬해서 가져오기
    const { data: sortedContests, error: sortError } = await supabase
      .from("contests")
      .select("id")
      .in("id", filteredIds)
      .order("start_epoch_second", { ascending: false });

    if (sortError || !sortedContests) {
      const fallbackResult = await getProblemsGroupedByContestFallback(filter, search);
      return {
        grouped: fallbackResult,
        totalContests: fallbackResult.size,
      };
    }

    const startIndex = (page - 1) * contestsPerPage;
    const paginatedContestIds = sortedContests
      .slice(startIndex, startIndex + contestsPerPage)
      .map((c) => c.id);

    if (paginatedContestIds.length === 0) {
      return { grouped: new Map(), totalContests };
    }

    // 나머지 로직으로 진행
    return fetchContestProblems(supabase, paginatedContestIds, totalContests, filter, search);
  }

  // 검색어가 없거나 문제 제목 매칭이 없는 경우 기존 로직
  let countQuery = supabase
    .from("contests")
    .select("*", { count: "exact", head: true });

  if (filterPattern) {
    countQuery = countQuery.ilike("id", filterPattern);
  }
  if (search) {
    countQuery = countQuery.ilike("id", `%${searchLower}%`);
  }

  const { count, error: countError } = await countQuery;
  totalContests = count || 0;

  // contests 테이블이 없거나 에러가 발생하면 fallback 사용
  if (countError) {
    console.warn(
      "contests table not found or error occurred, using fallback:",
      countError
    );
    const fallbackResult = await getProblemsGroupedByContestFallback(filter, search);
    return {
      grouped: fallbackResult,
      totalContests: fallbackResult.size,
    };
  }

  // contests 테이블이 비어있으면 fallback 사용
  if (totalContests === 0) {
    console.warn("contests table is empty, using fallback");
    const fallbackResult = await getProblemsGroupedByContestFallback(filter, search);
    return {
      grouped: fallbackResult,
      totalContests: fallbackResult.size,
    };
  }

  // 2. 페이지네이션: contests 테이블에서 날짜 기준 내림차순으로 가져오기
  const startIndex = (page - 1) * contestsPerPage;
  const endIndex = startIndex + contestsPerPage - 1;

  let contestsQuery = supabase
    .from("contests")
    .select("id")
    .order("start_epoch_second", { ascending: false });

  if (filterPattern) {
    contestsQuery = contestsQuery.ilike("id", filterPattern);
  }
  if (search) {
    contestsQuery = contestsQuery.ilike("id", `%${searchLower}%`);
  }

  const { data: contests, error: contestsError } = await contestsQuery.range(startIndex, endIndex);

  if (contestsError) {
    console.error("Failed to fetch contests:", contestsError);
    const fallbackResult = await getProblemsGroupedByContestFallback(filter, search);
    return {
      grouped: fallbackResult,
      totalContests: fallbackResult.size,
    };
  }

  if (!contests || contests.length === 0) {
    console.warn("No contests found for this page, returning empty result");
    return { grouped: new Map(), totalContests: totalContests || 0 };
  }

  const paginatedContestIds = contests.map((c) => c.id);
  return fetchContestProblems(supabase, paginatedContestIds, totalContests, filter, search);
}

/**
 * 콘테스트 ID 목록으로 문제들을 가져와 그룹화합니다.
 */
async function fetchContestProblems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paginatedContestIds: string[],
  totalContests: number,
  filter: ContestFilter,
  search: string
): Promise<{
  grouped: Map<string, Problem[]>;
  totalContests: number;
}> {
  // 해당 콘테스트들의 contest_problems 가져오기
  const { data: contestProblems, error: cpError } = await supabase
    .from("contest_problems")
    .select("contest_id, problem_index, problem_id")
    .in("contest_id", paginatedContestIds)
    .order("contest_id")
    .order("problem_index");

  if (cpError || !contestProblems || contestProblems.length === 0) {
    console.error("Failed to fetch contest_problems:", cpError);
    // Fallback 사용
    const fallbackResult = await getProblemsGroupedByContestFallback(filter, search);
    return {
      grouped: fallbackResult,
      totalContests: fallbackResult.size,
    };
  }

  // 4. 문제 ID 목록 추출
  const problemIds = Array.from(
    new Set(contestProblems.map((cp) => cp.problem_id))
  );

  // 5. problems 테이블에서 문제 정보 가져오기 (배치로 처리)
  const BATCH_SIZE = 1000;
  const allProblems: Problem[] = [];

  for (let i = 0; i < problemIds.length; i += BATCH_SIZE) {
    const batchIds = problemIds.slice(i, i + BATCH_SIZE);
    const { data: problemsData, error: problemsError } = await supabase
      .from("problems")
      .select("id, title, difficulty, summary")
      .in("id", batchIds);

    if (problemsError) {
      console.error(
        `Failed to fetch problems batch ${i / BATCH_SIZE + 1}:`,
        problemsError
      );
      continue;
    }

    if (problemsData) {
      allProblems.push(...problemsData);
    }
  }

  // 6. 문제를 ID로 맵핑
  const problemMap = new Map<string, Problem>();
  for (const problem of allProblems) {
    problemMap.set(problem.id, problem);
  }

  // 7. 콘테스트별로 그룹화 (날짜 순서 유지)
  const grouped = new Map<string, Problem[]>();
  // paginatedContestIds 순서대로 그룹 초기화 (날짜 내림차순)
  for (const contestId of paginatedContestIds) {
    grouped.set(contestId, []);
  }

  // contest_problems를 순회하며 문제 추가
  for (const cp of contestProblems) {
    const problem = problemMap.get(cp.problem_id);
    if (!problem) continue; // 문제가 없으면 스킵

    if (grouped.has(cp.contest_id)) {
      grouped.get(cp.contest_id)!.push(problem);
    }
  }

  return {
    grouped,
    totalContests: totalContests || 0,
  };
}

/**
 * Fallback: contest_problems 테이블이 없을 때 사용하는 기존 방식
 */
async function getProblemsGroupedByContestFallback(
  filter: ContestFilter = "all",
  search: string = ""
): Promise<Map<string, Problem[]>> {
  const supabase = await createClient();

  // 필터 패턴 생성
  const getFilterPrefix = (f: ContestFilter): string | null => {
    switch (f) {
      case "abc": return "abc";
      case "arc": return "arc";
      case "agc": return "agc";
      default: return null;
    }
  };
  const filterPrefix = getFilterPrefix(filter);
  const searchLower = search.toLowerCase();

  // Supabase는 기본적으로 1000개 제한이 있으므로, 모든 데이터를 가져오기 위해 반복적으로 fetch
  let allProblems: Problem[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("problems")
      .select("id, title, difficulty, summary")
      .order("id")
      .range(from, from + pageSize - 1);

    // 필터 적용
    if (filterPrefix) {
      query = query.ilike("id", `${filterPrefix}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch problems:", error);
      break;
    }

    if (data && data.length > 0) {
      allProblems = allProblems.concat(data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // 콘테스트별로 그룹화
  const grouped = new Map<string, Problem[]>();
  for (const problem of allProblems) {
    const contestId = extractContestId(problem.id);

    // 검색 필터 적용 (콘테스트 ID 또는 문제 제목)
    if (searchLower) {
      const matchesContestId = contestId.toLowerCase().includes(searchLower);
      const matchesTitle = problem.title?.toLowerCase().includes(searchLower) || false;
      if (!matchesContestId && !matchesTitle) {
        continue;
      }
    }

    if (!grouped.has(contestId)) {
      grouped.set(contestId, []);
    }
    grouped.get(contestId)!.push(problem);
  }

  // 각 콘테스트의 문제들을 인덱스 순서대로 정렬
  for (const [, problems] of grouped.entries()) {
    problems.sort((a, b) => {
      const indexA = extractProblemIndex(a.id);
      const indexB = extractProblemIndex(b.id);
      return indexA.localeCompare(indexB);
    });
  }

  return grouped;
}

/**
 * Supabase problems 테이블 스키마 (Kenkoo 기반):
 *
 * CREATE TABLE problems (
 *   id TEXT PRIMARY KEY, -- Kenkoo problem ID (e.g., "abc138_a")
 *   title TEXT NOT NULL,
 *   difficulty INTEGER, -- IRT-based difficulty from Kenkoo API (null 가능)
 *   summary TEXT, -- 한줄 요약 (optional)
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_problems_difficulty ON problems(difficulty);
 * CREATE INDEX idx_problems_id ON problems(id);
 */

/**
 * 아카이브 페이지에서 콘테스트 링크를 가져옵니다.
 *
 * @param limit - 필요한 최대 콘테스트 수 (지정하면 해당 수만큼만 수집)
 * @param startFrom - 시작할 콘테스트 인덱스 (재개용)
 */
export async function getAllContestLinks(
  limit?: number,
  startFrom: number = 0
): Promise<string[]> {
  const contestLinks: string[] = [];
  let page = 1;
  let hasMore = true;
  const neededCount = limit ? startFrom + limit : Infinity;

  while (hasMore && contestLinks.length < neededCount) {
    try {
      const url =
        page === 1
          ? "https://atcoder.jp/contests/archive"
          : `https://atcoder.jp/contests/archive?page=${page}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          `Failed to fetch archive page ${page}: HTTP ${response.status}`
        );
        break;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 테이블에서 콘테스트 링크 추출
      const rows = $(
        "#main-container > div.row > div.col-lg-9.col-md-8 > div.panel.panel-default > div > table > tbody > tr"
      );

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      rows.each((_, element) => {
        // 필요한 만큼만 수집
        if (contestLinks.length >= neededCount) {
          return false; // break
        }

        const linkElement = $(element).find("td:nth-child(2) > a");
        const href = linkElement.attr("href");
        if (href) {
          const fullUrl = href.startsWith("http")
            ? href
            : `https://atcoder.jp${href}`;
          contestLinks.push(fullUrl);
        }
      });

      console.log(
        `Page ${page}: Found ${rows.length} contests (Total: ${contestLinks.length})`
      );

      // 필요한 만큼 수집했으면 중단
      if (contestLinks.length >= neededCount) {
        console.log(`Collected ${contestLinks.length} contests, stopping...`);
        break;
      }

      // rows가 없으면 더 이상 페이지가 없음
      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      // 다음 페이지로 이동
      page++;
      // Rate limiting을 위한 지연
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMore = false;
    }
  }

  // startFrom 이후의 링크만 반환
  return contestLinks.slice(startFrom);
}

/**
 * 콘테스트의 모든 문제 링크를 가져옵니다.
 */
export async function getContestProblems(
  contestUrl: string
): Promise<string[]> {
  try {
    const tasksUrl = `${contestUrl}/tasks`;
    const response = await fetch(tasksUrl);

    if (!response.ok) {
      console.error(
        `Failed to fetch tasks for ${contestUrl}: HTTP ${response.status}`
      );
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const problemLinks: string[] = [];
    const taskElements = $("table.table-bordered.table-striped tbody").find(
      "tr"
    );

    taskElements.each((_, element) => {
      const href = $(element).find("td").find("a").attr("href");
      if (href) {
        const fullUrl = href.startsWith("http")
          ? href
          : `https://atcoder.jp${href}`;
        problemLinks.push(fullUrl);
      }
    });

    return problemLinks;
  } catch (error) {
    console.error(`Error fetching problems for ${contestUrl}:`, error);
    return [];
  }
}

/**
 * 문제 페이지에서 제목과 한줄 요약을 가져옵니다.
 */
export async function getProblemInfo(
  problemUrl: string
): Promise<{ title: string; summary: string } | null> {
  try {
    const response = await fetch(problemUrl);

    if (!response.ok) {
      console.error(
        `Failed to fetch problem ${problemUrl}: HTTP ${response.status}`
      );
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 제목 추출
    const title = $("span.h2").contents().first().text().trim();

    // 한줄 요약 추출 (문제 설명의 첫 부분)
    const langEn = $("#task-statement > span > span.lang-en");
    const problemStatement = langEn
      .find("div:nth-child(2) > section")
      .text()
      .trim();
    const summary = problemStatement.substring(0, 200).replace(/\s+/g, " "); // 첫 200자, 공백 정리

    if (!title) {
      return null;
    }

    return { title, summary: summary || "No summary available" };
  } catch (error) {
    console.error(`Error fetching problem info for ${problemUrl}:`, error);
    return null;
  }
}

/**
 * 문제를 DB에 저장합니다.
 */
export async function saveProblemToDB(problem: Problem): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("problems").upsert(
      {
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        summary: problem.summary,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error("Failed to save problem to DB:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving problem to DB:", error);
    return false;
  }
}

/**
 * Kenkoo API를 사용하여 모든 문제를 수집하고 DB에 저장합니다.
 * 이 함수는 Kenkoo의 problems.json과 problem-models.json을 사용하여
 * 빠르게 초기 테이블을 채웁니다.
 */
export async function collectAllProblemsFromKenkoo(supabaseClient?: SupabaseClient): Promise<{
  processed: number;
  saved: number;
}> {
  console.log("Starting problem collection from Kenkoo API...");

  let savedCount = 0;
  let processedCount = 0;

  try {
    // 1. Kenkoo problems.json에서 모든 문제 정보 가져오기
    console.log("Fetching problems from Kenkoo API...");
    const problemsResponse = await fetch(
      "https://kenkoooo.com/atcoder/resources/problems.json"
    );

    if (!problemsResponse.ok) {
      throw new Error(
        `Failed to fetch problems.json: HTTP ${problemsResponse.status}`
      );
    }

    const problems: KenkooProblem[] = await problemsResponse.json();
    console.log(`Found ${problems.length} problems in Kenkoo API`);

    // 2. Kenkoo problem-models.json에서 난이도 정보 가져오기
    console.log("Fetching problem models from Kenkoo API...");
    const problemModels = await getAllProblemModels();
    console.log(`Found ${problemModels.size} problem models`);

    // 3. 모든 문제를 메모리에 준비 (배치 처리용)
    const problemsToSave: Array<{
      id: string;
      title: string;
      difficulty: number | null;
      summary: string | null;
      updated_at: string;
    }> = [];

    for (let i = 0; i < problems.length; i++) {
      const kenkooProblem = problems[i];
      processedCount++;

      try {
        // 난이도 정보 가져오기
        const model = problemModels.get(kenkooProblem.id);
        const difficulty =
          model && model.difficulty !== undefined ? model.difficulty : null;

        // 문제 정보 구성
        problemsToSave.push({
          id: kenkooProblem.id,
          title: kenkooProblem.name || kenkooProblem.title || kenkooProblem.id,
          difficulty,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn(
          `Failed to process problem ${kenkooProblem.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    console.log(`Prepared ${problemsToSave.length} problems for batch insert`);

    // 4. 한 번에 DB에 저장
    try {
      const supabase = supabaseClient ?? await createClient();
      const { error } = await supabase.from("problems").upsert(problemsToSave, {
        onConflict: "id",
      });

      if (error) {
        console.error("Failed to save problems to DB:", error);
        throw error;
      } else {
        savedCount = problemsToSave.length;
        console.log(`  Saved ${savedCount} problems to DB`);
      }
    } catch (error) {
      console.error(
        `Error saving problems: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }

    console.log(
      `Problem collection completed! Processed ${processedCount} problems, saved ${savedCount} problems.`
    );
    return { processed: processedCount, saved: savedCount };
  } catch (error) {
    console.error("Error collecting problems from Kenkoo:", error);
    throw error;
  }
}

/**
 * Kenkoo contest.json을 사용하여 contests 테이블을 채웁니다.
 */
export async function populateContestsFromKenkooAPI(supabaseClient?: SupabaseClient): Promise<{
  processed: number;
  saved: number;
}> {
  console.log("Starting contests population from Kenkoo API...");
  let processedCount = 0;
  let savedCount = 0;

  try {
    // Kenkoo contest.json 가져오기
    const response = await fetch(
      "https://kenkoooo.com/atcoder/resources/contests.json"
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch contests.json: HTTP ${response.status}`);
    }

    const contests: KenkooContest[] = await response.json();
    console.log(`Fetched ${contests.length} contests from Kenkoo API`);

    // DB에 저장할 데이터 준비
    const recordsToInsert = contests.map((contest) => ({
      id: contest.id,
      start_epoch_second: contest.start_epoch_second,
      duration_second: contest.duration_second,
      title: contest.title,
      rate_change: contest.rate_change,
    }));

    // 배치로 DB에 저장 (1000개씩)
    const BATCH_SIZE = 1000;
    const supabase = supabaseClient ?? await createClient();
    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);

      try {
        const { error } = await supabase.from("contests").upsert(batch, {
          onConflict: "id",
        });

        if (error) {
          console.error(`Failed to save batch ${i / BATCH_SIZE + 1}:`, error);
        } else {
          savedCount += batch.length;
          processedCount += batch.length;
          if (savedCount % 5000 === 0) {
            console.log(`  Saved ${savedCount} contests...`);
          }
        }
      } catch (error) {
        console.error(
          `Error saving batch ${i / BATCH_SIZE + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    console.log(
      `Contest population completed! Processed ${processedCount} contests, saved ${savedCount} contests.`
    );
    return { processed: processedCount, saved: savedCount };
  } catch (error) {
    console.error("Error populating contests from Kenkoo:", error);
    throw error;
  }
}

/**
 * Kenkoo contest-problem.json을 사용하여 contest_problems 테이블을 채웁니다.
 */
export async function populateContestProblemsFromKenkooAPI(supabaseClient?: SupabaseClient): Promise<{
  processed: number;
  saved: number;
}> {
  console.log("Starting contest_problems population from Kenkoo API...");
  let processedCount = 0;
  let savedCount = 0;

  try {
    // Kenkoo contest-problem.json 가져오기
    const response = await fetch(
      "https://kenkoooo.com/atcoder/resources/contest-problem.json"
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch contest-problem.json: HTTP ${response.status}`
      );
    }

    const contestProblems: ContestProblem[] = await response.json();
    console.log(
      `Fetched ${contestProblems.length} contest-problem relationships from Kenkoo API`
    );

    // DB에 존재하는 문제 ID 목록 가져오기 (Foreign Key 제약 조건을 만족시키기 위해)
    const supabase = supabaseClient ?? await createClient();
    const existingProblemIds = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log("Fetching existing problem IDs from DB...");
    while (hasMore) {
      const { data, error } = await supabase
        .from("problems")
        .select("id")
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Failed to fetch problem IDs:", error);
        break;
      }

      if (data && data.length > 0) {
        data.forEach((p) => existingProblemIds.add(p.id));
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    console.log(`Found ${existingProblemIds.size} existing problems in DB`);

    // 존재하는 문제만 필터링
    const validContestProblems = contestProblems.filter((cp) =>
      existingProblemIds.has(cp.problem_id)
    );
    console.log(
      `Filtered to ${validContestProblems.length} valid relationships (out of ${contestProblems.length})`
    );

    // 배치로 DB에 저장 (1000개씩)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < validContestProblems.length; i += BATCH_SIZE) {
      const batch = validContestProblems.slice(i, i + BATCH_SIZE);
      const recordsToInsert = batch.map((cp) => ({
        contest_id: cp.contest_id,
        problem_id: cp.problem_id,
        problem_index: cp.problem_index,
      }));

      try {
        const { error } = await supabase
          .from("contest_problems")
          .upsert(recordsToInsert, {
            onConflict: "contest_id,problem_id",
          });

        if (error) {
          console.error(`Failed to save batch ${i / BATCH_SIZE + 1}:`, error);
        } else {
          savedCount += batch.length;
          processedCount += batch.length;
          if (savedCount % 5000 === 0) {
            console.log(
              `  Saved ${savedCount} contest-problem relationships...`
            );
          }
        }
      } catch (error) {
        console.error(
          `Error saving batch ${i / BATCH_SIZE + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    console.log(
      `Contest-problem population completed! Processed ${processedCount} relationships, saved ${savedCount} relationships.`
    );
    return { processed: processedCount, saved: savedCount };
  } catch (error) {
    console.error("Error populating contest_problems from Kenkoo:", error);
    throw error;
  }
}

/**
 * 모든 문제를 수집하고 DB에 저장하는 메인 함수입니다 (기존 방식 - AtCoder 크롤링).
 * 주의: 이 함수는 매우 오래 걸릴 수 있습니다 (수천 개의 콘테스트 처리).
 *
 * @param limit - 처리할 최대 콘테스트 수 (테스트용)
 * @param startFrom - 시작할 콘테스트 인덱스 (재개용)
 */
export async function collectAllProblems(
  limit?: number,
  startFrom: number = 0
): Promise<{ processed: number; saved: number }> {
  console.log("Starting problem collection...");

  let savedCount = 0;

  // 1. 필요한 만큼만 콘테스트 링크 가져오기
  console.log(
    `Fetching contest links... (limit: ${
      limit || "all"
    }, startFrom: ${startFrom})`
  );
  const contestLinks = await getAllContestLinks(limit, startFrom);
  console.log(`Found ${contestLinks.length} contests to process`);

  // 2. 각 콘테스트에 대해 처리
  for (let i = 0; i < contestLinks.length; i++) {
    const contestUrl = contestLinks[i];
    const globalIndex = startFrom + i;
    console.log(
      `Processing contest ${i + 1}/${contestLinks.length} (global: ${
        globalIndex + 1
      }): ${contestUrl}`
    );

    try {
      // 2-1. 콘테스트의 문제 링크 가져오기
      const problemLinks = await getContestProblems(contestUrl);
      console.log(`  Found ${problemLinks.length} problems`);

      if (problemLinks.length === 0) {
        console.log(`  Skipping contest with no problems`);
        continue;
      }

      // 2-2. 각 문제 처리 및 difficulty 계산
      // AtCoder Problems API를 사용하여 난이도 정보 가져오기
      for (let i = 0; i < problemLinks.length; i++) {
        const problemLink = problemLinks[i];
        const problemInfo = await getProblemInfo(problemLink);

        if (problemInfo) {
          // 문제 ID 추출
          const problemId = extractProblemId(problemLink);
          if (!problemId) {
            console.warn(
              `    Could not extract problem ID from ${problemLink}`
            );
            continue;
          }

          // API에서 난이도 정보 가져오기
          let difficulty: number | null = null;
          try {
            difficulty = await getProblemDifficultyFromAPI(problemId);
            if (difficulty !== null) {
              console.log(
                `    Problem ${i + 1} (${
                  problemInfo.title
                }): difficulty ${difficulty} (from API)`
              );
            } else {
              console.log(
                `    Problem ${i + 1} (${
                  problemInfo.title
                }): difficulty not available in API`
              );
            }
          } catch (error) {
            console.warn(
              `    Failed to get difficulty from API for ${
                problemInfo.title
              }: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }

          const problem: Problem = {
            id: problemId,
            title: problemInfo.title,
            difficulty,
            summary: problemInfo.summary,
          };

          const saved = await saveProblemToDB(problem);
          if (saved) {
            savedCount++;
            console.log(`    ✓ Saved: ${problemInfo.title}`);
          } else {
            console.log(`    ✗ Failed to save: ${problemInfo.title}`);
          }
        }

        // Rate limiting (최소화)
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Rate limiting between contests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing contest ${contestUrl}:`, error);
    }
  }

  console.log(
    `Problem collection completed! Processed ${contestLinks.length} contests, saved ${savedCount} problems.`
  );
  return { processed: contestLinks.length, saved: savedCount };
}
