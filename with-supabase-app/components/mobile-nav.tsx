"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, MessageSquare, Archive, Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "./language-context";

interface MobileNavProps {
  children?: React.ReactNode; // AuthButton
}

export function MobileNav({ children }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { tr } = useLanguage();

  const navItems = [
    { href: "/practice", label: tr.nav.challenge, icon: Sword },
    { href: "/problems", label: tr.nav.archive, icon: Archive },
    { href: "/chat", label: tr.nav.chat, icon: MessageSquare },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-pixel-white/80 hover:text-pixel-cyan hover:bg-pixel-navy"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{tr.nav.menuOpen}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[280px] sm:w-[320px] bg-pixel-dark border-l-4 border-pixel-navy"
      >
        <SheetHeader>
          <SheetTitle className="font-game text-lg font-bold text-pixel-yellow tracking-wider">
            MENU
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 mt-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 font-game text-sm font-medium tracking-wide transition-colors",
                  isActive
                    ? "text-pixel-yellow bg-pixel-navy"
                    : "text-pixel-white/80 hover:text-pixel-cyan hover:bg-pixel-navy/50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 pt-6 border-t-2 border-pixel-navy">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
