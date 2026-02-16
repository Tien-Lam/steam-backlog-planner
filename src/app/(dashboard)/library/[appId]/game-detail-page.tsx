"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useLibrary, useUpdateGameStatus } from "@/lib/hooks/use-library";
import { useGameAchievements, useHLTBData, useIGDBData } from "@/lib/hooks/use-game-detail";
import { getStorePage } from "@/lib/services/steam";
import { formatPlaytime } from "@/lib/utils";
import type { GameStatus } from "@/lib/db/schema";

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);
  const appIdNum = parseInt(appId, 10);

  const { data: games, isLoading: libraryLoading } = useLibrary();
  const { data: achievements, isLoading: achievementsLoading } = useGameAchievements(appIdNum);
  const { data: hltb, isLoading: hltbLoading } = useHLTBData(appIdNum);
  const { data: igdb, isLoading: igdbLoading } = useIGDBData(appIdNum);
  const updateStatus = useUpdateGameStatus();

  const game = games?.find((g) => g.steamAppId === appIdNum);

  if (libraryLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-[460/215] max-w-2xl rounded-lg" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="space-y-4">
        <Link href="/library">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
          </Button>
        </Link>
        <p className="text-muted-foreground">Game not found.</p>
      </div>
    );
  }

  const gameName = game.cache?.name ?? `App ${game.steamAppId}`;
  const headerUrl =
    game.cache?.headerImageUrl ??
    `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;

  const hltbMain = hltb?.mainMinutes ?? game.cache?.hltbMainMinutes;
  const hltbExtra = hltb?.extraMinutes ?? game.cache?.hltbExtraMinutes;
  const hltbComp = hltb?.completionistMinutes ?? game.cache?.hltbCompletionistMinutes;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/library">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{gameName}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-[460/215] max-w-2xl rounded-lg overflow-hidden">
            <Image
              src={headerUrl}
              alt={gameName}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 66vw"
              unoptimized
            />
          </div>

          {/* Genres */}
          {igdbLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          ) : igdb?.genres && igdb.genres.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {igdb.genres.map((genre) => (
                <Badge key={genre} variant="secondary">
                  {genre}
                </Badge>
              ))}
            </div>
          ) : null}

          {/* About */}
          {igdbLoading ? (
            <Card className="p-4 space-y-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ) : igdb?.summary ? (
            <Card className="p-4 space-y-2">
              <h2 className="font-semibold">About</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {igdb.summary}
              </p>
            </Card>
          ) : null}

          {/* HLTB Section */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">How Long to Beat</h2>
            {hltbLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : hltbMain || hltbExtra || hltbComp ? (
              <div className="space-y-3">
                {hltbMain && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Main Story</span>
                      <span>{formatPlaytime(hltbMain)}</span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.round((game.playtimeMinutes / hltbMain) * 100))}
                      className="h-2"
                    />
                  </div>
                )}
                {hltbExtra && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Main + Extras</span>
                      <span>{formatPlaytime(hltbExtra)}</span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.round((game.playtimeMinutes / hltbExtra) * 100))}
                      className="h-2"
                    />
                  </div>
                )}
                {hltbComp && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Completionist</span>
                      <span>{formatPlaytime(hltbComp)}</span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.round((game.playtimeMinutes / hltbComp) * 100))}
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No HLTB data available.</p>
            )}
          </Card>

          {/* Achievements Section */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Achievements</h2>
            {achievementsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : achievements && achievements.totalCount > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <Progress
                    value={Math.round((achievements.achievedCount / achievements.totalCount) * 100)}
                    className="h-2 flex-1"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {achievements.achievedCount} / {achievements.totalCount}
                  </span>
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {achievements.achievements.map((ach) => (
                      <div
                        key={ach.apiname}
                        className={`flex items-center gap-3 p-2 rounded ${
                          ach.achieved ? "opacity-100" : "opacity-50"
                        }`}
                      >
                        {ach.icon && (
                          <Image
                            src={ach.achieved ? ach.icon : (ach.icongray ?? ach.icon)}
                            alt={ach.name ?? ach.apiname}
                            width={32}
                            height={32}
                            unoptimized
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {ach.name ?? ach.apiname}
                          </p>
                          {ach.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {ach.description}
                            </p>
                          )}
                        </div>
                        {ach.achieved ? (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-400 shrink-0">
                            Unlocked
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No achievements for this game.</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            {igdbLoading ? (
              <div>
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-7 w-12" />
              </div>
            ) : igdb?.rating ? (
              <div>
                <p className="text-sm text-muted-foreground">IGDB Rating</p>
                <p className="text-lg font-semibold">{igdb.rating}<span className="text-sm text-muted-foreground">/100</span></p>
              </div>
            ) : null}

            <div>
              <p className="text-sm text-muted-foreground">Playtime</p>
              <p className="text-lg font-semibold">{formatPlaytime(game.playtimeMinutes)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Select
                value={game.status}
                onValueChange={(val) =>
                  updateStatus.mutate({ steamAppId: game.steamAppId, status: val as GameStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="playing">Playing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {game.lastPlayed && (
              <div>
                <p className="text-sm text-muted-foreground">Last Played</p>
                <p className="text-sm">{new Date(game.lastPlayed).toLocaleDateString()}</p>
              </div>
            )}

            <a
              href={getStorePage(game.steamAppId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                Steam Store <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
