"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getInitials, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  TrendingUp,
  Menu,
  LogOut,
  Settings,
  User,
  Bell,
  Moon,
  Sun,
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
  Calendar,
} from "lucide-react";
import type { Profile } from "@/types/database";

const WORKSPACE_NAV = [
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
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

interface TopNavProps {
  profile: Profile;
}

export function TopNav({ profile }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const workspaceMatch = pathname.match(/\/workspaces\/([^/]+)/);
  const workspaceId = workspaceMatch?.[1] ?? null;
  const base = workspaceId ? `/workspaces/${workspaceId}` : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function toggleDark() {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 backdrop-blur-sm px-4 gap-4">
      {/* Mobile menu trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden pressable" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          {/* Sheet header */}
          <div className="flex h-14 items-center gap-2 px-4 border-b border-border shrink-0">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">FinanceCollab</span>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {base ? (
              <>
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Workspace
                </p>
                {WORKSPACE_NAV.map(({ href, label, icon: Icon }) => {
                  const to = `${base}${href}`;
                  const active = href === ""
                    ? pathname === base || pathname === `${base}/`
                    : pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      href={to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/70 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
                <div className="h-px bg-border my-2" />
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
                >
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  All Workspaces
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
                >
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  Dashboard
                </Link>
              </>
            )}
          </nav>

          {/* User info at bottom */}
          <div className="border-t border-border p-3 shrink-0">
            <div className="flex items-center gap-3 px-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(profile.full_name ?? profile.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.full_name ?? profile.email}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <span className="font-bold text-foreground hidden sm:block">FinanceCollab</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          className="pressable"
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="pressable" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full pressable" aria-label="User menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? "User"} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(profile.full_name ?? profile.email)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
