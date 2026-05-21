import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getInitials, mimeLabel } from "@/lib/utils";
import type { Workspace, Task, FileRecord, WorkspaceMember, Profile } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Clock, CheckCircle2, Users, File, FileText,
  Table2, Presentation, Link2, ImageIcon, ClipboardCheck,
  Kanban, FolderOpen, ChevronRight,
} from "lucide-react";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

function deadlineDays(date: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d überfällig`;
  if (days === 0) return "Heute";
  return `${days}d`;
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return <Table2 className="h-4 w-4 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return <Presentation className="h-4 w-4 text-orange-500" />;
  if (mime === "text/uri-list") return <Link2 className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const [wsResult, membersResult, tasksResult, filesResult, reviewsResult] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
    supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("files").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("reviews").select("*, file:files(name, mime_type)").eq("workspace_id", workspaceId).in("status", ["pending", "in_review", "changes_requested"]).order("created_at", { ascending: false }),
  ]);

  const ws = wsResult.data as Workspace | null;
  const members = (membersResult.data ?? []) as Array<WorkspaceMember & { profile: Profile }>;
  const allTasks = (tasksResult.data ?? []) as Task[];
  const allFiles = (filesResult.data ?? []) as FileRecord[];
  const openReviews = (reviewsResult.data ?? []) as Array<{ id: string; title: string; status: string; created_at: string; file: { name: string; mime_type: string | null } | null }>;

  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const openTasks = allTasks.filter((t) => t.status !== "done").length;
  const progressPct = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;

  // Deadline items: files with deadline_date + tasks with due_date (not done)
  type DeadlineItem =
    | { kind: "file"; id: string; name: string; mime: string | null; days: number; href: string }
    | { kind: "task"; id: string; name: string; days: number; status: string; href: string };

  const deadlineItems: DeadlineItem[] = [
    ...allFiles
      .filter((f) => f.deadline_date)
      .map((f) => ({
        kind: "file" as const,
        id: f.id,
        name: f.name,
        mime: f.mime_type,
        days: deadlineDays(f.deadline_date!),
        href: `/workspaces/${workspaceId}/workspace`,
      })),
    ...allTasks
      .filter((t) => t.due_date && t.status !== "done")
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        name: t.title,
        days: deadlineDays(t.due_date!),
        status: t.status,
        href: `/workspaces/${workspaceId}/workspace`,
      })),
  ].sort((a, b) => a.days - b.days);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: ws?.color }}
          >
            {ws?.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{ws?.name}</h1>
            {ws?.description && <p className="text-sm text-muted-foreground">{ws.description}</p>}
          </div>
        </div>
        {(ws?.course_name || ws?.semester) && (
          <div className="flex gap-2 mt-2 ml-[52px]">
            {ws.course_name && <Badge variant="secondary">{ws.course_name}</Badge>}
            {ws.semester && <Badge variant="outline">{ws.semester}</Badge>}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 fade-in stagger-2">
        {[
          { label: "Mitglieder", value: members.length, icon: Users },
          { label: "Offene Tasks", value: openTasks, icon: Kanban },
          { label: "Dateien", value: allFiles.length, icon: FolderOpen },
          { label: "Erledigt", value: doneTasks, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {allTasks.length > 0 && (
        <div className="space-y-1.5 fade-in stagger-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Fortschritt</span>
            <span className="text-muted-foreground tabular-nums">{doneTasks}/{allTasks.length} Tasks</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      )}

      {/* ── Deadlines (Ampel) ── */}
      <div className="fade-in stagger-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Deadlines
          </h2>
          <Link href={`/workspaces/${workspaceId}/workspace`} className="text-xs text-primary hover:underline flex items-center gap-1">
            Workspace <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {deadlineItems.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Keine Deadlines</p>
            <p className="text-xs text-muted-foreground mt-1">Alle Dateien und Tasks sind ohne Frist.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deadlineItems.map((item) => (
              <DeadlineRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* ── Open Reviews ── */}
      {openReviews.length > 0 && (
        <div className="fade-in stagger-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              Offene Reviews
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold">{openReviews.length}</span>
            </h2>
            <Link href={`/workspaces/${workspaceId}/reviews`} className="text-xs text-primary hover:underline flex items-center gap-1">
              Alle <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {openReviews.slice(0, 5).map((r) => (
              <Link key={r.id} href={`/workspaces/${workspaceId}/reviews`}>
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5 hover:bg-muted/30 hover:border-primary/30 transition-all pressable">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.file && <p className="text-xs text-muted-foreground truncate">{r.file.name}</p>}
                  </div>
                  <ReviewStatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Members ── */}
      <div className="fade-in stagger-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          Team
        </h2>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => {
            const p = m.profile as any;
            const tasksDone = allTasks.filter((t) => t.assigned_to === m.user_id && t.status === "done").length;
            const tasksTotal = allTasks.filter((t) => t.assigned_to === m.user_id).length;
            return (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card px-3 py-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                    {getInitials(p?.full_name ?? p?.email ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{p?.full_name ?? p?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {m.role}{tasksTotal > 0 ? ` · ${tasksDone}/${tasksTotal}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeadlineRow({
  item,
}: {
  item: { kind: "file" | "task"; id: string; name: string; mime?: string | null; days: number; href: string };
}) {
  return (
    <Link href={item.href}>
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5 hover:bg-muted/30 transition-all pressable">
        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {item.kind === "file" ? (
            <FileIconInline mime={item.mime ?? null} />
          ) : (
            <Kanban className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.kind === "file" ? "Datei" : "Task"}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {deadlineLabel(item.days)}
        </span>
      </div>
    </Link>
  );
}

function FileIconInline({ mime }: { mime: string | null }) {
  if (!mime) return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-3.5 w-3.5 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return <Table2 className="h-3.5 w-3.5 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return <Presentation className="h-3.5 w-3.5 text-orange-500" />;
  if (mime === "text/uri-list") return <Link2 className="h-3.5 w-3.5 text-blue-500" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground" />;
}

const REVIEW_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ausstehend", cls: "bg-muted text-muted-foreground" },
  in_review: { label: "In Review", cls: "bg-muted text-foreground" },
  changes_requested: { label: "Änderungen nötig", cls: "bg-muted text-foreground font-semibold" },
};

function ReviewStatusBadge({ status }: { status: string }) {
  const s = REVIEW_STATUS[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", s.cls)}>{s.label}</span>;
}
