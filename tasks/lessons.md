# Lessons Learned

## 2024-02 AI 채팅 아키텍처 리팩토링

### 1. LangChain Structured Output 전략

**문제**: Gemini 모델에서 `providerStrategy`(네이티브 structured output)가 tool calling으로 fallback됨

**원인**: LangChain의 `withStructuredOutput`이 Gemini에서 버그가 있음

**해결**: `toolStrategy` 사용 + `invoke()` 호출 후 `result.structuredResponse` 사용

```typescript
// 잘못된 방식 (스트리밍 + structured output 혼용)
const stream = await agent.stream(...);

// 올바른 방식
const result = await agent.invoke(...);
return Response.json(result.structuredResponse);
```

**교훈**: 스트리밍과 structured output을 동시에 쓰려면 복잡해짐. 스트리밍이 필수 아니면 `invoke` 사용

---

### 2. responseSchema vs 시스템 프롬프트

**문제**: AI가 `{ type: "response", content: "...hint: ..." }` 형태로 응답 (type을 제대로 안 씀)

**원인**: 시스템 프롬프트에 `hint: 40자 이내...` 라고 적어서 AI가 혼란

**해결**: 시스템 프롬프트에서 중복 제거, `responseSchema.describe()`에 규칙 명시

```typescript
const responseSchema = z.object({
  type: z.enum(["hint", "response"]).describe(
    "hint: 새로운 힌트를 제공할 때 (40자 이내, ...). " +
    "response: 질문에 답변하거나 격려할 때 (100자 이내)"
  ),
  content: z.string().describe("응답 내용"),
});
```

**교훈**: structured output 사용 시 규칙은 스키마의 `.describe()`에 넣기. 시스템 프롬프트와 중복하면 혼란 발생

---

### 3. useChat 훅 vs 직접 fetch

**문제**: `@ai-sdk/react`의 `useChat`은 전체 messages 배열을 서버로 보냄

**원인**: useChat은 Vercel AI SDK 스트리밍 프로토콜에 맞춰 설계됨

**해결**: useChat 제거, 직접 fetch로 단일 message만 전송

```typescript
// useChat 방식 (전체 히스토리 전송)
sendMessage({ text, files }, { body: { chatId } });

// 직접 fetch 방식 (새 메시지만 전송)
await fetch("/api/chat", {
  body: JSON.stringify({ message: text, chatId }),
});
```

**교훈**: checkpointer로 히스토리 관리할 때는 useChat이 맞지 않음. 직접 구현이 더 명확

---

### 4. Serverless에서 Agent 생성 패턴

**고민**: 매 요청마다 `createAgent()` 호출이 비효율적인가?

**결론**:
- API route는 stateless, 요청 끝나면 메모리에서 사라짐
- checkpointer가 대화 히스토리를 DB에서 복원
- agent 객체 생성 비용은 거의 0, 실제 비용은 LLM API 호출

**대안 (미구현)**:
1. WebSocket으로 연결 유지 → agent 메모리에 유지
2. 모듈 레벨 캐싱 (단, 사용자별 분리 필요)

**현재 상태**: REST API + checkpointer 방식 유지. 성능상 문제 없음

---

### 5. chatId 생성 시점

**문제**: chatId가 없을 때 fallback으로 `crypto.randomUUID()` 사용?

**분석 결과**: 모든 정상 플로우에서 chatId는 API 호출 전에 생성됨
- 사이드바 "New Chat" → `saveChatHistory`로 먼저 생성
- 문제 링크 클릭 → `saveChatHistory`로 먼저 생성
- Practice "Ask Question" → `saveChatHistory`로 먼저 생성

**해결**: chatId를 필수로 변경, 없으면 400 에러

```typescript
if (!chatId) {
  return Response.json(
    { error: "MISSING_CHAT_ID", message: "chatId is required" },
    { status: 400 }
  );
}
```

---

## 미해결 과제

### WebSocket 방식 전환 검토
- 현재: REST API (요청마다 독립적)
- 고려: WebSocket으로 세션 유지 시 agent 재사용 가능
- 트레이드오프: 구현 복잡도 증가 vs 로그 깔끔함

### Checkpointer 동작 검증
- SupabaseSaver가 실제로 히스토리를 제대로 복원하는지 테스트 필요
- 여러 턴 대화 후 컨텍스트 유지 확인