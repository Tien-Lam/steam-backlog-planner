import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameCard } from "../game-card";
import { makeLibraryGame } from "@/lib/__tests__/helpers";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode }) => (
    <span data-testid="badge" {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange: (v: string) => void; value: string }) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button data-testid="select-trigger" onClick={() => onValueChange("completed")}>
        Change
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

describe("GameCard", () => {
  const onStatusChange = vi.fn();

  it("renders game name from cache", () => {
    const game = makeLibraryGame();
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    expect(screen.getByText("Team Fortress 2")).toBeInTheDocument();
  });

  it("shows fallback name when cache is null", () => {
    const game = makeLibraryGame({ cache: null });
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    expect(screen.getByText("App 440")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    const game = makeLibraryGame({ status: "playing" });
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    expect(screen.getByText("playing")).toBeInTheDocument();
  });

  it("displays formatted playtime", () => {
    const game = makeLibraryGame({ playtimeMinutes: 150 });
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    expect(screen.getByText("2h 30m")).toBeInTheDocument();
  });

  it("shows HLTB progress bar when data available", () => {
    const game = makeLibraryGame({ playtimeMinutes: 300 });
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    const progress = screen.getByTestId("progress");
    expect(progress).toBeInTheDocument();
    expect(progress.dataset.value).toBe("50");
  });

  it("does not show progress bar without HLTB data", () => {
    const game = makeLibraryGame({
      cache: {
        steamAppId: 440,
        name: "Test",
        headerImageUrl: null,
        hltbMainMinutes: null,
        hltbExtraMinutes: null,
        hltbCompletionistMinutes: null,
        totalAchievements: null,
      },
    });
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    expect(screen.queryByTestId("progress")).not.toBeInTheDocument();
  });

  it("renders game image with correct src", () => {
    const game = makeLibraryGame();
    render(<GameCard game={game} onStatusChange={onStatusChange} />);
    const img = screen.getByAltText("Team Fortress 2");
    expect(img).toHaveAttribute(
      "src",
      "https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg"
    );
  });
});
