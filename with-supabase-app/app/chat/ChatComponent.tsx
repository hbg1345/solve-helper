"use client";
import { Button } from "@/components/ui/button";
import { useAnimeMode } from "@/components/anime-mode-context";
import { useLanguage } from "@/components/language-context";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { useState, useEffect, useRef } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { CopyIcon, RefreshCcwIcon, AlertCircleIcon, SquareIcon, XIcon, CornerDownLeftIcon, VideoIcon } from "lucide-react";
import {
  getChatHistory,
} from "@/app/actions";
import type { Hint } from "@/lib/hints";
import { useChatLayout } from "./ChatLayoutContext";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { HintsCard, parseHintsFromMessage } from "@/components/hints-card";
import {
  ProblemSelectCard,
  parseSearchResultsFromPart,
} from "@/components/problem-select-card";

interface ChatBotDemoProps {
  chatId?: string | null;
  onChatIdChange?: (chatId: string | null) => void;
  initialProblemId?: string | null;
}

// 마지막 메시지만 서버로 전송하는 transport (AI SDK 6 패턴)
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ messages, body }) => {
    const requestBody = {
      message: messages[messages.length - 1],
      chatId: body?.chatId,
      problemUrl: body?.problemUrl,
      isAnimeMode: body?.isAnimeMode,
      language: body?.language,
    };
    return { body: requestBody };
  },
});

