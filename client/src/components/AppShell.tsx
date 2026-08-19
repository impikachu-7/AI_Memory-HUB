/** Quiet Intelligence Console shell: a three-zone workbench with an anchored location rail and calm primary canvas. */

import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Command,
  KeyRound,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

type NavigationItem = { label: string; href: string; icon: LucideIcon; matches?: string[] };

const primaryNav: NavigationItem[] = [
  { label: "Chat", href: "/chat", icon: MessageSquareText },
  { label: "Conversations", href: "/conversations", icon: PanelLeftClose },
  { label: "Memory", href: "/memory", icon: BrainCircuit, matches: ["/memory"] },
  { label: "Models", href: "/models", icon: Bot },
];

const manageNav: NavigationItem[] = [
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Privacy", href: "/privacy", icon: ShieldCheck },
  { label: "Provider settings", href: "/settings/providers", icon: KeyRound },
  { label: "Settings", href: "/settings", icon: Settings2, matches: ["/settings", "/profile"] },
];

function NavigationLink({ item, collapsed, location }: { item: NavigationItem; collapsed: boolean; location: string }) {
  const active = item.matches
    ? item.matches.some((prefix) => location === prefix || location.startsWith(`${prefix}/`))
    : location === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition duration-200 active:scale-[0.98]",
        active
          ? "bg-[color:color-mix(in_oklab,var(--memory-teal)_13%,transparent)] text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function AppShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const rail = (mobile = false) => (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground",
        mobile
          ? "w-[285px]"
          : cn(
              "fixed inset-y-0 left-0 z-40 hidden h-screen transition-[width] duration-200 lg:flex",
              collapsed ? "w-[76px]" : "w-[255px]",
            ),
      )}
    >
      <div className={cn("flex h-[76px] items-center border-b border-border px-5", collapsed && "justify-center px-3")}>
        <Link href="/chat" onClick={() => setMobileOpen(false)}>
          <BrandLockup compact={collapsed} />
        </Link>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
        {!collapsed && <p className="index-label mb-2 px-3">Workspace</p>}
        <nav className="space-y-1">
          {primaryNav.map((item) => <NavigationLink key={item.href} item={item} collapsed={collapsed} location={location} />)}
        </nav>
        <div className="my-6 h-px bg-border" />
        {!collapsed && <p className="index-label mb-2 px-3">Control center</p>}
        <nav className="space-y-1">
          {manageNav.map((item) => <NavigationLink key={item.href} item={item} collapsed={collapsed} location={location} />)}
        </nav>
      </div>
      <div className="border-t border-border p-3">
        <Link
          href="/profile"
          className={cn("flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-secondary", collapsed && "justify-center")}
          title={collapsed ? "Profile" : undefined}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--memory-teal)] text-xs font-bold text-white">AM</span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">Alex Morgan</span>
              <span className="block truncate text-[11px] text-muted-foreground">Personal workspace</span>
            </span>
          )}
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {rail()}
      <div className={cn("min-h-screen w-full transition-[margin] duration-200", collapsed ? "lg:ml-[76px] lg:w-[calc(100%-76px)]" : "lg:ml-[255px] lg:w-[calc(100%-255px)]")}>
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border bg-background/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border lg:hidden" aria-label="Open navigation">
              <Menu className="h-4 w-4" />
            </button>
            <button onClick={() => setCollapsed((value) => !value)} className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-secondary lg:inline-flex" aria-label="Toggle navigation rail">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              {eyebrow && <p className="index-label mb-1 truncate">{eyebrow}</p>}
              <h1 className="font-display truncate text-[18px] font-semibold tracking-[-0.035em] sm:text-[20px]">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs text-muted-foreground transition hover:bg-secondary md:flex" aria-label="Search workspace">
              <Search className="h-3.5 w-3.5" /><span>Search</span><kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
            </button>
            <ThemeToggle />
            {action}
          </div>
        </header>
        <main className="min-h-[calc(100vh-68px)] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full shadow-2xl">{rail(true)}</div>
        </div>
      )}
    </div>
  );
}

export function NewConversationButton({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[color:var(--memory-teal)] px-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(15,157,137,0.8)] transition duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--memory-teal-deep)] active:scale-[0.97]">
      <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New conversation</span><span className="sm:hidden">New</span>
    </button>
  );
}
