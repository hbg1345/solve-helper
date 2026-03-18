import { createClient } from "@/lib/supabase/server";

export interface RecommendedProblem {
  id: string;
  title: string;
  difficulty: number | null;
  contest_id: string;
  problem_index: string;
  problem_url: string;
}

/**
 * 레이팅 범위를 정의합니다.
 */
export interface RatingRange {
  min: number;
  max: number;
  label: string;
}

/**
 * 사용자 레이팅을 기반으로 4개의 범위를 생성합니다.
 * 각 범위는 250 단위입니다.
 * 유효하지 않은 범위는 제외하고, 항상 4개 열을 유지하기 위해 오른쪽으로 범위를 추가합니다.
 */
export function getRatingRanges(userRating: number): RatingRange[] {
  const ranges: RatingRange[] = [];

  const min1 = Math.max(0, userRating - 300);
  const max1 = Math.max(0, userRating - 100);
  if (min1 < max1) {
    ranges.push({ min: min1, max: max1, label: "Easy" });
  }

  const min2 = Math.max(0, userRating - 100);
  const max2 = userRating + 100;
  ranges.push({ min: min2, max: max2, label: "Normal" });

  ranges.push({ min: userRating + 100, max: userRating + 300, label: "Hard" });

  ranges.push({ min: userRating + 300, max: userRating + 500, label: "Very Hard" });

  return ranges;
}

/**
 * 특정 레이팅 범위의 문제를 가져옵니다.
 */
async function getProblemsInRange(
  minRating: number,
  maxRating: number,
  count: number,
  isLastRange: boolean = false,
  solvedProblemIds: Set<string> = new Set(),
  fromEpoch?: number
): Promise<RecommendedProblem[]> {
  const supabase = await createClient();

  // 레이팅 범위에 맞는 문제들을 가져옴
  // 각 범위는 독립적으로 처리 (minRating <= difficulty <= maxRating)
  const { data: problems, error: problemsError } = await supabase
    .from("problems")
    .select("id, title, difficulty")
    .not("difficulty", "is", null)
    .gte("difficulty", minRating)
    .lte("difficulty", maxRating)
    .order("difficulty");

  if (problemsError) {
    console.error("Failed to fetch problems:", problemsError);
    return [];
  }

  if (!problems || problems.length === 0) {
    return [];
  }

  // 이미 푼 문제 제외
  let unsolvedProblems = problems.filter((p) => !solvedProblemIds.has(p.id));

  // 날짜 필터: fromEpoch 이후 출제된 콘테스트 문제만
  if (fromEpoch && unsolvedProblems.length > 0) {
    const uniqueContestIds = [...new Set(unsolvedProblems.map((p) => p.id.split("_")[0]))];
    const { data: validContests } = await supabase
      .from("contests")
      .select("id")
      .in("id", uniqueContestIds)
      .gte("start_epoch_second", fromEpoch);
    if (validContests) {
      const validSet = new Set(validContests.map((c) => c.id));
      unsolvedProblems = unsolvedProblems.filter((p) => validSet.has(p.id.split("_")[0]));
    }
  }

  if (unsolvedProblems.length === 0) {
    return [];
  }

  // 랜덤으로 count개 선택
  const shuffled = [...unsolvedProblems].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  
  // 난이도 순서로 오름차순 정렬
  selected.sort((a, b) => {
    const diffA = a.difficulty ?? 0;
    const diffB = b.difficulty ?? 0;
    return diffA - diffB;
  });

  // contest_problems 테이블에서 contest_id와 problem_index 가져오기
  const problemIds = selected.map((p) => p.id);
  const { data: contestProblems, error: cpError } = await supabase
    .from("contest_problems")
    .select("contest_id, problem_id, problem_index")
    .in("problem_id", problemIds);

  if (cpError) {
    console.error("Failed to fetch contest_problems:", cpError);
  }

  // 문제 정보와 contest 정보를 결합
  const contestMap = new Map<string, { contest_id: string; problem_index: string }>();
  if (contestProblems) {
    for (const cp of contestProblems) {
      contestMap.set(cp.problem_id, {
        contest_id: cp.contest_id,
        problem_index: cp.problem_index,
      });
    }
  }

  // 최종 추천 문제 목록 생성
  const recommended: RecommendedProblem[] = selected.map((problem) => {
    const contestInfo = contestMap.get(problem.id);
    const contestId = contestInfo?.contest_id || problem.id.split("_")[0];
    const problemUrl = `https://atcoder.jp/contests/${contestId}/tasks/${problem.id}`;

    return {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      contest_id: contestId,
      problem_index: contestInfo?.problem_index || problem.id.split("_")[1] || "?",
      problem_url: problemUrl,
    };
  });

  return recommended;
}

/**
 * 사용자가 푼 문제 ID 목록을 가져옵니다.
 */
async function getSolvedProblemIds(): Promise<Set<string>> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return new Set();
  }

  const userId = claims.sub as string;

  const { data: solvedProblems, error } = await supabase
    .from("user_solved_problems")
    .select("problem_id")
    .eq("user_id", userId);

  if (error || !solvedProblems) {
    return new Set();
  }

  return new Set(solvedProblems.map((p) => p.problem_id));
}

/**
 * 타로 카드용: 정확히 5개 문제를 랜덤 추출합니다.
 */
export async function getRecommendedProblems(
  userRating: number,
  fromEpoch?: number
): Promise<RecommendedProblem[]> {
  const solvedProblemIds = await getSolvedProblemIds();
  return getProblemsInRange(
    Math.max(0, userRating - 300),
    userRating + 500,
    5,
    false,
    solvedProblemIds,
    fromEpoch
  );
}

/**
 * 사용자 레이팅을 기반으로 문제를 추천합니다.
 * 레이팅 ±500 범위를 250 단위로 나눠서 4개의 열로 구성합니다.
 * 각 범위에서 약 7-8개씩 랜덤으로 선택합니다.
 * 이미 푼 문제는 제외됩니다.
 *
 * @param userRating - 사용자의 AtCoder 레이팅
 * @param problemsPerRange - 각 범위당 문제 개수 (기본값: 8)
 * @returns 범위별로 그룹화된 추천 문제 목록 (키: range.label)
 */
export async function getRecommendedProblemsByRange(
  userRating: number,
  problemsPerRange: number = 8,
  fromEpoch?: number
): Promise<Map<string, { range: RatingRange; problems: RecommendedProblem[] }>> {
  const ranges = getRatingRanges(userRating);
  const result = new Map<string, { range: RatingRange; problems: RecommendedProblem[] }>();

  // 사용자가 푼 문제 목록 가져오기
  const solvedProblemIds = await getSolvedProblemIds();

  // 각 범위별로 병렬로 문제 가져오기
  const promises = ranges.map(async (range, index) => {
    const isLastRange = index === ranges.length - 1;
    const problems = await getProblemsInRange(
      range.min,
      range.max,
      problemsPerRange,
      isLastRange,
      solvedProblemIds,
      fromEpoch
    );
    return { range, problems };
  });

  const results = await Promise.all(promises);

  for (const { range, problems } of results) {
    result.set(range.label, { range, problems });
  }

  return result;
}

