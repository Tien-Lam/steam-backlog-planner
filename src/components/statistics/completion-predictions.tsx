"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPlaytime } from "@/lib/utils";
import type { CompletionPrediction } from "@/lib/hooks/use-statistics";

interface CompletionPredictionsProps {
  predictions: CompletionPrediction[];
  totalRemainingMinutes: number;
}

export function CompletionPredictions({
  predictions,
  totalRemainingMinutes,
}: CompletionPredictionsProps) {
  if (predictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completion Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No HLTB data available for backlog games.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalHltb = predictions.reduce((s, p) => s + p.hltbMinutes, 0);
  const totalPlayed = predictions.reduce((s, p) => s + p.playedMinutes, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Predictions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{formatPlaytime(totalHltb)}</p>
            <p className="text-xs text-muted-foreground">Total HLTB</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatPlaytime(totalPlayed)}</p>
            <p className="text-xs text-muted-foreground">Played</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatPlaytime(totalRemainingMinutes)}</p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
        </div>

        <div className="space-y-3">
          {predictions.map((p) => {
            const pct =
              p.hltbMinutes > 0
                ? Math.round((p.playedMinutes / p.hltbMinutes) * 100)
                : 0;
            return (
              <div key={p.steamAppId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {formatPlaytime(p.remainingMinutes)} left
                  </span>
                </div>
                <Progress value={Math.min(pct, 100)} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
