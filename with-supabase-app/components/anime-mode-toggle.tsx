"use client";

import { Button } from "@/components/ui/button";
import { useAnimeMode } from "./anime-mode-context";
import { useLanguage } from "./language-context";
import { Sparkles, User } from "lucide-react";

export function AnimeModeToggle() {
  const { isAnimeMode, setIsAnimeMode } = useAnimeMode();
  const { tr } = useLanguage();

  const handleToggle = () => {
    setIsAnimeMode(!isAnimeMode);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      aria-label={isAnimeMode ? tr.animeMode.toNormal : tr.animeMode.toAnime}
      className={`gap-1.5 ${isAnimeMode ? "text-pixel-cyan hover:text-pixel-yellow" : "text-pixel-yellow hover:text-pixel-cyan"}`}
    >
      {isAnimeMode ? (
        <Sparkles className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <User className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="text-xs font-medium">
        {isAnimeMode ? tr.animeMode.anime : tr.animeMode.normal}
      </span>
    </Button>
  );
}
