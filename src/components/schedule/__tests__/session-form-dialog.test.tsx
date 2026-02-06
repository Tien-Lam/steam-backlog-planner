import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionFormDialog } from "../session-form-dialog";
import type { LibraryGame } from "@/lib/hooks/use-library";

vi.mock("radix-ui", () => {
  return {
    Dialog: {
      Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
        open ? <div>{children}</div> : null,
      Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Overlay: () => <div data-testid="overlay" />,
      Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
      Description: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
      Close: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    },
    Label: {
      Root: ({ children, ...props }: { children: React.ReactNode }) => (
        <label {...props}>{children}</label>
      ),
    },
    Select: {
      Root: ({ children, value, onValueChange }: {
        children: React.ReactNode;
        value?: string;
        onValueChange?: (v: string) => void;
      }) => (
        <div data-value={value} data-on-change={onValueChange ? "yes" : "no"}>
          {children}
        </div>
      ),
      Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Value: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
      Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Item: ({ children, value }: { children: React.ReactNode; value: string }) => (
        <div data-value={value}>{children}</div>
      ),
      ItemText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
      ItemIndicator: () => null,
      Viewport: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Icon: () => null,
      ScrollUpButton: () => null,
      ScrollDownButton: () => null,
      Label: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Separator: () => null,
    },
  };
});

const games: LibraryGame[] = [
  {
    userId: "u1",
    steamAppId: 440,
    status: "backlog",
    priority: 1,
    playtimeMinutes: 0,
    lastPlayed: null,
    addedAt: "",
    updatedAt: "",
    cache: {
      steamAppId: 440,
      name: "TF2",
      headerImageUrl: null,
      hltbMainMinutes: null,
      hltbExtraMinutes: null,
      hltbCompletionistMinutes: null,
      totalAchievements: null,
    },
  },
];

describe("SessionFormDialog", () => {
  it("renders create form when no session prop", () => {
    render(
      <SessionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        games={games}
        timezone="UTC"
        onSubmit={vi.fn()}
        isPending={false}
      />
    );
    expect(screen.getByText("New Session")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("renders edit form when session prop is provided", () => {
    render(
      <SessionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        session={{
          id: "s1",
          userId: "u1",
          steamAppId: 440,
          startTime: "2025-03-15T18:00:00Z",
          endTime: "2025-03-15T19:00:00Z",
          completed: false,
          notes: "Test",
          createdAt: "",
          game: { name: "TF2", headerImageUrl: null },
        }}
        games={games}
        timezone="UTC"
        onSubmit={vi.fn()}
        isPending={false}
      />
    );
    expect(screen.getByText("Edit Session")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
  });

  it("shows saving state when isPending", () => {
    render(
      <SessionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        games={games}
        timezone="UTC"
        onSubmit={vi.fn()}
        isPending={true}
      />
    );
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <SessionFormDialog
        open={false}
        onOpenChange={vi.fn()}
        games={games}
        timezone="UTC"
        onSubmit={vi.fn()}
        isPending={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("populates notes field for existing session", () => {
    render(
      <SessionFormDialog
        open={true}
        onOpenChange={vi.fn()}
        session={{
          id: "s1",
          userId: "u1",
          steamAppId: 440,
          startTime: "2025-03-15T18:00:00Z",
          endTime: "2025-03-15T19:00:00Z",
          completed: false,
          notes: "My notes",
          createdAt: "",
          game: { name: "TF2", headerImageUrl: null },
        }}
        games={games}
        timezone="UTC"
        onSubmit={vi.fn()}
        isPending={false}
      />
    );
    const notesInput = screen.getByDisplayValue("My notes");
    expect(notesInput).toBeInTheDocument();
  });
});
