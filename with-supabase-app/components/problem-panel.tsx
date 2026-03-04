"use client";

import { ExternalLink, RefreshCw, Languages } from "lucide-react";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useMemo, memo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useChatLayoutOptional, type ProblemLanguage } from "@/app/chat/ChatLayoutContext";

interface ProblemPanelProps {
  problemUrl: string | null;
}

type Language = ProblemLanguage;

interface ProblemContent {
  en: string | null;
  ja: string | null;
  full: string | null;
}

interface ProblemData {
  title: string;
  timeLimit: string;
  memoryLimit: string;
  content: ProblemContent;
  styles: string;
  url: string;
}

const languageLabels: Record<Language, string> = {
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

export const ProblemPanel = memo(function ProblemPanel({ problemUrl }: ProblemPanelProps) {
  const layoutContext = useChatLayoutOptional();
  const [localLanguage, setLocalLanguage] = useState<ProblemLanguage>("en");
  const language = layoutContext?.problemLanguage ?? localLanguage;
  const setLanguage = layoutContext?.setProblemLanguage ?? setLocalLanguage;
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemData, setProblemData] = useState<ProblemData | null>(null);
  const [translatedContent, setTranslatedContent] = useState<string | null>(
    null
  );
  const [needsTranslation, setNeedsTranslation] = useState(false);

  // 번역 소스 콘텐츠 가져오기 (일본어 우선, 없으면 영어, 없으면 full)
  const getSourceContent = (data: ProblemData): string => {
    // 일본어 콘텐츠가 있고 비어있지 않으면 사용 (일본어→한국어 번역이 더 자연스러움)
    if (data.content.ja && data.content.ja.trim().length > 0) {
      return data.content.ja;
    }
    // 영어 콘텐츠가 있고 비어있지 않으면 사용
    if (data.content.en && data.content.en.trim().length > 0) {
      return data.content.en;
    }
    // 둘 다 없으면 full 사용
    return data.content.full || "";
  };

  const fetchProblem = async (url: string): Promise<ProblemData | null> => {
    setIsLoading(true);
    setError(null);
    setTranslatedContent(null);

    try {
      const response = await fetch(
        `/api/problem?url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch problem");
      }

      const data = await response.json();
      setProblemData(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch problem");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const translateContent = async (content: string, targetLang: Language) => {
    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          targetLang,
          problemUrl, // 캐싱을 위해 problemUrl 전달
        }),
      });

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = await response.json();
      setTranslatedContent(data.translated);
    } catch (err) {
      console.error("Translation error:", err);
      setError("번역에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsTranslating(false);
    }
  };

  // problemData가 변경되고 한국어 번역이 필요한 경우 자동 번역
  useEffect(() => {
    if (needsTranslation && problemData && language === "ko") {
      const sourceContent = getSourceContent(problemData);
      if (sourceContent) {
        translateContent(sourceContent, "ko");
      }
      setNeedsTranslation(false);
    }
  }, [needsTranslation, problemData, language]);

  // 언어 변경 처리
  const handleLanguageChange = async (newLang: Language) => {
    setLanguage(newLang);
    setTranslatedContent(null);
    setError(null);

    if (newLang === "ko" && problemData) {
      // 한국어는 번역 필요
      const sourceContent = getSourceContent(problemData);
      if (sourceContent) {
        await translateContent(sourceContent, "ko");
      }
    }
  };

  // 현재 표시할 콘텐츠 결정
  const getCurrentContent = (): string => {
    if (!problemData) return "";

    if (language === "ko" && translatedContent) {
      return translatedContent;
    }

    if (language === "ja") {
      return problemData.content.ja || problemData.content.full || "";
    }

    // 기본: 영어
    return problemData.content.en || problemData.content.full || "";
  };

  // KaTeX로 수식 렌더링된 HTML 생성 (useMemo로 캐싱)
  const renderedHtml = useMemo(() => {
    if (!problemData) return '';

    let html = problemData.styles + getCurrentContent();

    // \[ ... \] 디스플레이 수식 처리
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    });

    // \( ... \) 인라인 수식 처리
    html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    });

    // $ ... $ 인라인 수식 처리
    html = html.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    });

    // <var>...</var> 태그 처리
    html = html.replace(/<var>(.*?)<\/var>/g, (match, content) => {
      try {
        return katex.renderToString(content.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    });

    return html;
  }, [problemData, language, translatedContent]);

  // URL 변경 시 문제 로드 (언어 설정은 유지, 번역 캐시만 리셋)
  useEffect(() => {
    if (problemUrl) {
      setTranslatedContent(null);
      fetchProblem(problemUrl).then((data) => {
        // 한국어 상태에서 새 문제 로드 시 자동 번역
        if (data && language === "ko") {
          setNeedsTranslation(true);
        }
      });
    } else {
      setProblemData(null);
    }
  }, [problemUrl]);

  // 새로고침 - 현재 언어 유지
  const handleRefresh = async () => {
    if (problemUrl) {
      const currentLang = language;

      // 한국어인 경우 번역 필요 플래그 설정
      if (currentLang === "ko") {
        setNeedsTranslation(true);
      }

      await fetchProblem(problemUrl);
    }
  };

  const handleOpenExternal = () => {
    if (problemUrl) {
      window.open(problemUrl, "_blank");
    }
  };

  if (!problemUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-center text-foreground">
          <p className="text-lg font-medium">문제가 선택되지 않았습니다</p>
          <p className="text-sm mt-2">
            Problems 페이지에서 문제를 선택하면 여기에 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  // 일본어 콘텐츠 존재 여부 확인
  const hasJapanese =
    problemData?.content.ja && problemData.content.ja.trim().length > 0;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* 상단 툴바 */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {problemData?.title ? (
            <span className="text-sm font-medium truncate">
              {problemData.title}
            </span>
          ) : (
            <span className="text-sm text-foreground truncate">
              {problemUrl}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 언어 선택 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1"
                disabled={isLoading || isTranslating}
              >
                <Languages className="h-4 w-4" />
                <span className="text-xs">{languageLabels[language]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleLanguageChange("en")}
                className={language === "en" ? "bg-accent" : ""}
              >
                English
              </DropdownMenuItem>
              {hasJapanese && (
                <DropdownMenuItem
                  onClick={() => handleLanguageChange("ja")}
                  className={language === "ja" ? "bg-accent" : ""}
                >
                  日本語
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => handleLanguageChange("ko")}
                className={language === "ko" ? "bg-accent" : ""}
              >
                한국어 (번역)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            title="새로고침"
            disabled={isLoading || isTranslating}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading || isTranslating ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenExternal}
            title="새 탭에서 열기"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <Loader size={24} />
          </div>
        ) : isTranslating ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="flex items-center gap-2 text-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>번역 중...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 p-4">
            <p className="text-destructive text-center">{error}</p>
            <Button variant="outline" onClick={handleRefresh}>
              다시 시도
            </Button>
          </div>
        ) : problemData ? (
          <div className="p-4">
            {/* 시간/메모리 제한 */}
            {(problemData.timeLimit || problemData.memoryLimit) && (
              <div className="mb-4 text-sm text-foreground flex gap-4">
                {problemData.timeLimit && <span>{problemData.timeLimit}</span>}
                {problemData.memoryLimit && (
                  <span>{problemData.memoryLimit}</span>
                )}
              </div>
            )}

            {/* 문제 내용 */}
            <div
              className="task-statement prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: renderedHtml,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});
