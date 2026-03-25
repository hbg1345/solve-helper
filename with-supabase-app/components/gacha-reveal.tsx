"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import type { RecommendedProblem } from "@/lib/atcoder/recommendations";
import { getGachaRecommendations } from "@/app/actions";
import Link from "next/link";
import { useLanguage } from "./language-context";

type Rarity = {
  stars: string;
  label: string;
  gradient: string;
  borderColor: string;
  glow: string;
  textColor: string;
};

function getRarity(difficulty: number | null): Rarity {
  // 카드 앞면은 흰색, 제목 색상은 AtCoder 난이도 색상 체계
  const base = {
    gradient: "linear-gradient(135deg, #ffffff 0%, #f8f8fa 100%)",
    borderColor: "#e2e2e8",
    glow: "rgba(0,0,0,0.08)",
  };
  if (difficulty === null || difficulty < 400)
    return { ...base, stars: "★", label: "Common", textColor: "#6b7280" };
  if (difficulty < 800)
    return { ...base, stars: "★", label: "Common", textColor: "#92400e" };
  if (difficulty < 1200)
    return { ...base, stars: "★★", label: "Uncommon", textColor: "#16a34a" };
  if (difficulty < 1600)
    return { ...base, stars: "★★★", label: "Rare", textColor: "#0891b2" };
  if (difficulty < 2000)
    return { ...base, stars: "★★★★", label: "Super Rare", textColor: "#1d4ed8" };
  if (difficulty < 2400)
    return { ...base, stars: "★★★★★", label: "Epic", textColor: "#ca8a04" };
  if (difficulty < 2800)
    return { ...base, stars: "✦✦✦✦✦", label: "Epic+", textColor: "#ea580c" };
  return { ...base, stars: "✦✦✦✦✦", label: "Legend", textColor: "#dc2626" };
}

function getSolveProbability(userRating: number, difficulty: number | null): number | null {
  if (difficulty === null) return null;
  return 1 / (1 + Math.pow(6, (difficulty - userRating) / 400));
}

type GachaState = "idle" | "revealing" | "done";

interface GachaRevealProps {
  initialProblems: RecommendedProblem[];
  userRating: number;
  fromEpoch?: number;
  contestType?: string;
}

export function GachaReveal({ initialProblems, userRating, fromEpoch, contestType }: GachaRevealProps) {
  const { tr } = useLanguage();
  const [problems, setProblems] = useState(initialProblems);
  const [state, setState] = useState<GachaState>("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRedrawing, setIsRedrawing] = useState(false);

  useEffect(() => {
    if (state !== "revealing") return;
    if (revealedCount >= problems.length) {
      setState("done");
      return;
    }
    const timeout = setTimeout(() => setRevealedCount((c) => c + 1), 380);
    return () => clearTimeout(timeout);
  }, [state, revealedCount, problems.length]);

  const handlePull = () => {
    setState("revealing");
    setRevealedCount(0);
  };

  const handleRedraw = async () => {
    setIsRedrawing(true);
    try {
      const newProblems = await getGachaRecommendations(userRating, fromEpoch, contestType);
      setProblems(newProblems);
      setRevealedCount(0);
      setState("revealing");
    } finally {
      setIsRedrawing(false);
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col rounded-xl overflow-hidden">
      {/* 배경 */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/space-bg.jpg')" }} />
      <div className="absolute inset-0 bg-black/30" />
      {/* 별 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          "top-4 left-[10%]", "top-8 right-[15%]", "top-16 left-[30%]",
          "bottom-12 right-[25%]", "bottom-8 left-[20%]", "top-12 right-[40%]",
          "bottom-20 left-[45%]", "top-6 left-[60%]", "bottom-16 right-[10%]",
        ].map((pos, i) => (
          <div key={i} className={`absolute ${pos} text-white/30 text-[10px]`}>
            {i % 3 === 0 ? "✦" : i % 3 === 1 ? "✧" : "·"}
          </div>
        ))}
      </div>

      <div className="relative flex flex-col flex-1 items-center justify-center gap-6 py-8 px-6">
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {problems.map((problem, i) => (
            <GachaCard
              key={problem.id}
              problem={problem}
              isRevealed={i < revealedCount}
              rarity={getRarity(problem.difficulty)}
              prob={getSolveProbability(userRating, problem.difficulty)}
              index={i}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          {state === "idle" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Button
                size="lg"
                onClick={handlePull}
                className="gap-2 bg-white text-pixel-dark font-bold border-0 shadow-lg hover:bg-white/90"
              >
                <Sparkles className="h-4 w-4" />
                {tr.gacha.pull}
              </Button>
            </motion.div>
          )}
          {state === "done" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Button onClick={handleRedraw} disabled={isRedrawing} className="gap-2 bg-white text-pixel-dark font-bold border-0 shadow-lg hover:bg-white/90">
                <RefreshCw className={`h-4 w-4 ${isRedrawing ? "animate-spin" : ""}`} />
                {tr.gacha.rePull}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function GachaCard({
  problem,
  isRevealed,
  rarity,
  prob,
  index,
}: {
  problem: RecommendedProblem;
  isRevealed: boolean;
  rarity: Rarity;
  prob: number | null;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      style={{ perspective: "1000px" }}
      className="w-32 h-48 sm:w-40 sm:h-56 shrink-0"
    >
      <motion.div
        style={{ transformStyle: "preserve-3d", width: "100%", height: "100%", position: "relative" }}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Front face: card back (unrevealed) */}
        <div
          style={{ backfaceVisibility: "hidden" }}
          className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-100 to-amber-200 border-2 border-amber-400/70 select-none"
        >
          <div className="absolute inset-2.5 border border-amber-500/30 rounded-lg pointer-events-none" />
          <div className="absolute top-2 left-2 text-[11px] text-amber-600/40">✦</div>
          <div className="absolute top-2 right-2 text-[11px] text-amber-600/40">✦</div>
          <div className="absolute bottom-2 left-2 text-[11px] text-amber-600/40">✦</div>
          <div className="absolute bottom-2 right-2 text-[11px] text-amber-600/40">✦</div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-4xl text-amber-500/80 leading-none">✦</span>
            <span className="text-[10px] tracking-[0.2em] text-amber-600/50 font-mono">SOLVE HELPER</span>
          </div>
        </div>

        {/* Back face: problem info (revealed) */}
        <Link
          href={`/practice/${problem.id}`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: rarity.gradient,
            borderColor: rarity.borderColor,
            boxShadow: isRevealed ? `0 0 18px ${rarity.glow}` : "none",
          }}
          className="absolute inset-0 rounded-xl overflow-hidden border-2 flex flex-col p-3.5 hover:brightness-95 transition-[filter] duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold leading-none text-amber-500">
              {rarity.stars}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-black">
              {problem.contest_id.replace(/(\d)/, " $1")}
            </div>
          </div>
          <div className="flex-1 flex items-center mt-2.5">
            <span className="text-sm font-bold leading-tight line-clamp-4" style={{ color: rarity.textColor }}>
              {problem.title}
            </span>
          </div>
          <div className="mt-2 space-y-0.5">
            {problem.difficulty && (
              <div className="text-[11px] text-black">{problem.difficulty.toLocaleString()} diff</div>
            )}
            {prob !== null && (
              <div className="text-xs font-bold text-black">{Math.round(prob * 100)}%</div>
            )}
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
