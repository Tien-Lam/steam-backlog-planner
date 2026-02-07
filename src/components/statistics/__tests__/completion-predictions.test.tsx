import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CompletionPredictions } from "../completion-predictions";

vi.mock("radix-ui", () => ({
  Progress: {
    Root: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", { "data-testid": "progress", ...props }, children),
    Indicator: (props: React.ComponentProps<"div">) =>
      React.createElement("div", props),
  },
}));

describe("CompletionPredictions", () => {
  it("renders empty state when no predictions", () => {
    render(<CompletionPredictions predictions={[]} totalRemainingMinutes={0} />);
    expect(screen.getByText("Completion Predictions")).toBeInTheDocument();
    expect(screen.getByText("No HLTB data available for backlog games.")).toBeInTheDocument();
  });

  it("renders summary cards and per-game progress", () => {
    render(
      <CompletionPredictions
        predictions={[
          {
            steamAppId: 440,
            name: "TF2",
            hltbMinutes: 600,
            playedMinutes: 120,
            remainingMinutes: 480,
          },
        ]}
        totalRemainingMinutes={480}
      />
    );
    expect(screen.getByText("Completion Predictions")).toBeInTheDocument();
    expect(screen.getByText("Total HLTB")).toBeInTheDocument();
    expect(screen.getByText("Played")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("TF2")).toBeInTheDocument();
    expect(screen.getByText("8h left")).toBeInTheDocument();
  });

  it("renders formatted total times", () => {
    render(
      <CompletionPredictions
        predictions={[
          {
            steamAppId: 1,
            name: "Game A",
            hltbMinutes: 120,
            playedMinutes: 60,
            remainingMinutes: 60,
          },
        ]}
        totalRemainingMinutes={60}
      />
    );
    expect(screen.getByText("2h")).toBeInTheDocument();
    // "1h" appears for both Played and Remaining summary cards
    expect(screen.getAllByText("1h")).toHaveLength(2);
    expect(screen.getByText("1h left")).toBeInTheDocument();
  });
});
