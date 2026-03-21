"use client";

import { useEffect, useState } from "react";
import {
  getYearSubmissions,
  groupSubmissionsByDate,
} from "@/lib/atcoder/submissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SubmissionGrassProps {
  userId: string;
}

interface DayData {
  date: Date;
  count: number;
}

/**
 * GitHub 잔디 스타일의 제출 기록 시각화 컴포넌트
 */
export function SubmissionGrass({ userId }: SubmissionGrassProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [data, setData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSubmissions, setTotalSubmissions] = useState<number>(0);

  // 사용 가능한 년도 목록 생성 (2020년부터 현재 년도까지)
  const availableYears: number[] = [];
  const startYear = 2020;
  for (let year = currentYear; year >= startYear; year--) {
    availableYears.push(year);
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const submissions = await getYearSubmissions(userId, selectedYear);
        const grouped = groupSubmissionsByDate(submissions);

        // 해당 년도의 1월 1일부터 12월 31일까지 모든 날짜 생성
        const yearStart = new Date(selectedYear, 0, 1);
        yearStart.setHours(0, 0, 0, 0);

        const yearEnd = new Date(selectedYear, 11, 31);
        yearEnd.setHours(23, 59, 59, 999);

        const days: DayData[] = [];
        const currentDate = new Date(yearStart);

        while (currentDate <= yearEnd) {
          const dateKey = currentDate.toISOString().split("T")[0];
          days.push({
            date: new Date(currentDate),
            count: grouped[dateKey] || 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        setData(days);
        // AC만 카운트
        const acCount = submissions.filter((s) => s.result === "AC").length;
        setTotalSubmissions(acCount);
      } catch (err) {
        console.error("Error loading submission data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load submission data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, selectedYear]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-sm text-foreground">
          제출 기록을 불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-sm text-foreground">
          제출 기록이 없습니다.
        </div>
      </div>
    );
  }

  // 주(week) 단위로 그룹화
  const weeks: DayData[][] = [];
  let currentWeek: DayData[] = [];

  // 첫 번째 날짜의 요일 확인 (0=일요일, 6=토요일)
  const firstDayOfWeek = data[0].date.getDay();

  // 첫 주의 빈 날짜 추가 (일요일부터 시작)
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({
      date: new Date(
        data[0].date.getTime() - (firstDayOfWeek - i) * 24 * 60 * 60 * 1000
      ),
      count: 0,
    });
  }

  for (const day of data) {
    currentWeek.push(day);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // 마지막 주가 채워지지 않은 경우 빈 날짜로 채우기
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      const lastDate = currentWeek[currentWeek.length - 1].date;
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 1);
      currentWeek.push({
        date: nextDate,
        count: 0,
      });
    }
    weeks.push(currentWeek);
  }

  // 최대 제출 횟수 계산 (색상 단계 결정용)
  const maxCount = Math.max(...data.map((d) => d.count), 0);

  // 제출 횟수에 따른 색상 결정 (1개 단위로 색상 변경)
  const getColor = (count: number): string => {
    if (count === 0) {
      return "bg-gray-100 dark:bg-gray-800";
    } else if (maxCount === 0) {
      return "bg-gray-100 dark:bg-gray-800";
    } else {
      // 1개부터 최대값까지 5단계로 나눔
      // 단계: 1, 2, 3, 4, 5+
      const step = Math.max(1, Math.ceil(maxCount / 5));

      if (count <= step) {
        return "bg-green-200 dark:bg-green-900";
      } else if (count <= step * 2) {
        return "bg-green-300 dark:bg-green-800";
      } else if (count <= step * 3) {
        return "bg-green-400 dark:bg-green-700";
      } else if (count <= step * 4) {
        return "bg-green-600 dark:bg-green-600";
      } else {
        return "bg-green-800 dark:bg-green-500";
      }
    }
  };

  // 월 레이블 위치 계산 (각 주의 첫 번째 날짜로 월 판단)
  const monthLabels: { weekIndex: number; month: number }[] = [];
  const processedMonths = new Set<number>();

  weeks.forEach((week, weekIndex) => {
    if (week.length > 0) {
      const firstDay = week.find(
        (day) => day.date.getFullYear() === selectedYear
      );
      if (firstDay) {
        const month = firstDay.date.getMonth();
        if (!processedMonths.has(month)) {
          processedMonths.add(month);
          monthLabels.push({ weekIndex, month });
        }
      }
    }
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <h3 className="text-sm font-medium">{selectedYear}년 정답 기록</h3>
        </div>
        <div className="text-sm text-foreground">
          총 {totalSubmissions}회 AC
        </div>
      </div>

      {/* 잔디 그래프 */}
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="flex gap-[3px]">
          {/* 요일 레이블 (세로) */}
          <div className="flex flex-col gap-[3px]" style={{ width: "20px" }}>
            <div className="h-4" /> {/* 월 레이블 높이만큼 빈 공간 */}
            <div className="text-xs text-foreground leading-[14px] h-[14px]">일</div>
            <div className="text-xs text-foreground leading-[14px] h-[14px]">월</div>
            <div className="text-xs text-foreground leading-[14px] h-[14px]">화</div>
            <div className="text-xs text-foreground leading-[14px] h-[14px]">수</div>
            <div className="text-xs text-foreground leading-[14px] h-[14px]">목</div>
            <div className="text-xs text-foreground leading-[14px] h-[14px]">금</div>
            <div className="text-xs text-foreground leading-[14px] h-[14px]">토</div>
          </div>

          {/* 주별 데이터 (월 레이블 포함) */}
          <TooltipProvider delayDuration={100}>
          {weeks.map((week, weekIndex) => {
            const monthLabel = monthLabels.find(
              (label) => label.weekIndex === weekIndex
            );
            return (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {/* 월 레이블 */}
                <div className="h-4 text-xs text-foreground whitespace-nowrap">
                  {monthLabel ? `${monthLabel.month + 1}월` : ""}
                </div>
                {/* 날짜 셀 */}
                {week.map((day, dayIndex) => {
                  const dateKey = day.date.toISOString().split("T")[0];
                  const isCurrentYear = day.date.getFullYear() === selectedYear;

                  const cell = (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`w-3 h-[14px] rounded-sm ${getColor(day.count)} ${
                        isCurrentYear
                          ? "hover:ring-1 hover:ring-primary cursor-pointer"
                          : "opacity-30"
                      } transition-colors`}
                    />
                  );

                  if (!isCurrentYear) return cell;

                  return (
                    <Tooltip key={`${weekIndex}-${dayIndex}`}>
                      <TooltipTrigger asChild>{cell}</TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="font-medium">{dateKey}</p>
                        <p>AC {day.count}회</p>
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

      {/* 범례 */}
      <div className="flex items-center justify-end gap-2 text-xs text-foreground">
        <span>적음</span>
        <div className="flex gap-[3px]">
          <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
          <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
          <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-800" />
          <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
          <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-600" />
          <div className="w-3 h-3 rounded-sm bg-green-800 dark:bg-green-500" />
        </div>
        <span>많음</span>
      </div>
    </div>
  );
}
