import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "../session-card";
import type { Session } from "@/lib/hooks/use-sessions";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

const session: Session = {
  id: "s1",
  userId: "user-1",
  steamAppId: 440,
  startTime: "2025-03-15T18:00:00Z",
  endTime: "2025-03-15T19:30:00Z",
  completed: false,
  notes: "Focus on MvM",
  createdAt: "2025-03-01T00:00:00Z",
  game: { name: "Team Fortress 2", headerImageUrl: "http://img.jpg" },
};

describe("SessionCard", () => {
  const defaultProps = {
    session,
    timezone: "UTC",
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleComplete: vi.fn(),
  };

  it("renders game name and time range", () => {
    render(<SessionCard {...defaultProps} />);
    expect(screen.getByText("Team Fortress 2")).toBeInTheDocument();
    expect(screen.getByText(/6:00 PM/)).toBeInTheDocument();
  });

  it("renders duration badge", () => {
    render(<SessionCard {...defaultProps} />);
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  it("renders notes", () => {
    render(<SessionCard {...defaultProps} />);
    expect(screen.getByText("Focus on MvM")).toBeInTheDocument();
  });

  it("calls onEdit when Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<SessionCard {...defaultProps} onEdit={onEdit} />);
    await user.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith(session);
  });

  it("calls onDelete when Delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<SessionCard {...defaultProps} onDelete={onDelete} />);
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("calls onToggleComplete when Complete button is clicked", async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    render(<SessionCard {...defaultProps} onToggleComplete={onToggleComplete} />);
    await user.click(screen.getByText("Complete"));
    expect(onToggleComplete).toHaveBeenCalledWith("s1", true);
  });

  it("shows Undo when session is completed", () => {
    const completed = { ...session, completed: true };
    render(<SessionCard {...defaultProps} session={completed} />);
    expect(screen.getByText("Undo")).toBeInTheDocument();
  });

  it("adds opacity when completed", () => {
    const completed = { ...session, completed: true };
    render(<SessionCard {...defaultProps} session={completed} />);
    const card = screen.getByTestId("session-card");
    expect(card.className).toContain("opacity-60");
  });

  it("falls back to generic name when no game data", () => {
    const noGame = { ...session, game: null };
    render(<SessionCard {...defaultProps} session={noGame} />);
    expect(screen.getByText("Game 440")).toBeInTheDocument();
  });
});
