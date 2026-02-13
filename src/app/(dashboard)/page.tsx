"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Gamepad2,
  Calendar,
  BarChart3,
  Clock,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/lib/hooks/use-library";
import { useSessions, type Session } from "@/lib/hooks/use-sessions";
import { useAchievementStats } from "@/lib/hooks/use-statistics";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { formatPlaytime } from "@/lib/utils";
import { formatSessionDate, formatSessionTime } from "@/lib/utils/date";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: games, isLoading: gamesLoading, error: gamesError, refetch: refetchGames } = useLibrary();
  const { data: preferences } = usePreferences();
  const timezone = preferences?.timezone ?? "UTC";

  const [now] = useState(() => new Date().toISOString());
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useSessions(now);
  const { data: achievementData, isLoading: achievementsLoading } = useAchievementStats();

  const stats = useMemo(() => {
    if (!games) return null;
    return {
      total: games.length,
      backlog: games.filter((g) => g.status === "backlog").length,
      playing: games.filter((g) => g.status === "playing").length,
      completed: games.filter((g) => g.status === "completed").length,
      totalPlaytime: games.reduce((acc, g) => acc + g.playtimeMinutes, 0),
    };
  }, [games]);

  const upcomingSessions = sessions?.slice(0, 5) ?? [];
  const achievementPct = achievementData?.overallAchievements?.percentage;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {session?.user?.name}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s your gaming overview
        </p>
      </div>

      {/* Error State for games */}
      {gamesError && (
        <ErrorCard
          message="Failed to load your library."
          onRetry={() => refetchGames()}
        />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Games" value={stats?.total} loading={gamesLoading} />
        <StatCard title="Backlog" value={stats?.backlog} loading={gamesLoading} />
        <StatCard title="Playing" value={stats?.playing} loading={gamesLoading} />
        <StatCard title="Completed" value={stats?.completed} loading={gamesLoading} />
      </div>

      {/* Playtime + Achievements Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Total Playtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gamesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : stats ? (
              <p className="text-2xl font-bold text-primary">
                {formatPlaytime(stats.totalPlaytime)}
              </p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              Achievement Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {achievementsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : achievementPct != null ? (
              <p className="text-2xl font-bold text-primary">
                {achievementPct.toFixed(1)}%
              </p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsError ? (
            <ErrorCard
              message="Failed to load sessions."
              onRetry={() => refetchSessions()}
            />
          ) : sessionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : upcomingSessions.length === 0 ? (
            <EmptyState
              message="No upcoming sessions scheduled."
              linkText="Schedule some gaming time"
              linkHref="/schedule"
            />
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((s) => (
                <SessionRow key={s.id} session={s} timezone={timezone} />
              ))}
              {(sessions?.length ?? 0) > 5 && (
                <Link href="/schedule">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all sessions
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty Library CTA */}
      {!gamesLoading && games?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Gamepad2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Your library is empty. Sync your Steam games to get started!
            </p>
            <Link href="/library">
              <Button>Go to Library</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/library">
          <Button variant="outline" className="gap-2">
            <Gamepad2 className="h-4 w-4" />
            View Library
          </Button>
        </Link>
        <Link href="/schedule">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            View Schedule
          </Button>
        </Link>
        <Link href="/statistics">
          <Button variant="outline" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            View Statistics
          </Button>
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
          <p className="text-2xl font-bold">{value != null ? value.toLocaleString() : "--"}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SessionRow({
  session,
  timezone,
}: {
  session: Session;
  timezone: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
      <div className="min-w-0">
        <p className="font-medium truncate">
          {session.game?.name ?? `Game ${session.steamAppId}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatSessionDate(session.startTime, timezone)}{" "}
          {formatSessionTime(session.startTime, timezone)} –{" "}
          {formatSessionTime(session.endTime, timezone)}
        </p>
      </div>
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="ml-auto shrink-0"
      >
        Try again
      </Button>
    </div>
  );
}

function EmptyState({
  message,
  linkText,
  linkHref,
}: {
  message: string;
  linkText: string;
  linkHref: string;
}) {
  return (
    <div className="text-center py-6">
      <p className="text-muted-foreground mb-2">{message}</p>
      <Link href={linkHref}>
        <Button variant="link" size="sm">
          {linkText}
        </Button>
      </Link>
    </div>
  );
}
