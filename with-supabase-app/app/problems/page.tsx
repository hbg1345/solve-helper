import {
  getCachedProblemsGroupedByContest,
  extractProblemIndex,
  ContestFilter,
} from "@/lib/atcoder/problems";
import { Loader } from "@/components/ai-elements/loader";
import { getSolvedProblems } from "@/app/actions";
import Link from "next/link";
import { ProblemLink } from "@/components/problem-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";

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
  const page = params.page ? parseInt(params.page, 10) : 1;
  const filter = (params.filter as ContestFilter) || "all";
  const search = params.search || "";
  const hideCompleted = params.hideCompleted === "true";

  // 사용자가 푼 문제 ID 목록 가져오기
  let solvedProblemIds = new Set<string>();
  if (hideCompleted && atcoderHandle) {
    const solvedProblems = await getSolvedProblems(atcoderHandle);
    solvedProblemIds = new Set(solvedProblems.map((p) => p.id));
  }

  const CONTESTS_PER_PAGE = 30;
  const { grouped: problemsByContest, totalContests: rawTotalContests } =
    await getCachedProblemsGroupedByContest(page, CONTESTS_PER_PAGE, filter, search);

  // hideCompleted가 true이면 모든 문제를 푼 콘테스트 제외
  let filteredContests = problemsByContest;
  if (hideCompleted && solvedProblemIds.size > 0) {
    filteredContests = filteredContests.filter(([, problems]) => {
      // 푼 문제가 하나도 없는 콘테스트만 포함 (하나라도 풀었으면 제외)
      return problems.every((problem) => !solvedProblemIds.has(problem.id));
    });
  }

  const paginatedContests = filteredContests;
  const totalContests = hideCompleted ? filteredContests.length : rawTotalContests;
  const totalPages = Math.ceil(rawTotalContests / CONTESTS_PER_PAGE);
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
  const Pagination = () => (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div className="text-sm text-foreground">
        페이지 {currentPage} / {totalPages} (총 {totalContests}개 콘테스트)
      </div>
      <div className="flex items-center gap-1">
        {/* 더블 왼쪽 화살표: 10페이지 뒤로 */}
        {currentPage > 10 && (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildUrl(currentPage - 10)}>
              <ChevronsLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {/* 왼쪽 화살표: 1페이지 뒤로 */}
        {currentPage > 1 && (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {/* 페이지 번호들 */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((pageNum) => {
            return (
              pageNum === 1 ||
              pageNum === totalPages ||
              (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
            );
          })
          .map((pageNum, idx, array) => {
            const showEllipsis = idx > 0 && pageNum - array[idx - 1] > 1;
            return (
              <div key={pageNum} className="flex items-center gap-1">
                {showEllipsis && (
                  <span className="px-2 text-foreground">...</span>
                )}
                <Button
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link href={buildUrl(pageNum)}>{pageNum}</Link>
                </Button>
              </div>
            );
          })}
        {/* 오른쪽 화살표: 1페이지 앞으로 */}
        {currentPage < totalPages && (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildUrl(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {/* 더블 오른쪽 화살표: 10페이지 앞으로 */}
        {currentPage < totalPages - 9 && (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildUrl(currentPage + 10)}>
              <ChevronsRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-2 w-full">
        <h1 className="text-3xl font-bold tracking-tight">Problems Archive</h1>
        <p className="text-foreground">
          Data provided by{" "}
          <Link
            href="https://kenkoooo.com/atcoder/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Kenkoo API
          </Link>
        </p>
      </div>

      {/* Filter & Pagination */}
      <Card className="w-full">
        <CardContent className="pt-6 space-y-4">
          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Filter Buttons - Left */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground mr-2">
                필터:
              </span>
              {[
                { value: "all", label: "전체" },
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
                  <span className="text-sm">푼 문제 포함 콘테스트 제외</span>
                </Link>
              ) : (
                <span className="text-xs text-foreground">
                  (AtCoder 연동 시 풀이 필터 가능)
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
                  placeholder="콘테스트 또는 문제 검색"
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
              &quot;{search}&quot; 검색 결과: {totalContests}개 콘테스트
            </div>
          )}
          {/* Pagination */}
          <Pagination />
        </CardContent>
      </Card>

      {/* Problems Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Contests & Problems</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              <div className="border rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[200px_repeat(26,minmax(120px,1fr))] gap-0 bg-muted/50 dark:bg-muted/30 border-b border-border">
                  <div className="p-3 font-semibold text-sm sticky left-0 bg-muted/50 dark:bg-muted/30 z-10 border-r border-border">
                    Contest
                  </div>
                  {Array.from({ length: 26 }, (_, i) => (
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
                        className="grid grid-cols-[200px_repeat(26,minmax(120px,1fr))] gap-0 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors border-b border-border last:border-b-0"
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
                        {Array.from({ length: 26 }, (_, i) => {
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Difficulty Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {[
              { range: "< 400", difficulty: 300, label: "Gray" },
              { range: "400-799", difficulty: 600, label: "Brown" },
              { range: "800-1199", difficulty: 1000, label: "Green" },
              { range: "1200-1599", difficulty: 1400, label: "Cyan" },
              { range: "1600-1999", difficulty: 1800, label: "Blue" },
              { range: "2000-2399", difficulty: 2200, label: "Yellow" },
              { range: "2400-2799", difficulty: 2600, label: "Orange" },
              { range: "2800-3199", difficulty: 3000, label: "Red" },
              { range: "3200+", difficulty: 3400, label: "Gold" },
            ].map(({ range, difficulty, label }) => {
              const colors = getDifficultyColor(difficulty);
              const isGold = difficulty >= 3200;
              return (
                <div key={range} className="flex items-center gap-2">
                  {isGold ? (
                    <span className="text-sm font-medium">
                      <span className="text-black dark:text-white">G</span>
                      <span className="text-red-600 dark:text-red-400">old</span>
                    </span>
                  ) : (
                    <span className={cn("text-sm font-medium", colors.text)}>
                      {label}
                    </span>
                  )}
                  <span className="text-sm text-black dark:text-white">
                    ({range})
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Pagination */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <Pagination />
        </CardContent>
      </Card>
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
          <CardTitle>Contests & Problems</CardTitle>
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
