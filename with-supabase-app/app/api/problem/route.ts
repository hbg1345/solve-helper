import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // AtCoder URL 검증
  if (!url.startsWith("https://atcoder.jp/")) {
    return NextResponse.json({ error: "Invalid AtCoder URL" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5,ja;q=0.3",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch problem: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 제목 추출
    const title = $("span.h2").first().text().trim();

    // 시간/메모리 제한 추출 (콘텐츠 추출 전에 먼저)
    // 보통 "Time Limit: 2 sec / Memory Limit: 1024 MiB" 형식으로 한 줄에 있음
    const limitText = $("p:contains('Time Limit')").first().text().trim();
    const timeLimit = limitText || "";
    const memoryLimit = ""; // timeLimit에 이미 포함됨

    // 콘텐츠에서 time/memory limit 요소 제거 (중복 방지)
    $("#task-statement p:contains('Time Limit')").remove();

    // 영어 콘텐츠 추출
    const langEn = $("#task-statement .lang-en").html();
    // 일본어 콘텐츠 추출
    const langJa = $("#task-statement .lang-ja").html();
    // 전체 콘텐츠 (언어 구분 없는 경우)
    const fullContent = $("#task-statement").html();

    // 기본 스타일
    const styles = `
      <style>
        .task-statement {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: inherit;
        }
        .task-statement h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.5rem;
        }
        .task-statement section {
          margin-bottom: 1.5rem;
        }
        .task-statement p {
          margin-bottom: 0.75rem;
        }
        .task-statement pre {
          background-color: hsl(var(--muted));
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
          font-size: 0.875rem;
          margin: 0.75rem 0;
        }
        .task-statement var {
          font-style: italic;
          color: hsl(var(--primary));
        }
        .task-statement ul, .task-statement ol {
          margin-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .task-statement li {
          margin-bottom: 0.25rem;
        }
        .task-statement .sample-test-case {
          margin: 1rem 0;
        }
        .task-statement table {
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .task-statement th, .task-statement td {
          border: 1px solid var(--border);
          padding: 0.5rem;
        }
        .task-statement img {
          max-width: 100%;
          height: auto;
        }
      </style>
    `;

    return NextResponse.json({
      title,
      timeLimit,
      memoryLimit,
      content: {
        en: langEn,
        ja: langJa,
        full: fullContent,
      },
      styles,
      url,
    });
  } catch (error) {
    console.error("Error fetching problem:", error);
    return NextResponse.json(
      { error: "Failed to fetch problem content" },
      { status: 500 }
    );
  }
}
