export type Hint = {
  step: number;
  content: string;
};

/**
 * AI 메시지에서 JSON 형식의 힌트를 파싱합니다.
 * 서버/클라이언트 양쪽에서 사용 가능한 순수 함수.
 */
export function parseHintsFromMessage(text: string): {
  hintContents: string[] | null;
  textWithoutHints: string;
} {
  let resultText = text;
  const hintContents: string[] = [];

  // JSON 블록 추출 함수 - 중괄호 매칭으로 완전한 JSON 찾기
  const extractJsonBlocks = (str: string): string[] => {
    const blocks: string[] = [];
    let i = 0;

    while (i < str.length) {
      if (str[i] === '{') {
        let depth = 1;
        let j = i + 1;
        let inString = false;
        let escape = false;

        while (j < str.length && depth > 0) {
          const char = str[j];

          if (escape) {
            escape = false;
          } else if (char === '\\' && inString) {
            escape = true;
          } else if (char === '"' && !escape) {
            inString = !inString;
          } else if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') depth--;
          }
          j++;
        }

        if (depth === 0) {
          blocks.push(str.slice(i, j));
        }
        i = j;
      } else {
        i++;
      }
    }

    return blocks;
  };

  // JSON 블록들 추출 및 파싱
  const jsonBlocks = extractJsonBlocks(text);

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);

      if (parsed?.type === "hint" && parsed?.content) {
        hintContents.push(parsed.content);
        resultText = resultText.replace(block, "").trim();
      } else if (parsed?.type === "response" && parsed?.content) {
        resultText = resultText.replace(block, parsed.content).trim();
      }
    } catch {
      // JSON.parse 실패 시 (LaTeX 백슬래시, 개행 등) 수정 후 재시도
      try {
        const fixed = block
          .replace(/[\r\n]+/g, ' ')
          .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
        const parsed = JSON.parse(fixed);

        if (parsed?.type === "hint" && parsed?.content) {
          hintContents.push(parsed.content);
          resultText = resultText.replace(block, "").trim();
        } else if (parsed?.type === "response" && parsed?.content) {
          resultText = resultText.replace(block, parsed.content).trim();
        }
      } catch {
        // 그래도 실패하면 무시
      }
    }
  }

  // 불완전한 JSON 블록 감지 (파싱되지 않은 JSON이 남아있으면)
  const hasUnparsedJson = resultText.trim().startsWith('{') && !resultText.trim().endsWith('}');

  if (hintContents.length > 0) {
    return {
      hintContents,
      textWithoutHints: hasUnparsedJson ? '' : resultText // 불완전한 JSON은 숨김
    };
  }

  return {
    hintContents: null,
    textWithoutHints: hasUnparsedJson ? '' : resultText // 불완전한 JSON은 숨김
  };
}

/**
 * 메시지 배열에서 모든 힌트를 추출하여 순차적으로 번호를 부여합니다.
 */
export function extractAllHints(
  messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>
): Hint[] | null {
  const allHints: Hint[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts ?? []) {
      if (part.type === "text" && part.text) {
        const { hintContents } = parseHintsFromMessage(part.text);
        if (hintContents) {
          for (const content of hintContents) {
            allHints.push({ step: allHints.length + 1, content });
          }
        }
      }
    }
  }
  return allHints.length > 0 ? allHints : null;
}
