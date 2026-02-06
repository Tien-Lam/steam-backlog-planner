"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences, useUpdatePreferences } from "@/lib/hooks/use-preferences";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function SettingsPage() {
  const { data: prefs, isLoading } = usePreferences();
  const updatePrefs = useUpdatePreferences();

  const [weeklyHours, setWeeklyHours] = useState<number | null>(null);
  const [sessionLength, setSessionLength] = useState<number | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);

  const displayWeeklyHours = weeklyHours ?? prefs?.weeklyHours ?? 10;
  const displaySessionLength = sessionLength ?? prefs?.sessionLengthMinutes ?? 60;
  const displayTimezone = timezone ?? prefs?.timezone ?? "UTC";

  function handleSave() {
    updatePrefs.mutate({
      weeklyHours: displayWeeklyHours,
      sessionLengthMinutes: displaySessionLength,
      timezone: displayTimezone,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your gaming preferences</p>
      </div>

      <Card className="p-6 max-w-lg space-y-6">
        <div className="space-y-2">
          <Label htmlFor="weeklyHours">Weekly Gaming Hours</Label>
          <Input
            id="weeklyHours"
            type="number"
            min={0}
            max={168}
            value={displayWeeklyHours}
            onChange={(e) => setWeeklyHours(parseInt(e.target.value, 10) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            How many hours per week you want to dedicate to gaming (0-168)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sessionLength">Session Length (minutes)</Label>
          <Input
            id="sessionLength"
            type="number"
            min={15}
            max={480}
            value={displaySessionLength}
            onChange={(e) => setSessionLength(parseInt(e.target.value, 10) || 60)}
          />
          <p className="text-xs text-muted-foreground">
            Preferred gaming session length (15-480 minutes)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={displayTimezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={updatePrefs.isPending}>
            {updatePrefs.isPending ? "Saving..." : "Save Settings"}
          </Button>
          {updatePrefs.isSuccess && (
            <p className="text-sm text-green-400">Settings saved!</p>
          )}
          {updatePrefs.isError && (
            <p className="text-sm text-destructive">Failed to save settings.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
