import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileDropdown } from "./profile-dropdown";

export async function AuthButton() {
  const supabase = await createClient();

  // getClaims()는 JWT를 로컬에서 읽으므로 getUser()보다 훨씬 빠름
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub as string | undefined;

  if (!userId) {
    return (
      <div className="flex gap-2">
        <Link
          href="/auth/login"
          className="font-game text-xs font-medium px-3 py-2 text-pixel-white/80 hover:text-pixel-cyan transition-colors tracking-wide"
        >
          LOG IN
        </Link>
      </div>
    );
  }

  // 사용자 프로필 정보 가져오기
  const { data: userInfo } = await supabase
    .from("user_info")
    .select("avatar_url, atcoder_handle")
    .eq("id", userId)
    .single();

  return (
    <ProfileDropdown
      avatarUrl={userInfo?.avatar_url ?? null}
      handle={userInfo?.atcoder_handle ?? null}
      email={(claims?.email as string) ?? null}
    />
  );
}
