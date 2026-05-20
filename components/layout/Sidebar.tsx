"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Kanban,
  GanttChartSquare,
  FolderOpen,
  MessageSquare,
  BookOpen,
  Calculator,
  ClipboardCheck,
  BarChart3,
  Vote,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const WORKSPACE_LINKS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/tasks", label: "Kanban Board", icon: Kanban },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/sources", label: "Sources", icon: BookOpen },
  { href: "/formulas", label: "Formulas", icon: Calculator },
  { href: "/reviews", label: "Peer Review", icon: ClipboardCheck },
  { href: "/contributions", label: "Contributions", icon: BarChart3 },
  { href: "/polls", label: "Polls", icon: Vote },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  workspaceId: string;
  workspaceName: string;
  workspaceColor: string;
}

export function Sidebar({ workspaceId, workspaceName, workspaceColor }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const base = `/workspaces/${workspaceId}`;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sidebar-transition flex flex-col border-r border-sidebar-border bg-sidebar relative z-20",
          "hidden md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {/* Logo / Workspace name */}
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
            {WORKSPACE_LINKS.map(({ href, label, icon: Icon }) => {
              const to = `${base}${href}`;
              const active = href === ""
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(to);

              const link = (
                <Link
                  key={to}
                  href={to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium",
                    "transition-colors duration-100",
                    "hover:bg-accent hover:text-accent-foreground",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground",
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
            })}
          </nav>
        </ScrollArea>

        <Separator />
        <div className="p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mx-auto"
                >
                  <TrendingUp className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">All Workspaces</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              All Workspaces
            </Link>
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
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}
