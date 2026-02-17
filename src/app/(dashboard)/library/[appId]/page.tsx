import GameDetailPage from "./game-detail-page";

// Required for Next.js static export (output: 'export').
// Game detail pages are reached via client-side navigation from the
// library grid, not pre-rendered at build time. revalidate=0 tells
// Next.js this route is dynamic, which bypasses the static export
// check that otherwise requires generateStaticParams to return
// non-empty results (Next.js treats empty array as "missing").
export const revalidate = 0;

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
