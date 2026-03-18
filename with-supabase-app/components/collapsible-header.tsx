"use client";

import Link from "next/link";
import { Suspense } from "react";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";
import { ThemeSwitcher } from "./theme-switcher";
import { AnimeModeToggle } from "./anime-mode-toggle";
import { LanguageSelector } from "./language-selector";

interface CollapsibleHeaderProps {
  authButton: React.ReactNode;
  mobileAuthButton: React.ReactNode;
}

export function CollapsibleHeader({ authButton, mobileAuthButton }: CollapsibleHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-pixel-dark">
      <div className="container flex max-w-5xl items-center mx-auto px-4 h-12">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center gap-2 group">
          <div className="w-5 h-5 bg-pixel-yellow" />
          <span className="font-game text-sm font-bold text-pixel-yellow group-hover:text-pixel-cyan transition-colors tracking-wider">
            SOLVE HELPER
          </span>
        </Link>

        {/* Desktop Navigation */}
        <Suspense fallback={<nav className="hidden md:flex flex-1" />}>
          <DesktopNav />
        </Suspense>

        {/* Desktop Auth & Theme */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageSelector />
          <AnimeModeToggle />
          <ThemeSwitcher />
          {authButton}
        </div>

        {/* Mobile Menu */}
        <div className="flex flex-1 items-center justify-end md:hidden gap-2">
          <LanguageSelector />
          <AnimeModeToggle />
          <ThemeSwitcher />
          <Suspense fallback={<div className="h-9 w-9" />}>
            <MobileNav>
              {mobileAuthButton}
            </MobileNav>
          </Suspense>
        </div>
      </div>
    </header>
  );
}
