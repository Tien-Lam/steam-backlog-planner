"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AchievementStats } from "@/lib/hooks/use-statistics";

interface AchievementOverviewProps {
  data: AchievementStats | undefined;
  isLoading: boolean;
}

export function AchievementOverview({ data, isLoading }: AchievementOverviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading achievements...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.perGame.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No achievement data yet. Visit a game detail page to sync achievements.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold">{data.overallAchievements.percentage}%</p>
          <p className="text-sm text-muted-foreground">
            {data.overallAchievements.achieved} / {data.overallAchievements.total} achievements
          </p>
          <Progress value={data.overallAchievements.percentage} className="mt-2" />
        </div>

        <div className="space-y-3">
          {data.perGame.map((game) => (
            <div key={game.steamAppId} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate">{game.gameName}</span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {game.achieved}/{game.total} ({game.percentage}%)
                </span>
              </div>
              <Progress value={game.percentage} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
