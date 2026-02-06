import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameGrid } from "../game-grid";
import { makeLibraryGame } from "@/lib/__tests__/helpers";

const mockUseLibrary = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/lib/hooks/use-library", () => ({
  useLibrary: () => mockUseLibrary(),
  useUpdateGameStatus: () => ({
    mutate: mockMutate,
  }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} data-testid="search-input" />
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
}));

let selectCallbacks: Record<string, (v: string) => void> = {};

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange?: (v: string) => void; value?: string }) => {
    if (onValueChange && value) {
      selectCallbacks[value] = onValueChange;
    }
    return (
      <div data-testid={`select-${value}`} data-value={value}>
        {children}
      </div>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

beforeEach(() => {
  mockUseLibrary.mockReset();
  mockMutate.mockReset();
  selectCallbacks = {};
});

describe("GameGrid", () => {
  it("shows loading skeletons when loading", () => {
    mockUseLibrary.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<GameGrid />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error message on error", () => {
    mockUseLibrary.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    });
    render(<GameGrid />);
    expect(screen.getByText(/Failed to load library/)).toBeInTheDocument();
  });

  it("renders game cards when data is loaded", () => {
    const games = [
      makeLibraryGame({ steamAppId: 440 }),
      makeLibraryGame({ steamAppId: 730, cache: { ...makeLibraryGame().cache!, steamAppId: 730, name: "CS2" } }),
    ];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);
    expect(screen.getByText("Team Fortress 2")).toBeInTheDocument();
    expect(screen.getByText("CS2")).toBeInTheDocument();
  });

  it("filters games by search text", async () => {
    const user = userEvent.setup();
    const games = [
      makeLibraryGame({ steamAppId: 440 }),
      makeLibraryGame({
        steamAppId: 730,
        cache: { ...makeLibraryGame().cache!, steamAppId: 730, name: "Counter-Strike 2" },
      }),
    ];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);

    await user.type(screen.getByTestId("search-input"), "Counter");
    expect(screen.getByText("Counter-Strike 2")).toBeInTheDocument();
    expect(screen.queryByText("Team Fortress 2")).not.toBeInTheDocument();
  });

  it("filters by status", () => {
    const games = [
      makeLibraryGame({ steamAppId: 440, status: "backlog" }),
      makeLibraryGame({ steamAppId: 730, status: "playing", cache: { ...makeLibraryGame().cache!, steamAppId: 730, name: "CS2" } }),
    ];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);

    act(() => {
      selectCallbacks["all"]?.("playing");
    });
    expect(screen.getByText("CS2")).toBeInTheDocument();
    expect(screen.queryByText("Team Fortress 2")).not.toBeInTheDocument();
  });

  it("sorts by name", () => {
    const games = [
      makeLibraryGame({ steamAppId: 440, playtimeMinutes: 200, cache: { ...makeLibraryGame().cache!, name: "Zelda" } }),
      makeLibraryGame({ steamAppId: 730, playtimeMinutes: 100, cache: { ...makeLibraryGame().cache!, steamAppId: 730, name: "Apex" } }),
    ];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);

    act(() => {
      selectCallbacks["playtime"]?.("name");
    });

    const cards = screen.getAllByTestId("card");
    expect(cards.length).toBe(2);
  });

  it("sorts by lastPlayed", () => {
    const games = [
      makeLibraryGame({ steamAppId: 440, lastPlayed: null }),
      makeLibraryGame({
        steamAppId: 730,
        lastPlayed: "2024-06-01T00:00:00Z",
        cache: { ...makeLibraryGame().cache!, steamAppId: 730, name: "CS2" },
      }),
    ];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);

    act(() => {
      selectCallbacks["playtime"]?.("lastPlayed");
    });
    const cards = screen.getAllByTestId("card");
    expect(cards.length).toBe(2);
  });

  it("handles status change via GameCard", () => {
    const games = [makeLibraryGame({ steamAppId: 440 })];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);

    act(() => {
      selectCallbacks["backlog"]?.("completed");
    });
    expect(mockMutate).toHaveBeenCalledWith({ steamAppId: 440, status: "completed" });
  });

  it("shows empty message when no games match filters", async () => {
    const user = userEvent.setup();
    const games = [makeLibraryGame()];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);

    await user.type(screen.getByTestId("search-input"), "nonexistent");
    expect(screen.getByText(/No games match your filters/)).toBeInTheDocument();
  });

  it("shows game count", () => {
    const games = [makeLibraryGame(), makeLibraryGame({ steamAppId: 730 })];
    mockUseLibrary.mockReturnValue({ data: games, isLoading: false, error: null });
    render(<GameGrid />);
    expect(screen.getByText("2 of 2 games")).toBeInTheDocument();
  });

  it("shows sync message when no games at all", () => {
    mockUseLibrary.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<GameGrid />);
    expect(screen.getByText(/Sync your Steam library/)).toBeInTheDocument();
  });

  it("has a search input", () => {
    mockUseLibrary.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<GameGrid />);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });
});
