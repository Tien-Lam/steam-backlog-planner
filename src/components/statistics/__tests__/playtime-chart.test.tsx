import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PlaytimeChart } from "../playtime-chart";

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "bar-chart" }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Tooltip: () => null,
}));

describe("PlaytimeChart", () => {
  it("renders empty state when no data", () => {
    render(<PlaytimeChart data={[]} />);
    expect(screen.getByText("Top Games by Playtime")).toBeInTheDocument();
    expect(screen.getByText("No playtime data available.")).toBeInTheDocument();
  });

  it("renders bar chart when data exists", () => {
    render(
      <PlaytimeChart
        data={[
          { name: "TF2", hours: 50, steamAppId: 440 },
          { name: "Portal 2", hours: 20, steamAppId: 620 },
        ]}
      />
    );
    expect(screen.getByText("Top Games by Playtime")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});
