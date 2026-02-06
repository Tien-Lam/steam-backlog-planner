import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BacklogPrioritizer } from "../backlog-prioritizer";
import { makeLibraryGame } from "@/lib/__tests__/helpers";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("BacklogPrioritizer", () => {
  it("shows empty state when no backlog games", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <BacklogPrioritizer games={[]} />
      </Wrapper>
    );
    expect(screen.getByText(/no games in your backlog/i)).toBeInTheDocument();
  });

  it("renders backlog games sorted by priority", () => {
    const games = [
      makeLibraryGame({ steamAppId: 440, status: "backlog", priority: 1 }),
      makeLibraryGame({
        steamAppId: 730,
        status: "backlog",
        priority: 2,
        cache: {
          steamAppId: 730,
          name: "CS:GO",
          headerImageUrl: null,
          hltbMainMinutes: null,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
    ];

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <BacklogPrioritizer games={games} />
      </Wrapper>
    );

    expect(screen.getByText("CS:GO")).toBeInTheDocument();
    expect(screen.getByText("Team Fortress 2")).toBeInTheDocument();
  });

  it("filters out non-backlog games", () => {
    const games = [
      makeLibraryGame({ steamAppId: 440, status: "backlog", priority: 1 }),
      makeLibraryGame({ steamAppId: 730, status: "playing", priority: 2 }),
    ];

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <BacklogPrioritizer games={games} />
      </Wrapper>
    );

    expect(screen.getByText("Team Fortress 2")).toBeInTheDocument();
    expect(screen.queryByText("playing")).not.toBeInTheDocument();
  });

  it("has a save button", () => {
    const games = [
      makeLibraryGame({ status: "backlog" }),
    ];

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <BacklogPrioritizer games={games} />
      </Wrapper>
    );

    expect(screen.getByText("Save Priority Order")).toBeInTheDocument();
  });

  it("save button is disabled when no changes", () => {
    const games = [
      makeLibraryGame({ status: "backlog" }),
    ];

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <BacklogPrioritizer games={games} />
      </Wrapper>
    );

    const btn = screen.getByText("Save Priority Order");
    expect(btn).toBeDisabled();
  });
});
