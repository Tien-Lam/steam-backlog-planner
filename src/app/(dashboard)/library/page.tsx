"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameGrid } from "@/components/games/game-grid";
import { BacklogPrioritizer } from "@/components/games/backlog-prioritizer";
import { useLibrary } from "@/lib/hooks/use-library";

export default function LibraryPage() {
  const { data: games } = useLibrary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Game Library</h1>
        <p className="text-muted-foreground">
          Your Steam games synced and organized
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Games</TabsTrigger>
          <TabsTrigger value="prioritize">Prioritize Backlog</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <GameGrid />
        </TabsContent>
        <TabsContent value="prioritize">
          <BacklogPrioritizer
            key={(games ?? []).filter(g => g.status === "backlog").map(g => `${g.steamAppId}:${g.priority}`).join(",")}
            games={games ?? []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
