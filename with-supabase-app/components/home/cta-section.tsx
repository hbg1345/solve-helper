"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import { motion } from "framer-motion";

interface CTASectionProps {
  isLoggedIn?: boolean;
}

export function CTASection({ isLoggedIn }: CTASectionProps) {
  if (isLoggedIn) {
    return null;
  }

  return (
    <section className="w-full max-w-5xl px-4">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/90 to-primary p-8 md:p-16 text-center">
          {/* 배경 장식 */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-white/10 rounded-full blur-3xl"
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.5, 0.3, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-primary-foreground text-sm font-medium mb-6"
            >
              <Sparkles className="h-4 w-4" />
              무료로 시작하세요
            </motion.div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">
              지금 바로 시작하세요
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto text-lg">
              무료로 가입하고 AI 코치와 함께 첫 문제를 풀어보세요
            </p>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Link href="/auth/login">
                  무료로 시작하기
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
