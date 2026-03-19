"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Trophy, Zap } from "lucide-react";
import { RatingHistoryEntry, getRatingHistory } from "@/app/actions";
import { getRatingColor } from "@/lib/atcoder/rating-history";
import { useLanguage } from "./language-context";

interface RatingGraphProps {
  atcoderHandle: string;
}

// 레이팅 구간 정의 (배경 띠용)
const RATING_BANDS = [
  { min: 0, max: 400, color: "#6b7280", name: "Gray" },
  { min: 400, max: 800, color: "#92400e", name: "Brown" },
  { min: 800, max: 1200, color: "#16a34a", name: "Green" },
  { min: 1200, max: 1600, color: "#06b6d4", name: "Cyan" },
  { min: 1600, max: 2000, color: "#2563eb", name: "Blue" },
  { min: 2000, max: 2400, color: "#eab308", name: "Yellow" },
  { min: 2400, max: 2800, color: "#ea580c", name: "Orange" },
  { min: 2800, max: 4000, color: "#dc2626", name: "Red" },
];

// 이동 평균 기간
const MOVING_AVERAGE_PERIOD = 10;

// 차트 데이터 포인트 타입
interface ChartDataPoint {
  date: string;
  fullDate: string;
  timestamp: number;
  rating: number;
  oldRating: number;
  color: string;
  contestName: string;
  performance: number;
  increment: number;
  place: number;
  index: number;
  // 캔들스틱용 (Bar의 base와 높이)
  ratingRange: [number, number];
  isPositive: boolean;
  // 이동 평균
  movingAverage: number | null;
}

// 호버 정보 타입
interface HoverInfo {
  data: ChartDataPoint;
  x: number;
  y: number;
}

// 이동 평균 계산 함수
function calculateMovingAverage(
  data: { rating: number }[],
  index: number,
  period: number
): number | null {
  if (index < period - 1) return null;
  const start = index - period + 1;
  const slice = data.slice(start, index + 1);
  const sum = slice.reduce((acc, item) => acc + item.rating, 0);
  return Math.round(sum / period);
}

