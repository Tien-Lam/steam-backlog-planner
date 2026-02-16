"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { PlaytimeEntry } from "@/lib/hooks/use-statistics";

interface PlaytimeChartProps {
  data: PlaytimeEntry[];
}

export function PlaytimeChart({ data }: PlaytimeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Games by Playtime</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No playtime data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Games by Playtime</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" unit="h" />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number | undefined) => [`${value ?? 0}h`, "Playtime"]} />
            <Bar dataKey="hours" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
