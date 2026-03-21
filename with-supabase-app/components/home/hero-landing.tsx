"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Sword, MessageSquare, Archive, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/language-context";

interface HeroLandingProps {
  isLoggedIn: boolean;
}

const menuIcons = [Sword, MessageSquare, Archive];
const menuIds = ["practice", "chat", "problems"] as const;
const menuSubLabels: string[] = [];
const menuHrefs = ["/practice", "/chat", "/problems"];

export function HeroLanding({ isLoggedIn }: HeroLandingProps) {
  const { tr } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const menuItems = menuIds.map((id, i) => ({
    id,
    label: tr.landing.menu[id].label,
    href: menuHrefs[i],
    icon: menuIcons[i],
    description: tr.landing.menu[id].description,
  }));

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % menuItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = menuItems[selectedIndex];
        if (item) {
          window.location.href = item.href;
        }
      }
    },
    [selectedIndex, menuItems]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-full relative flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Pixelated background image */}
      <div
        className="absolute -top-12 left-0 right-0 bottom-0 bg-cover bg-center bg-no-repeat pixelated-bg"
        style={{
          backgroundImage: "url('/hero-bg.jpg')",
          filter: "contrast(1.1) saturate(1.2)",
        }}
      />
      {/* Dot pattern overlay for pixel art effect */}
      <div className="absolute -top-12 left-0 right-0 bottom-0 dot-overlay" />
      {/* Dark overlay for better text readability */}
      <div className="absolute -top-12 left-0 right-0 bottom-0 bg-black/20" />

      {/* Title */}
      <motion.div
        className="text-center mb-12 relative z-20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1
          className="font-game text-3xl md:text-5xl font-black mb-4 tracking-widest"
          style={{
            color: "#fff",
            textShadow: "3px 3px 0 #2E7D32, 6px 6px 0 rgba(0,0,0,0.3)",
          }}
        >
          SOLVE HELPER
        </h1>
        <p
          className="font-game text-sm md:text-base font-medium tracking-wide"
          style={{
            color: "#E0F4FF",
            textShadow: "2px 2px 0 #1565C0",
          }}
        >
          {tr.landing.subtitle}
        </p>
      </motion.div>

      {/* Menu Box */}
      <motion.div
        className="relative z-20 w-full max-w-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div
          className="p-6 md:p-8 rounded-lg"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            border: "4px solid #5D4037",
            boxShadow: "8px 8px 0 0 rgba(0,0,0,0.2), inset 0 0 0 4px #8D6E63",
          }}
        >
          {/* Menu Items */}
          <nav className="space-y-2">
            {menuItems.map((item, index) => {
              const isSelected = selectedIndex === index;
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`
                    group flex items-center gap-3 p-3 rounded transition-all duration-100
                    ${isSelected ? "bg-green-100" : "hover:bg-amber-50"}
                  `}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* Selection cursor */}
                  <span
                    className={`
                      font-game text-green-600 text-sm transition-opacity
                      ${isSelected && showCursor ? "opacity-100" : "opacity-0"}
                    `}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </span>

                  {/* Icon */}
                  <Icon
                    className={`
                      w-5 h-5 transition-colors
                      ${isSelected ? "text-green-600" : "text-amber-700"}
                    `}
                  />

                  {/* Text */}
                  <div className="flex-1">
                    <span
                      className={`
                        font-game text-sm md:text-base font-semibold block tracking-wide
                        ${isSelected ? "text-green-700" : "text-amber-900"}
                      `}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Description Box */}
          <div className="mt-6 pt-4 border-t-2 border-amber-200">
            <p className="font-game text-sm text-green-700 leading-relaxed">
              {menuItems[selectedIndex]?.description}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Controls hint */}
      <motion.div
        className="mt-8 relative z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p
          className="font-game text-xs text-center tracking-wider"
          style={{
            color: "#fff",
            textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
          }}
        >
          [↑][↓] SELECT &nbsp;&nbsp; [ENTER] CONFIRM
        </p>
      </motion.div>

      {/* Version text */}
      <motion.div
        className="absolute bottom-4 right-4 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <p
          className="font-game text-xs"
          style={{
            color: "#fff",
            textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
          }}
        >
          v1.0.0
        </p>
      </motion.div>
    </div>
  );
}
