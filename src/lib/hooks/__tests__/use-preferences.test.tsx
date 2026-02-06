import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePreferences, useUpdatePreferences } from "../use-preferences";

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

describe("usePreferences", () => {
  it("fetches preferences successfully", async () => {
    const prefs = { weeklyHours: 10, sessionLengthMinutes: 60, timezone: "UTC" };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(prefs) });

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(prefs);
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => usePreferences(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdatePreferences", () => {
  it("sends PATCH with preferences", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    const { result } = renderHook(() => useUpdatePreferences(), { wrapper: createWrapper() });
    result.current.mutate({ weeklyHours: 20 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyHours: 20 }),
    });
  });

  it("handles update error", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useUpdatePreferences(), { wrapper: createWrapper() });
    result.current.mutate({ weeklyHours: 20 });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
