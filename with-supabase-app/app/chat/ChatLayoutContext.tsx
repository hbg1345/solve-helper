"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type LayoutMode = "both" | "problem-only" | "chat-only";
export type ProblemLanguage = "en" | "ja" | "ko";

function getInitialProblemLanguage(): ProblemLanguage {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("appLanguage");
  if (stored === "ko" || stored === "en" || stored === "ja") return stored;
  return "en";
}

interface ChatLayoutContextType {
  selectedChatId: string | null;
  setSelectedChatId: (chatId: string | null) => void;
  refreshTrigger: number;
  setRefreshTrigger: (trigger: number | ((prev: number) => number)) => void;
  problemUrl: string | null;
  setProblemUrl: (url: string | null) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  problemLanguage: ProblemLanguage;
  setProblemLanguage: (lang: ProblemLanguage) => void;
}

const ChatLayoutContext = createContext<ChatLayoutContextType | undefined>(
  undefined
);

export function ChatLayoutProvider({ children }: { children: ReactNode }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [problemUrl, setProblemUrl] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("both");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [problemLanguage, setProblemLanguage] = useState<ProblemLanguage>(getInitialProblemLanguage);

  return (
    <ChatLayoutContext.Provider
      value={{
        selectedChatId,
        setSelectedChatId,
        refreshTrigger,
        setRefreshTrigger,
        problemUrl,
        setProblemUrl,
        layoutMode,
        setLayoutMode,
        sidebarOpen,
        setSidebarOpen,
        problemLanguage,
        setProblemLanguage,
      }}
    >
      {children}
    </ChatLayoutContext.Provider>
  );
}

export function useChatLayout() {
  const context = useContext(ChatLayoutContext);
  if (context === undefined) {
    throw new Error("useChatLayout must be used within ChatLayoutProvider");
  }
  return context;
}

export function useChatLayoutOptional() {
  return useContext(ChatLayoutContext);
}
