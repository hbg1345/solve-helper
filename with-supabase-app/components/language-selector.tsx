"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useLanguage } from "./language-context";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/translations";

const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
];

export function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const router = useRouter();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-pixel-white/80 hover:text-pixel-cyan hover:bg-pixel-navy text-xs font-medium"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map(({ code, flag, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => { setLang(code); router.refresh(); }}
            className={lang === code ? "font-bold" : ""}
          >
            {flag} {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
