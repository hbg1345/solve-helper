import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MODEL_NAME = "gemini-2.5-flash-lite";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증: 로그인한 사용자만 번역 호출 가능 (공개 엔드포인트 비용 남용 방지)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, targetLang, problemUrl } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (!targetLang || !["ko", "ja", "en"].includes(targetLang)) {
      return NextResponse.json(
        { error: "Invalid target language" },
        { status: 400 }
      );
    }

    // problemUrl이 있으면 캐시 확인
    if (problemUrl) {
      const { data: cached } = await supabase
        .from("problem_translations")
        .select("translated_content")
        .eq("problem_url", problemUrl)
        .eq("target_lang", targetLang)
        .single();

      if (cached?.translated_content) {
        return NextResponse.json({
          translated: cached.translated_content,
          targetLang,
          cached: true,
        });
      }
    }

    // 캐시 없으면 AI 번역
    const systemPrompt = targetLang === "ko"
      ? `당신은 경쟁 프로그래밍 문제 전문 번역가입니다.

[핵심 임무] 반드시 한국어로 번역하세요! 일본어나 영어 텍스트를 한국어로 번역해야 합니다!

다음 HTML 콘텐츠의 모든 텍스트를 한국어로 번역하세요.

번역 규칙:
1. 모든 일본어/영어 텍스트 → 한국어로 번역
2. HTML 태그는 그대로 유지 (수정/추가/삭제 금지)
3. 수식, LaTeX (\\(...\\), \\[...\\], $...$) → 그대로 유지
4. 변수명, 코드 → 그대로 유지
5. 샘플 입력/출력 (pre 태그 내용) → 번역하지 말고 그대로 유지
6. HTML 구조 유지
7. <var>태그는 절대 수정하지 마세요! <var>N</var>, <var>A_i</var> 등을 그대로 유지하세요. 태그 앞뒤에 줄바꿈을 넣지 마세요. 인라인으로 유지하세요.
8. \\(...\\) 수식 앞뒤에 줄바꿈을 넣지 마세요. 문장 안에 인라인으로 유지하세요.

출력: 한국어로 번역된 HTML만 출력. 설명 없이 HTML만.

다시 한번 강조: 반드시 한국어로 번역하세요!`
      : targetLang === "ja"
      ? `あなたは競技プログラミング問題の専門翻訳者です。
以下のHTMLコンテンツを日本語に翻訳してください。

重要なルール:
1. すべてのHTMLタグはそのまま維持してください
2. タグ間のテキスト内容のみ翻訳してください
3. 数式、LaTeXはそのまま維持してください
4. 変数名、コードスニペット、技術用語はそのままにしてください
5. サンプル入出力は翻訳しないでください
6. preタグの内容は変更しないでください
7. HTML構造を正確に維持してください

翻訳されたHTMLのみを返してください。`
      : `You are a professional translator specializing in competitive programming problems.
Translate the following HTML content to English.

CRITICAL RULES:
1. Preserve ALL HTML tags exactly as they are
2. Only translate the text content between tags
3. Keep all mathematical expressions, formulas, and LaTeX intact
4. Keep all variable names, code snippets, and technical terms
5. Preserve sample inputs/outputs exactly as they are
6. Keep pre tags content unchanged
7. Maintain the exact same HTML structure

Return ONLY the translated HTML without any explanation.`;

    const result = await generateText({
      model: google(MODEL_NAME),
      system: systemPrompt,
      prompt: content,
    });

    const translatedContent = result.text;

    // problemUrl이 있으면 캐시에 저장 (쓰기는 RLS 우회가 필요하므로 service_role)
    if (problemUrl && translatedContent) {
      const { error: upsertError } = await createServiceRoleClient()
        .from("problem_translations")
        .upsert(
          {
            problem_url: problemUrl,
            target_lang: targetLang,
            translated_content: translatedContent,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "problem_url,target_lang",
          }
        );

      if (upsertError) {
        console.error("Failed to cache translation:", upsertError);
      }
    }

    return NextResponse.json({
      translated: translatedContent,
      targetLang,
      cached: false,
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
