# Solve Helper

AtCoder 문제를 AI 코치와 함께 풀며 실력을 키우는 학습 플랫폼.

🔗 **https://solve-helper.space/**

다국어 지원: 한국어 / English / 日本語

## 주요 기능

### `/chat` — AI 채팅 코칭
- 문제별 AI 상담, 단계별 힌트 제공 (정답을 바로 알려주지 않음)
- 채팅 히스토리 저장·재개
- 사용자 선택 언어로 응답

### `/practice` — 맞춤 문제 추천
- 사용자 레이팅 ±500 범위 문제 자동 추천
- 난이도별 색상 구분, 가챠 스타일 뽑기 UI
- 연습 세션 기록

### `/problems` — 문제 아카이브
- ABC / ARC / AGC 전체 문제 검색 및 페이지네이션
- 개인 풀이 상태 배지 [AC] / [WA]
- 풀이 완료 문제 필터

### `/profile` — 프로필 & 통계
- AtCoder 핸들 연동 및 레이팅 동기화
- 풀이 잔디 heatmap, 레이팅 그래프, 난이도 분포
- AI 토큰 사용량

### `/guide` — 사용 가이드
- 서비스 사용법 안내

## 기술 스택

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui (Radix), Lucide Icons, Motion
- **AI**: Vercel AI SDK + `@ai-sdk/google` (Gemini)
- **DB / Auth**: Supabase (PostgreSQL, RLS, Auth)
- **차트**: Recharts
- **콘텐츠 렌더링**: react-markdown, KaTeX (수식), Shiki / Streamdown (코드)
- **외부 API**: AtCoder, Kenkoo

## 프로젝트 구조

```
with-supabase-app/
├── app/                  # Next.js App Router
│   ├── chat/            # AI 채팅
│   ├── practice/        # 문제 추천 / 풀이 세션
│   ├── problems/        # 문제 아카이브
│   ├── profile/         # 프로필
│   ├── guide/           # 사용 가이드
│   ├── admin/           # 관리자
│   ├── auth/            # 로그인 / 회원가입
│   ├── api/             # API 라우트
│   │   ├── chat/       # AI 스트리밍
│   │   ├── cron/       # 문제 동기화
│   │   ├── atcoder/    # AtCoder 연동
│   │   ├── practice/   # 세션 처리
│   │   ├── problem/    # 문제 조회
│   │   ├── translate/  # 번역
│   │   └── user/       # 유저 데이터
│   └── actions.ts       # Server Actions
├── components/          # React 컴포넌트
│   └── ui/             # shadcn/ui 기본 컴포넌트
├── lib/
│   ├── supabase/       # Supabase 클라이언트 (server/client/service-role)
│   ├── atcoder/        # AtCoder 문제 로직
│   └── translations.ts # 다국어 문자열 (ko/en/ja)
└── domains/            # 도메인 로직 (schema / action / handler)
```

## 라이선스

MIT
