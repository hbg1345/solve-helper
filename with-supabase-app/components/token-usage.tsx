"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMonthlyTokenUsage, getTotalTokenUsage, TokenUsage } from "@/app/actions";
import { Zap } from "lucide-react";
import { useLanguage } from "./language-context";

type UsageTab = "month" | "total";

export function TokenUsageCard() {
  const { tr } = useLanguage();
  const [monthUsage, setMonthUsage] = useState<TokenUsage | null>(null);
  const [totalUsage, setTotalUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UsageTab>("month");

  useEffect(() => {
    async function fetchUsage() {
      try {
        const [month, total] = await Promise.all([
          getMonthlyTokenUsage(),
          getTotalTokenUsage(),
        ]);
        setMonthUsage(month);
        setTotalUsage(total);
      } catch (error) {
        console.error("Failed to fetch token usage:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, []);

  const usage = activeTab === "month" ? monthUsage : totalUsage;

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {tr.tokenUsage.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {tr.tokenUsage.title}
          </CardTitle>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UsageTab)}>
            <TabsList className="h-8">
              <TabsTrigger value="month" className="text-xs px-3">
                {tr.tokenUsage.thisMonth}
              </TabsTrigger>
              <TabsTrigger value="total" className="text-xs px-3">
                {tr.tokenUsage.total}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <CardDescription>
          {tr.tokenUsage.usage(activeTab === "month" ? tr.tokenUsage.thisMonth : tr.tokenUsage.total)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-foreground">{tr.tokenUsage.inputTokens}</p>
            <p className="text-2xl font-bold">
              {usage?.total_input_tokens.toLocaleString() || 0}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-foreground">{tr.tokenUsage.outputTokens}</p>
            <p className="text-2xl font-bold">
              {usage?.total_output_tokens.toLocaleString() || 0}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-foreground">{tr.tokenUsage.totalTokens}</p>
            <p className="text-2xl font-bold text-primary">
              {usage?.total_tokens.toLocaleString() || 0}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-foreground">{tr.tokenUsage.requests}</p>
            <p className="text-2xl font-bold">
              {usage?.request_count.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
