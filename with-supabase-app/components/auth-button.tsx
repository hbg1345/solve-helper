import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { ProfileDropdown } from "./profile-dropdown";

export async function AuthButton() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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
    .eq("id", user.id)
    .single();

  return (
    <ProfileDropdown
      avatarUrl={userInfo?.avatar_url ?? null}
      handle={userInfo?.atcoder_handle ?? null}
      email={user.email ?? null}
    />
  );
}
