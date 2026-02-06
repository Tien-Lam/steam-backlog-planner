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

interface AutoScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (data: {
    startDate: string;
    weeks: number;
    clearExisting: boolean;
  }) => void;
  isPending: boolean;
}

export function AutoScheduleDialog({
  open,
  onOpenChange,
  onGenerate,
  isPending,
}: AutoScheduleDialogProps) {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [weeks, setWeeks] = useState(4);
  const [clearExisting, setClearExisting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || weeks < 1) return;
    onGenerate({ startDate, weeks, clearExisting });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Auto-Generate Schedule</DialogTitle>
          <DialogDescription>
            Automatically fill your calendar based on your backlog priorities and preferences.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-start-date">Start Date</Label>
            <Input
              id="auto-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-weeks">Number of Weeks</Label>
            <Input
              id="auto-weeks"
              type="number"
              min={1}
              max={12}
              value={weeks}
              onChange={(e) => setWeeks(parseInt(e.target.value, 10) || 1)}
            />
            <p className="text-xs text-muted-foreground">1-12 weeks</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="auto-clear"
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="auto-clear" className="text-sm font-normal">
              Clear existing sessions first
            </Label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !startDate}>
              {isPending ? "Generating..." : "Generate Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
