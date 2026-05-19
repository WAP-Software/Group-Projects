import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, getInitials, priorityColor } from "@/lib/utils";
import type { Workspace, Task, Document, WorkspaceMember, Profile } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  FileText, Kanban, MessageSquare, Users,
  CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const [wsResult, membersResult, tasksResult, docsResult] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
    supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(5),
    supabase.from("documents").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(4),
  ]);

  const ws = wsResult.data as Workspace | null;
  const members = (membersResult.data ?? []) as Array<WorkspaceMember & { profile: Profile }>;
  const recentTasks = (tasksResult.data ?? []) as Task[];
  const recentDocs = docsResult.data ?? [];

  const stats = {
    members: members.length,
    tasks: recentTasks.length,
    docs: recentDocs.length,
    done: recentTasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Workspace header */}
      <div className="fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: ws?.color }}
          >
            {ws?.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{ws?.name}</h1>
            {ws?.description && (
              <p className="text-sm text-muted-foreground">{ws.description}</p>
            )}
          </div>
        </div>
        {(ws?.course_name || ws?.semester) && (
          <div className="flex gap-2 mt-2 ml-13">
            {ws.course_name && <Badge variant="secondary">{ws.course_name}</Badge>}
            {ws.semester && <Badge variant="outline">{ws.semester}</Badge>}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-in stagger-2">
        {[
          { label: "Members", value: stats.members, icon: Users, color: "text-blue-500" },
          { label: "Recent Tasks", value: stats.tasks, icon: Kanban, color: "text-violet-500" },
          { label: "Documents", value: stats.docs, icon: FileText, color: "text-amber-500" },
          { label: "Completed", value: stats.done, icon: CheckCircle2, color: "text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tasks */}
        <Card className="lg:col-span-2 border-border/50 fade-in stagger-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Tasks</CardTitle>
              <Link href={`/workspaces/${workspaceId}/tasks`} className="text-xs text-primary hover:underline">
                View board →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet</p>
            ) : (
              recentTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  {task.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : task.priority === "urgent" ? (
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  <Badge variant="secondary" className={`text-xs shrink-0 ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(task.due_date)}</span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="border-border/50 fade-in stagger-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Members</CardTitle>
              <Badge variant="secondary">{members.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((m) => {
              const p = m.profile as any;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p?.avatar_url} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(p?.full_name ?? p?.email ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p?.full_name ?? p?.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent documents */}
      {recentDocs.length > 0 && (
        <Card className="border-border/50 fade-in stagger-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Documents</CardTitle>
              <Link href={`/workspaces/${workspaceId}/documents`} className="text-xs text-primary hover:underline">
                All documents →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentDocs.map((doc) => (
                <Link key={doc.id} href={`/workspaces/${workspaceId}/documents/${doc.id}`}>
                  <div className="p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all pressable">
                    <FileText className="h-5 w-5 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.updated_at)}</p>
                    <Badge variant="outline" className="text-xs mt-2 capitalize">{doc.status}</Badge>
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
