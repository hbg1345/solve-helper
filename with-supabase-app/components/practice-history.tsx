"use client";

import Link from "next/link";
import { TrendingUp, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PracticeSession, PracticeStats } from "@/app/actions";
import { useLanguage } from "./language-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PracticeHistoryProps {
  sessions: PracticeSession[];
  stats: PracticeStats;
}

function getColorRank(difficulty: number | null): number {
  if (difficulty === null) return -1;
  if (difficulty < 400) return 0;
  if (difficulty < 800) return 1;
  if (difficulty < 1200) return 2;
  if (difficulty < 1600) return 3;
  if (difficulty < 2000) return 4;
  if (difficulty < 2400) return 5;
  if (difficulty < 2800) return 6;
  if (difficulty < 3200) return 7;
  return 8;
}

function getDifficultyColor(difficulty: number | null): string {
  if (difficulty === null) return "text-gray-500 dark:text-gray-400";
  if (difficulty < 400) return "text-gray-500 dark:text-gray-400";
  if (difficulty < 800) return "text-amber-800 dark:text-amber-600";
  if (difficulty < 1200) return "text-green-600 dark:text-green-400";
  if (difficulty < 1600) return "text-cyan-600 dark:text-cyan-400";
  if (difficulty < 2000) return "text-blue-700 dark:text-blue-500";
  if (difficulty < 2400) return "text-yellow-500 dark:text-yellow-300";
  if (difficulty < 2800) return "text-orange-500 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

// ── 잔디 그래프 (성공한 도전) ──────────────────────────────────────────────────

interface GrassProps {
  sessions: PracticeSession[];
  year: number;
}

function PracticeGrass({ sessions, year }: GrassProps) {
  // 해당 연도 solved 세션을 날짜별로 집계
  const countByDate: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.solved) continue;
    const date = new Date(s.created_at);
    if (date.getFullYear() !== year) continue;
    const key = date.toISOString().split("T")[0];
    countByDate[key] = (countByDate[key] ?? 0) + 1;
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const days: { date: Date; count: number }[] = [];
  const cur = new Date(yearStart);
  while (cur <= yearEnd) {
    const key = cur.toISOString().split("T")[0];
    days.push({ date: new Date(cur), count: countByDate[key] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  // 주(week) 단위 그룹화
  const weeks: typeof days[] = [];
  let week: typeof days = [];
  const firstDow = days[0].date.getDay();
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(days[0].date.getTime() - (firstDow - i) * 86400000);
    week.push({ date: d, count: 0 });
  }
  for (const day of days) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) {
      const last = week[week.length - 1].date;
      const next = new Date(last); next.setDate(next.getDate() + 1);
      week.push({ date: next, count: 0 });
    }
    weeks.push(week);
  }

  const maxCount = Math.max(...days.map((d) => d.count), 0);
  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-100 dark:bg-gray-800";
    const step = Math.max(1, Math.ceil(maxCount / 5));
    if (count <= step) return "bg-green-200 dark:bg-green-900";
    if (count <= step * 2) return "bg-green-300 dark:bg-green-800";
    if (count <= step * 3) return "bg-green-400 dark:bg-green-700";
    if (count <= step * 4) return "bg-green-600 dark:bg-green-600";
    return "bg-green-800 dark:bg-green-500";
  };

  // 월 레이블
  const monthLabels: { weekIndex: number; month: number }[] = [];
  const seen = new Set<number>();
  weeks.forEach((w, wi) => {
    const first = w.find((d) => d.date.getFullYear() === year);
    if (first) {
      const m = first.date.getMonth();
      if (!seen.has(m)) { seen.add(m); monthLabels.push({ weekIndex: wi, month: m }); }
    }
  });

  const totalSolved = Object.values(countByDate).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{year}년 도전 성공 기록</span>
        <span className="text-muted-foreground">총 {totalSolved}회 성공</span>
      </div>
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="flex gap-[3px]">
          {/* 요일 레이블 */}
          <div className="flex flex-col gap-[3px]" style={{ width: "20px" }}>
            <div className="h-4" />
            {["일","월","화","수","목","금","토"].map((d) => (
              <div key={d} className="text-xs text-muted-foreground leading-[14px] h-[14px]">{d}</div>
            ))}
          </div>
          <TooltipProvider delayDuration={100}>
            {weeks.map((w, wi) => {
              const label = monthLabels.find((l) => l.weekIndex === wi);
              return (
                <div key={wi} className="flex flex-col gap-[3px]">
                  <div className="h-4 text-xs text-muted-foreground whitespace-nowrap">
                    {label ? `${label.month + 1}월` : ""}
                  </div>
                  {w.map((day, di) => {
                    const isCurrentYear = day.date.getFullYear() === year;
                    const dateKey = day.date.toISOString().split("T")[0];
                    const cell = (
                      <div
                        className={cn(
                          "w-3 h-[14px] rounded-sm transition-colors",
                          getColor(day.count),
                          isCurrentYear ? "hover:ring-1 hover:ring-primary cursor-pointer" : "opacity-30"
                        )}
                      />
                    );
                    if (!isCurrentYear) return <div key={`${wi}-${di}`}>{cell}</div>;
                    return (
                      <Tooltip key={`${wi}-${di}`}>
                        <TooltipTrigger asChild>{cell}</TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="font-medium">{dateKey}</p>
                          <p>성공 {day.count}회</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>적음</span>
        <div className="flex gap-[3px]">
          {["bg-gray-100 dark:bg-gray-800","bg-green-200 dark:bg-green-900","bg-green-300 dark:bg-green-800","bg-green-400 dark:bg-green-700","bg-green-600 dark:bg-green-600","bg-green-800 dark:bg-green-500"].map((c) => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
        </div>
        <span>많음</span>
      </div>
    </div>
  );
}

// ── 실패 문제 배지 리스트 ────────────────────────────────────────────────────

function FailedProblemsList({ sessions }: { sessions: PracticeSession[] }) {
  // 실패한 세션에서 유니크 문제만 추출 (같은 문제 여러 번 실패해도 1개)
  const seen = new Set<string>();
  const failed: PracticeSession[] = [];
  for (const s of [...sessions].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )) {
    if (!s.solved && !seen.has(s.problem_id)) {
      seen.add(s.problem_id);
      failed.push(s);
    }
  }

  // 색상 구간 내림차순 → 같은 색이면 이름 오름차순
  failed.sort((a, b) => {
    const ra = getColorRank(a.difficulty);
    const rb = getColorRank(b.difficulty);
    if (ra !== rb) return rb - ra;
    return a.problem_id.localeCompare(b.problem_id);
  });

  if (failed.length === 0) {
    return <p className="text-sm text-muted-foreground">실패한 도전이 없습니다.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {failed.map((s) => {
        const isGold = s.difficulty !== null && s.difficulty >= 3200;
        return (
          <Link
            key={s.problem_id}
            href={`/practice/${s.problem_id}`}
            className="inline-flex items-center text-xs font-bold hover:underline"
            title={`${s.problem_title || s.problem_id} (${s.difficulty ?? "?"})`}
          >
            {isGold ? (
              <>
                <span className="text-black dark:text-white">{s.problem_id[0]}</span>
                <span className="text-red-600 dark:text-red-400">{s.problem_id.slice(1)}</span>
              </>
            ) : (
              <span className={getDifficultyColor(s.difficulty)}>{s.problem_id}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function PracticeHistory({ sessions, stats }: PracticeHistoryProps) {
  const { tr } = useLanguage();
  const currentYear = new Date().getFullYear();

  if (sessions.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{tr.practiceHistory.title}</CardTitle>
          <CardDescription>{tr.practiceHistory.empty}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-foreground text-center py-8">{tr.practiceHistory.emptyHint}</p>
        </CardContent>
      </Card>
    );
  }

  const successRate = stats.totalSessions > 0
    ? Math.round((stats.solvedCount / stats.totalSessions) * 100)
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{tr.practiceHistory.title}</CardTitle>
        <CardDescription>
          {tr.practiceHistory.stats(stats.totalSessions, stats.solvedCount, String(successRate))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 통계 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground">{tr.practiceHistory.totalSessions}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className={cn(
                "h-5 w-5",
                successRate >= 50 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
              )} />
              <p className={cn(
                "text-2xl font-bold",
                successRate >= 50 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
              )}>
                {successRate}%
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr.practiceHistory.successRate(stats.solvedCount, stats.totalSessions)}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold font-mono">
              {tr.practiceHistory.formatElapsedTime(Math.round(stats.avgElapsedTime))}
            </p>
            <p className="text-xs text-muted-foreground">{tr.practiceHistory.avgTime}</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <p className="text-2xl font-bold">{stats.avgHintsUsed.toFixed(1)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{tr.practiceHistory.avgHints}</p>
          </div>
        </div>

        {/* 성공 잔디 */}
        <PracticeGrass sessions={sessions} year={currentYear} />

        {/* 실패 문제 목록 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">미완료 문제</p>
          <FailedProblemsList sessions={sessions} />
        </div>
      </CardContent>
    </Card>
  );
}
