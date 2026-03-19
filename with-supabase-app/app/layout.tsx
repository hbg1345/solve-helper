import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AnimeModeProvider } from "@/components/anime-mode-context";
import { LanguageProvider } from "@/components/language-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { CollapsibleHeader } from "@/components/collapsible-header";
import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { Suspense } from "react";
import { cookies } from "next/headers";
import type { Lang } from "@/lib/translations";
import "katex/dist/katex.min.css";
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

async function AppShell({
  children,
  authButton,
  mobileAuthButton,
}: {
  children: React.ReactNode;
  authButton: React.ReactNode;
  mobileAuthButton: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("appLanguage")?.value;
  const initialLang: Lang =
    langCookie === "en" || langCookie === "ja" ? langCookie : "ko";

  return (
    <LanguageProvider initialLang={initialLang}>
      <AnimeModeProvider>
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
      <body className={`${geistSans.className} antialiased`}>
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
