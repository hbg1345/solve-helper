import {
  getRecommendedProblemsByRange,
  getRatingRanges,
} from "@/lib/atcoder/recommendations";
import { getServerTr } from "@/lib/lang-server";
import { ProblemLink } from "@/components/problem-link";
import { Loader } from "@/components/ai-elements/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { OngoingSessionCard } from "@/components/ongoing-session-card";
import { PracticeHistory } from "@/components/practice-history";
import { getPracticeSessions, getPracticeStats } from "@/app/actions";

/**
 * AtCoder 레이팅 색상 (난이도에 따라)
 */
function getDifficultyColor(difficulty: number | null): {
  bg: string;
  text: string;
  border: string;
} {
  if (difficulty === null) {
    return {
      bg: "bg-gray-400 dark:bg-gray-500",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
    };
  }

  if (difficulty < 400) {
    return {
      bg: "bg-gray-400 dark:bg-gray-500",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
    };
  }
  if (difficulty < 800) {
    return {
      bg: "bg-amber-800 dark:bg-amber-700",
      text: "text-amber-800 dark:text-amber-600",
      border: "border-amber-800 dark:border-amber-700",
    };
  }
  if (difficulty < 1200) {
    return {
      bg: "bg-green-600 dark:bg-green-500",
      text: "text-green-600 dark:text-green-400",
      border: "border-green-600 dark:border-green-500",
    };
  }
  if (difficulty < 1600) {
    return {
      bg: "bg-cyan-500 dark:bg-cyan-400",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-500 dark:border-cyan-400",
    };
  }
  if (difficulty < 2000) {
    return {
      bg: "bg-blue-700 dark:bg-blue-600",
      text: "text-blue-700 dark:text-blue-500",
      border: "border-blue-700 dark:border-blue-600",
    };
  }
  if (difficulty < 2400) {
    return {
      bg: "bg-yellow-400 dark:bg-yellow-300",
      text: "text-yellow-500 dark:text-yellow-300",
      border: "border-yellow-400 dark:border-yellow-300",
    };
  }
  if (difficulty < 2800) {
    return {
      bg: "bg-orange-500 dark:bg-orange-400",
      text: "text-orange-500 dark:text-orange-400",
      border: "border-orange-500 dark:border-orange-400",
    };
  }
  if (difficulty < 3200) {
    return {
      bg: "bg-red-600 dark:bg-red-500",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-600 dark:border-red-500",
    };
  }
  return {
    bg: "bg-red-600 dark:bg-red-500",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-600 dark:border-red-500",
  };
}

function formatDifficulty(difficulty: number | null): string {
  if (difficulty === null) return "N/A";
  return difficulty.toLocaleString();
}

function getSolveProbability(userRating: number, difficulty: number | null): number | null {
  if (difficulty === null) return null;
  return 1 / (1 + Math.pow(6, (difficulty - userRating) / 400));
}

