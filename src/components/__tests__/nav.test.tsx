import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "../nav";

const mockUsePathname = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  AvatarImage: ({ src }: { src?: string }) => src ? <img src={src} data-testid="avatar-img" /> : null,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span data-testid="avatar-fallback">{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: { children: React.ReactNode }) => (
    <div role="menuitem" {...props}>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

describe("Nav", () => {
  it("renders navigation links", () => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: null });
    render(<Nav />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows SBP brand", () => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: null });
    render(<Nav />);
    expect(screen.getByText("SBP")).toBeInTheDocument();
  });

  it("shows user info when authenticated", () => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "TestUser", image: "https://avatar.url" },
      },
    });
    render(<Nav />);
    expect(screen.getByText("TestUser")).toBeInTheDocument();
  });

  it("does not show user menu when unauthenticated", () => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: null });
    render(<Nav />);
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });
});
