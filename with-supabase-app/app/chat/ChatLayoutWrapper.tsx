"use client";

import { Suspense } from "react";
import { Loader } from "@/components/ai-elements/loader";
import { ChatLayoutClient } from "./ChatLayoutClient";
import { ChatLayoutProvider } from "./ChatLayoutContext";

export function ChatLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ChatLayoutProvider>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <Loader />
          </div>
        }
      >
        <ChatLayoutClient>{children}</ChatLayoutClient>
      </Suspense>
    </ChatLayoutProvider>
  );
}
