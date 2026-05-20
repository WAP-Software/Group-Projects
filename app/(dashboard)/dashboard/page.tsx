import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, FileText, Kanban, TrendingUp } from "lucide-react";
import { WorkspaceCreateDialog } from "@/components/workspaces/WorkspaceCreateDialog";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const workspaces = memberships?.map((m) => ({
    ...m.workspace as any,
    role: m.role,
  })) ?? [];

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your collaborative finance workspaces
          </p>
        </div>
        <WorkspaceCreateDialog userId={user.id} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 fade-in stagger-2">
        {[
          { label: "Workspaces", value: workspaces.length, icon: TrendingUp },
          { label: "As Owner", value: workspaces.filter((w) => w.role === "owner").length, icon: Users },
          { label: "As Editor", value: workspaces.filter((w) => w.role === "editor").length, icon: FileText },
          { label: "As Viewer", value: workspaces.filter((w) => w.role === "viewer").length, icon: Kanban },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workspace grid */}
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center fade-in stagger-3">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Create your first workspace to start collaborating with your finance cohort.
          </p>
          <WorkspaceCreateDialog userId={user.id} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 fade-in stagger-3">
          {workspaces.map((ws, i) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`}>
              <Card
                className={`border-border/50 hover:shadow-md cursor-pointer h-full pressable stagger-${Math.min(i + 1, 5)}`}
                style={{ borderLeftColor: ws.color, borderLeftWidth: 3 }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: ws.color }}
                    >
                      {ws.name[0]?.toUpperCase()}
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize shrink-0">
                      {ws.role}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-1">{ws.name}</CardTitle>
                  {ws.description && (
                    <CardDescription className="text-xs line-clamp-2">{ws.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {ws.course_name && <span>{ws.course_name}</span>}
                    {ws.semester && <span>· {ws.semester}</span>}
                    <span>· Created {formatDate(ws.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
