import {
  getCachedProblemsGroupedByContest,
  getProblemsGroupedByContest,
  extractProblemIndex,
  ContestFilter,
} from "@/lib/atcoder/problems";
import { getServerTr } from "@/lib/lang-server";
import { Loader } from "@/components/ai-elements/loader";
import { getSolvedProblems, getProblemStatuses } from "@/app/actions";
import Link from "next/link";
import { ProblemLink } from "@/components/problem-link";
import { RecentProblems } from "@/components/recent-problems";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

/**
 * AtCoder 레이팅 색상 (난이도에 따라)
 */
function getDifficultyColor(difficulty: number | null): {
  bg: string;
  text: string;
  border: string;
} {
  // AtCoder 공식 색상에 맞춤
  if (difficulty === null) {
    return {
      bg: "bg-gray-400 dark:bg-gray-500",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
    };
  }

  // Gray: < 400
  if (difficulty < 400) {
    return {
      bg: "bg-gray-400 dark:bg-gray-500",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
    };
  }
  // Brown: 400-799
  if (difficulty < 800) {
    return {
      bg: "bg-amber-800 dark:bg-amber-700",
      text: "text-amber-800 dark:text-amber-600",
      border: "border-amber-800 dark:border-amber-700",
    };
  }
  // Green: 800-1199
  if (difficulty < 1200) {
    return {
      bg: "bg-green-600 dark:bg-green-500",
      text: "text-green-600 dark:text-green-400",
      border: "border-green-600 dark:border-green-500",
    };
  }
  // Cyan: 1200-1599
  if (difficulty < 1600) {
    return {
      bg: "bg-cyan-500 dark:bg-cyan-400",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-500 dark:border-cyan-400",
    };
  }
  // Blue: 1600-1999
  if (difficulty < 2000) {
    return {
      bg: "bg-blue-700 dark:bg-blue-600",
      text: "text-blue-700 dark:text-blue-500",
      border: "border-blue-700 dark:border-blue-600",
    };
  }
  // Yellow: 2000-2399
  if (difficulty < 2400) {
    return {
      bg: "bg-yellow-400 dark:bg-yellow-300",
      text: "text-yellow-500 dark:text-yellow-300",
      border: "border-yellow-400 dark:border-yellow-300",
    };
  }
  // Orange: 2400-2799
  if (difficulty < 2800) {
    return {
      bg: "bg-orange-500 dark:bg-orange-400",
      text: "text-orange-500 dark:text-orange-400",
      border: "border-orange-500 dark:border-orange-400",
    };
  }
  // Red: 2800-3199
  if (difficulty < 3200) {
    return {
      bg: "bg-red-600 dark:bg-red-500",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-600 dark:border-red-500",
    };
  }
  // 3200+: 첫 글자 검은색/금색, 나머지 빨간색 (별도 처리 필요)
  return {
    bg: "bg-red-600 dark:bg-red-500",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-600 dark:border-red-500",
  };
}

/**
 * 난이도를 바의 채워진 정도로 변환 (0-100%)
 * 난이도 범위: 0 ~ 4000 정도로 가정
 */
function getDifficultyPercentage(difficulty: number | null): number {
  if (difficulty === null) return 0;
  // 최대 난이도를 4000으로 가정 (필요시 조정)
  return Math.min((difficulty / 4000) * 100, 100);
}

