import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useAutoGenerateSessions,
} from "../use-sessions";

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

describe("useSessions", () => {
  it("fetches sessions from API", async () => {
    const sessions = [{ id: "s1", steamAppId: 440, game: { name: "TF2" } }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sessions),
    });

    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sessions);
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions");
  });

  it("appends date range query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(
      () => useSessions("2025-03-01", "2025-03-31"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sessions?from=2025-03-01&to=2025-03-31"
    );
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateSession", () => {
  it("sends POST request with session data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "new-id" }),
    });

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      steamAppId: 440,
      startTime: "2025-03-15T18:00:00Z",
      endTime: "2025-03-15T19:00:00Z",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("440"),
    });
  });

  it("handles server error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Bad request" }),
    });

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      steamAppId: 440,
      startTime: "2025-03-15T18:00:00Z",
      endTime: "2025-03-15T19:00:00Z",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Bad request");
  });
});

describe("useUpdateSession", () => {
  it("sends PATCH request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "s1", completed: true }),
    });

    const { result } = renderHook(() => useUpdateSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ sessionId: "s1", completed: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("true"),
    });
  });
});

describe("useDeleteSession", () => {
  it("sends DELETE request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useDeleteSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("s1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/s1", {
      method: "DELETE",
    });
  });

  it("handles error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    const { result } = renderHook(() => useDeleteSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("s1");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAutoGenerateSessions", () => {
  it("sends POST request to auto-generate endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ created: 5 }),
    });

    const { result } = renderHook(() => useAutoGenerateSessions(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      startDate: "2025-03-17",
      weeks: 2,
      clearExisting: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/auto-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("2025-03-17"),
    });
  });

  it("handles error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "No backlog" }),
    });

    const { result } = renderHook(() => useAutoGenerateSessions(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ startDate: "2025-03-17", weeks: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No backlog");
  });
});
