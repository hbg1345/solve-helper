import { AppLayout } from "@/components/app-layout";
import { ChatLayoutWrapper } from "./ChatLayoutWrapper";
import { Suspense } from "react";
import { Loader } from "@/components/ai-elements/loader";
import { ChatAuthCheck } from "./ChatAuthCheck";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout
      fixedHeight={true}
      contentWrapperClassName="flex flex-col p-0 w-full h-[calc(100vh-3.5rem)] overflow-hidden"
      outerWrapperClassName="flex w-full flex-col items-center h-[calc(100vh-3.5rem)] overflow-hidden"
    >
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <Loader />
          </div>
        }
      >
        <ChatAuthCheck>
          <ChatLayoutWrapper>{children}</ChatLayoutWrapper>
        </ChatAuthCheck>
      </Suspense>
    </AppLayout>
  );
}
