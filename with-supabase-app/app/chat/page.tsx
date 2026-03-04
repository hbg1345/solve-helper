"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader } from "@/components/ai-elements/loader";
import ChatComponent from "./ChatComponent";
import { useChatLayout } from "./ChatLayoutContext";

function ChatPageContent() {
  const { selectedChatId, setSelectedChatId } = useChatLayout();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [initialProblemId, setInitialProblemId] = useState<string | null>(null);

  // URL에서 chatId 또는 problemId 파라미터 확인
  useEffect(() => {
    const chatIdParam = searchParams.get("chatId");
    const problemId = searchParams.get("problemId");

    if (chatIdParam) {
      // chatId가 있으면 해당 채팅 선택
      setSelectedChatId(chatIdParam);
      // URL에서 쿼리 파라미터 제거
      router.replace("/chat", { scroll: false });
    } else if (problemId) {
      // 새 채팅 시작을 위해 selectedChatId를 null로 설정
      setSelectedChatId(null);
      setInitialProblemId(problemId);
      // URL에서 쿼리 파라미터 제거 (히스토리에 남지 않도록)
      router.replace("/chat", { scroll: false });
    }
  }, [searchParams, setSelectedChatId, router]);

  // 채팅 ID 변경 핸들러 (저장 완료 후에만 호출)
  const handleChatIdChange = useCallback(
    (chatId: string | null) => {
      if (chatId !== selectedChatId) {
        setSelectedChatId(chatId);
        // 채팅이 저장되면 initialProblemId 초기화
        if (chatId) {
          setInitialProblemId(null);
        }
      }
    },
    [selectedChatId, setSelectedChatId]
  );

  return (
    <ChatComponent
      chatId={selectedChatId}
      onChatIdChange={handleChatIdChange}
      initialProblemId={initialProblemId}
    />
  );
}

export default function Page() {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden flex-1 min-h-0">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <Loader />
          </div>
        }
      >
        <ChatPageContent />
      </Suspense>
    </div>
  );
}
