"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Archive, Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "./language-context";

export function DesktopNav() {
  const pathname = usePathname();
  const { tr } = useLanguage();

  const navItems = [
    { href: "/practice", label: tr.nav.challenge, icon: Sword },
    { href: "/problems", label: tr.nav.archive, icon: Archive },
    { href: "/chat", label: tr.nav.chat, icon: MessageSquare },
  ];

  return (
    <nav className="hidden md:flex flex-1 items-center gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 font-game text-xs font-medium tracking-wide transition-colors",
              isActive
                ? "text-pixel-yellow bg-pixel-navy"
                : "text-pixel-white/80 hover:text-pixel-cyan hover:bg-pixel-navy/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
