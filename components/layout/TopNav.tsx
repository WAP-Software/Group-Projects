"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
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
} from "lucide-react";
import type { Profile } from "@/types/database";

interface TopNavProps {
  profile: Profile;
  workspaceName?: string;
}

export function TopNav({ profile, workspaceName }: TopNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dark, setDark] = useState(false);

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
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden pressable" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">FinanceCollab</span>
          </div>
          <nav className="p-4">
            <Link href="/dashboard" className="block py-2 text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/workspaces" className="block py-2 text-sm text-muted-foreground hover:text-foreground">
              Workspaces
            </Link>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Logo — only on non-workspace pages */}
      {!workspaceName && (
        <Link href="/dashboard" className="flex items-center gap-2 mr-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground hidden sm:block">FinanceCollab</span>
        </Link>
      )}

      {workspaceName && (
        <span className="text-sm font-medium text-muted-foreground hidden md:block">
          {workspaceName}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          className="pressable"
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications placeholder */}
        <Button variant="ghost" size="icon" className="pressable" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User menu */}
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
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
