import GameDetailPage from "./game-detail-page";

// Required for Next.js static export (output: 'export').
// Returns empty array — game detail pages are reached via client-side
// navigation from the library grid, not pre-rendered at build time.
export function generateStaticParams() {
  return [];
}

export default function Page({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  return <GameDetailPage params={params} />;
}
