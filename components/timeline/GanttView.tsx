"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Flag } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import type { Task, Profile } from "@/types/database";

type Member = { user_id: string; role: string; profile: Profile };

const STATUS_COLOR: Record<string, string> = {
  backlog: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
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

function formatDayHeader(dateKey: string): { weekday: string; date: string } {
  const d = new Date(dateKey + "T12:00:00");
  return {
    weekday: d.toLocaleDateString("de-DE", { weekday: "short" }),
    date: d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" }),
  };
}

interface Props {
  workspaceId: string;
}

export function GanttView({ workspaceId }: Props) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    ]);
    setTasks(t ?? []);
    setMembers((m as Member[]) ?? []);
    setLoading(false);
  }, [workspaceId, supabase]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel(`timeline:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId, load, supabase]);

  // Scroll to today on first load
  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const todayKey = toDateKey(new Date());

  // Group tasks by due_date day
  const { dayGroups, unscheduled } = useMemo(() => {
    const withDates = tasks.filter((t) => t.due_date);
    const without = tasks.filter((t) => !t.due_date);

    const filtered = withDates.filter((t) => {
      const key = toDateKey(t.due_date!);
      if (rangeStart && key < rangeStart) return false;
      if (rangeEnd && key > rangeEnd) return false;
      return true;
    });

    const map = new Map<string, Task[]>();
    for (const task of filtered) {
      const key = toDateKey(task.due_date!);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }

    const sortedKeys = [...map.keys()].sort();

    // Insert today marker if today falls between dates but has no tasks
    const allKeys = new Set(sortedKeys);
    if (
      !allKeys.has(todayKey) &&
      sortedKeys.length > 0 &&
      todayKey > sortedKeys[0] &&
      todayKey < sortedKeys[sortedKeys.length - 1]
    ) {
      allKeys.add(todayKey);
    }

    const finalKeys = [...allKeys].sort();
    const groups = finalKeys.map((key) => ({
      key,
      tasks: map.get(key) ?? [],
      isToday: key === todayKey,
      isPast: key < todayKey,
    }));

    return { dayGroups: groups, unscheduled: without };
  }, [tasks, rangeStart, rangeEnd, todayKey]);

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

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Noch keine Tasks</h3>
        <p className="text-sm text-muted-foreground">
          Erstelle Tasks im Kanban-Board um sie hier zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          {(rangeStart || rangeEnd) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setRangeStart(""); setRangeEnd(""); }}
            >
              Zurücksetzen
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground ml-auto">
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
              <span className="capitalize">{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Vertical timeline ── */}
      {dayGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Keine Tasks im gewählten Zeitraum.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {dayGroups.map((group) => {
              const { weekday, date } = formatDayHeader(group.key);
              const hasOverdue = group.tasks.some(
                (t) => group.isPast && t.status !== "done"
              );

              return (
                <div
                  key={group.key}
                  ref={group.isToday ? todayRef : undefined}
                  className="relative flex gap-0 group/day"
                >
                  {/* Date label */}
                  <div
                    className={cn(
                      "w-[5.5rem] shrink-0 flex flex-col items-end pr-4 pt-3 pb-6",
                      group.isToday && "text-primary",
                      hasOverdue && !group.isToday && "text-red-500",
                      !group.isToday && !hasOverdue && "text-muted-foreground",
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      {weekday}
                    </span>
                    <span className={cn(
                      "text-xs font-medium",
                      group.isToday && "text-primary font-bold",
                    )}>
                      {new Date(group.key + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                    </span>
                    {group.tasks.length > 0 && (
                      <span className="text-[10px] mt-0.5">
                        {new Date(group.key + "T12:00:00").getFullYear()}
                      </span>
                    )}
                  </div>

                  {/* Dot on the line */}
                  <div className="absolute left-[5.5rem] -translate-x-1/2 pt-3.5 z-10">
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full border-2 border-background transition-all",
                        group.isToday && "h-4 w-4 bg-primary shadow-[0_0_0_3px_rgb(59_130_246_/_0.2)]",
                        !group.isToday && hasOverdue && "bg-red-500",
                        !group.isToday && !hasOverdue && group.tasks.length === 0 && "bg-border",
                        !group.isToday && !hasOverdue && group.tasks.length > 0 && "bg-foreground/40",
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pl-6 pt-2 pb-6">
                    {/* Today badge */}
                    {group.isToday && (
                      <div className="mb-2">
                        <Badge className="text-xs bg-primary text-primary-foreground">
                          Heute
                        </Badge>
                      </div>
                    )}

                    {/* Empty today placeholder */}
                    {group.tasks.length === 0 && (
                      <p className="text-xs text-muted-foreground italic pt-1">
                        Keine Aufgaben
                      </p>
                    )}

                    {/* Task cards */}
                    <div className="space-y-2">
                      {group.tasks.map((task) => {
                        const isOverdue = group.isPast && task.status !== "done";
                        const member = task.assigned_to ? memberMap.get(task.assigned_to) : null;
                        const color = STATUS_COLOR[task.status];

                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer",
                              "hover:shadow-sm transition-all duration-150",
                              "bg-card hover:bg-accent/30",
                              isOverdue
                                ? "border-red-500/40 bg-red-500/5"
                                : "border-border/50",
                            )}
                          >
                            {/* Status bar */}
                            <div
                              className="w-1 self-stretch rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />

                            {/* Title + meta */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "text-sm font-medium truncate",
                                  isOverdue && "text-red-400",
                                )}>
                                  {task.title}
                                </span>
                                {task.milestone && (
                                  <Flag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span
                                  className="text-[11px] font-medium"
                                  style={{ color }}
                                >
                                  {STATUS_LABEL[task.status]}
                                </span>
                                {task.start_date && (
                                  <span className="text-[11px] text-muted-foreground">
                                    ab {new Date(task.start_date).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                                  </span>
                                )}
                                {isOverdue && (
                                  <span className="text-[11px] font-semibold text-red-500">
                                    Überfällig
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Priority */}
                            <Badge
                              className={cn("text-[10px] px-1.5 py-0 shrink-0 font-medium", PRIORITY_COLOR[task.priority])}
                            >
                              {task.priority}
                            </Badge>

                            {/* Assignee */}
                            {member && (
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={member.profile.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[9px]">
                                  {getInitials(member.profile.full_name ?? "")}
                                </AvatarFallback>
                              </Avatar>
                            )}
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

      {/* ── Unscheduled ── */}
      {unscheduled.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
          <div className="px-4 py-2.5 border-b border-border/30 bg-muted/30 flex items-center gap-2">
            <span className="text-xs font-semibold">Kein Datum</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {unscheduled.length}
            </Badge>
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
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLOR[task.status] }}
                  />
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  {member && (
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={member.profile.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(member.profile.full_name ?? "")}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <Badge variant="secondary" className="text-xs capitalize shrink-0">
                    {STATUS_LABEL[task.status]}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Task detail panel ── */}
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