const ChatBotDemo = ({ chatId, onChatIdChange, initialProblemId }: ChatBotDemoProps) => {
  const { isAnimeMode } = useAnimeMode();
  const { lang, tr } = useLanguage();
  const prevChatIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    return () => {
      // unmount 시 상태 초기화하여 다음 mount 시 DB 로드하도록
      hasLoadedRef.current = false;
      prevChatIdRef.current = null;
    };
  }, []);

  const [input, setInput] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [problemUrl, setProblemUrl] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState<string | null>(null);
  const [tokenLimitExceeded, setTokenLimitExceeded] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(isAnimeMode);

  // 애니 모드 변경 시 배경도 함께 변경
  useEffect(() => {
    setBackgroundEnabled(isAnimeMode);
  }, [isAnimeMode]);

  const { messages, setMessages, sendMessage, status, regenerate, stop } = useChat({
    transport,
    onError: (err) => {
      // 429 에러 (토큰 제한 초과) 감지
      if (err.message?.includes("429") || err.message?.includes("MONTHLY_LIMIT_EXCEEDED") || err.message?.includes("GLOBAL_BUDGET_EXCEEDED")) {
        setTokenLimitExceeded(true);
      }
    },
  });
  const { setRefreshTrigger, setProblemUrl: setContextProblemUrl } = useChatLayout();
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  // DB 기반 hints state
  const [hints, setHints] = useState<Hint[] | null>(null);
  const prevStatusRef = useRef<string>(status);
  const problemChangedRef = useRef(false);

  // 문제 선택 핸들러
  const handleProblemSelect = async (problemId: string) => {
    if (!chatId) {
      console.error("Cannot link problem: chatId is not set");
      return;
    }

    // 같은 문제면 아무 작업도 하지 않음
    if (selectedProblemId === problemId) {
      return;
    }

    try {
      const response = await fetch("/api/link-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, problemId }),
      });

      if (!response.ok) {
        throw new Error("Failed to link problem");
      }

      const data = await response.json();

      // 상태 업데이트 (문제 전환 시 이전 힌트 초기화)
      setSelectedProblemId(problemId);
      setHints(null);
      setProblemUrl(data.problemUrl);
      setChatTitle(data.title);
      setContextProblemUrl(data.problemUrl);
      setRefreshTrigger((prev) => prev + 1);

      // 채팅 리로드 (DB의 hints: null이 반영되도록)
      const chatData = await getChatHistory(chatId);
      if (chatData) {
        const convertedMessages = chatData.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          parts: msg.parts && msg.parts.length > 0
            ? msg.parts
            : [{ type: "text" as const, text: msg.content }],
        })) as UIMessage[];
        setMessages(convertedMessages);
      }

      // 선택 상태 리셋
      setSelectedProblemId(null);
    } catch (error) {
      console.error("Failed to select problem:", error);
    }
  };

  // initialProblemId가 있으면 문제 정보 가져와서 컨텍스트 설정
  useEffect(() => {
    if (!initialProblemId) return;

    const fetchProblemInfo = async () => {
      try {
        // 문제 정보 가져오기
        const response = await fetch(`/api/problem?problemId=${initialProblemId}`);
        if (response.ok) {
          const data = await response.json();
          const contestId = initialProblemId.split("_")[0];
          const url = `https://atcoder.jp/contests/${contestId}/tasks/${initialProblemId}`;

          setProblemUrl(url);
          setChatTitle(data.title || initialProblemId);

          // 초기 메시지 설정
          setInitialMessage(
            `${data.title || initialProblemId} 문제에 대해 질문이 있습니다.\n\n이 문제를 어떻게 접근해야 할지 알려주세요.`
          );
          setInput(
            `${data.title || initialProblemId} 문제에 대해 질문이 있습니다.\n\n이 문제를 어떻게 접근해야 할지 알려주세요.`
          );
        } else {
          // API 실패해도 기본 컨텍스트 설정
          const contestId = initialProblemId.split("_")[0];
          const url = `https://atcoder.jp/contests/${contestId}/tasks/${initialProblemId}`;

          setProblemUrl(url);
          setChatTitle(initialProblemId);
          setInitialMessage(`${initialProblemId} 문제에 대해 질문이 있습니다.\n\n이 문제를 어떻게 접근해야 할지 알려주세요.`);
          setInput(`${initialProblemId} 문제에 대해 질문이 있습니다.\n\n이 문제를 어떻게 접근해야 할지 알려주세요.`);
        }
      } catch (error) {
        console.error("Failed to fetch problem info:", error);
        // 실패해도 기본 컨텍스트 설정
        const contestId = initialProblemId.split("_")[0];
        const url = `https://atcoder.jp/contests/${contestId}/tasks/${initialProblemId}`;

        setProblemUrl(url);
        setChatTitle(initialProblemId);
        setInitialMessage(`${initialProblemId} 문제에 대해 질문이 있습니다.\n\n이 문제를 어떻게 접근해야 할지 알려주세요.`);
        setInput(`${initialProblemId} 문제에 대해 질문이 있습니다.\n\n이 문제를 어떻게 접근해야 할지 알려주세요.`);
      }
    };

    fetchProblemInfo();
  }, [initialProblemId]);

  // chatId가 변경되면 해당 채팅 로드
  useEffect(() => {
    const prevChatId = prevChatIdRef.current;

    // chatId가 변경되지 않았으면 무시
    if (chatId === prevChatId) {
      return;
    }

    if (chatId) {
      setIsLoadingChat(true);
      getChatHistory(chatId).then((chatData) => {
        if (chatData && chatData.messages.length > 0) {
          const convertedMessages = chatData.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            parts: msg.parts && msg.parts.length > 0
              ? msg.parts
              : [{ type: "text" as const, text: msg.content }],
          })) as UIMessage[];
          setMessages(convertedMessages);
          setProblemUrl(chatData.problemUrl || null);
          setChatTitle(chatData.title || null);
          setHints(chatData.hints ?? null);
        } else {
          // 새 채팅이거나 메시지 없음 — 반드시 초기화
          setMessages([]);
          setProblemUrl(null);
          setChatTitle(null);
          setHints(null);
        }
        setSelectedProblemId(null);
        setIsLoadingChat(false);
      });
    } else if (!chatId) {
      // chatId가 null/undefined인 경우 - 상태 초기화만 (새 채팅은 사이드바에서 생성)
      setMessages([]);
      setProblemUrl(null);
      setChatTitle(null);
      setHints(null);
      setSelectedProblemId(null);
    }

    prevChatIdRef.current = chatId || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, setMessages]);

  // 메시지에서 linkProblemToChat tool output 감지 (실시간)
  // AI tool이 이미 DB를 업데이트했으므로 클라이언트 상태만 동기화
  // 역순 스캔: 가장 마지막(최신) 문제 연결 결과를 사용
  useEffect(() => {
    if (messages.length === 0) return;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== "assistant") continue;

      for (const part of message.parts) {
        if (part.type === "tool-linkProblemToChat") {
          const toolPart = part as {
            type: string;
            state?: string;
            output?: { success?: boolean; problemId?: string; problemUrl?: string; title?: string };
          };
          if (toolPart.state === "output-available" && toolPart.output?.success) {
            const toolProblemUrl = toolPart.output.problemUrl;
            if (toolProblemUrl && toolProblemUrl !== problemUrl) {
              setProblemUrl(toolProblemUrl);
              setChatTitle(toolPart.output.title || null);
              setContextProblemUrl(toolProblemUrl);
              setHints(null);
              problemChangedRef.current = true;
            }
            return;
          }
        }
      }
    }
  }, [messages, problemUrl, setContextProblemUrl]);

  // 서버에서 새 chatId가 metadata로 전달되면 감지
  useEffect(() => {
    if (chatId || messages.length === 0) return;

    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.metadata) continue;
      const metadata = msg.metadata as { newChatId?: string };

      if (metadata.newChatId) {
        onChatIdChange?.(metadata.newChatId);
        setRefreshTrigger((prev) => prev + 1);
        return;
      }
    }
  }, [messages, chatId, problemUrl, onChatIdChange, setRefreshTrigger, setContextProblemUrl]);

  // 스트림 완료 후 마지막 메시지에서 힌트 파싱하여 append
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prevStatus !== "ready" && status === "ready") {
      // 문제 변경 직후면 스킵 (hints는 이미 null로 설정됨)
      if (problemChangedRef.current) {
        problemChangedRef.current = false;
        return;
      }

      // 마지막 assistant 메시지에서 새 힌트 추출
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
      if (!lastAssistantMsg) return;

      const textParts = lastAssistantMsg.parts
        .filter((p) => p.type === "text" && "text" in p)
        .map((p) => (p as { text: string }).text)
        .join("");

      const { hintContents } = parseHintsFromMessage(textParts);
      if (hintContents && hintContents.length > 0) {
        setHints((prev) => {
          const existingCount = prev?.length ?? 0;
          const newHints: Hint[] = hintContents.map((content, i) => ({
            step: existingCount + i + 1,
            content,
          }));
          return [...(prev ?? []), ...newHints];
        });
      }
    }
  }, [status, messages]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(
      {
        text: message.text || "Sent with attachments",
        files: message.files,
      },
      {
        body: {
          chatId: chatId || undefined,
          problemUrl: problemUrl || undefined,
          isAnimeMode,
          language: lang,
        },
      }
    );
    setInput("");
  };
  return (
    <div className="w-full h-full flex flex-col overflow-hidden max-w-4xl mx-auto relative">
      {/* Background Videos - fade between them */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover -z-10 transition-opacity duration-500 ${
          backgroundEnabled && status === "ready" ? "opacity-30" : "opacity-0"
        }`}
      >
        <source src="https://fskgibfypuqcmkcosgax.supabase.co/storage/v1/object/public/Solve%20Helper/generated_video.mp4" type="video/mp4" />
      </video>
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover -z-10 transition-opacity duration-500 ${
          backgroundEnabled && status !== "ready" ? "opacity-30" : "opacity-0"
        }`}
      >
        <source src="https://fskgibfypuqcmkcosgax.supabase.co/storage/v1/object/public/Solve%20Helper/generated_video%20(1).mp4" type="video/mp4" />
      </video>

      {isLoadingChat ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex flex-col relative z-10">
            {/* 힌트 패널 - hints가 있고 문제 전환 직후가 아닐 때만 표시 */}
            {hints && hints.length > 0 && selectedProblemId === null && (
              <div className="flex-shrink-0 px-4 py-3 border-b bg-muted/20 flex items-start justify-between gap-4">
                <HintsCard key={problemUrl ?? chatId} hints={hints} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBackgroundEnabled(!backgroundEnabled)}
                  aria-label={backgroundEnabled ? tr.chat.bgOff : tr.chat.bgOn}
                  className={backgroundEnabled ? "" : "opacity-40"}
                >
                  <VideoIcon className="size-4" />
                </Button>
              </div>
            )}
            <Conversation className="flex-1 min-h-0">
              <ConversationContent>
              {messages.map((message, messageIndex) => {
                return (
                <div key={`${message.id}-${messageIndex}`}>
                  {message.role === "assistant" &&
                    message.parts.filter((part) => part.type === "source-url")
                      .length > 0 && (
                      <Sources>
                        <SourcesTrigger
                          count={
                            message.parts.filter(
                              (part) => part.type === "source-url"
                            ).length
                          }
                        />
                        {message.parts
                          .filter((part) => part.type === "source-url")
                          .map((part, i) => (
                            <SourcesContent key={`${message.id}-${i}`}>
                              <Source
                                key={`${message.id}-${i}`}
                                href={part.url}
                                title={part.url}
                              />
                            </SourcesContent>
                          ))}
                      </Sources>
                    )}
                  {message.parts.map((part, i) => {
                    // searchProblems 도구 결과 파싱 (null이 아니면 렌더링 - 빈 배열도 포함)
                    const searchResults = parseSearchResultsFromPart(part);
                    if (searchResults !== null) {
                      return (
                        <div key={`${message.id}-${i}`} className="my-2">
                          <ProblemSelectCard
                            problems={searchResults}
                            onSelect={handleProblemSelect}
                            selectedProblemId={selectedProblemId}
                          />
                        </div>
                      );
                    }

                    switch (part.type) {
                      case "text":
                        // hints 블록 파싱
                        const { hintContents: parsedHints, textWithoutHints } = parseHintsFromMessage(part.text);

                        return (
                          <Message
                            key={`${message.id}-${i}`}
                            from={message.role}
                          >
                            <MessageContent>
                              {/* 힌트는 content만 텍스트로 표시 (번호는 HintsCard에서 표시) */}
                              {parsedHints && parsedHints.map((content, idx) => (
                                <MessageResponse key={idx}>
                                  {tr.chat.hintLabel(content)}
                                </MessageResponse>
                              ))}
                              {/* 나머지 텍스트 표시 */}
                              {textWithoutHints && (
                                <MessageResponse>{textWithoutHints}</MessageResponse>
                              )}
                            </MessageContent>
                            {message.role === "assistant" &&
                              i === messages.length - 1 && (
                                <MessageActions>
                                  <MessageAction
                                    onClick={() => regenerate()}
                                    label="Retry"
                                  >
                                    <RefreshCcwIcon className="size-3" />
                                  </MessageAction>
                                  <MessageAction
                                    onClick={() =>
                                      navigator.clipboard.writeText(part.text)
                                    }
                                    label="Copy"
                                  >
                                    <CopyIcon className="size-3" />
                                  </MessageAction>
                                </MessageActions>
                              )}
                          </Message>
                        );
                      case "reasoning":
                        return (
                          <Reasoning
                            key={`${message.id}-${i}`}
                            className="w-full"
                            isStreaming={
                              status === "streaming" &&
                              i === message.parts.length - 1 &&
                              message.id === messages.at(-1)?.id
                            }
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              );
              })}
              {status !== "ready" && (
                <div className="flex items-center gap-1 py-4 text-foreground">
                  <span className="text-sm">{tr.chat.thinking}</span>
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse [animation-delay:0.4s]" />
                  </span>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          </div>
        </>
      )}
      <div className="flex-shrink-0 p-4 relative z-10">
        {tokenLimitExceeded && (
          <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
            <AlertCircleIcon className="size-4 flex-shrink-0" />
            <span>{tr.chat.tokenExceeded}</span>
          </div>
        )}
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              disabled={tokenLimitExceeded}
              placeholder={tokenLimitExceeded ? tr.chat.tokenLimitPlaceholder : undefined}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              disabled={tokenLimitExceeded || (!input && status === "ready")}
              status={status}
              onClick={(e) => {
                if (status !== "ready") {
                  e.preventDefault();
                  stop();
                }
              }}
            >
              {status !== "ready" && status !== "error" ? (
                <SquareIcon className="size-4" />
              ) : status === "error" ? (
                <XIcon className="size-4" />
              ) : (
                <CornerDownLeftIcon className="size-4" />
              )}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
export default ChatBotDemo;
