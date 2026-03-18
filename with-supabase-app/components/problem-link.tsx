"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveChatHistory, getChatByProblemUrl } from "@/app/actions";
import { cn } from "@/lib/utils";
import { saveRecentProblem } from "@/lib/recent-problems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, Swords } from "lucide-react";

interface ProblemLinkProps {
  problemId: string;
  problemTitle: string;
  problemUrl: string;
  contestId: string;
  difficulty: number | null;
  status?: 'AC' | 'WA' | null;
  className?: string;
  children?: React.ReactNode;
  mode?: "select" | "practice"; // select: 드롭다운으로 선택, practice: 바로 도전 이동
}

export function ProblemLink({
  problemId,
  problemTitle,
  problemUrl,
  contestId,
  difficulty,
  status,
  className,
  children,
  mode = "select",
}: ProblemLinkProps) {
  const router = useRouter();

  const saveToRecent = () => {
    saveRecentProblem({ problemId, problemTitle, problemUrl, contestId, difficulty });
  };

  const goToChat = async () => {
    saveToRecent();
    let chatId = await getChatByProblemUrl(problemUrl);
    if (!chatId) {
      const title = `${problemId}: ${problemTitle}`;
      chatId = await saveChatHistory(null, [], title, problemUrl);
    }
    router.push(chatId ? `/chat?chatId=${chatId}` : "/chat");
  };

  const goToPractice = () => {
    saveToRecent();
    router.push(`/practice/${problemId}`);
  };

  const colors = getDifficultyColor(difficulty);

  const label = (
    <div
      className={cn(
        "text-xs font-bold truncate group-hover:underline",
        difficulty && difficulty >= 3200 ? "" : colors.text
      )}
      title={problemTitle}
    >
      {status === 'AC' && (
        <span className="text-green-500 mr-0.5">[AC]</span>
      )}
      {status === 'WA' && (
        <span className="text-orange-500 mr-0.5">[WA]</span>
      )}
      {difficulty && difficulty >= 3200 ? (
        problemTitle.length > 0 ? (
          <>
            <span className="text-black dark:text-white">{problemTitle[0]}</span>
            <span className="text-red-600 dark:text-red-400">{problemTitle.slice(1)}</span>
          </>
        ) : problemTitle
      ) : problemTitle}
    </div>
  );

  // practice 모드는 드롭다운 없이 바로 이동
  if (mode === "practice") {
    return (
      <Link href={`/practice/${problemId}`} className={className}>
        {children || label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("w-full text-left cursor-pointer", className)}>
          {children || label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuItem onClick={goToChat} className="gap-2 cursor-pointer">
          <MessageSquare className="h-3.5 w-3.5" />
          AI 채팅
        </DropdownMenuItem>
        <DropdownMenuItem onClick={goToPractice} className="gap-2 cursor-pointer">
          <Swords className="h-3.5 w-3.5" />
          도전
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getDifficultyColor(difficulty: number | null): {
  bg: string;
  text: string;
  border: string;
} {
  // AtCoder 공식 색상에 맞춤
  if (difficulty === null) {
    return {
      bg: "bg-gray-400 dark:bg-gray-500",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
    };
  }

  // Gray: < 400
  if (difficulty < 400) {
    return {
      bg: "bg-gray-400 dark:bg-gray-500",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-400 dark:border-gray-500",
    };
  }
  // Brown: 400-799
  if (difficulty < 800) {
    return {
      bg: "bg-amber-800 dark:bg-amber-700",
      text: "text-amber-800 dark:text-amber-600",
      border: "border-amber-800 dark:border-amber-700",
    };
  }
  // Green: 800-1199
  if (difficulty < 1200) {
    return {
      bg: "bg-green-600 dark:bg-green-500",
      text: "text-green-600 dark:text-green-400",
      border: "border-green-600 dark:border-green-500",
    };
  }
  // Cyan: 1200-1599
  if (difficulty < 1600) {
    return {
      bg: "bg-cyan-500 dark:bg-cyan-400",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-500 dark:border-cyan-400",
    };
  }
  // Blue: 1600-1999
  if (difficulty < 2000) {
    return {
      bg: "bg-blue-700 dark:bg-blue-600",
      text: "text-blue-700 dark:text-blue-500",
      border: "border-blue-700 dark:border-blue-600",
    };
  }
  // Yellow: 2000-2399
  if (difficulty < 2400) {
    return {
      bg: "bg-yellow-400 dark:bg-yellow-300",
      text: "text-yellow-500 dark:text-yellow-300",
      border: "border-yellow-400 dark:border-yellow-300",
    };
  }
  // Orange: 2400-2799
  if (difficulty < 2800) {
    return {
      bg: "bg-orange-500 dark:bg-orange-400",
      text: "text-orange-500 dark:text-orange-400",
      border: "border-orange-500 dark:border-orange-400",
    };
  }
  // Red: 2800-3199
  if (difficulty < 3200) {
    return {
      bg: "bg-red-600 dark:bg-red-500",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-600 dark:border-red-500",
    };
  }
  // 3200+: 첫 글자 검은색/금색, 나머지 빨간색 (별도 처리 필요)
  return {
    bg: "bg-red-600 dark:bg-red-500",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-600 dark:border-red-500",
  };
}

