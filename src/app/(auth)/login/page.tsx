import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Steam Backlog Planner</CardTitle>
          <CardDescription>
            Sign in with your Steam account to manage your game backlog
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route that redirects externally */}
          <a href="/api/auth/steam">
            <Button className="w-full gap-2 bg-[#171a21] hover:bg-[#2a475e] text-white" size="lg">
              <SteamIcon />
              Sign in with Steam
            </Button>
          </a>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            We only access your public profile and game library data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SteamIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 10.946l6.432 2.658a3.387 3.387 0 0 1 1.912-.587c.063 0 .125.002.188.006l2.861-4.142V8.81a4.53 4.53 0 0 1 4.523-4.524 4.53 4.53 0 0 1 4.524 4.524 4.53 4.53 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396a3.406 3.406 0 0 1-3.345-2.797L.453 14.857C1.736 19.957 6.407 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.543 2.543 0 0 0 4.707-.982 2.543 2.543 0 0 0-2.541-2.542c-.18 0-.357.02-.529.056l1.522.63a1.868 1.868 0 0 1-1.428 3.449zm8.4-5.49a3.02 3.02 0 0 0 3.016-3.015 3.02 3.02 0 0 0-3.016-3.015 3.02 3.02 0 0 0-3.015 3.015 3.02 3.02 0 0 0 3.015 3.015zm-.004-5.276a2.264 2.264 0 0 1 2.262 2.261 2.264 2.264 0 0 1-2.262 2.263 2.264 2.264 0 0 1-2.261-2.263 2.264 2.264 0 0 1 2.261-2.261z" />
    </svg>
  );
}
