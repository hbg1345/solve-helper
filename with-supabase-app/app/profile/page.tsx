import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getServerTr } from "@/lib/lang-server";
import { Suspense } from "react";
import { ProfileWithGrass } from "@/components/profile-form";
import { UserInfoRow } from "@/types/supabase";
import { getPracticeSessions, getPracticeStats } from "@/app/actions";
import { OngoingPracticeIndicator } from "@/components/ongoing-practice-indicator";

async function UserDetails() {
  const supabase = await createClient();

  // getClaims() is faster than getUser() as it reads from JWT directly
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    redirect("/auth/login");
  }

  const userId = claims.sub as string;

  const { data, error } = await supabase
    .from("user_info")
    .select("rating, atcoder_handle, avatar_url")
    .eq("id", userId)
    .single();

  if (!data || error) {
    return null;
  }

  const userData: UserInfoRow = {
    rating: data.rating,
    atcoder_handle: data.atcoder_handle,
    avatar_url: data.avatar_url ?? null,
  };

  const [tr, practiceSessions, practiceStats] = await Promise.all([
    getServerTr(),
    getPracticeSessions(20),
    getPracticeStats(),
  ]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-foreground">{tr.profile.subtitle}</p>
      </div>
      <ProfileWithGrass
        rating={userData.rating}
        atcoder_handle={userData.atcoder_handle}
        avatar_url={userData.avatar_url}
        atcoder_handle_for_solved={userData.atcoder_handle}
        practiceSessions={practiceSessions}
        practiceStats={practiceStats}
      />
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-8 items-start">
          <Suspense fallback={
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
              </div>
              <div className="w-full max-w-md h-64 bg-muted animate-pulse rounded-xl" />
            </>
          }>
            <UserDetails />
          </Suspense>
        </div>
      </div>
      <OngoingPracticeIndicator />
    </div>
  );
}
