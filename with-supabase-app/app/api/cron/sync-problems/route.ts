import { NextResponse } from "next/server";
import {
  collectAllProblemsFromKenkoo,
  populateContestsFromKenkooAPI,
  populateContestProblemsFromKenkooAPI,
} from "@/lib/atcoder/problems";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 보냄
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceRoleClient();

  try {
    // 1. 콘테스트 목록 동기화
    const contests = await populateContestsFromKenkooAPI(supabase);

    // 2. 문제 목록 + 난이도 동기화
    const problems = await collectAllProblemsFromKenkoo(supabase);

    // 3. 콘테스트-문제 매핑 동기화
    const contestProblems = await populateContestProblemsFromKenkooAPI(supabase);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      contests,
      problems,
      contestProblems,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.error("Cron sync-problems failed:", error);
    return NextResponse.json(
      {
        success: false,
        duration: `${duration}s`,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
