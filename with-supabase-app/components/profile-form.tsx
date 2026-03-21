"use client";
import { useState, useEffect, useTransition } from "react";
import { AtcoderForm } from "./atcoder-form";
import { UserInfoRow } from "@/types/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SubmissionGrass } from "./submission-grass";
import { SolvedProblemsList } from "./solved-problems";
import { DifficultyDistribution } from "./difficulty-distribution";
import { AvatarUpload } from "./avatar-upload";
import { TokenUsageCard } from "./token-usage";
import { RatingGraph } from "./rating-graph";
import { SolvedProblem, PracticeSession, PracticeStats, refreshAtcoderRating, getSolvedProblems, refreshSolvedProblems } from "@/app/actions";
import { PracticeHistory } from "./practice-history";
import { getRatingColor } from "@/lib/atcoder/rating-history";
import { RefreshCw, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { updatAtcoderHandle } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useLanguage } from "./language-context";

export function ProfileForm({ rating, atcoder_handle }: UserInfoRow) {
    const [modify, setModify] = useState(false);

    if (rating === null || modify) {
        return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Atcoder 연동</CardTitle>
          <CardDescription>
            Atcoder 핸들을 입력하여 프로필을 연동하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AtcoderForm onSuccess={() => setModify(false)} />
        </CardContent>
      </Card>
        );
    }
    return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>프로필 정보</CardTitle>
        <CardDescription>Atcoder 계정 정보를 확인하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Atcoder Handle
            </span>
            <Badge variant="outline" className="text-sm">
              {atcoder_handle}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Rating
            </span>
            <Badge variant="default" className="text-sm">
              {rating}
            </Badge>
          </div>
        </div>
        <Separator />
        <Button
          onClick={() => setModify(true)}
          variant="outline"
          className="w-full"
        >
          수정하기
        </Button>
      </CardContent>
    </Card>
    );
}

interface ProfileWithGrassProps extends UserInfoRow {
  atcoder_handle_for_solved?: string | null;
  practiceSessions?: PracticeSession[];
  practiceStats?: PracticeStats;
}

