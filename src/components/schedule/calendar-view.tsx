"use client";

import { useState, useMemo } from "react";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionCard } from "./session-card";
import { SessionFormDialog } from "./session-form-dialog";
import { AutoScheduleDialog } from "./auto-schedule-dialog";
import {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useAutoGenerateSessions,
  type Session,
} from "@/lib/hooks/use-sessions";
import { useLibrary } from "@/lib/hooks/use-library";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { getWeekDays, formatSessionDate } from "@/lib/utils/date";

export function CalendarView() {
  const { data: prefs } = usePreferences();
  const timezone = prefs?.timezone ?? "UTC";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showNewSession, setShowNewSession] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const from = monthStart < weekStart ? monthStart : weekStart;
  const to = monthEnd > weekEnd ? monthEnd : weekEnd;

  const { data: sessions, isLoading } = useSessions(
    from.toISOString(),
    to.toISOString()
  );
  const { data: games } = useLibrary();

  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const autoGenerate = useAutoGenerateSessions();

  const weekDays = getWeekDays(currentDate);

  const sessionsByDay = useMemo(() => {
    if (!sessions) return {};
    const map: Record<string, Session[]> = {};
    for (const session of sessions) {
      const zoned = toZonedTime(new Date(session.startTime), timezone);
      const key = zoned.toISOString().split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(session);
    }
    return map;
  }, [sessions, timezone]);

  const selectedDaySessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s) => {
      const zoned = toZonedTime(new Date(s.startTime), timezone);
      return isSameDay(zoned, selectedDate);
    });
  }, [sessions, selectedDate, timezone]);

  const datesWithSessions = useMemo(() => {
    return Object.keys(sessionsByDay).map((d) => new Date(d));
  }, [sessionsByDay]);

  function handleCreate(data: {
    steamAppId: number;
    startTime: string;
    endTime: string;
    notes?: string;
  }) {
    createSession.mutate(data, {
      onSuccess: () => setShowNewSession(false),
    });
  }

  function handleEdit(data: {
    steamAppId: number;
    startTime: string;
    endTime: string;
    notes?: string;
  }) {
    if (!editSession) return;
    updateSession.mutate(
      { sessionId: editSession.id, ...data },
      { onSuccess: () => setEditSession(null) }
    );
  }

  function handleAutoGenerate(data: {
    startDate: string;
    weeks: number;
    clearExisting: boolean;
  }) {
    autoGenerate.mutate(data, {
      onSuccess: () => setShowAutoSchedule(false),
    });
  }

  function prevWeek() {
    setCurrentDate((d) => addDays(d, -7));
  }

  function nextWeek() {
    setCurrentDate((d) => addDays(d, 7));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAutoSchedule(true)}>
            Auto-Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href="/api/calendar/export.ics" download>
              Export iCal
            </a>
          </Button>
          <Button size="sm" onClick={() => setShowNewSession(true)}>
            New Session
          </Button>
        </div>
      </div>

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={prevWeek}>
              &larr; Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatSessionDate(weekDays[0], timezone)} &mdash;{" "}
              {formatSessionDate(weekDays[6], timezone)}
            </span>
            <Button variant="ghost" size="sm" onClick={nextWeek}>
              Next &rarr;
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const key = day.toISOString().split("T")[0];
                const daySessions = sessionsByDay[key] ?? [];
                const isToday = isSameDay(day, new Date());

                return (
                  <Card
                    key={key}
                    className={`p-2 min-h-[120px] ${isToday ? "border-primary" : ""}`}
                  >
                    <p
                      className={`text-xs font-medium mb-2 ${isToday ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {formatSessionDate(day, timezone)}
                    </p>
                    <div className="space-y-1">
                      {daySessions.map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          timezone={timezone}
                          onEdit={setEditSession}
                          onDelete={(id) => deleteSession.mutate(id)}
                          onToggleComplete={(id, completed) =>
                            updateSession.mutate({ sessionId: id, completed })
                          }
                        />
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="month" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              onMonthChange={setCurrentDate}
              modifiers={{ hasSessions: datesWithSessions }}
              modifiersClassNames={{
                hasSessions: "bg-primary/20 rounded-md",
              }}
            />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                {formatSessionDate(selectedDate, timezone)}
              </h3>
              {selectedDaySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sessions scheduled for this day.
                </p>
              ) : (
                selectedDaySessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    timezone={timezone}
                    onEdit={setEditSession}
                    onDelete={(id) => deleteSession.mutate(id)}
                    onToggleComplete={(id, completed) =>
                      updateSession.mutate({ sessionId: id, completed })
                    }
                  />
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <SessionFormDialog
        open={showNewSession}
        onOpenChange={setShowNewSession}
        games={games ?? []}
        timezone={timezone}
        onSubmit={handleCreate}
        isPending={createSession.isPending}
      />

      <SessionFormDialog
        open={!!editSession}
        onOpenChange={(open) => !open && setEditSession(null)}
        session={editSession}
        games={games ?? []}
        timezone={timezone}
        onSubmit={handleEdit}
        isPending={updateSession.isPending}
      />

      <AutoScheduleDialog
        open={showAutoSchedule}
        onOpenChange={setShowAutoSchedule}
        onGenerate={handleAutoGenerate}
        isPending={autoGenerate.isPending}
      />
    </div>
  );
}
