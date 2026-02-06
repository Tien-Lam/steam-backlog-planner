"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/lib/hooks/use-library";

function formatPlaytime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString()}h`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: games, isLoading } = useLibrary();

  const stats = games
    ? {
        total: games.length,
        backlog: games.filter((g) => g.status === "backlog").length,
        playing: games.filter((g) => g.status === "playing").length,
        completed: games.filter((g) => g.status === "completed").length,
        totalPlaytime: games.reduce((acc, g) => acc + g.playtimeMinutes, 0),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {session?.user?.name}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s your gaming overview
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Games" value={stats?.total} loading={isLoading} />
        <StatCard title="Backlog" value={stats?.backlog} loading={isLoading} />
        <StatCard title="Playing" value={stats?.playing} loading={isLoading} />
        <StatCard title="Completed" value={stats?.completed} loading={isLoading} />
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Playtime</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {formatPlaytime(stats.totalPlaytime)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href="/library">
          <Button>View Library</Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  loading,
}: {
  title: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value?.toLocaleString() ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}
