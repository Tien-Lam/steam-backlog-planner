import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBatchUpdatePriorities } from "../use-priority";

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

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useBatchUpdatePriorities", () => {
  it("sends PATCH for each game", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([
      { steamAppId: 440, priority: 2 },
      { steamAppId: 730, priority: 1 },
    ]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles partial failure", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([
      { steamAppId: 440, priority: 2 },
      { steamAppId: 730, priority: 1 },
    ]);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("Failed to update 1 game");
  });

  it("sends correct body for each update", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([{ steamAppId: 440, priority: 5 }]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamAppId: 440, priority: 5 }),
    });
  });

  it("handles empty update list", async () => {
    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
