import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLibrary, useUpdateGameStatus } from "../use-library";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

describe("useLibrary", () => {
  it("fetches library data successfully", async () => {
    const games = [{ steamAppId: 440, status: "backlog" }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(games),
    });

    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(games);
    expect(mockFetch).toHaveBeenCalledWith("/api/steam/library");
  });

  it("is in loading state initially", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useLibrary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useUpdateGameStatus", () => {
  it("sends PATCH request with correct body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useUpdateGameStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ steamAppId: 440, status: "playing" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamAppId: 440, status: "playing" }),
    });
  });

  it("handles mutation error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    });

    const { result } = renderHook(() => useUpdateGameStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ steamAppId: 440, status: "playing" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
