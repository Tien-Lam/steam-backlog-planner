import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AchievementOverview } from "../achievement-overview";

vi.mock("radix-ui", () => ({
  Progress: {
    Root: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", { "data-testid": "progress", ...props }, children),
    Indicator: (props: React.ComponentProps<"div">) =>
      React.createElement("div", props),
  },
}));

describe("AchievementOverview", () => {
  it("renders loading state", () => {
    render(<AchievementOverview data={undefined} isLoading={true} />);
    expect(screen.getByText("Achievements")).toBeInTheDocument();
    expect(screen.getByText("Loading achievements...")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<AchievementOverview data={undefined} isLoading={false} />);
    expect(screen.getByText("No achievement data yet. Visit a game detail page to sync achievements.")).toBeInTheDocument();
  });

  it("renders empty state when perGame is empty", () => {
    render(
      <AchievementOverview
        data={{
          overallAchievements: { achieved: 0, total: 0, percentage: 0 },
          perGame: [],
        }}
        isLoading={false}
      />
    );
    expect(screen.getByText(/No achievement data/)).toBeInTheDocument();
  });

  it("renders overall percentage and per-game data", () => {
    render(
      <AchievementOverview
        data={{
          overallAchievements: { achieved: 15, total: 30, percentage: 50 },
          perGame: [
            { steamAppId: 440, gameName: "TF2", achieved: 10, total: 20, percentage: 50 },
            { steamAppId: 620, gameName: "Portal 2", achieved: 5, total: 10, percentage: 50 },
          ],
        }}
        isLoading={false}
      />
    );
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("15 / 30 achievements")).toBeInTheDocument();
    expect(screen.getByText("TF2")).toBeInTheDocument();
    expect(screen.getByText("Portal 2")).toBeInTheDocument();
    expect(screen.getByText("10/20 (50%)")).toBeInTheDocument();
  });
});
