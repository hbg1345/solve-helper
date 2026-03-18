"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, Translations, translations } from "@/lib/translations";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  tr: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    const stored = localStorage.getItem("appLanguage") as Lang | null;
    if (stored === "ko" || stored === "en" || stored === "ja") {
      setLangState(stored);
    }
  }, []);

  const setLang = (value: Lang) => {
    setLangState(value);
    localStorage.setItem("appLanguage", value);
    document.cookie = `appLanguage=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
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
