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
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  LayoutDashboard: (props: Record<string, unknown>) => (
    <svg data-testid="icon-dashboard" {...props} />
  ),
  Gamepad2: (props: Record<string, unknown>) => (
    <svg data-testid="icon-library" {...props} />
  ),
  Calendar: (props: Record<string, unknown>) => (
    <svg data-testid="icon-schedule" {...props} />
  ),
  BarChart3: (props: Record<string, unknown>) => (
    <svg data-testid="icon-statistics" {...props} />
  ),
  Settings: (props: Record<string, unknown>) => (
    <svg data-testid="icon-settings" {...props} />
  ),
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) => <div {...props}>{children}</div>,
  AvatarImage: ({ src }: { src?: string }) =>
    src ? <img src={src} data-testid="avatar-img" /> : null,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) => (
    <div role="menuitem" {...props}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

describe("Nav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: null });
  });

  it("renders desktop nav with all links", () => {
    render(<Nav />);
    const desktopNav = screen.getByTestId("desktop-nav");
    expect(desktopNav).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Library").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Schedule").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Statistics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile bottom nav", () => {
    render(<Nav />);
    const mobileNav = screen.getByTestId("mobile-bottom-nav");
    expect(mobileNav).toBeInTheDocument();
  });

  it("renders mobile top bar with SBP brand", () => {
    render(<Nav />);
    const mobileTopBar = screen.getByTestId("mobile-top-bar");
    expect(mobileTopBar).toBeInTheDocument();
    expect(screen.getAllByText("SBP").length).toBe(2);
  });

  it("renders icons for nav items", () => {
    render(<Nav />);
    expect(screen.getAllByTestId("icon-dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("icon-library").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("icon-schedule").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("icon-statistics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("icon-settings").length).toBeGreaterThanOrEqual(1);
  });

  it("shows user avatar when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "TestUser", image: "https://avatar.url" },
      },
    });
    render(<Nav />);
    expect(screen.getAllByText("TestUser").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show user menu when unauthenticated", () => {
    render(<Nav />);
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("highlights active nav item", () => {
    mockUsePathname.mockReturnValue("/library");
    render(<Nav />);
    const libraryLinks = screen.getAllByText("Library");
    const hasActiveClass = libraryLinks.some((el) => {
      const link = el.closest("a");
      return link?.className.includes("bg-primary/10 text-primary");
    });
    expect(hasActiveClass).toBe(true);
  });

  it("highlights parent nav item for nested routes", () => {
    mockUsePathname.mockReturnValue("/library/440");
    render(<Nav />);
    const libraryLinks = screen.getAllByText("Library");
    const hasActiveClass = libraryLinks.some((el) => {
      const link = el.closest("a");
      return link?.className.includes("text-primary");
    });
    expect(hasActiveClass).toBe(true);
  });
});
