import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      problemId,
      problemTitle,
      difficulty,
      timeLimit,
      elapsedTime,
      hintsUsed,
      solved,
    } = body;

    if (!problemId || timeLimit === undefined || elapsedTime === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // practice_sessions 쓰기는 RLS 우회가 필요하므로 service_role
    const { data, error } = await createServiceRoleClient()
      .from("practice_sessions")
      .insert({
        user_id: userData.user.id,
        problem_id: problemId,
        problem_title: problemTitle || null,
        difficulty: difficulty || null,
        time_limit: timeLimit,
        elapsed_time: elapsedTime,
        hints_used: hintsUsed || 0,
        solved: solved || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save practice session:", error);
      return NextResponse.json(
        { error: "Failed to save session" },
        { status: 500 }
      );
    }

    // AC를 받은 경우 user_solved_problems에 추가 (새 문제인 경우)
    if (solved) {
      const contestId = problemId.split("_")[0];

      // upsert로 처리 (이미 있으면 무시)
      await supabase
        .from("user_solved_problems")
        .upsert(
          {
            user_id: userData.user.id,
            problem_id: problemId,
            contest_id: contestId,
            solved_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,problem_id",
            ignoreDuplicates: true,
          }
        );
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error("Failed to save practice session:", error);
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500 }
    );
  }
}
