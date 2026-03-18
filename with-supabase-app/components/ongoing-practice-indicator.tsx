"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, Play, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "./language-context";

interface OngoingPracticeState {
  problemId: string;
  problemTitle: string | null;
  status: "running" | "paused";
  selectedTime: number;
  remainingTime: number;
  elapsedTime: number;
  startedAt: number;
}

const PRACTICE_STATE_KEY = "ongoing_practice";

export function OngoingPracticeIndicator() {
  const [practiceState, setPracticeState] = useState<OngoingPracticeState | null>(null);
  const [currentRemainingTime, setCurrentRemainingTime] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);
  const { tr } = useLanguage();

  // localStorage에서 상태 읽기
  useEffect(() => {
    const checkPracticeState = () => {
      try {
        const saved = localStorage.getItem(PRACTICE_STATE_KEY);
        if (saved) {
          const state = JSON.parse(saved) as OngoingPracticeState;
          setPracticeState(state);

          // 경과 시간 계산 (running 상태일 때만)
          if (state.status === "running") {
            const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
            const remaining = Math.max(0, state.selectedTime * 60 - elapsed);
            setCurrentRemainingTime(remaining);
          } else {
            setCurrentRemainingTime(state.remainingTime);
          }
        } else {
          setPracticeState(null);
        }
      } catch {
        setPracticeState(null);
      }
    };

    // 초기 체크
    checkPracticeState();

    // 주기적으로 체크 (다른 탭에서 변경될 수 있음)
    const interval = setInterval(checkPracticeState, 1000);

    return () => clearInterval(interval);
  }, []);

  // 시간 포맷
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 닫기
  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
  };

  // 포기
  const handleAbandon = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.removeItem(PRACTICE_STATE_KEY);
    setPracticeState(null);
  };

  if (!practiceState || dismissed) {
    return null;
  }

  const isUrgent = currentRemainingTime <= 60 && currentRemainingTime > 0;
  const isExpired = currentRemainingTime <= 0;

  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-300">
      <Link href={`/practice/${practiceState.problemId}`}>
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border cursor-pointer transition-all hover:scale-105",
            isExpired
              ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
              : isUrgent
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
                : "bg-background border-border"
          )}
        >
          {/* 상태 아이콘 */}
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              practiceState.status === "running"
                ? "bg-green-100 dark:bg-green-900"
                : "bg-yellow-100 dark:bg-yellow-900"
            )}
          >
            {practiceState.status === "running" ? (
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400 animate-pulse" />
            ) : (
              <Play className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            )}
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {practiceState.problemTitle || practiceState.problemId}
            </p>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <span>
                {practiceState.status === "running" ? tr.ongoingPractice.running : tr.ongoingPractice.paused}
              </span>
              <span>·</span>
              <span
                className={cn(
                  "font-mono",
                  isExpired
                    ? "text-red-600 dark:text-red-400"
                    : isUrgent
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                )}
              >
                {isExpired ? tr.ongoingPractice.timeout : formatTime(currentRemainingTime)}
              </span>
            </div>
          </div>

          {/* 포기 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-red-500 hover:text-red-600"
            onClick={handleAbandon}
            title={tr.ongoingPractice.giveUp}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {/* 닫기 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Link>
    </div>
  );
}
