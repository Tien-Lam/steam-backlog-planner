import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPage from "../page";

const mockUseSession = vi.fn();
const mockUseLibrary = vi.fn();
const mockUseSessions = vi.fn();
const mockUseAchievementStats = vi.fn();
const mockUsePreferences = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  Gamepad2: (props: Record<string, unknown>) => <svg data-testid="icon-gamepad" {...props} />,
  Calendar: (props: Record<string, unknown>) => <svg data-testid="icon-calendar" {...props} />,
  BarChart3: (props: Record<string, unknown>) => <svg data-testid="icon-barchart" {...props} />,
  Clock: (props: Record<string, unknown>) => <svg data-testid="icon-clock" {...props} />,
  Trophy: (props: Record<string, unknown>) => <svg data-testid="icon-trophy" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  CardTitle: ({ children, ...props }: { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: Record<string, unknown>) => (
    <div data-testid="skeleton" {...props} />
  ),
}));

vi.mock("@/lib/hooks/use-library", () => ({
  useLibrary: () => mockUseLibrary(),
}));

vi.mock("@/lib/hooks/use-sessions", () => ({
  useSessions: () => mockUseSessions(),
}));

vi.mock("@/lib/hooks/use-statistics", () => ({
  useAchievementStats: () => mockUseAchievementStats(),
}));

vi.mock("@/lib/hooks/use-preferences", () => ({
  usePreferences: () => mockUsePreferences(),
}));

vi.mock("@/lib/utils", () => ({
  formatPlaytime: (m: number) => `${Math.floor(m / 60)}h`,
}));

vi.mock("@/lib/utils/date", () => ({
  formatSessionDate: () => "Mon, Jan 1",
  formatSessionTime: () => "7:00 PM",
}));

const mockGames = [
  { steamAppId: 1, status: "backlog", playtimeMinutes: 120, cache: { name: "Game A" } },
  { steamAppId: 2, status: "playing", playtimeMinutes: 300, cache: { name: "Game B" } },
  { steamAppId: 3, status: "completed", playtimeMinutes: 600, cache: { name: "Game C" } },
];

const mockSessionData = [
  {
    id: "s1",
    steamAppId: 1,
    startTime: "2025-01-01T19:00:00Z",
    endTime: "2025-01-01T21:00:00Z",
    completed: false,
    notes: null,
    game: { name: "Game A", headerImageUrl: null },
  },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Gamer" } },
    });
    mockUseLibrary.mockReturnValue({
      data: mockGames,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseSessions.mockReturnValue({
      data: mockSessionData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseAchievementStats.mockReturnValue({
      data: { overallAchievements: { achieved: 10, total: 20, percentage: 50 } },
      isLoading: false,
    });
    mockUsePreferences.mockReturnValue({
      data: { timezone: "America/New_York", weeklyHours: 10, sessionLengthMinutes: 120 },
    });
  });

  it("renders welcome header with user name", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Welcome back, Gamer")).toBeInTheDocument();
    expect(screen.getByText("Here's your gaming overview")).toBeInTheDocument();
  });

  it("renders stat cards with correct values", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total Games")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBe(3);
    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders total playtime", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total Playtime")).toBeInTheDocument();
    expect(screen.getByText("17h")).toBeInTheDocument();
  });

  it("renders achievement percentage", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Achievement Progress")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
  });

  it("renders upcoming sessions", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Upcoming Sessions")).toBeInTheDocument();
    expect(screen.getByText("Game A")).toBeInTheDocument();
  });

  it("shows loading skeletons when data is loading", () => {
    mockUseLibrary.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    mockUseSessions.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    mockUseAchievementStats.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<DashboardPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error card with retry when library fails", () => {
    const mockRefetch = vi.fn();
    mockUseLibrary.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
      refetch: mockRefetch,
    });
    render(<DashboardPage />);
    expect(screen.getByText("Failed to load your library.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Try again")[0]);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("shows error card with retry when sessions fail", () => {
    const mockRefetch = vi.fn();
    mockUseSessions.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
      refetch: mockRefetch,
    });
    render(<DashboardPage />);
    expect(screen.getByText("Failed to load sessions.")).toBeInTheDocument();
  });

  it("shows empty state when no upcoming sessions", () => {
    mockUseSessions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<DashboardPage />);
    expect(screen.getByText("No upcoming sessions scheduled.")).toBeInTheDocument();
    expect(screen.getByText("Schedule some gaming time")).toBeInTheDocument();
  });

  it("shows empty library CTA when no games", () => {
    mockUseLibrary.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<DashboardPage />);
    expect(
      screen.getByText("Your library is empty. Sync your Steam games to get started!")
    ).toBeInTheDocument();
    expect(screen.getByText("Go to Library")).toBeInTheDocument();
  });

  it("renders quick action buttons", () => {
    render(<DashboardPage />);
    expect(screen.getByText("View Library")).toBeInTheDocument();
    expect(screen.getByText("View Schedule")).toBeInTheDocument();
    expect(screen.getByText("View Statistics")).toBeInTheDocument();
  });

  it("shows -- for achievement when data is null", () => {
    mockUseAchievementStats.mockReturnValue({
      data: null,
      isLoading: false,
    });
    render(<DashboardPage />);
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(1);
  });

  it("shows view all sessions link when more than 5", () => {
    const manySessions = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      steamAppId: i,
      startTime: "2025-01-01T19:00:00Z",
      endTime: "2025-01-01T21:00:00Z",
      completed: false,
      notes: null,
      game: { name: `Game ${i}`, headerImageUrl: null },
    }));
    mockUseSessions.mockReturnValue({
      data: manySessions,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<DashboardPage />);
    expect(screen.getByText("View all sessions")).toBeInTheDocument();
  });
});
