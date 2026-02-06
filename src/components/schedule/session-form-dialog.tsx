"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import type { Session } from "@/lib/hooks/use-sessions";
import type { LibraryGame } from "@/lib/hooks/use-library";

interface SessionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: Session | null;
  games: LibraryGame[];
  timezone: string;
  onSubmit: (data: {
    steamAppId: number;
    startTime: string;
    endTime: string;
    notes?: string;
  }) => void;
  isPending: boolean;
}

function getInitialValues(session: Session | null | undefined, timezone: string) {
  if (session) {
    const zonedStart = toZonedTime(new Date(session.startTime), timezone);
    const zonedEnd = toZonedTime(new Date(session.endTime), timezone);
    return {
      selectedAppId: String(session.steamAppId),
      date: format(zonedStart, "yyyy-MM-dd"),
      startTime: format(zonedStart, "HH:mm"),
      endTime: format(zonedEnd, "HH:mm"),
      notes: session.notes ?? "",
    };
  }
  const now = toZonedTime(new Date(), timezone);
  return {
    selectedAppId: "",
    date: format(now, "yyyy-MM-dd"),
    startTime: "19:00",
    endTime: "20:00",
    notes: "",
  };
}

function SessionForm({
  session,
  games,
  timezone,
  onSubmit,
  isPending,
}: Omit<SessionFormDialogProps, "open" | "onOpenChange">) {
  const isEdit = !!session;
  const initial = getInitialValues(session, timezone);

  const [selectedAppId, setSelectedAppId] = useState(initial.selectedAppId);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [notes, setNotes] = useState(initial.notes);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const appId = parseInt(selectedAppId, 10);
    if (isNaN(appId) || !date || !startTime || !endTime) return;

    const localStart = new Date(`${date}T${startTime}:00`);
    const localEnd = new Date(`${date}T${endTime}:00`);
    const utcStart = fromZonedTime(localStart, timezone);
    const utcEnd = fromZonedTime(localEnd, timezone);

    onSubmit({
      steamAppId: appId,
      startTime: utcStart.toISOString(),
      endTime: utcEnd.toISOString(),
      notes: notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Game</Label>
        <Select value={selectedAppId} onValueChange={setSelectedAppId} disabled={isEdit}>
          <SelectTrigger>
            <SelectValue placeholder="Select a game" />
          </SelectTrigger>
          <SelectContent>
            {games.map((g) => (
              <SelectItem key={g.steamAppId} value={String(g.steamAppId)}>
                {g.cache?.name ?? `App ${g.steamAppId}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-date">Date</Label>
        <Input
          id="session-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="session-start">Start Time</Label>
          <Input
            id="session-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-end">End Time</Label>
          <Input
            id="session-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-notes">Notes</Label>
        <Input
          id="session-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending || !selectedAppId || !date}>
          {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SessionFormDialog({
  open,
  onOpenChange,
  session,
  games,
  timezone,
  onSubmit,
  isPending,
}: SessionFormDialogProps) {
  const formKey = session?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session ? "Edit Session" : "New Session"}</DialogTitle>
          <DialogDescription>
            {session ? "Update your gaming session." : "Schedule a gaming session."}
          </DialogDescription>
        </DialogHeader>
        <SessionForm
          key={formKey}
          session={session}
          games={games}
          timezone={timezone}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
