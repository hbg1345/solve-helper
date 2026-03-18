import { getRecommendedProblems } from "@/lib/atcoder/recommendations";
import { getServerTr } from "@/lib/lang-server";
import { Loader } from "@/components/ai-elements/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { OngoingSessionCard } from "@/components/ongoing-session-card";
import { PracticeHistory } from "@/components/practice-history";
import { getPracticeSessions, getPracticeStats } from "@/app/actions";
import { GachaReveal } from "@/components/gacha-reveal";

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

  if (!claims) redirect("/auth/login");

  const userId = claims.sub as string;
  const { data: userData, error: userError } = await supabase
    .from("user_info")
    .select("rating, atcoder_handle")
    .eq("id", userId)
    .single();

  if (userError || !userData) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle>{tr.practice.title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-foreground">
            {tr.practice.noHandle}{" "}
            <Link href="/profile" className="text-primary hover:underline">{tr.practice.profilePage}</Link>
            {tr.practice.linkHere}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (userData.rating === null) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle>{tr.practice.title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-foreground">
            {tr.practice.noRating}{" "}
            <Link href="/profile" className="text-primary hover:underline">{tr.practice.profilePage}</Link>
            {tr.practice.linkHere}
          </p>
        </CardContent>
      </Card>
    );
  }

  const [problems, practiceSessions, practiceStats] = await Promise.all([
    getRecommendedProblems(userData.rating, fromEpoch),
    getPracticeSessions(50),
    getPracticeStats(),
  ]);

  if (problems.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle>{tr.practice.title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-foreground">{tr.practice.noProblems(userData.rating)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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

      {/* 가챠 추천 */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{tr.practice.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <GachaReveal
            initialProblems={problems}
            userRating={userData.rating}
            fromEpoch={fromEpoch}
          />
        </CardContent>
      </Card>

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
        <CardContent>
          <div className="w-full h-64 bg-muted/30 animate-pulse rounded-lg" />
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
