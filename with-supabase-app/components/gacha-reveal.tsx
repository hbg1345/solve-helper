"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { RecommendedProblem } from "@/app/actions";
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
  if (difficulty === null || difficulty < 400)
    return {
      stars: "★",
      label: "Common",
      gradient: "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
      borderColor: "#6b7280",
      glow: "rgba(107,114,128,0.5)",
      textColor: "#d1d5db",
    };
  if (difficulty < 800)
    return {
      stars: "★",
      label: "Common",
      gradient: "linear-gradient(135deg, #92400e 0%, #451a03 100%)",
      borderColor: "#b45309",
      glow: "rgba(180,83,9,0.5)",
      textColor: "#fcd34d",
    };
  if (difficulty < 1200)
    return {
      stars: "★★",
      label: "Uncommon",
      gradient: "linear-gradient(135deg, #166534 0%, #052e16 100%)",
      borderColor: "#16a34a",
      glow: "rgba(22,163,74,0.6)",
      textColor: "#86efac",
    };
  if (difficulty < 1600)
    return {
      stars: "★★★",
      label: "Rare",
      gradient: "linear-gradient(135deg, #155e75 0%, #083344 100%)",
      borderColor: "#06b6d4",
      glow: "rgba(6,182,212,0.7)",
      textColor: "#67e8f9",
    };
  if (difficulty < 2000)
    return {
      stars: "★★★★",
      label: "Super Rare",
      gradient: "linear-gradient(135deg, #1d4ed8 0%, #1e1b4b 100%)",
      borderColor: "#3b82f6",
      glow: "rgba(59,130,246,0.7)",
      textColor: "#93c5fd",
    };
  if (difficulty < 2400)
    return {
      stars: "★★★★★",
      label: "Epic",
      gradient: "linear-gradient(135deg, #a16207 0%, #422006 100%)",
      borderColor: "#eab308",
      glow: "rgba(234,179,8,0.8)",
      textColor: "#fde047",
    };
  if (difficulty < 2800)
    return {
      stars: "✦✦✦✦✦",
      label: "Epic+",
      gradient: "linear-gradient(135deg, #c2410c 0%, #431407 100%)",
      borderColor: "#f97316",
      glow: "rgba(249,115,22,0.8)",
      textColor: "#fdba74",
    };
  return {
    stars: "✦✦✦✦✦",
    label: "Legend",
    gradient: "linear-gradient(135deg, #b91c1c 0%, #450a0a 100%)",
    borderColor: "#ef4444",
    glow: "rgba(239,68,68,0.9)",
    textColor: "#fca5a5",
  };
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
}

export function GachaReveal({ initialProblems, userRating, fromEpoch }: GachaRevealProps) {
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
      const newProblems = await getGachaRecommendations(userRating, fromEpoch);
      setProblems(newProblems);
      setState("idle");
      setRevealedCount(0);
    } finally {
      setIsRedrawing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-2">
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
              className="relative overflow-hidden px-10 py-5 text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-0 text-white shadow-lg shadow-purple-500/30"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {tr.gacha.pull}
            </Button>
          </motion.div>
        )}
        {state === "done" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Button variant="outline" onClick={handleRedraw} disabled={isRedrawing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isRedrawing ? "animate-spin" : ""}`} />
              {tr.gacha.rePull}
            </Button>
          </motion.div>
        )}
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
      className="w-28 h-44 sm:w-32 sm:h-48 shrink-0"
    >
      <motion.div
        style={{ transformStyle: "preserve-3d", width: "100%", height: "100%", position: "relative" }}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Front face: card back (unrevealed) */}
        <div
          style={{ backfaceVisibility: "hidden" }}
          className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 border-2 border-purple-500/50 select-none"
        >
          <div className="absolute inset-2 border border-purple-400/20 rounded-lg pointer-events-none" />
          <div className="absolute top-1.5 left-1.5 text-[9px] text-purple-300/30">✦</div>
          <div className="absolute top-1.5 right-1.5 text-[9px] text-purple-300/30">✦</div>
          <div className="absolute bottom-1.5 left-1.5 text-[9px] text-purple-300/30">✦</div>
          <div className="absolute bottom-1.5 right-1.5 text-[9px] text-purple-300/30">✦</div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <span className="text-3xl text-purple-300/70 leading-none">✦</span>
            <span className="text-[8px] tracking-[0.25em] text-purple-300/40 font-mono">ATCODER</span>
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
          className="absolute inset-0 rounded-xl overflow-hidden border-2 flex flex-col p-2.5 hover:brightness-110 transition-[filter] duration-200"
        >
          <div className="text-[10px] font-bold leading-none" style={{ color: rarity.borderColor }}>
            {rarity.stars}
          </div>
          <div className="text-[9px] font-semibold mt-0.5 text-white/60">{rarity.label}</div>
          <div className="flex-1 flex items-center mt-2">
            <span className="text-xs font-bold leading-tight line-clamp-4" style={{ color: rarity.textColor }}>
              {problem.title}
            </span>
          </div>
          <div className="mt-1.5 space-y-0.5">
            {problem.difficulty && (
              <div className="text-[9px] text-white/50">{problem.difficulty.toLocaleString()} diff</div>
            )}
            {prob !== null && (
              <div className="text-[10px] font-bold text-white/80">{Math.round(prob * 100)}%</div>
            )}
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