export function RatingGraph({ atcoderHandle }: RatingGraphProps) {
  const { tr } = useLanguage();
  const [history, setHistory] = useState<RatingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getRatingHistory(atcoderHandle);
        setHistory(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load rating history"
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (atcoderHandle) {
      fetchHistory();
    }
  }, [atcoderHandle]);

  // 차트 데이터 변환
  const chartData: ChartDataPoint[] = useMemo(() => {
    const baseData = history.map((entry, index) => {
      const date = new Date(entry.EndTime);
      return {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        fullDate: date.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        timestamp: date.getTime(),
        rating: entry.NewRating,
        oldRating: entry.OldRating,
        color: getRatingColor(entry.NewRating),
        contestName: entry.ContestName,
        performance: entry.Performance,
        increment: entry.Increment,
        place: entry.Place,
        index,
        // 캔들스틱용
        ratingRange: [
          Math.min(entry.OldRating, entry.NewRating),
          Math.max(entry.OldRating, entry.NewRating),
        ] as [number, number],
        isPositive: entry.NewRating >= entry.OldRating,
        movingAverage: null as number | null,
      };
    });

    // 이동 평균 계산
    return baseData.map((item, index) => ({
      ...item,
      movingAverage: calculateMovingAverage(baseData, index, MOVING_AVERAGE_PERIOD),
    }));
  }, [history]);

  // 최고 레이팅 계산
  const highestRating = useMemo(() => {
    if (history.length === 0) return 0;
    return Math.max(...history.map((h) => h.NewRating));
  }, [history]);

  // 현재 레이팅 (마지막 엔트리)
  const currentRating = useMemo(() => {
    if (history.length === 0) return 0;
    return history[history.length - 1].NewRating;
  }, [history]);

  // 최고 퍼포먼스 계산
  const highestPerformance = useMemo(() => {
    if (history.length === 0) return 0;
    return Math.max(...history.map((h) => h.Performance));
  }, [history]);

  // 평균 퍼포먼스 계산
  const averagePerformance = useMemo(() => {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, h) => acc + h.Performance, 0);
    return Math.round(sum / history.length);
  }, [history]);

  // Y축 범위 계산 (레이팅 구간에 맞춤)
  const { yMin, yMax } = useMemo(() => {
    if (history.length === 0) return { yMin: 0, yMax: 1600 };

    const allRatings = history.flatMap((h) => [h.NewRating, h.OldRating]);
    const maxRating = Math.max(...allRatings);
    const minRating = Math.min(...allRatings);

    // 최소값은 400 단위로 내림, 최대값은 400 단위로 올림
    const yMin = Math.max(0, Math.floor(minRating / 400) * 400 - 200);
    const yMax = Math.ceil((maxRating + 200) / 400) * 400;

    return { yMin, yMax };
  }, [history]);

  // 표시할 레이팅 밴드 필터링
  const visibleBands = useMemo(() => {
    return RATING_BANDS.filter((band) => band.max > yMin && band.min < yMax);
  }, [yMin, yMax]);

  // 퍼포먼스 Y축 범위 계산
  const { perfYMin, perfYMax } = useMemo(() => {
    if (history.length === 0) return { perfYMin: 0, perfYMax: 2000 };

    const allPerformances = history.map((h) => h.Performance);
    const maxPerf = Math.max(...allPerformances);
    const minPerf = Math.min(...allPerformances);

    const perfYMin = Math.max(0, Math.floor(minPerf / 400) * 400 - 200);
    const perfYMax = Math.ceil((maxPerf + 200) / 400) * 400;

    return { perfYMin, perfYMax };
  }, [history]);

  // 퍼포먼스 그래프용 밴드 필터링
  const perfVisibleBands = useMemo(() => {
    return RATING_BANDS.filter((band) => band.max > perfYMin && band.min < perfYMax);
  }, [perfYMin, perfYMax]);

  // 점 호버 핸들러
  const handleDotMouseEnter = useCallback(
    (data: ChartDataPoint, cx: number, cy: number) => {
      setHoverInfo({ data, x: cx, y: cy });
    },
    []
  );

  const handleDotMouseLeave = useCallback(() => {
    // 호버 해제해도 마지막 값 유지
  }, []);

  // 커스텀 Dot 컴포넌트 (레이팅별 색상 + 호버 이벤트)
  const CustomDot = useCallback(
    (props: {
      cx?: number;
      cy?: number;
      payload?: ChartDataPoint;
      index?: number;
    }) => {
      const { cx, cy, payload } = props;
      if (!cx || !cy || !payload) return null;

      const isHovered = hoverInfo?.data.index === payload.index;

      return (
        <circle
          cx={cx}
          cy={cy}
          r={isHovered ? 7 : 4}
          fill={payload.color}
          stroke="#fff"
          strokeWidth={isHovered ? 2 : 1}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => handleDotMouseEnter(payload, cx, cy)}
          onMouseLeave={handleDotMouseLeave}
        />
      );
    },
    [hoverInfo, handleDotMouseEnter, handleDotMouseLeave]
  );

  // 퍼포먼스용 커스텀 Dot 컴포넌트
  const PerformanceDot = useCallback(
    (props: {
      cx?: number;
      cy?: number;
      payload?: ChartDataPoint;
      index?: number;
    }) => {
      const { cx, cy, payload } = props;
      if (!cx || !cy || !payload) return null;

      const isHovered = hoverInfo?.data.index === payload.index;
      const perfColor = getRatingColor(payload.performance);

      return (
        <circle
          cx={cx}
          cy={cy}
          r={isHovered ? 7 : 4}
          fill={perfColor}
          stroke="#fff"
          strokeWidth={isHovered ? 2 : 1}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => handleDotMouseEnter(payload, cx, cy)}
          onMouseLeave={handleDotMouseLeave}
        />
      );
    },
    [hoverInfo, handleDotMouseEnter, handleDotMouseLeave]
  );

  // 캔들스틱 바 shape
  const CandlestickBar = useCallback(
    (props: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      payload?: ChartDataPoint;
    }) => {
      const { x, y, width, height, payload } = props;
      if (x === undefined || y === undefined || !width || !height || !payload)
        return null;

      const color = payload.isPositive ? "#16a34a" : "#dc2626";
      const barWidth = Math.max(width * 0.3, 2);
      const barX = x + (width - barWidth) / 2;

      return (
        <rect
          x={barX}
          y={y}
          width={barWidth}
          height={Math.max(height, 1)}
          fill={color}
          opacity={0.6}
        />
      );
    },
    []
  );

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rating Graph
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rating Graph
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rating Graph
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-foreground text-sm">
            {tr.ratingGraph.noHistory}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rating Graph
            </CardTitle>
            <CardDescription>
              {tr.ratingGraph.ratedCount(history.length)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-foreground">Current</p>
              <Badge
                style={{ backgroundColor: getRatingColor(currentRating) }}
                className="text-white"
              >
                {currentRating}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-foreground flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Highest
              </p>
              <Badge
                style={{ backgroundColor: getRatingColor(highestRating) }}
                className="text-white"
              >
                {highestRating}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 고정 위치 정보 박스 (그래프 위쪽) */}
        {(() => {
          const displayData = hoverInfo?.data || chartData[chartData.length - 1];
          if (!displayData) return null;
          return (
            <div className="mb-3 bg-muted/50 border rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1 max-w-[400px] md:max-w-[600px]">
                  <p className="font-medium truncate" title={displayData.contestName}>{displayData.contestName}</p>
                  <p className="text-foreground text-xs">
                    {displayData.fullDate}
                  </p>
                </div>
                <div className="flex gap-4 md:gap-6 text-right flex-wrap">
                  <div>
                    <p className="text-foreground text-xs">Rating</p>
                    <p style={{ color: displayData.color }} className="font-bold">
                      {displayData.oldRating} → {displayData.rating}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground text-xs">Performance</p>
                    <p style={{ color: getRatingColor(displayData.performance) }} className="font-bold">
                      {displayData.performance}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground text-xs">{tr.ratingGraph.change}</p>
                    <p className={`font-medium ${displayData.increment >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {displayData.increment >= 0 ? "+" : ""}{displayData.increment}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground text-xs">{tr.ratingGraph.rank}</p>
                    <p className="font-medium">{displayData.place}{tr.ratingGraph.rankSuffix}</p>
                  </div>
                  {displayData.movingAverage && (
                    <div>
                      <p className="text-foreground text-xs">MA({MOVING_AVERAGE_PERIOD})</p>
                      <p className="font-medium text-orange-500">{displayData.movingAverage}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              {/* 레이팅 구간별 배경 띠 (ReferenceArea) */}
              {visibleBands.map((band) => (
                <ReferenceArea
                  key={band.name}
                  y1={Math.max(band.min, yMin)}
                  y2={Math.min(band.max, yMax)}
                  fill={band.color}
                  fillOpacity={0.15}
                />
              ))}

              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toString()}
                width={40}
              />

              {/* 최고 레이팅 표시선 */}
              <ReferenceLine
                y={highestRating}
                stroke={getRatingColor(highestRating)}
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{
                  value: `Highest: ${highestRating}`,
                  position: "right",
                  fontSize: 10,
                  fill: getRatingColor(highestRating),
                }}
              />

              {/* 이동 평균선 */}
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
                strokeDasharray="3 3"
              />

              {/* 레이팅 선 + 점 */}
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#888"
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs">
          {RATING_BANDS.filter((band) => band.max <= 2800).map((band) => (
            <div key={band.name} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: band.color }}
              />
              <span className="text-foreground">
                {band.name} ({band.min}-{band.max - 1})
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: "#dc2626" }}
            />
            <span className="text-foreground">Red (2800+)</span>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <div className="w-4 h-0.5 bg-orange-500" style={{ borderStyle: "dashed" }} />
            <span className="text-foreground">MA({MOVING_AVERAGE_PERIOD})</span>
          </div>
        </div>

        {/* 퍼포먼스 그래프 섹션 */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Graph
              </h3>
              <p className="text-sm text-foreground">
                {tr.ratingGraph.perfTrend}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-foreground">Average</p>
                <Badge
                  style={{ backgroundColor: getRatingColor(averagePerformance) }}
                  className="text-white"
                >
                  {averagePerformance}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-foreground flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  Highest
                </p>
                <Badge
                  style={{ backgroundColor: getRatingColor(highestPerformance) }}
                  className="text-white"
                >
                  {highestPerformance}
                </Badge>
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                {/* 레이팅 구간별 배경 띠 */}
                {perfVisibleBands.map((band) => (
                  <ReferenceArea
                    key={`perf-${band.name}`}
                    y1={Math.max(band.min, perfYMin)}
                    y2={Math.min(band.max, perfYMax)}
                    fill={band.color}
                    fillOpacity={0.15}
                  />
                ))}

                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />

                <YAxis
                  domain={[perfYMin, perfYMax]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value.toString()}
                  width={40}
                />

                {/* 최고 퍼포먼스 표시선 */}
                <ReferenceLine
                  y={highestPerformance}
                  stroke={getRatingColor(highestPerformance)}
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  label={{
                    value: `Best: ${highestPerformance}`,
                    position: "right",
                    fontSize: 10,
                    fill: getRatingColor(highestPerformance),
                  }}
                />

                {/* 평균 퍼포먼스 표시선 */}
                <ReferenceLine
                  y={averagePerformance}
                  stroke="#888"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `Avg: ${averagePerformance}`,
                    position: "right",
                    fontSize: 10,
                    fill: "#888",
                  }}
                />

                {/* 퍼포먼스 선 + 점 */}
                <Line
                  type="monotone"
                  dataKey="performance"
                  stroke="#888"
                  strokeWidth={2}
                  dot={<PerformanceDot />}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
