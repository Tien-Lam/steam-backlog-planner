"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Session } from "@/lib/hooks/use-sessions";
import { formatSessionTime, durationMinutes, formatDuration } from "@/lib/utils/date";

interface SessionCardProps {
  session: Session;
  timezone: string;
  onEdit: (session: Session) => void;
  onDelete: (sessionId: string) => void;
  onToggleComplete: (sessionId: string, completed: boolean) => void;
}

export function SessionCard({
  session,
  timezone,
  onEdit,
  onDelete,
  onToggleComplete,
}: SessionCardProps) {
  const gameName = session.game?.name ?? `Game ${session.steamAppId}`;
  const headerUrl =
    session.game?.headerImageUrl ??
    `https://cdn.akamai.steamstatic.com/steam/apps/${session.steamAppId}/header.jpg`;
  const duration = durationMinutes(session.startTime, session.endTime);
  const timeRange = `${formatSessionTime(session.startTime, timezone)} - ${formatSessionTime(session.endTime, timezone)}`;

  return (
    <Card
      className={`p-3 space-y-2 ${session.completed ? "opacity-60" : ""}`}
      data-testid="session-card"
    >
      <div className="flex items-start gap-3">
        <div className="relative w-16 h-8 rounded overflow-hidden shrink-0">
          <Image
            src={headerUrl}
            alt={gameName}
            fill
            className="object-cover"
            sizes="64px"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{gameName}</h4>
          <p className="text-xs text-muted-foreground">{timeRange}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {formatDuration(duration)}
        </Badge>
      </div>

      {session.notes && (
        <p className="text-xs text-muted-foreground pl-[76px]">{session.notes}</p>
      )}

      <div className="flex items-center gap-1 pl-[76px]">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleComplete(session.id, !session.completed)}
        >
          {session.completed ? "Undo" : "Complete"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onEdit(session)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive"
          onClick={() => onDelete(session.id)}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}
