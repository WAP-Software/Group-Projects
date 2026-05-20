"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ClipboardCheck, Flag } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import type { Task, Review, Profile } from "@/types/database";

type Member = { user_id: string; role: string; profile: Profile };

type TimelineItem =
  | { kind: "task"; data: Task }
  | { kind: "review"; data: Review };

const TASK_STATUS_COLOR: Record<string, string> = {
  backlog: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8",
  in_review: "#f59e0b",
  changes_requested: "#ef4444",
  approved: "#22c55e",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

function toDateKey(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

interface Props {
  workspaceId: string;
}

export function GanttView({ workspaceId }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: r }, { data: m }] = await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("reviews").select("*").eq("workspace_id", workspaceId).not("due_date", "is", null),
      supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    ]);
    setTasks(t ?? []);
    setReviews((r ?? []) as Review[]);
    setMembers((m as Member[]) ?? []);
    setLoading(false);
  }, [workspaceId, supabase]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel(`timeline:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId, load, supabase]);

  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const todayKey = toDateKey(new Date());

  const { dayGroups, unscheduled } = useMemo(() => {
    // Merge tasks + reviews into unified items
    const withDates: TimelineItem[] = [
      ...tasks.filter((t) => t.due_date).map((t): TimelineItem => ({ kind: "task", data: t })),
      ...reviews.map((r): TimelineItem => ({ kind: "review", data: r })),
    ];
    const without = tasks.filter((t) => !t.due_date);

    const map = new Map<string, TimelineItem[]>();
    for (const item of withDates) {
      const key = toDateKey(item.kind === "task" ? item.data.due_date! : item.data.due_date!);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    const allKeys = new Set(map.keys());
    const sortedKeys = [...allKeys].sort();

    if (
      !allKeys.has(todayKey) &&
      sortedKeys.length > 0 &&
      todayKey > sortedKeys[0] &&
      todayKey < sortedKeys[sortedKeys.length - 1]
    ) {
      allKeys.add(todayKey);
    }

    const groups = [...allKeys].sort().map((key) => ({
      key,
      items: map.get(key) ?? [],
      isToday: key === todayKey,
      isPast: key < todayKey,
    }));

    return { dayGroups: groups, unscheduled: without };
  }, [tasks, reviews, todayKey]);

  async function handleUpdate(id: string, data: Partial<Task>) {
    await supabase.from("tasks").update(data).eq("id", id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  }

  async function handleDelete(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0 && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No entries yet</h3>
        <p className="text-sm text-muted-foreground">Create tasks or reviews to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {Object.entries(TASK_STATUS_COLOR).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
            <span>{TASK_STATUS_LABEL[s]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          <span>Peer Review</span>
        </div>
      </div>

      {/* ── Vertical timeline ── */}
      {dayGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No scheduled entries.
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-12 sm:left-[5.5rem] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {dayGroups.map((group) => {
              const d = new Date(group.key + "T12:00:00");
              const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
              const dayNum = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
              const yearStr = d.getFullYear().toString();

              const hasOverdue = group.isPast && group.items.some(
                (item) => item.kind === "task"
                  ? item.data.status !== "done"
                  : item.data.status !== "approved",
              );

              return (
                <div key={group.key} ref={group.isToday ? todayRef : undefined} className="relative flex">
                  {/* Date label */}
                  <div className={cn(
                    "w-12 sm:w-[5.5rem] shrink-0 flex flex-col items-end pr-2 sm:pr-4 pt-3 pb-6",
                    group.isToday && "text-primary",
                    hasOverdue && !group.isToday && "text-red-500",
                    !group.isToday && !hasOverdue && "text-muted-foreground",
                  )}>
                    <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">{weekday}</span>
                    <span className={cn("text-[10px] sm:text-xs font-medium", group.isToday && "font-bold")}>{dayNum}</span>
                    {group.items.length > 0 && <span className="text-[9px] sm:text-[10px] mt-0.5">{yearStr}</span>}
                  </div>

                  {/* Dot */}
                  <div className="absolute left-12 sm:left-[5.5rem] -translate-x-1/2 pt-3.5 z-10">
                    <div className={cn(
                      "rounded-full border-2 border-background transition-all",
                      group.isToday ? "h-4 w-4 bg-primary shadow-[0_0_0_3px_rgb(59_130_246_/_0.2)]" : "h-3 w-3",
                      !group.isToday && hasOverdue && "bg-red-500",
                      !group.isToday && !hasOverdue && group.items.length === 0 && "bg-border",
                      !group.isToday && !hasOverdue && group.items.length > 0 && "bg-foreground/40",
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pl-4 sm:pl-6 pt-2 pb-6">
                    {group.isToday && (
                      <div className="mb-2">
                        <Badge className="text-xs bg-primary text-primary-foreground">Today</Badge>
                      </div>
                    )}
                    {group.items.length === 0 && (
                      <p className="text-xs text-muted-foreground italic pt-1">No tasks</p>
                    )}
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        if (item.kind === "task") {
                          const task = item.data;
                          const isOverdue = group.isPast && task.status !== "done";
                          const member = task.assigned_to ? memberMap.get(task.assigned_to) : null;
                          const color = TASK_STATUS_COLOR[task.status];

                          return (
                            <div
                              key={`task-${task.id}`}
                              onClick={() => setSelectedTaskId(task.id)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer",
                                "hover:shadow-sm transition-all duration-150 bg-card hover:bg-accent/30",
                                isOverdue ? "border-red-500/40 bg-red-500/5" : "border-border/50",
                              )}
                            >
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-sm font-medium truncate", isOverdue && "text-red-400")}>
                                    {task.title}
                                  </span>
                                  {task.milestone && <Flag className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[11px] font-medium" style={{ color }}>
                                    {TASK_STATUS_LABEL[task.status]}
                                  </span>
                                  {task.start_date && (
                                    <span className="text-[11px] text-muted-foreground">
                                      from {new Date(task.start_date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                                    </span>
                                  )}
                                  {isOverdue && <span className="text-[11px] font-semibold text-red-500">Overdue</span>}
                                </div>
                              </div>
                              <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0 font-medium", PRIORITY_COLOR[task.priority])}>
                                {task.priority}
                              </Badge>
                              {member && (
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={member.profile.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[9px]">{getInitials(member.profile.full_name ?? "")}</AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          );
                        }

                        // Review item
                        const review = item.data;
                        const isOverdue = group.isPast && review.status !== "approved";
                        const color = REVIEW_STATUS_COLOR[review.status];

                        return (
                          <div
                            key={`review-${review.id}`}
                            onClick={() => router.push(`/workspaces/${workspaceId}/reviews`)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer",
                              "hover:shadow-sm transition-all duration-150 bg-card hover:bg-accent/30",
                              isOverdue ? "border-red-500/40 bg-red-500/5" : "border-orange-500/30",
                            )}
                          >
                            <div className="w-1 self-stretch rounded-full shrink-0 bg-orange-500" />
                            <ClipboardCheck className="h-4 w-4 text-orange-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className={cn("text-sm font-medium truncate block", isOverdue && "text-red-400")}>
                                {review.title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-medium" style={{ color }}>
                                  {REVIEW_STATUS_LABEL[review.status]}
                                </span>
                                {isOverdue && <span className="text-[11px] font-semibold text-red-500">Overdue</span>}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-orange-500/50 text-orange-600 dark:text-orange-400">
                              Review
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Unscheduled tasks ── */}
      {unscheduled.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
          <div className="px-4 py-2.5 border-b border-border/30 bg-muted/30 flex items-center gap-2">
            <span className="text-xs font-semibold">No date</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{unscheduled.length}</Badge>
          </div>
          <div className="divide-y divide-border/20">
            {unscheduled.map((task) => {
              const member = task.assigned_to ? memberMap.get(task.assigned_to) : null;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TASK_STATUS_COLOR[task.status] }} />
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  {member && (
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={member.profile.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px]">{getInitials(member.profile.full_name ?? "")}</AvatarFallback>
                    </Avatar>
                  )}
                  <Badge variant="secondary" className="text-xs shrink-0">{TASK_STATUS_LABEL[task.status]}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TaskDetailPanel
        taskId={selectedTaskId}
        workspaceId={workspaceId}
        members={members}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
