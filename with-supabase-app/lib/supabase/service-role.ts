import { createClient } from "@supabase/supabase-js";

/**
 * Service Role 클라이언트 - RLS를 우회하여 관리 작업 수행
 * Cron job, 배치 작업 등 유저 세션 없이 DB에 쓰기 필요한 경우 사용
 */
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
