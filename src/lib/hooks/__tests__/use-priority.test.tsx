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
  it("sends single batch request with all updates", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, updated: 2 }),
    });

    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([
      { steamAppId: 440, priority: 2 },
      { steamAppId: 730, priority: 1 },
    ]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/games/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          { steamAppId: 440, priority: 2 },
          { steamAppId: 730, priority: 1 },
        ],
      }),
    });
  });

  it("handles server error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to update priorities" }),
    });

    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([
      { steamAppId: 440, priority: 2 },
      { steamAppId: 730, priority: 1 },
    ]);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("Failed to update");
  });

  it("handles empty update list without fetching", async () => {
    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useBatchUpdatePriorities(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([{ steamAppId: 440, priority: 5 }]);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
