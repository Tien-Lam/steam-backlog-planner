import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useGameAchievements, useHLTBData } from "../use-game-detail";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/services/hltb", () => ({}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useGameAchievements", () => {
  it("fetches achievement data successfully", async () => {
    const data = { achievedCount: 5, totalCount: 10, achievements: [] };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const { result } = renderHook(() => useGameAchievements(440), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith("/api/steam/achievements/440");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useGameAchievements(99999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("is in loading state initially", () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });

    const { result } = renderHook(() => useGameAchievements(440), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});

describe("useHLTBData", () => {
  it("fetches HLTB data successfully", async () => {
    const data = { mainMinutes: 600, extraMinutes: 1200, completionistMinutes: 2400 };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const { result } = renderHook(() => useHLTBData(440), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith("/api/hltb/440");
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const { result } = renderHook(() => useHLTBData(99999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("is in loading state initially", () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });

    const { result } = renderHook(() => useHLTBData(440), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
