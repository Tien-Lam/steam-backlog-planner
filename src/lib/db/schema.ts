import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const gameStatusEnum = pgEnum("game_status", [
  "backlog",
  "playing",
  "completed",
  "abandoned",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  steamId: text("steam_id").notNull().unique(),
  steamUsername: text("steam_username").notNull(),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weeklyHours: integer("weekly_hours").default(10),
  sessionLengthMinutes: integer("session_length_minutes").default(60),
  timezone: text("timezone").default("UTC"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userGames = pgTable(
  "user_games",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    steamAppId: integer("steam_app_id").notNull(),
    status: gameStatusEnum("status").default("backlog").notNull(),
    priority: integer("priority").default(0),
    playtimeMinutes: integer("playtime_minutes").default(0),
    lastPlayed: timestamp("last_played"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.steamAppId] })]
);

export const gameCache = pgTable("game_cache", {
  steamAppId: integer("steam_app_id").primaryKey(),
  name: text("name").notNull(),
  headerImageUrl: text("header_image_url"),
  hltbMainMinutes: integer("hltb_main_minutes"),
  hltbExtraMinutes: integer("hltb_extra_minutes"),
  hltbCompletionistMinutes: integer("hltb_completionist_minutes"),
  totalAchievements: integer("total_achievements"),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    steamAppId: integer("steam_app_id").notNull(),
    achievedCount: integer("achieved_count").default(0).notNull(),
    totalCount: integer("total_count").default(0).notNull(),
    lastSynced: timestamp("last_synced").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.steamAppId] })]
);

export const scheduledSessions = pgTable("scheduled_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  steamAppId: integer("steam_app_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  completed: boolean("completed").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  games: many(userGames),
  achievements: many(userAchievements),
  sessions: many(scheduledSessions),
}));

export const userGamesRelations = relations(userGames, ({ one }) => ({
  user: one(users, {
    fields: [userGames.userId],
    references: [users.id],
  }),
  cache: one(gameCache, {
    fields: [userGames.steamAppId],
    references: [gameCache.steamAppId],
  }),
}));

export const userAchievementsRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(users, {
      fields: [userAchievements.userId],
      references: [users.id],
    }),
    cache: one(gameCache, {
      fields: [userAchievements.steamAppId],
      references: [gameCache.steamAppId],
    }),
  })
);

export const scheduledSessionsRelations = relations(
  scheduledSessions,
  ({ one }) => ({
    user: one(users, {
      fields: [scheduledSessions.userId],
      references: [users.id],
    }),
    cache: one(gameCache, {
      fields: [scheduledSessions.steamAppId],
      references: [gameCache.steamAppId],
    }),
  })
);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type UserGame = typeof userGames.$inferSelect;
export type GameCache = typeof gameCache.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type ScheduledSession = typeof scheduledSessions.$inferSelect;
export type GameStatus = (typeof gameStatusEnum.enumValues)[number];