async function ProblemsContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; search?: string; hideCompleted?: string }>;
}) {
  // ⚠️ PAGE-LEVEL AUTHENTICATION CHECK
  // Authentication is handled at the page level, NOT in middleware.
  // See lib/supabase/proxy.ts for architecture details.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    redirect("/auth/login");
  }

  const userId = claims.sub as string;

  // 사용자의 atcoder_handle 가져오기
  const { data: userData } = await supabase
    .from("user_info")
    .select("atcoder_handle")
    .eq("id", userId)
    .single();

  const atcoderHandle = userData?.atcoder_handle || null;

  const params = await searchParams;
  const tr = await getServerTr();
  const page = params.page ? parseInt(params.page, 10) : 1;
  const filter = (params.filter as ContestFilter) || "abc";
  const search = params.search || "";
  const hideCompleted = params.hideCompleted === "true";

  // 문제별 풀이 상태 맵 (AC/WA 배지 표시용)
  let problemStatuses = new Map<string, 'AC' | 'WA'>();
  let solvedContestIds = new Set<string>();

  if (atcoderHandle) {
    // 병렬로 상태 맵과 (필요한 경우) 풀이 목록 가져오기
    const [statuses, solvedProblems] = await Promise.all([
      getProblemStatuses(atcoderHandle),
      hideCompleted ? getSolvedProblems(atcoderHandle) : Promise.resolve([]),
    ]);
    problemStatuses = statuses;
    if (hideCompleted) {
      solvedContestIds = new Set(solvedProblems.map((p) => p.contest_id));
    }
  }

  const CONTESTS_PER_PAGE = 30;

  // hideCompleted가 true이면 DB 레벨에서 필터링 (non-cached, 사용자별 쿼리)
  // 그 외엔 캐시된 쿼리 사용
  let problemsByContest: [string, import("@/lib/atcoder/problems").Problem[]][];
  let rawTotalContests: number;

  if (hideCompleted && solvedContestIds.size > 0) {
    const result = await getProblemsGroupedByContest(
      page, CONTESTS_PER_PAGE, filter, search, supabase, solvedContestIds
    );
    problemsByContest = Array.from(result.grouped.entries()) as typeof problemsByContest;
    rawTotalContests = result.totalContests;
  } else {
    const cached = await getCachedProblemsGroupedByContest(page, CONTESTS_PER_PAGE, filter, search);
    problemsByContest = cached.grouped;
    rawTotalContests = cached.totalContests;
  }

  const paginatedContests = problemsByContest;
  const totalContests = rawTotalContests;
  const totalPages = Math.ceil(totalContests / CONTESTS_PER_PAGE);

  // 현재 페이지 문제들 중 최대 열 수 계산
  const maxCols = Math.max(
    1,
    ...paginatedContests.flatMap(([, problems]) =>
      problems.map((p) => {
        const idx = extractProblemIndex(p.id).toUpperCase();
        return idx.charCodeAt(0) - 64; // A=1, B=2, ...
      })
    )
  );
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));

  // URL 생성 헬퍼 함수
  const buildUrl = (
    pageNum: number,
    filterValue: string = filter,
    searchValue: string = search,
    hideCompletedValue: boolean = hideCompleted
  ) => {
    const params = new URLSearchParams();
    params.set("page", pageNum.toString());
    if (filterValue !== "all") {
      params.set("filter", filterValue);
    }
    if (searchValue) {
      params.set("search", searchValue);
    }
    if (hideCompletedValue) {
      params.set("hideCompleted", "true");
    }
    return `/problems?${params.toString()}`;
  };

  // 페이지네이션 컴포넌트
  const Pagination = () => {
    // 현재 페이지 기준 10개 윈도우
    const windowStart = Math.floor((currentPage - 1) / 10) * 10 + 1;
    const windowEnd = Math.min(windowStart + 9, totalPages);
    const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

    return (
      <div className="flex items-center justify-center gap-1">
        {currentPage > 1 && (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {pages.map((pageNum) => (
          <Button
            key={pageNum}
            variant={pageNum === currentPage ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={buildUrl(pageNum)}>{pageNum}</Link>
          </Button>
        ))}
        {currentPage < totalPages && (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildUrl(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    );
  };

  return (
    <>

      {/* Filter & Pagination */}
      <Card className="w-full py-0">
        <CardContent className="py-3 space-y-2">
          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Filter Buttons - Left */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground mr-2">
                {tr.problems.filter}
              </span>
              {[
                { value: "all", label: tr.problems.all },
                { value: "abc", label: "ABC" },
                { value: "arc", label: "ARC" },
                { value: "agc", label: "AGC" },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  variant={filter === value ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link href={buildUrl(1, value)}>{label}</Link>
                </Button>
              ))}
              {/* 구분선 */}
              <div className="h-6 w-px bg-border mx-1" />
              {/* 푼 문제 포함 콘테스트 제외 체크박스 */}
              {atcoderHandle ? (
                <Link
                  href={buildUrl(1, filter, search, !hideCompleted)}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={hideCompleted}
                    className="pointer-events-none"
                  />
                  <span className="text-sm">{tr.problems.excludeSolved}</span>
                </Link>
              ) : (
                <span className="text-xs text-foreground">
                  {tr.problems.loginToFilter}
                </span>
              )}
            </div>
            {/* Search Form - Right */}
            <form action="/problems" method="GET" className="flex gap-2 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  type="text"
                  name="search"
                  placeholder={tr.problems.searchPlaceholder}
                  defaultValue={search}
                  className="pl-9"
                />
              </div>
              {filter !== "all" && (
                <input type="hidden" name="filter" value={filter} />
              )}
              {hideCompleted && (
                <input type="hidden" name="hideCompleted" value="true" />
              )}
              <Button type="submit" variant="secondary" size="icon">
                <Search className="h-4 w-4" />
              </Button>
              {search && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildUrl(1, filter, "")}>초기화</Link>
                </Button>
              )}
            </form>
          </div>
          {/* Search Result Info */}
          {search && (
            <div className="text-sm text-foreground">
              {tr.problems.searchResult(search, totalContests)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problems Table */}
      <Card className="w-full">
        <CardHeader>
          <RecentProblems />
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              <div className="border rounded-lg overflow-hidden">
                {/* Table Header */}
                <div
                  className="gap-0 bg-muted/50 dark:bg-muted/30 border-b border-border"
                  style={{ display: "grid", gridTemplateColumns: `200px repeat(${maxCols}, minmax(120px, 1fr))` }}
                >
                  <div className="p-3 font-semibold text-sm sticky left-0 bg-muted/50 dark:bg-muted/30 z-10 border-r border-border">
                    Contest
                  </div>
                  {Array.from({ length: maxCols }, (_, i) => (
                    <div
                      key={i}
                      className="p-2 text-center text-sm font-medium border-r last:border-r-0 border-border"
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>

                {/* Table Body */}
                <div className="divide-y">
                  {paginatedContests.map(([contestId, problems]) => {
                    // 문제를 인덱스별로 맵핑
                    const problemMap = new Map<string, (typeof problems)[0]>();
                    problems.forEach((p) => {
                      const idx = extractProblemIndex(p.id);
                      problemMap.set(idx.toLowerCase(), p);
                    });

                    // 콘테스트의 최고 난이도 찾기
                    const maxDifficulty = problems.reduce((max, p) => {
                      if (p.difficulty === null) return max;
                      return Math.max(max, p.difficulty);
                    }, 0);
                    const contestColors = getDifficultyColor(maxDifficulty > 0 ? maxDifficulty : null);

                    return (
                      <div
                        key={contestId}
                        className="gap-0 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors border-b border-border last:border-b-0"
                        style={{ display: "grid", gridTemplateColumns: `200px repeat(${maxCols}, minmax(120px, 1fr))` }}
                      >
                        {/* Contest Name */}
                        <div className="p-3 font-medium text-sm sticky left-0 bg-card dark:bg-card border-r border-border z-10">
                          <Link
                            href={`https://atcoder.jp/contests/${contestId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("hover:underline", contestColors.text)}
                          >
                            {contestId}
                          </Link>
                        </div>

                        {/* Problems */}
                        {Array.from({ length: maxCols }, (_, i) => {
                          const letter = String.fromCharCode(65 + i);
                          const problem = problemMap.get(letter.toLowerCase());

                          if (!problem) {
                            return (
                              <div
                                key={i}
                                className="p-2 border-r last:border-r-0 border-border"
                              >
                                <span className="text-foreground/30 text-xs">
                                  -
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={i}
                              className="p-2 border-r last:border-r-0 border-border min-w-[120px]"
                            >
                              <ProblemLink
                                problemId={problem.id}
                                problemTitle={problem.title}
                                problemUrl={`https://atcoder.jp/contests/${contestId}/tasks/${problem.id}`}
                                contestId={contestId}
                                difficulty={problem.difficulty}
                                status={problemStatuses.get(problem.id) ?? null}
                                className="group"
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Difficulty Legend */}
      <Card className="w-full py-0">
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { label: "<400", difficulty: 300 },
              { label: "<800", difficulty: 600 },
              { label: "<1200", difficulty: 1000 },
              { label: "<1600", difficulty: 1400 },
              { label: "<2000", difficulty: 1800 },
              { label: "<2400", difficulty: 2200 },
              { label: "<2800", difficulty: 2600 },
              { label: "<3200", difficulty: 3000 },
              { label: "3200+", difficulty: 3400 },
            ].map(({ label, difficulty }) => {
              const colors = getDifficultyColor(difficulty);
              const isGold = difficulty >= 3200;
              return (
                <span key={label} className={cn("text-sm font-bold", isGold ? "" : colors.text)}>
                  {isGold ? (
                    <>
                      <span className="text-black dark:text-white">3</span>
                      <span className="text-red-600 dark:text-red-400">200+</span>
                    </>
                  ) : label}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Pagination */}
      <Card className="w-full py-0">
        <CardContent className="py-3">
          <Pagination />
        </CardContent>
      </Card>

      {/* Data Source */}
      <p className="text-sm text-foreground/50 w-full text-center pb-2">
        Data provided by{" "}
        <Link
          href="https://kenkoooo.com/atcoder/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Kenkoo API
        </Link>
      </p>
    </>
  );
}

function ProblemsLoading() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-2 w-full">
        <h1 className="text-3xl font-bold tracking-tight">Problems Archive</h1>
        <Loader />
      </div>

      {/* Loading Table */}
      <Card className="w-full">
        <CardHeader>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[600px] bg-muted/30 animate-pulse rounded-lg" />
        </CardContent>
      </Card>

      {/* Loading Legend */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Difficulty Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-24 bg-muted/30 animate-pulse rounded-full"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; search?: string; hideCompleted?: string }>;
}) {
  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-8 items-start">
          <Suspense fallback={<ProblemsLoading />}>
            <ProblemsContent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
