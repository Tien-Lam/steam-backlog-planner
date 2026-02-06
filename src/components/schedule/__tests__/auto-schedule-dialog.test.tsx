import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutoScheduleDialog } from "../auto-schedule-dialog";

vi.mock("radix-ui", () => {
  return {
    Dialog: {
      Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
        open ? <div>{children}</div> : null,
      Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Overlay: () => <div />,
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
  };
});

describe("AutoScheduleDialog", () => {
  it("renders dialog when open", () => {
    render(
      <AutoScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerate={vi.fn()}
        isPending={false}
      />
    );
    expect(screen.getByText("Auto-Generate Schedule")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <AutoScheduleDialog
        open={false}
        onOpenChange={vi.fn()}
        onGenerate={vi.fn()}
        isPending={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows generating state when isPending", () => {
    render(
      <AutoScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerate={vi.fn()}
        isPending={true}
      />
    );
    expect(screen.getByText("Generating...")).toBeInTheDocument();
  });

  it("calls onGenerate when form is submitted", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(
      <AutoScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerate={onGenerate}
        isPending={false}
      />
    );

    await user.click(screen.getByText("Generate Schedule"));
    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        weeks: 4,
        clearExisting: false,
      })
    );
  });

  it("has checkbox for clearing existing sessions", () => {
    render(
      <AutoScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerate={vi.fn()}
        isPending={false}
      />
    );
    expect(screen.getByText("Clear existing sessions first")).toBeInTheDocument();
  });
});
