import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getInitials, priorityColor, formatBytes, mimeLabel } from "@/lib/utils";
import type { Workspace, Task, FileRecord, WorkspaceMember, Profile } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Kanban, Users, CheckCircle2, Clock, AlertCircle,
  Calendar, FolderOpen, Zap, File,
} from "lucide-react";


interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const [wsResult, membersResult, allTasksResult, filesResult, filesCountResult] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
    supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("files").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(6),
    supabase.from("files").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  const ws = wsResult.data as Workspace | null;
  const members = (membersResult.data ?? []) as Array<WorkspaceMember & { profile: Profile }>;
  const allTasks = (allTasksResult.data ?? []) as Task[];
  const recentFiles = (filesResult.data ?? []) as FileRecord[];
  const totalFiles = filesCountResult.count ?? 0;

  const today = new Date();
  const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const upcomingDeadlines = allTasks
    .filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) <= in14Days)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  const recentTasks = allTasks.slice(0, 5);
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const totalTasks = allTasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Activity feed: merge recent tasks + files
  const activityItems: Array<{ type: "task" | "file"; title: string; sub: string; time: string; href: string }> = [
    ...allTasks.slice(0, 6).map((t) => ({
      type: "task" as const,
      title: t.title,
      sub: t.status === "done" ? "Completed" : `Status: ${t.status.replace("_", " ")}`,
      time: t.updated_at,
      href: `/workspaces/${workspaceId}/tasks`,
    })),
    ...recentFiles.map((f) => ({
      type: "file" as const,
      title: f.name,
      sub: `File · ${mimeLabel(f.mime_type)}`,
      time: f.created_at,
      href: `/workspaces/${workspaceId}/files`,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Workspace header */}
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

      {/* Progress + Stats */}
      <div className="space-y-3 fade-in stagger-2">
        {totalTasks > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground tabular-nums">{doneTasks}/{totalTasks} tasks done</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Members", value: members.length, icon: Users, color: "text-blue-500" },
            { label: "Open Tasks", value: allTasks.filter((t) => t.status !== "done").length, icon: Kanban, color: "text-violet-500" },
            { label: "Files", value: totalFiles, icon: FolderOpen, color: "text-amber-500" },
            { label: "Completed", value: doneTasks, icon: CheckCircle2, color: "text-green-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color} shrink-0`} />
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Deadlines */}
        <Card className="border-border/50 fade-in stagger-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                Upcoming Deadlines
              </CardTitle>
              <Link href={`/workspaces/${workspaceId}/tasks`} className="text-xs text-primary hover:underline">
                Board →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No upcoming deadlines</p>
            ) : (
              upcomingDeadlines.map((task) => {
                const daysLeft = Math.ceil((new Date(task.due_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const urgent = daysLeft <= 2;
                return (
                  <Link key={task.id} href={`/workspaces/${workspaceId}/tasks`}>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      {urgent
                        ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm flex-1 truncate">{task.title}</span>
                      <Badge variant={urgent ? "destructive" : "secondary"} className="text-xs shrink-0">
                        {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                      </Badge>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="border-border/50 fade-in stagger-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activityItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">No activity yet</p>
            ) : (
              activityItems.map((item, i) => (
                <Link key={i} href={item.href}>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${item.type === "task" ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                      {item.type === "task" ? <Kanban className="h-3 w-3" /> : <File className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.sub} · {formatDate(item.time)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="border-border/50 fade-in stagger-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Members
              </CardTitle>
              <Badge variant="secondary">{members.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((m) => {
              const p = m.profile as any;
              const tasksDone = allTasks.filter((t) => t.assigned_to === m.user_id && t.status === "done").length;
              const tasksTotal = allTasks.filter((t) => t.assigned_to === m.user_id).length;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(p?.full_name ?? p?.email ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{p?.full_name ?? p?.email}</p>
                      <Badge variant="outline" className="text-xs capitalize shrink-0">{m.role}</Badge>
                    </div>
                    {tasksTotal > 0 && (
                      <p className="text-xs text-muted-foreground">{tasksDone}/{tasksTotal} tasks done</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <Card className="border-border/50 fade-in stagger-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-amber-500" />
                Recent Files
              </CardTitle>
              <Link href={`/workspaces/${workspaceId}/files`} className="text-xs text-primary hover:underline">
                All files →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentFiles.map((f) => (
                <Link key={f.id} href={`/workspaces/${workspaceId}/files`}>
                  <div className="p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all pressable flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <File className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.size_bytes ? formatBytes(f.size_bytes) : ""} · {formatDate(f.created_at)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
