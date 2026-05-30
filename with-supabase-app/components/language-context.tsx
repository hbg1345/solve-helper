"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, Translations, translations } from "@/lib/translations";
import { updateUserLanguage } from "@/app/actions";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  tr: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children, initialLang = "ko" }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // 정적 렌더링을 위해 서버에서 쿠키를 읽지 않으므로, 클라이언트 마운트 시
  // 저장된 언어를 복원한다. (기본 언어 → 저장 언어로 한 번 전환될 수 있음)
  useEffect(() => {
    const saved = localStorage.getItem("appLanguage");
    if (saved === "en" || saved === "ja" || saved === "ko") {
      setLangState((prev) => (prev !== saved ? saved : prev));
    }
  }, []);

  const setLang = (value: Lang) => {
    setLangState(value);
    localStorage.setItem("appLanguage", value);
    document.cookie = `appLanguage=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
    updateUserLanguage(value).catch(() => {}); // 로그인 상태면 DB에도 저장
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, tr: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
