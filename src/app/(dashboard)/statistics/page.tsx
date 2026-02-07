"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { StatusChart } from "@/components/statistics/status-chart";
import { PlaytimeChart } from "@/components/statistics/playtime-chart";
import { CompletionPredictions } from "@/components/statistics/completion-predictions";
import { AchievementOverview } from "@/components/statistics/achievement-overview";
import { useLibraryStats, useAchievementStats } from "@/lib/hooks/use-statistics";

export default function StatisticsPage() {
  const { stats, isLoading: libraryLoading } = useLibraryStats();
  const { data: achievementData, isLoading: achievementsLoading } = useAchievementStats();

  if (libraryLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Statistics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusChart data={stats?.statusBreakdown ?? []} />
        <PlaytimeChart data={stats?.topGamesByPlaytime ?? []} />
        <CompletionPredictions
          predictions={stats?.completionPredictions ?? []}
          totalRemainingMinutes={stats?.totalRemainingMinutes ?? 0}
        />
        <AchievementOverview
          data={achievementData}
          isLoading={achievementsLoading}
        />
      </div>
    </div>
  );
}
