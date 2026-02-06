import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "steam",
      name: "Steam",
      credentials: {
        steamId: { type: "text" },
        username: { type: "text" },
        avatarUrl: { type: "text" },
        profileUrl: { type: "text" },
      },
      async authorize(credentials) {
        const steamId = credentials?.steamId as string;
        if (!steamId) return null;

        const username = (credentials?.username as string) || steamId;
        const avatarUrl = (credentials?.avatarUrl as string) || null;
        const profileUrl = (credentials?.profileUrl as string) || null;

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.steamId, steamId))
          .limit(1);

        let userId: string;

        if (existing.length > 0) {
          userId = existing[0].id;
          await db
            .update(users)
            .set({
              steamUsername: username,
              avatarUrl,
              profileUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        } else {
          userId = crypto.randomUUID();
          await db.insert(users).values({
            id: userId,
            steamId,
            steamUsername: username,
            avatarUrl,
            profileUrl,
          });
        }

        return {
          id: userId,
          name: username,
          image: avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;

        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.id, token.userId as string))
          .limit(1);

        if (dbUser.length > 0) {
          (session.user as unknown as Record<string, unknown>).steamId = dbUser[0].steamId;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
