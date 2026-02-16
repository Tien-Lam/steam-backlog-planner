import { db, userPreferences, scheduledSessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/services/cache";
import {
  tryRefreshAccessToken,
  isRefreshError,
  createEvent,
  updateEvent,
  deleteEvent,
  type CalendarEventData,
} from "./google-calendar";

interface GCalConfig {
  accessToken: string;
  calendarId: string;
  timezone: string;
}

export async function getGoogleCalendarConfig(
  userId: string
): Promise<GCalConfig | null> {
  const rows = await db
    .select({
      enabled: userPreferences.googleCalendarSyncEnabled,
      accessToken: userPreferences.googleAccessToken,
      refreshToken: userPreferences.googleRefreshToken,
      tokenExpiry: userPreferences.googleTokenExpiry,
      calendarId: userPreferences.googleCalendarId,
      timezone: userPreferences.timezone,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (!rows.length) return null;
  const prefs = rows[0];
  if (!prefs.enabled || !prefs.accessToken || !prefs.refreshToken || !prefs.calendarId) {
    return null;
  }

  let accessToken = prefs.accessToken;

  if (prefs.tokenExpiry && prefs.tokenExpiry.getTime() < Date.now() + 60_000) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const lockKey = `sbp:gcal-token-refresh:${userId}`;
    let lockAcquired = false;
    try {
      const result = await redis.set(lockKey, "1", { nx: true, ex: 30 });
      lockAcquired = result === "OK";
    } catch {
      // Redis failure — proceed without lock (fail-open)
      lockAcquired = true;
    }

    if (!lockAcquired) return null;

    try {
      const result = await tryRefreshAccessToken(prefs.refreshToken, clientId, clientSecret);

      if (isRefreshError(result)) {
        if (result.permanent) {
          await db
            .update(userPreferences)
            .set({ googleCalendarSyncEnabled: false, updatedAt: new Date() })
            .where(eq(userPreferences.userId, userId));
        } else {
          const failKey = `sbp:gcal-refresh-failures:${userId}`;
          try {
            const failures = await redis.incr(failKey);
            await redis.expire(failKey, 86400);
            if (failures >= 3) {
              await db
                .update(userPreferences)
                .set({ googleCalendarSyncEnabled: false, updatedAt: new Date() })
                .where(eq(userPreferences.userId, userId));
            }
          } catch {
            // Redis failure tracking failed — skip
          }
        }
        return null;
      }

      accessToken = result.accessToken;
      const newExpiry = new Date(Date.now() + result.expiresIn * 1000);
      await db
        .update(userPreferences)
        .set({
          googleAccessToken: accessToken,
          googleTokenExpiry: newExpiry,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));

      try {
        await redis.del(`sbp:gcal-refresh-failures:${userId}`);
      } catch {
        // Failure counter reset failed — non-critical
      }
    } finally {
      try {
        await redis.del(lockKey);
      } catch {
        // Lock release failed — TTL will clean up
      }
    }
  }

  return {
    accessToken,
    calendarId: prefs.calendarId,
    timezone: prefs.timezone ?? "UTC",
  };
}

export async function syncSessionCreated(
  userId: string,
  sessionId: string,
  data: { gameName: string; startTime: Date; endTime: Date; notes?: string | null }
): Promise<void> {
  const config = await getGoogleCalendarConfig(userId);
  if (!config) return;

  const eventData: CalendarEventData = {
    summary: data.gameName,
    description: data.notes ?? undefined,
    startTime: data.startTime,
    endTime: data.endTime,
    timezone: config.timezone,
  };

  const result = await createEvent(config.accessToken, config.calendarId, eventData);
  if (result) {
    await db
      .update(scheduledSessions)
      .set({ googleCalendarEventId: result.eventId })
      .where(eq(scheduledSessions.id, sessionId));
  }
}

export async function syncSessionUpdated(
  userId: string,
  sessionId: string,
  data: { gameName: string; startTime: Date; endTime: Date; notes?: string | null }
): Promise<void> {
  const config = await getGoogleCalendarConfig(userId);
  if (!config) return;

  const sessionRows = await db
    .select({ googleCalendarEventId: scheduledSessions.googleCalendarEventId })
    .from(scheduledSessions)
    .where(eq(scheduledSessions.id, sessionId))
    .limit(1);

  const eventData: CalendarEventData = {
    summary: data.gameName,
    description: data.notes ?? undefined,
    startTime: data.startTime,
    endTime: data.endTime,
    timezone: config.timezone,
  };

  const existingEventId = sessionRows[0]?.googleCalendarEventId;
  if (existingEventId) {
    await updateEvent(config.accessToken, config.calendarId, existingEventId, eventData);
  } else {
    const result = await createEvent(config.accessToken, config.calendarId, eventData);
    if (result) {
      await db
        .update(scheduledSessions)
        .set({ googleCalendarEventId: result.eventId })
        .where(eq(scheduledSessions.id, sessionId));
    }
  }
}

export async function syncSessionDeleted(
  userId: string,
  eventId: string | null
): Promise<void> {
  if (!eventId) return;

  const config = await getGoogleCalendarConfig(userId);
  if (!config) return;

  await deleteEvent(config.accessToken, config.calendarId, eventId);
}

export async function syncAutoGenerate(
  userId: string,
  sessions: Array<{ id: string; gameName: string; startTime: Date; endTime: Date }>
): Promise<void> {
  const config = await getGoogleCalendarConfig(userId);
  if (!config) return;

  for (const session of sessions) {
    const eventData: CalendarEventData = {
      summary: session.gameName,
      startTime: session.startTime,
      endTime: session.endTime,
      timezone: config.timezone,
    };

    const result = await createEvent(config.accessToken, config.calendarId, eventData);
    if (result) {
      await db
        .update(scheduledSessions)
        .set({ googleCalendarEventId: result.eventId })
        .where(eq(scheduledSessions.id, session.id));
    }
  }
}
