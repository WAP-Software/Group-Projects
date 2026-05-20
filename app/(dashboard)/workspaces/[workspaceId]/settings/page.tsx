"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/types/database";

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  joined_at: string;
  profile: Profile;
}

interface Props {
  params: Promise<{ workspaceId: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export default function SettingsPage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);

  const currentMember = members.find((m) => m.user_id === currentUserId);
  const isOwner = currentMember?.role === "owner";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    loadMembers();
    const sub = supabase
      .channel(`settings:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `workspace_id=eq.${workspaceId}` }, () => loadMembers(true))
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId]);

  async function loadMembers(silent = false) {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from("workspace_members")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", workspaceId)
      .order("joined_at");
    setMembers((data ?? []) as any);
    setLoading(false);
  }

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { toast.error("Enter an email address"); return; }

    setInviting(true);
    try {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", email)
        .maybeSingle();

      if (profileErr || !profile) {
        toast.error("No user found with that email address");
        return;
      }

      const alreadyMember = members.some((m) => m.user_id === profile.id);
      if (alreadyMember) {
        toast.error("This person is already a member");
        return;
      }

      const { error } = await supabase.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: profile.id,
        role: inviteRole,
      });

      if (error) {
        toast.error("Failed to add member");
        return;
      }

      toast.success(`${profile.full_name ?? email} added as ${inviteRole}`);
      setInviteEmail("");
      loadMembers();
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) toast.error("Failed to update role");
    else loadMembers(true);
  }

  async function handleRemove(member: Member) {
    const isSelf = member.user_id === currentUserId;
    const name = member.profile?.full_name ?? member.profile?.email ?? "this member";
    const msg = isSelf ? "Leave this workspace?" : `Remove ${name} from the workspace?`;
    if (!confirm(msg)) return;

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", member.id);

    if (error) { toast.error("Failed to remove member"); return; }
    if (isSelf) window.location.href = "/dashboard";
    else { toast.success("Member removed"); loadMembers(); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6 fade-in stagger-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage workspace members and access</p>
      </div>

      {/* Members section */}
      <div className="space-y-4 fade-in stagger-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Members</h2>
          <Badge variant="secondary" className="text-xs">{members.length}</Badge>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {members.map((member, i) => {
              const isSelf = member.user_id === currentUserId;
              const isLastOwner = member.role === "owner" && members.filter((m) => m.role === "owner").length === 1;
              return (
                <div key={member.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(member.profile?.full_name ?? member.profile?.email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.profile?.full_name ?? member.profile?.email}
                        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.profile?.email}</p>
                    </div>
                    {isOwner && !isLastOwner ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleChangeRole(member.id, v)}
                        disabled={isSelf && isLastOwner}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-xs capitalize shrink-0">
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(member)}
                      disabled={isLastOwner && isSelf}
                      aria-label={isSelf ? "Leave workspace" : "Remove member"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator className="my-6" />

      {/* Invite section */}
      <div className="space-y-4 fade-in stagger-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Add Member</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Add someone by their registered email address.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label className="sr-only">Email address</Label>
            <Input
              type="email"
              placeholder="colleague@university.edu"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              className="h-10"
            />
          </div>
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
            <SelectTrigger className="h-10 w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="h-10 gap-2 pressable shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            {inviting ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
