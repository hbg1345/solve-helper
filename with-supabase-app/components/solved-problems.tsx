"use client";

import Link from "next/link";
import { SolvedProblem } from "@/app/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";

interface SolvedProblemsProps {
  problems: SolvedProblem[];
}

// 난이도별 색상 (Tailwind 클래스)
function getDifficultyColor(difficulty: number | null): string {
  if (difficulty === null || difficulty < 400) return "text-gray-500 dark:text-gray-400";
  if (difficulty < 800) return "text-amber-800 dark:text-amber-600";
  if (difficulty < 1200) return "text-green-600 dark:text-green-400";
  if (difficulty < 1600) return "text-cyan-600 dark:text-cyan-400";
  if (difficulty < 2000) return "text-blue-700 dark:text-blue-500";
  if (difficulty < 2400) return "text-yellow-500 dark:text-yellow-300";
  if (difficulty < 2800) return "text-orange-500 dark:text-orange-400";
  if (difficulty < 3200) return "text-red-600 dark:text-red-400";
  return "text-red-600 dark:text-red-400"; // gold (handled separately)
}

function ProblemBadge({ problem }: { problem: SolvedProblem }) {
  const displayId = problem.problem_id;
  const url = `https://atcoder.jp/contests/${problem.contest_id}/tasks/${problem.problem_id}`;
  const colorClass = getDifficultyColor(problem.difficulty);
  const isGold = problem.difficulty !== null && problem.difficulty >= 3200;

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-xs font-bold hover:underline"
      title={`${problem.title || displayId} (${problem.difficulty ?? "?"})`}
    >
      {isGold ? (
        <>
          <span className="text-black dark:text-white">{displayId[0]}</span>
          <span className="text-red-600 dark:text-red-400">{displayId.slice(1)}</span>
        </>
      ) : (
        <span className={colorClass}>{displayId}</span>
      )}
    </Link>
  );
}

export function SolvedProblemsList({ problems }: SolvedProblemsProps) {
  // 난이도 순 내림차순 정렬 (null은 맨 뒤로)
  const sortedProblems = useMemo(() => {
    return [...problems].sort((a, b) => {
      if (a.difficulty === null && b.difficulty === null) return a.problem_id.localeCompare(b.problem_id);
      if (a.difficulty === null) return 1;
      if (b.difficulty === null) return -1;
      if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty;
      return a.problem_id.localeCompare(b.problem_id);
    });
  }, [problems]);

  if (problems.length === 0) {
    return (
      <p className="text-foreground text-sm">
        아직 푼 문제가 없습니다.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="flex flex-wrap gap-2">
        {sortedProblems.map((problem) => (
          <ProblemBadge key={problem.problem_id} problem={problem} />
        ))}
      </div>
    </ScrollArea>
  );
}
