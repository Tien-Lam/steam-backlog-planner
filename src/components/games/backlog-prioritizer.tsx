"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryGame } from "@/lib/hooks/use-library";
import { useBatchUpdatePriorities } from "@/lib/hooks/use-priority";
import { formatPlaytime } from "@/lib/utils";

function SortableItem({ game }: { game: LibraryGame }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: game.steamAppId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const headerUrl =
    game.cache?.headerImageUrl ??
    `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="relative w-16 h-8 rounded overflow-hidden shrink-0">
        <Image
          src={headerUrl}
          alt={game.cache?.name ?? `App ${game.steamAppId}`}
          fill
          className="object-cover"
          sizes="64px"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {game.cache?.name ?? `App ${game.steamAppId}`}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatPlaytime(game.playtimeMinutes)}
      </span>
    </div>
  );
}

interface BacklogPrioritizerProps {
  games: LibraryGame[];
}

export function BacklogPrioritizer({ games }: BacklogPrioritizerProps) {
  const backlogGames = useMemo(
    () =>
      games
        .filter((g) => g.status === "backlog")
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
    [games]
  );

  const [items, setItems] = useState(backlogGames);
  const [hasChanges, setHasChanges] = useState(false);
  const batchUpdate = useBatchUpdatePriorities();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((g) => g.steamAppId === active.id);
        const newIndex = prev.findIndex((g) => g.steamAppId === over.id);
        setHasChanges(true);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleSave() {
    const updates = items.map((game, index) => ({
      steamAppId: game.steamAppId,
      priority: items.length - index,
    }));
    batchUpdate.mutate(updates, {
      onSuccess: () => setHasChanges(false),
    });
  }

  if (backlogGames.length === 0) {
    return (
      <p className="text-center py-12 text-muted-foreground">
        No games in your backlog to prioritize.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Drag to reorder. Top = highest priority.
        </p>
        <div className="flex items-center gap-3">
          {batchUpdate.isSuccess && (
            <p className="text-sm text-green-400">Priorities saved!</p>
          )}
          {batchUpdate.isError && (
            <p className="text-sm text-destructive">Failed to save.</p>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || batchUpdate.isPending}
          >
            {batchUpdate.isPending ? "Saving..." : "Save Priority Order"}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((g) => g.steamAppId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((game) => (
              <SortableItem key={game.steamAppId} game={game} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
