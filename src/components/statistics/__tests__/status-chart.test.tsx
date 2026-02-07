import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { StatusChart } from "../status-chart";

vi.mock("recharts", () => ({
  PieChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "pie-chart" }, children),
  Pie: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Cell: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Tooltip: () => null,
  Legend: () => null,
}));

describe("StatusChart", () => {
  it("renders empty state when no data", () => {
    render(<StatusChart data={[]} />);
    expect(screen.getByText("Library Status")).toBeInTheDocument();
    expect(screen.getByText("No games in your library yet.")).toBeInTheDocument();
  });

  it("renders pie chart when data exists", () => {
    render(
      <StatusChart
        data={[
          { status: "backlog", count: 5, fill: "hsl(var(--chart-1))" },
          { status: "playing", count: 3, fill: "hsl(var(--chart-2))" },
        ]}
      />
    );
    expect(screen.getByText("Library Status")).toBeInTheDocument();
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });
});
