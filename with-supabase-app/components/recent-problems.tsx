"use client";

import { useEffect, useState } from "react";
import { getRecentProblems, type RecentProblem } from "@/lib/recent-problems";
import { ProblemLink } from "@/components/problem-link";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function RecentProblems() {
  const [problems, setProblems] = useState<RecentProblem[]>([]);

  useEffect(() => {
    setProblems(getRecentProblems());
  }, []);

  if (problems.length === 0) return null;

  return (
    <Card className="w-full py-0">
      <CardContent className="py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3.5 w-3.5" />
            최근 본 문제
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {problems.map((p) => (
              <div key={p.problemId} className="group">
                <ProblemLink
                  problemId={p.problemId}
                  problemTitle={p.problemTitle}
                  problemUrl={p.problemUrl}
                  contestId={p.contestId}
                  difficulty={p.difficulty}
                  className="group"
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
