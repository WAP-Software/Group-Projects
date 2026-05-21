"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Calculator,
  ClipboardCheck,
  BarChart3,
  Vote,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Layers,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const MAIN_LINKS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/workspace", label: "Workspace", icon: Layers },
  { href: "/reviews", label: "Peer Review", icon: ClipboardCheck },
];

const MORE_LINKS = [
  { href: "/polls", label: "Polls", icon: Vote },
  { href: "/sources", label: "Sources", icon: BookOpen },
  { href: "/formulas", label: "Formulas", icon: Calculator },
  { href: "/contributions", label: "Contributions", icon: BarChart3 },
];

interface SidebarProps {
  workspaceId: string;
  workspaceName: string;
  workspaceColor: string;
}

export function Sidebar({ workspaceId, workspaceName, workspaceColor }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const base = `/workspaces/${workspaceId}`;

  function isActive(href: string) {
    const to = `${base}${href}`;
    return href === ""
      ? pathname === base || pathname === `${base}/`
      : pathname.startsWith(to);
  }

  function navLink(href: string, label: string, Icon: React.ElementType) {
    const to = `${base}${href}`;
    const active = isActive(href);
    const link = (
      <Link
        key={to}
        href={to}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium",
          "transition-colors duration-100",
          "hover:bg-accent hover:text-accent-foreground",
          active ? "bg-primary/10 text-primary" : "text-sidebar-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && label}
      </Link>
    );
    if (collapsed) {
      return (
        <Tooltip key={to}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  const moreActive = MORE_LINKS.some((l) => isActive(l.href));

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sidebar-transition flex flex-col border-r border-sidebar-border bg-sidebar relative z-20",
          "hidden md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {/* Workspace name */}
        <div className="flex h-14 items-center gap-2 px-3 border-b border-sidebar-border">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: workspaceColor }}
          >
            {workspaceName[0]?.toUpperCase()}
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-sidebar-foreground">
              {workspaceName}
            </span>
          )}
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-0.5 px-2">
            {MAIN_LINKS.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}

            <Separator className="my-2" />

            {/* Mehr section */}
            {collapsed ? (
              MORE_LINKS.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))
            ) : (
              <>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium",
                    "transition-colors duration-100 hover:bg-accent hover:text-accent-foreground",
                    moreActive ? "text-primary" : "text-sidebar-foreground",
                  )}
                >
                  <span>Mehr</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", moreOpen && "rotate-180")} />
                </button>
                {moreOpen && (
                  <div className="space-y-0.5 pl-2">
                    {MORE_LINKS.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
                  </div>
                )}
              </>
            )}
          </nav>
        </ScrollArea>

        <Separator />
        <div className="p-2 space-y-0.5">
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`${base}/settings`}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-md transition-colors mx-auto",
                      isActive("/settings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mx-auto">
                    <TrendingUp className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">All Workspaces</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Link
                href={`${base}/settings`}
                className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  isActive("/settings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <TrendingUp className="h-4 w-4" />
                All Workspaces
              </Link>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute -right-3 top-16 z-30",
            "flex h-6 w-6 items-center justify-center rounded-full",
            "border border-border bg-background shadow-sm",
            "text-muted-foreground hover:text-foreground",
            "transition-colors duration-150 pressable",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
