"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import type { Task, Profile } from "@/types/database";

interface CalEvent {
  id: string;
  title: string;
  date: string;
  type: "task" | "review" | "poll";
  priority?: string;
}

type Member = { user_id: string; role: string; profile: Profile };

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_STYLE: Record<string, string> = {
  task: "bg-blue-500",
  review: "bg-amber-500",
  poll: "bg-violet-500",
};

const TYPE_LABEL: Record<string, string> = {
  task: "Task",
  review: "Review",
  poll: "Umfrage",
};

interface Props {
  workspaceId: string;
}

export function CalendarView({ workspaceId }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [tasksRes, reviewsRes, pollsRes, membersRes] = await Promise.all([
        supabase.from("tasks").select("id, title, due_date, priority").eq("workspace_id", workspaceId).not("due_date", "is", null),
        supabase.from("reviews").select("id, title, due_date").eq("workspace_id", workspaceId).not("due_date", "is", null),
        supabase.from("polls").select("id, question, expires_at").eq("workspace_id", workspaceId).not("expires_at", "is", null),
        supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
      ]);

      const all: CalEvent[] = [
        ...(tasksRes.data ?? []).map((t) => ({ id: t.id, title: t.title, date: t.due_date!, type: "task" as const, priority: t.priority })),
        ...(reviewsRes.data ?? []).map((r) => ({ id: r.id, title: r.title, date: r.due_date!, type: "review" as const })),
        ...(pollsRes.data ?? []).map((p) => ({ id: p.id, title: p.question, date: p.expires_at!, type: "poll" as const })),
      ];
      setEvents(all.sort((a, b) => a.date.localeCompare(b.date)));
      setMembers((membersRes.data ?? []) as Member[]);
      setLoading(false);
    }
    load();
    const sub = supabase
      .channel(`calview:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `workspace_id=eq.${workspaceId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls", filter: `workspace_id=eq.${workspaceId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId, supabase]);

  async function exportIcs() {
    const res = await fetch(`/api/calendar/export?workspaceId=${workspaceId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-collab-calendar.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpdateTask(id: string, data: Partial<Task>) {
    const { error } = await supabase.from("tasks").update(data as any).eq("id", id);
    return error;
  }

  async function handleDeleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setEvents((evts) => evts.filter((e) => !(e.id === id && e.type === "task")));
    setSelectedTaskId(null);
  }

  function handleEventClick(ev: CalEvent) {
    if (ev.type === "task") setSelectedTaskId(ev.id);
    else if (ev.type === "review") router.push(`/workspaces/${workspaceId}/reviews`);
    else if (ev.type === "poll") router.push(`/workspaces/${workspaceId}/polls`);
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // Monday-first grid
  const firstDow = new Date(year, month, 1).getDay();
  const leadingBlanks = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date.startsWith(dateStr));
  }

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {currentDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="pressable" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="pressable" onClick={() => setCurrentDate(new Date())}>
            Heute
          </Button>
          <Button variant="ghost" size="icon" className="pressable" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportIcs} className="pressable ml-2 gap-1.5">
            <Download className="h-3.5 w-3.5" /> .ics
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(TYPE_STYLE).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span>{TYPE_LABEL[type]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const dayEvs = day ? eventsForDay(day) : [];
              return (
                <div
                  key={idx}
                  className={`min-h-[80px] border-b border-r border-border/30 p-1.5 ${!day ? "bg-muted/10" : "hover:bg-muted/20 transition-colors"}`}
                >
                  {day && (
                    <>
                      <span className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                      )}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvs.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className={`${TYPE_STYLE[ev.type]} text-white text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity`}
                            title={ev.title}
                            onClick={() => handleEventClick(ev)}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvs.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvs.length - 3} weitere</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming deadlines */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Nächste Deadlines</h3>
        <div className="space-y-2">
          {events.filter((e) => new Date(e.date) >= today).slice(0, 8).map((ev) => (
            <div
              key={ev.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => handleEventClick(ev)}
            >
              <div className={`h-3 w-3 rounded-full shrink-0 ${TYPE_STYLE[ev.type]}`} />
              <span className="text-sm font-medium flex-1 truncate">{ev.title}</span>
              <Badge variant="secondary" className="text-xs shrink-0">{TYPE_LABEL[ev.type]}</Badge>
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(ev.date)}</span>
            </div>
          ))}
          {!events.filter((e) => new Date(e.date) >= today).length && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine bevorstehenden Deadlines</p>
          )}
        </div>
      </div>

      <TaskDetailPanel
        taskId={selectedTaskId}
        workspaceId={workspaceId}
        members={members}
        open={selectedTaskId !== null}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}