export function ProfileWithGrass({
  rating: initialRating,
  atcoder_handle,
  avatar_url: initialAvatarUrl,
  atcoder_handle_for_solved,
  practiceSessions = [],
  practiceStats = { totalSessions: 0, solvedCount: 0, avgElapsedTime: 0, avgHintsUsed: 0 },
}: ProfileWithGrassProps) {
  const { tr } = useLanguage();
  const [modify, setModify] = useState(false);
  const [editHandle, setEditHandle] = useState(atcoder_handle || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [rating, setRating] = useState(initialRating);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [solvedProblems, setSolvedProblems] = useState<SolvedProblem[]>([]);
  const [solvedLoading, setSolvedLoading] = useState(!!atcoder_handle_for_solved);
  const [isPending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSection, setActiveSection] = useState("profile-info");
  const router = useRouter();

  // router.refresh() 후 서버에서 새 props가 내려올 때 state 동기화
  useEffect(() => { setRating(initialRating); }, [initialRating]);

  // 활성 섹션 감지 (스크롤 기반)
  useEffect(() => {
    const ids = ["profile-info", "rating-graph", "ac-table", "solved-problems", "challenge-history"];
    const HEADER_OFFSET = 96;

    const handleScroll = () => {
      // 아래에서 위로 순회하며 top이 HEADER_OFFSET 이하인 마지막 섹션을 active로
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top <= HEADER_OFFSET) {
          setActiveSection(ids[i]);
          return;
        }
      }
      setActiveSection(ids[0]);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 마운트 후 solved problems 클라이언트 로드
  useEffect(() => {
    if (!atcoder_handle_for_solved) return;
    getSolvedProblems(atcoder_handle_for_solved).then((problems) => {
      setSolvedProblems(problems);
      setSolvedLoading(false);
    });
  }, [atcoder_handle_for_solved]);

  const handleRefresh = () => {
    if (!atcoder_handle) return;

    startTransition(async () => {
      // 레이팅 갱신 (히스토리도 함께 갱신됨)
      const newRating = await refreshAtcoderRating();
      if (newRating !== null) {
        setRating(newRating);
      }

      // 푼 문제 목록 갱신 (API에서 새로 가져와 DB에 저장)
      const newSolvedProblems = await refreshSolvedProblems(atcoder_handle);
      setSolvedProblems(newSolvedProblems);

      // RatingGraph 리렌더링 트리거
      setRefreshKey((prev) => prev + 1);
    });
  };

  const handleSaveHandle = async () => {
    if (!editHandle.trim()) return;

    setIsUpdating(true);
    try {
      const result = await updatAtcoderHandle(editHandle);
      if (!result.success) {
        alert(tr.profile.updateFailed);
        return;
      }

      // 레이팅 업데이트
      if (result.rating !== null) {
        setRating(result.rating);
      }

      // 푼 문제 목록 갱신 (새 핸들로 API에서 가져와 DB에 저장)
      if (result.handle) {
        const newSolvedProblems = await refreshSolvedProblems(result.handle);
        setSolvedProblems(newSolvedProblems);
      }

      // RatingGraph 리렌더링 트리거
      setRefreshKey((prev) => prev + 1);

      setModify(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to update handle:", error);
      alert(tr.profile.updateFailed);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditHandle(atcoder_handle || "");
    setModify(false);
  };

  if (rating === null) {
    return (
      <>
        <div className="flex flex-col gap-2 self-start w-full">
          <h1 className="text-3xl font-bold tracking-tight">{tr.profile.title}</h1>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{tr.profile.linkTitle}</CardTitle>
            <CardDescription>
              {tr.profile.linkDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AtcoderForm />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 self-start w-full">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{tr.profile.title}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isPending}
            className="h-7 w-7 focus-visible:ring-0 border-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <div className="w-full flex gap-8 items-start">
        {/* 사이드 TOC */}
        <nav className="hidden xl:flex flex-col gap-1 sticky top-20 w-40 shrink-0 text-sm">
          {[
            { id: "profile-info", label: tr.profile.toc.info },
            { id: "rating-graph", label: tr.profile.toc.rating },
            { id: "ac-table", label: tr.profile.toc.acTable },
            { id: "solved-problems", label: tr.profile.toc.solved },
            { id: "challenge-history", label: tr.profile.toc.challenges },
          ].map(({ id, label }) => (
            <a
              key={id}
              href={id === "profile-info" ? "#" : `#${id}`}
              onClick={(e) => {
                e.preventDefault();
                if (id === "profile-info") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={`truncate transition-colors py-0.5 ${
                activeSection === id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex-1 min-w-0 max-w-5xl space-y-6">
        <div id="profile-info" className="scroll-mt-24 flex flex-col md:flex-row gap-6">
          <Card
            className="w-full md:flex-1 border-2"
            style={{ borderColor: getRatingColor(rating ?? 0) }}
          >
            <CardHeader>
              <CardTitle>{tr.profile.cardTitle}</CardTitle>
              <CardDescription>{tr.profile.cardDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-6">
                <AvatarUpload
                  avatarUrl={avatarUrl}
                  onUpload={(url) => setAvatarUrl(url)}
                />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Atcoder Handle
                    </span>
                    {modify ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editHandle}
                          onChange={(e) => setEditHandle(e.target.value)}
                          className="h-7 w-32 text-sm"
                          disabled={isUpdating}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleSaveHandle}
                          disabled={isUpdating}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm">
                          {atcoder_handle}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setModify(true)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Rating
                    </span>
                    <Badge
                      className="text-sm text-white"
                      style={{ backgroundColor: getRatingColor(rating ?? 0) }}
                    >
                      {rating}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="w-full md:flex-1">
            <TokenUsageCard />
          </div>
        </div>

        <div id="rating-graph" className="scroll-mt-24">
          {atcoder_handle && <RatingGraph key={refreshKey} atcoderHandle={atcoder_handle} />}
        </div>

        <div id="ac-table" className="scroll-mt-24">
          {atcoder_handle && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle>AC Table</CardTitle>
                <CardDescription>{tr.profile.acTableDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <SubmissionGrass key={refreshKey} userId={atcoder_handle} />
              </CardContent>
            </Card>
          )}
        </div>

        <div id="solved-problems" className="scroll-mt-24">
          {solvedLoading ? (
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="h-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ) : solvedProblems.length > 0 && (
            <>
              <DifficultyDistribution problems={solvedProblems} />
              <Card className="w-full mt-6">
                <CardHeader>
                  <CardTitle>Solved Problems</CardTitle>
                  <CardDescription>
                    {tr.profile.solvedCount(solvedProblems.length)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SolvedProblemsList problems={solvedProblems} />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* 도전 기록 */}
        <div id="challenge-history" className="scroll-mt-24">
          <PracticeHistory sessions={practiceSessions} stats={practiceStats} />
        </div>
        </div>
      </div>
    </>
  );
}
