import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import { parseHintsFromMessage, extractAllHints, type Hint } from "@/lib/hints";

export type SerializedMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
};

interface ChatData {
  messages: UIMessage[];
  title: string;
  problemUrl: string | null;
  hints: Hint[] | null;
  summary: string | null;
  summaryMessageCount: number | null;
  lastInputTokens: number | null;
}

/**
 * DB에서 채팅을 로드합니다 (이미 인증된 상태에서 호출).
 */
export async function loadChatFromDB(
  supabase: SupabaseClient,
  chatId: string,
  userId: string
): Promise<ChatData | null> {
  const { data, error } = await supabase
    .from("chat_history")
    .select("messages, title, problem_url, hints, summary, summary_message_count, last_input_tokens")
    .eq("id", chatId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    console.error("Failed to load chat from DB:", error);
    return null;
  }

  const messages = JSON.parse(data.messages) as SerializedMessage[];
  // SerializedMessage → UIMessage 변환: parts가 있으면 사용, 없으면 content로 생성
  const uiMessages: UIMessage[] = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as UIMessage["role"],
    parts:
      msg.parts && msg.parts.length > 0
        ? msg.parts
        : [{ type: "text" as const, text: msg.content }],
  })) as UIMessage[];

  return {
    messages: uiMessages,
    title: data.title,
    problemUrl: data.problem_url,
    hints: data.hints,
    summary: data.summary ?? null,
    summaryMessageCount: data.summary_message_count ?? null,
    lastInputTokens: data.last_input_tokens ?? null,
  };
}

/**
 * 새 채팅 레코드를 pre-create합니다 (스트리밍 전에 chatId 확보).
 */
export async function createChatRecord(
  supabase: SupabaseClient,
  userId: string,
  firstMessage: UIMessage,
  problemUrl?: string | null
): Promise<string | null> {
  const serialized = serializeMessage(firstMessage);
  const title = generateTitle([firstMessage]);

  const insertData: Record<string, unknown> = {
    user_id: userId,
    messages: JSON.stringify([serialized]),
    title,
  };
  if (problemUrl) {
    insertData.problem_url = problemUrl;
  }

  const { data, error } = await supabase
    .from("chat_history")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create chat record:", error);
    return null;
  }

  return data.id;
}

/**
 * 스트리밍 완료 후 채팅을 저장합니다 (onFinish에서 호출).
 */
export async function saveChatAfterStream(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  messages: UIMessage[],
  problemUrl: string | null,
  existingTitle?: string | null,
  hasProblemUrl?: boolean
): Promise<void> {
  // 메시지 직렬화
  const serializedMessages = messages.map(serializeMessage);

  // 마지막 assistant 메시지에서만 새 힌트 추출 (이전 힌트는 DB에 이미 저장됨)
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const newHints = lastAssistantMsg
    ? extractAllHints([
        {
          role: lastAssistantMsg.role,
          parts: lastAssistantMsg.parts?.map((p) => ({
            type: p.type,
            text: "text" in p ? (p as { text?: string }).text : undefined,
          })),
        },
      ])
    : null;

  // 제목 결정: problemUrl이 있으면 기존 제목 유지
  const shouldUpdateTitle = !hasProblemUrl;
  let title = existingTitle || "New Chat";
  if (shouldUpdateTitle && !existingTitle) {
    title = generateTitle(messages);
  }

  const updateData: Record<string, unknown> = {
    messages: JSON.stringify(serializedMessages),
  };

  if (shouldUpdateTitle) {
    updateData.title = title;
  }

  // 새 힌트가 있으면 기존 DB 힌트에 append
  if (newHints && newHints.length > 0) {
    const { data: existingData } = await supabase
      .from("chat_history")
      .select("hints")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    const existingHints: Hint[] = existingData?.hints ?? [];
    updateData.hints = [...existingHints, ...newHints];
  }

  const { error } = await supabase
    .from("chat_history")
    .update(updateData)
    .eq("id", chatId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to save chat after stream:", error);
  }
}

/**
 * UIMessage를 DB 저장용 형식으로 직렬화합니다.
 */
function serializeMessage(msg: UIMessage): SerializedMessage {
  return {
    id: msg.id,
    role: msg.role as SerializedMessage["role"],
    content:
      msg.parts
        ?.map((part) => {
          if (part.type === "text" && "text" in part)
            return (part as { text: string }).text;
          return "";
        })
        .join("") || "",
    parts: msg.parts as SerializedMessage["parts"],
  };
}

/**
 * 첫 사용자 메시지에서 제목을 생성합니다.
 */
function generateTitle(messages: UIMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    const textPart = firstUserMsg.parts?.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      return ((textPart as { text: string }).text).substring(0, 50);
    }
  }
  return "New Chat";
}
