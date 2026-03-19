"use client";

import { useMemo } from "react";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SolvedProblem } from "@/app/actions";
import { useLanguage } from "./language-context";

interface DifficultyDistributionProps {
  problems: SolvedProblem[];
}

// AtCoder 난이도 분류 (채도 높은 단색)
const DIFFICULTY_LEVELS = [
  { name: "Gray", min: 0, max: 399, color: "#808080" },
  { name: "Brown", min: 400, max: 799, color: "#8B4513" },
  { name: "Green", min: 800, max: 1199, color: "#008000" },
  { name: "Cyan", min: 1200, max: 1599, color: "#00BFBF" },
  { name: "Blue", min: 1600, max: 1999, color: "#0000FF" },
  { name: "Yellow", min: 2000, max: 2399, color: "#C0C000" },
  { name: "Orange", min: 2400, max: 2799, color: "#FF8C00" },
  { name: "Red", min: 2800, max: Infinity, color: "#FF0000" },
] as const;

function getDifficultyLevel(difficulty: number | null): string {
  if (difficulty === null) return "Unknown";
  for (const level of DIFFICULTY_LEVELS) {
    if (difficulty >= level.min && difficulty <= level.max) {
      return level.name;
    }
  }
  return "Unknown";
}

function getLevelColor(levelName: string): string {
  const level = DIFFICULTY_LEVELS.find((l) => l.name === levelName);
  return level?.color ?? "#6b7280";
}

export function DifficultyDistribution({ problems }: DifficultyDistributionProps) {
  const { tr } = useLanguage();
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};

    // 초기화
    for (const level of DIFFICULTY_LEVELS) {
      counts[level.name] = 0;
    }
    counts["Unknown"] = 0;

    // 카운트
    for (const problem of problems) {
      const level = getDifficultyLevel(problem.difficulty);
      counts[level] = (counts[level] || 0) + 1;
    }

    // 차트 데이터 생성 (0인 항목 제외)
    return DIFFICULTY_LEVELS
      .map((level) => ({
        name: level.name,
        value: counts[level.name],
        color: level.color,
        range: level.max === Infinity ? `${level.min}+` : `${level.min}-${level.max}`,
      }))
      .filter((item) => item.value > 0);
  }, [problems]);

  const total = problems.length;

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const item of distribution) {
      config[item.name] = {
        label: item.name,
        color: item.color,
      };
    }
    return config;
  }, [distribution]);

  if (problems.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-foreground text-sm font-normal">{tr.difficultyDist.title}</span>
        </CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground">
          {tr.difficultyDist.solved(total)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* 도넛 차트 */}
          <div className="w-full lg:w-1/2">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex items-center gap-2">
                          <span>{name}</span>
                          <span className="font-bold">{tr.difficultyDist.problemCount(Number(value))}</span>
                          <span className="text-foreground">
                            ({((Number(value) / total) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={100}
                  paddingAngle={2}
                  strokeWidth={1}
                  stroke="rgba(255,255,255,0.3)"
                >
                  {distribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          {/* 테이블 */}
          <div className="w-full lg:w-1/2">
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">{tr.difficultyDist.level}</th>
                    <th className="px-4 py-2 text-right font-medium">{tr.difficultyDist.problems}</th>
                    <th className="px-4 py-2 text-right font-medium">{tr.difficultyDist.ratio}</th>
                  </tr>
                </thead>
                <tbody>
                  {DIFFICULTY_LEVELS.map((level) => {
                    const item = distribution.find((d) => d.name === level.name);
                    const count = item?.value ?? 0;
                    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

                    return (
                      <tr key={level.name} className="border-b last:border-b-0">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-none"
                              style={{ backgroundColor: level.color }}
                            />
                            <span style={{ color: level.color }} className="font-medium">
                              {level.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-foreground">
                          {percent}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
