"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronDown, ChevronRight, Flag } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { Task, Profile } from "@/types/database";

type Member = { user_id: string; role: string; profile: Profile };
type Zoom = "day" | "week" | "month";

const PX: Record<Zoom, number> = { day: 40, week: 20, month: 8 };
const LEFT_COL = 220;
const ROW_H = 44;

const STATUS_COLOR: Record<string, string> = {
  backlog: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
};

const STATUS_GROUPS: { key: string; label: string }[] = [
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "backlog", label: "Backlog" },
  { key: "done", label: "Done" },
];

interface Props {
  workspaceId: string;
}

export function GanttView({ workspaceId }: Props) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["done"]));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("start_date", { ascending: true, nullsFirst: false }),
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

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const tasksWithDates = useMemo(() => tasks.filter((t) => t.due_date), [tasks]);
  const unscheduled = useMemo(() => tasks.filter((t) => !t.due_date), [tasks]);

  const { computedStart, computedEnd } = useMemo(() => {
    if (!tasksWithDates.length) {
      const now = new Date();
      return {
        computedStart: new Date(now.getFullYear(), now.getMonth(), 1),
        computedEnd: new Date(now.getFullYear(), now.getMonth() + 2, 0),
      };
    }
    const allTs = tasksWithDates.flatMap((t) => [
      new Date(t.due_date!).getTime(),
      ...(t.start_date ? [new Date(t.start_date).getTime()] : []),
    ]);
    const min = new Date(Math.min(...allTs));
    const max = new Date(Math.max(...allTs));
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);
    return { computedStart: min, computedEnd: max };
  }, [tasksWithDates]);

  const startDate = useMemo(
    () => (rangeStart ? new Date(rangeStart + "T00:00:00") : computedStart),
    [rangeStart, computedStart],
  );
  const endDate = useMemo(
    () => (rangeEnd ? new Date(rangeEnd + "T23:59:59") : computedEnd),
    [rangeEnd, computedEnd],
  );
  const totalDays = useMemo(
    () => Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)),
    [startDate, endDate],
  );
  const pxPerDay = PX[zoom];
  const chartWidth = totalDays * pxPerDay;

  const dayOffset = useCallback(
    (d: string | Date) => {
      const ts = typeof d === "string" ? new Date(d).getTime() : d.getTime();
      return Math.floor((ts - startDate.getTime()) / 86400000);
    },
    [startDate],
  );

  const today = useMemo(() => new Date(), []);
  const todayPx = dayOffset(today) * pxPerDay;
  const todayVisible = todayPx >= 0 && todayPx <= chartWidth;

  // Month spans for top header row
  const monthSpans = useMemo(() => {
    const spans: { label: string; left: number; width: number }[] = [];
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (d <= endDate) {
      const spanStart = Math.max(0, dayOffset(d) * pxPerDay);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const spanEnd = Math.min(chartWidth, dayOffset(next) * pxPerDay);
      if (spanEnd > spanStart) {
        spans.push({
          label: d.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
          left: spanStart,
          width: spanEnd - spanStart,
        });
      }
      d.setMonth(d.getMonth() + 1);
    }
    return spans;
  }, [startDate, endDate, dayOffset, pxPerDay, chartWidth]);

  // Tick marks for bottom header row
  const headerTicks = useMemo(() => {
    const ticks: { label: string; px: number }[] = [];
    const d = new Date(startDate);

    if (zoom === "day") {
      while (d <= endDate) {
        const px = dayOffset(d) * pxPerDay;
        ticks.push({ label: d.getDate().toString(), px });
        d.setDate(d.getDate() + 1);
      }
    } else if (zoom === "week") {
      const dow = d.getDay();
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      while (d <= endDate) {
        const offset = dayOffset(d);
        if (offset >= 0) {
          ticks.push({
            label: d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" }),
            px: offset * pxPerDay,
          });
        }
        d.setDate(d.getDate() + 7);
      }
    } else {
      d.setDate(1);
      while (d <= endDate) {
        ticks.push({
          label: d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
          px: Math.max(0, dayOffset(d) * pxPerDay),
        });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return ticks;
  }, [startDate, endDate, zoom, pxPerDay, dayOffset]);

  const groups = useMemo(
    () => STATUS_GROUPS.map((g) => ({ ...g, tasks: tasksWithDates.filter((t) => t.status === g.key) })),
    [tasksWithDates],
  );

  async function handleUpdate(id: string, data: Partial<Task>) {
    await supabase.from("tasks").update(data).eq("id", id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  }

  async function handleDelete(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId(null);
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function renderBar(task: Task) {
    if (!task.due_date) return null;
    const isOverdue = new Date(task.due_date) < today && task.status !== "done";
    const color = STATUS_COLOR[task.status];
    const dueOff = dayOffset(task.due_date);
    const member = task.assigned_to ? memberMap.get(task.assigned_to) : null;

    let barLeft: number;
    let barWidth: number;
    let isPoint = false;

    if (task.start_date) {
      const startOff = dayOffset(task.start_date);
      barLeft = startOff * pxPerDay;
      barWidth = Math.max(pxPerDay, (dueOff - startOff + 1) * pxPerDay);
    } else {
      barLeft = dueOff * pxPerDay - 8;
      barWidth = 16;
      isPoint = true;
    }

    // not in visible range
    if (barLeft + barWidth < 0 || barLeft > chartWidth) return null;

    if (isPoint) {
      return (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: barLeft + 8, transform: "translate(-50%, -50%) rotate(45deg)" }}
        >
          <div
            className={`h-4 w-4 border-2 shadow-sm ${isOverdue ? "border-red-500" : "border-background"}`}
            style={{ backgroundColor: color }}
            title={`Due: ${new Date(task.due_date).toLocaleDateString("de-DE")}`}
          />
        </div>
      );
    }

    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center rounded-md overflow-hidden shadow-sm"
        style={{
          left: barLeft,
          width: barWidth,
          height: 24,
          backgroundColor: color,
          opacity: task.status === "done" ? 0.55 : 1,
          outline: isOverdue ? "2px solid rgb(239 68 68 / 0.7)" : undefined,
          outlineOffset: isOverdue ? "1px" : undefined,
        }}
        title={`${task.title}${task.start_date ? ` | Start: ${new Date(task.start_date).toLocaleDateString("de-DE")}` : ""} | Due: ${new Date(task.due_date).toLocaleDateString("de-DE")}`}
      >
        {member && (
          <Avatar className="h-4 w-4 border border-background/60 ml-auto mr-1 shrink-0">
            <AvatarImage src={member.profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-[7px] bg-white/20 text-white">
              {getInitials(member.profile.full_name ?? "")}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }

  function renderTaskRow(task: Task) {
    const isOverdue = !!task.due_date && new Date(task.due_date) < today && task.status !== "done";
    const color = STATUS_COLOR[task.status];

    return (
      <div
        key={task.id}
        className={`flex border-b border-border/20 hover:bg-muted/25 transition-colors cursor-pointer ${isOverdue ? "bg-red-500/5" : ""}`}
        style={{ height: ROW_H }}
        onClick={() => setSelectedTaskId(task.id)}
      >
        {/* Left label column */}
        <div
          className="shrink-0 flex items-center gap-2 border-r border-border/30 px-3"
          style={{ width: LEFT_COL }}
        >
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className={`text-xs font-medium truncate flex-1 ${isOverdue ? "text-red-400" : ""}`}>
            {task.title}
          </span>
          {task.milestone && <Flag className="h-3 w-3 text-amber-500 shrink-0" />}
          {isOverdue && (
            <span className="text-[10px] font-bold text-red-500 shrink-0">!</span>
          )}
        </div>

        {/* Bar area */}
        <div className="flex-1 relative overflow-hidden" style={{ minWidth: chartWidth }}>
          {/* Vertical grid lines */}
          {headerTicks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-border/15 pointer-events-none"
              style={{ left: tick.px }}
            />
          ))}

          {/* Today line */}
          {todayVisible && (
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500/50 pointer-events-none"
              style={{ left: todayPx }}
            />
          )}

          {/* Bar */}
          {renderBar(task)}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
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
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Zoom toggle */}
        <div className="flex items-center gap-px rounded-lg border border-border p-1 bg-muted/30">
          {(["day", "week", "month"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                zoom === z
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {z === "day" ? "Tag" : z === "week" ? "Woche" : "Monat"}
            </button>
          ))}
        </div>

        {/* Date range */}
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

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground ml-auto">
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
              <span className="capitalize">{s.replace("_", " ")}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-red-500/20 ring-1 ring-red-500/60" />
            <span>Überfällig</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-px bg-red-500" />
            <span>Heute</span>
          </div>
        </div>
      </div>

      {/* ── Gantt chart ── */}
      {tasksWithDates.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <div style={{ minWidth: LEFT_COL + chartWidth }}>

              {/* Month header row */}
              <div className="flex border-b border-border bg-muted/50 sticky top-0 z-10">
                <div
                  className="shrink-0 border-r border-border px-3 flex items-center"
                  style={{ width: LEFT_COL, height: 28 }}
                >
                  <span className="text-xs font-medium text-muted-foreground">Task</span>
                </div>
                <div className="relative" style={{ width: chartWidth, height: 28 }}>
                  {monthSpans.map((span, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex items-center border-l border-border/40 px-2 overflow-hidden"
                      style={{ left: span.left, width: span.width }}
                    >
                      <span className="text-xs font-semibold text-foreground/70 whitespace-nowrap">
                        {span.label}
                      </span>
                    </div>
                  ))}
                  {todayVisible && (
                    <div
                      className="absolute top-0 flex items-center gap-1 pointer-events-none"
                      style={{ left: todayPx + 4, height: 28 }}
                    >
                      <span className="text-[10px] font-bold text-red-500 whitespace-nowrap">
                        Heute
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tick header row */}
              <div className="flex border-b border-border bg-muted/30">
                <div className="shrink-0 border-r border-border" style={{ width: LEFT_COL, height: 24 }} />
                <div className="relative" style={{ width: chartWidth, height: 24 }}>
                  {todayVisible && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                      style={{ left: todayPx }}
                    />
                  )}
                  {headerTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex items-center border-l border-border/30 pl-1"
                      style={{ left: tick.px }}
                    >
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {tick.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status groups */}
              {groups.map((group) => {
                if (!group.tasks.length) return null;
                const isCollapsed = collapsed.has(group.key);
                const color = STATUS_COLOR[group.key];

                return (
                  <div key={group.key}>
                    {/* Group header row */}
                    <div
                      className="flex items-center border-b border-border/40 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors select-none"
                      style={{ height: 32 }}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div
                        className="shrink-0 flex items-center gap-2 px-3 border-r border-border/30"
                        style={{ width: LEFT_COL }}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-semibold">{group.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto mr-1">
                          {group.tasks.length}
                        </Badge>
                      </div>
                      <div className="relative" style={{ width: chartWidth, height: 32 }}>
                        {todayVisible && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-500/30 pointer-events-none"
                            style={{ left: todayPx }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Task rows */}
                    {!isCollapsed && group.tasks.map((task) => renderTaskRow(task))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Unscheduled tasks ── */}
      {unscheduled.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
          <div
            className="flex items-center gap-2 px-4 border-b border-border/30 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors select-none"
            style={{ height: 36 }}
            onClick={() => toggleGroup("__unscheduled")}
          >
            {collapsed.has("__unscheduled") ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-semibold">Kein Datum</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {unscheduled.length}
            </Badge>
          </div>
          {!collapsed.has("__unscheduled") && (
            <div className="divide-y divide-border/20">
              {unscheduled.map((task) => {
                const member = task.assigned_to ? memberMap.get(task.assigned_to) : null;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
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
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
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
