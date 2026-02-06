import { GameGrid } from "@/components/games/game-grid";

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Game Library</h1>
        <p className="text-muted-foreground">
          Your Steam games synced and organized
        </p>
      </div>
      <GameGrid />
    </div>
  );
}
