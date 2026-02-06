"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibraryGame } from "@/lib/hooks/use-library";
import type { GameStatus } from "@/lib/db/schema";
import { formatPlaytime } from "@/lib/utils";

const STATUS_COLORS: Record<GameStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  playing: "bg-primary/20 text-primary",
  completed: "bg-green-500/20 text-green-400",
  abandoned: "bg-destructive/20 text-destructive",
};

interface GameCardProps {
  game: LibraryGame;
  onStatusChange: (steamAppId: number, status: GameStatus) => void;
}

export function GameCard({ game, onStatusChange }: GameCardProps) {
  const gameName = game.cache?.name ?? `App ${game.steamAppId}`;
  const headerUrl =
    game.cache?.headerImageUrl ??
    `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;

  const hltbMain = game.cache?.hltbMainMinutes;
  const completionPercent =
    hltbMain && game.playtimeMinutes
      ? Math.min(100, Math.round((game.playtimeMinutes / hltbMain) * 100))
      : null;

  return (
    <Card className="overflow-hidden group hover:border-primary/50 transition-colors">
      <Link href={`/library/${game.steamAppId}`}>
        <div className="relative aspect-[460/215]">
          <Image
            src={headerUrl}
            alt={gameName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
          <div className="absolute top-2 right-2">
            <Badge className={STATUS_COLORS[game.status]} variant="secondary">
              {game.status}
            </Badge>
          </div>
        </div>

        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm truncate" title={gameName}>
            {gameName}
          </h3>
        </div>
      </Link>

      <div className="px-3 pb-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatPlaytime(game.playtimeMinutes)}</span>
          {hltbMain && (
            <span title="HowLongToBeat main story">
              / {formatPlaytime(hltbMain)}
            </span>
          )}
        </div>

        {completionPercent !== null && (
          <Progress value={completionPercent} className="h-1.5" />
        )}

        <Select
          value={game.status}
          onValueChange={(val) =>
            onStatusChange(game.steamAppId, val as GameStatus)
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="playing">Playing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
