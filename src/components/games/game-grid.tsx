"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GameCard } from "./game-card";
import { useLibrary, useUpdateGameStatus } from "@/lib/hooks/use-library";
import type { GameStatus } from "@/lib/db/schema";

type SortOption = "playtime" | "name" | "lastPlayed";

export function GameGrid() {
  const { data: games, isLoading, error, refetch } = useLibrary();
  const updateStatus = useUpdateGameStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GameStatus | "all">("all");
  const [sort, setSort] = useState<SortOption>("playtime");

  const filtered = useMemo(() => {
    if (!games) return [];

    let result = games;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((g) =>
        (g.cache?.name ?? "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((g) => g.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.cache?.name ?? "").localeCompare(b.cache?.name ?? "");
        case "lastPlayed": {
          const aTime = a.lastPlayed ? new Date(a.lastPlayed).getTime() : 0;
          const bTime = b.lastPlayed ? new Date(b.lastPlayed).getTime() : 0;
          return bTime - aTime;
        }
        case "playtime":
        default:
          return b.playtimeMinutes - a.playtimeMinutes;
      }
    });

    return result;
  }, [games, search, statusFilter, sort]);

  function handleStatusChange(steamAppId: number, status: GameStatus) {
    updateStatus.mutate({ steamAppId, status });
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-3">Failed to load library.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search games..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />

        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as GameStatus | "all")}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="playing">Playing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(val) => setSort(val as SortOption)}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="playtime">Playtime</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="lastPlayed">Last Played</SelectItem>
          </SelectContent>
        </Select>

        {games && (
          <div className="flex items-center text-sm text-muted-foreground ml-auto">
            {filtered.length} of {games.length} games
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[460/215] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((game) => (
            <GameCard
              key={game.steamAppId}
              game={game}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {search || statusFilter !== "all"
            ? "No games match your filters."
            : "No games found. Sync your Steam library to get started."}
        </div>
      )}
    </div>
  );
}
