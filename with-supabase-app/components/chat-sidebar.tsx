"use client";

import { useState, useEffect } from "react";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, Plus, MessageSquare, Trash2, PanelLeft, PanelRight, Columns2 } from "lucide-react";
import { getChatHistoryList, deleteChatHistory, saveChatHistory, type ChatHistoryItem } from "@/app/actions";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type LayoutMode = "problem-only" | "chat-only" | "both";

interface ChatSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onSelectChat: (chatId: string | null) => void;
    selectedChatId: string | null;
    refreshTrigger?: number;
    layoutMode?: LayoutMode;
    onLayoutChange?: (mode: LayoutMode) => void;
    showLayoutControls?: boolean;
}

export function ChatSidebar({
    isOpen,
    onToggle,
    onSelectChat,
    selectedChatId,
    refreshTrigger,
    layoutMode,
    onLayoutChange,
    showLayoutControls,
}: ChatSidebarProps) {
    const [chatList, setChatList] = useState<ChatHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadChatList = async () => {
            setIsLoading(true);
            const list = await getChatHistoryList();
            // 최근 업데이트 순으로 정렬 (updated_at 기준 내림차순)
            const sortedList = [...list].sort((a, b) => {
                const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                return dateB - dateA; // 내림차순 (최신이 위로)
            });
            setChatList(sortedList);
            setIsLoading(false);
        };
        loadChatList();
    }, [refreshTrigger]);

    const handleNewChat = async () => {
        // 새 채팅 생성
        const savedChatId = await saveChatHistory(null, [], "New Chat", null, true);
        if (savedChatId) {
            onSelectChat(savedChatId);
            // 목록 새로고침
            const list = await getChatHistoryList();
            const sortedList = [...list].sort((a, b) => {
                const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                return dateB - dateA;
            });
            setChatList(sortedList);
        }
    };

    const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation(); // 버튼 클릭 시 채팅 선택 방지
        const success = await deleteChatHistory(chatId);
        if (success) {
            // 삭제된 채팅이 현재 선택된 채팅이면 새 채팅으로 변경
            if (selectedChatId === chatId) {
                onSelectChat(null);
            }
            // 목록 새로고침
            const list = await getChatHistoryList();
            // 최근 업데이트 순으로 정렬 (updated_at 기준 내림차순)
            const sortedList = [...list].sort((a, b) => {
                const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                return dateB - dateA; // 내림차순 (최신이 위로)
            });
            setChatList(sortedList);
        }
    };

    return (
        <div
            className={cn(
                "flex flex-col h-full border-r bg-background transition-all duration-300 shadow-lg",
                isOpen ? "w-64" : "w-12"
            )}
        >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-2 border-b">
                {isOpen && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNewChat}
                        className="flex-1 justify-start gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        새 채팅
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="shrink-0"
                    title={isOpen ? "사이드바 닫기" : "사이드바 열기"}
                >
                    {isOpen ? (
                        <PanelLeftClose className="h-4 w-4" />
                    ) : (
                        <PanelLeftOpen className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* 채팅 목록 */}
            {isOpen && (
                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader />
                        </div>
                    ) : chatList.length === 0 ? (
                        <div className="text-sm text-foreground text-center py-4">
                            채팅 내역이 없습니다
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {chatList.map((chat) => (
                                <div
                                    key={chat.id}
                                    className="group flex items-center gap-1 hover:bg-muted rounded-md"
                                >
                                    <Button
                                        variant={selectedChatId === chat.id ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => onSelectChat(chat.id)}
                                        className="flex-1 justify-start gap-2 text-left h-auto py-2"
                                    >
                                        <MessageSquare className="h-4 w-4 shrink-0" />
                                        <span className="truncate flex-1">
                                          {chat.title.length > 12
                                            ? `${chat.title.substring(0, 12)}...`
                                            : chat.title}
                                        </span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => handleDeleteChat(e, chat.id)}
                                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive dark:text-red-400" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 레이아웃 컨트롤 */}
            {showLayoutControls && onLayoutChange && (
                <div className={cn("border-t p-2", isOpen ? "" : "flex flex-col items-center")}>
                    {isOpen ? (
                        <div className="flex items-center justify-center gap-1">
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={layoutMode === "problem-only" ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => onLayoutChange("problem-only")}
                                            className="h-8 px-2"
                                        >
                                            <PanelLeft className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>문제만 보기</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={layoutMode === "both" ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => onLayoutChange("both")}
                                            className="h-8 px-2"
                                        >
                                            <Columns2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>둘 다 보기</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={layoutMode === "chat-only" ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => onLayoutChange("chat-only")}
                                            className="h-8 px-2"
                                        >
                                            <PanelRight className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>채팅만 보기</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    ) : (
                        <TooltipProvider delayDuration={0}>
                            <div className="flex flex-col gap-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={layoutMode === "problem-only" ? "secondary" : "ghost"}
                                            size="icon"
                                            onClick={() => onLayoutChange("problem-only")}
                                            className="h-8 w-8"
                                        >
                                            <PanelLeft className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>문제만 보기</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={layoutMode === "both" ? "secondary" : "ghost"}
                                            size="icon"
                                            onClick={() => onLayoutChange("both")}
                                            className="h-8 w-8"
                                        >
                                            <Columns2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>둘 다 보기</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={layoutMode === "chat-only" ? "secondary" : "ghost"}
                                            size="icon"
                                            onClick={() => onLayoutChange("chat-only")}
                                            className="h-8 w-8"
                                        >
                                            <PanelRight className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>채팅만 보기</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    )}
                </div>
            )}
        </div>
    );
}

