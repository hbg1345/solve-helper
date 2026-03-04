import { Suspense } from "react";
import { Loader } from "@/components/ai-elements/loader";
import PracticeClient from "./PracticeClient";

interface PageProps {
  params: Promise<{ problemId: string }>;
}

async function PracticeContent({ params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  return <PracticeClient problemId={problemId} />;
}

export default function PracticePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <Loader />
        </div>
      }
    >
      <PracticeContent params={params} />
    </Suspense>
  );
}
