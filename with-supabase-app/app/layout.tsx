import type { Metadata } from "next";
import { Geist, Orbitron } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AnimeModeProvider } from "@/components/anime-mode-context";
import { LanguageProvider } from "@/components/language-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { CollapsibleHeader } from "@/components/collapsible-header";
import { ScrollToTop } from "@/components/scroll-to-top";
import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { Suspense } from "react";
import { cookies } from "next/headers";
import type { Lang } from "@/lib/translations";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Solve Helper",
  description: "공식 해설 기반 AI와 함께 알고리즘 문제를 풀어보세요",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

async function AppShell({
  children,
  authButton,
  mobileAuthButton,
}: {
  children: React.ReactNode;
  authButton: React.ReactNode;
  mobileAuthButton: React.ReactNode;
}) {
  const [cookieStore, supabase] = await Promise.all([
    cookies(),
    createClient(),
  ]);
  const langCookie = cookieStore.get("appLanguage")?.value;

  // 로그인 사용자는 DB 언어 우선, 비로그인은 쿠키 fallback
  let initialLang: Lang = langCookie === "en" || langCookie === "ja" ? langCookie : "ko";
  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    if (claims) {
      const { data } = await supabase
        .from("user_info")
        .select("language")
        .eq("id", claims.sub)
        .single();
      if (data?.language === "en" || data?.language === "ja" || data?.language === "ko") {
        initialLang = data.language;
      }
    }
  } catch {
    // fallback to cookie
  }

  return (
    <LanguageProvider initialLang={initialLang}>
      <AnimeModeProvider>
        <ScrollToTop />
        <CollapsibleHeader
          authButton={authButton}
          mobileAuthButton={mobileAuthButton}
        />
        {children}
        <SpeedInsights />
        <Analytics />
      </AnimeModeProvider>
    </LanguageProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authButton = !hasEnvVars ? (
    <EnvVarWarning />
  ) : (
    <Suspense fallback={<div className="w-16 h-9" />}>
      <AuthButton />
    </Suspense>
  );
  const mobileAuthButton = !hasEnvVars ? (
    <EnvVarWarning />
  ) : (
    <Suspense fallback={<div className="w-full h-8" />}>
      <AuthButton />
    </Suspense>
  );

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.className} ${orbitron.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense>
            <AppShell
              authButton={authButton}
              mobileAuthButton={mobileAuthButton}
            >
              {children}
            </AppShell>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