async function PracticeContent({
  searchParams,
}: {
  searchParams: Promise<{ fromYear?: string; fromMonth?: string }>;
}) {
  const params = await searchParams;
  const tr = await getServerTr();
  const fromYear = params.fromYear ? parseInt(params.fromYear) : null;
  const fromMonth = params.fromMonth ? parseInt(params.fromMonth) : null;
  const fromEpoch =
    fromYear != null
      ? Math.floor(new Date(fromYear, (fromMonth ?? 1) - 1, 1).getTime() / 1000)
      : undefined;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    redirect("/auth/login");
  }

  const userId = claims.sub as string;
  const { data: userData, error: userError } = await supabase
    .from("user_info")
    .select("rating, atcoder_handle")
    .eq("id", userId)
    .single();

  if (userError || !userData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{tr.practice.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground">
            {tr.practice.noHandle}{" "}
            <Link href="/profile" className="text-primary hover:underline">
              {tr.practice.profilePage}
            </Link>
            {tr.practice.linkHere}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (userData.rating === null) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{tr.practice.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground">
            {tr.practice.noRating}{" "}
            <Link href="/profile" className="text-primary hover:underline">
              {tr.practice.profilePage}
            </Link>
            {tr.practice.linkHere}
          </p>
        </CardContent>
      </Card>
    );
  }

  // 추천 문제와 연습 기록을 병렬로 가져오기
  const [recommendedByRange, practiceSessions, practiceStats] = await Promise.all([
    getRecommendedProblemsByRange(userData.rating, 5, fromEpoch),
    getPracticeSessions(50),
    getPracticeStats(),
  ]);

  const ranges = getRatingRanges(userData.rating);

  const totalProblems = Array.from(recommendedByRange.values()).reduce(
    (sum, { problems }) => sum + problems.length,
    0
  );

  if (totalProblems === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{tr.practice.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground">
            {tr.practice.noProblems(userData.rating)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* 진행 중인 도전 세션 */}
      <OngoingSessionCard />

      {/* 날짜 필터 */}
      <Card className="w-full py-0">
        <CardContent className="py-3">
          <form action="/practice" method="GET" className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium shrink-0">{tr.practice.period}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                name="fromYear"
                placeholder={tr.practice.yearPlaceholder}
                defaultValue={fromYear ?? ""}
                min={2010}
                max={new Date().getFullYear()}
                className="w-20 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {tr.practice.yearSuffix && <span className="text-sm">{tr.practice.yearSuffix}</span>}
              <select
                name="fromMonth"
                defaultValue={fromMonth ?? ""}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{tr.practice.allMonths}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}{tr.practice.month}</option>
                ))}
              </select>
              <span className="text-sm">{tr.practice.after}</span>
            </div>
            <Button type="submit" size="sm" variant="secondary">{tr.practice.apply}</Button>
            {fromYear && (
              <Button asChild size="sm" variant="outline">
                <Link href="/practice">{tr.practice.reset}</Link>
              </Button>
            )}
            {fromYear && (
              <span className="text-xs text-muted-foreground">
                {tr.practice.afterPeriod(fromYear, fromMonth ?? 1)}
              </span>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Recommended Problems Grid */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>{tr.practice.recommended(totalProblems)}</CardTitle>
              <span className="text-xs font-medium text-black dark:text-white">{tr.practice.solveProb}</span>
            </div>
            <Button asChild variant="ghost" size="icon" className="h-7 w-7">
              <Link href="/practice">
                <RefreshCw className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ranges.map((range, rangeIndex) => {
              const rangeData = recommendedByRange.get(range.label);
              const problems = rangeData?.problems || [];

              return (
                <div key={rangeIndex} className="flex flex-col">
                  <div className="mb-3 pb-2 border-b">
                    <h3 className="text-sm font-semibold">{range.label}</h3>
                  </div>
                  <div className="space-y-2 flex-1">
                    {problems.length === 0 ? (
                      <p className="text-sm text-black dark:text-white">
                        {tr.practice.noProblemsInRange}
                      </p>
                    ) : (
                      problems.map((problem) => {
                        const colors = getDifficultyColor(problem.difficulty);
                        const prob = getSolveProbability(userData.rating, problem.difficulty);

                        return (
                          <div
                            key={problem.id}
                            className="p-3 border rounded-lg hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <ProblemLink
                                problemId={problem.id}
                                problemTitle={problem.title}
                                problemUrl={problem.problem_url}
                                contestId={problem.contest_id}
                                difficulty={problem.difficulty}
                                className="group min-w-0 flex-1"
                                mode="practice"
                              >
                                <div
                                  className={cn(
                                    "text-sm font-bold group-hover:underline truncate",
                                    problem.difficulty && problem.difficulty >= 3200
                                      ? ""
                                      : colors.text
                                  )}
                                  title={problem.title}
                                >
                                  {problem.difficulty && problem.difficulty >= 3200 ? (
                                    problem.title.length > 0 ? (
                                      <>
                                        <span className="text-black dark:text-white">
                                          {problem.title[0]}
                                        </span>
                                        <span className="text-red-600 dark:text-red-400">
                                          {problem.title.slice(1)}
                                        </span>
                                      </>
                                    ) : (
                                      problem.title
                                    )
                                  ) : (
                                    problem.title
                                  )}
                                </div>
                              </ProblemLink>
                              {prob !== null && (
                                <span className="text-xs font-medium text-black dark:text-white shrink-0">
                                  {Math.round(prob * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 도전 기록 */}
      <PracticeHistory sessions={practiceSessions} stats={practiceStats} />
    </>
  );
}

function PracticeLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        <h1 className="text-3xl font-bold tracking-tight">Challenge</h1>
        <Loader />
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>추천 문제</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[600px] bg-muted/30 animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    </>
  );
}

export default function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ fromYear?: string; fromMonth?: string }>;
}) {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-8 items-start">
        <Suspense fallback={<PracticeLoading />}>
          <PracticeContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
