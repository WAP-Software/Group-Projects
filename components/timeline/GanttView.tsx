"use client";

import { useMemo } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag, Calendar } from "lucide-react";
import type { Task } from "@/types/database";

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

const STATUS_COLOR: Record<string, string> = {
  backlog: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
};

interface Props {
  tasks: Task[];
}

export function GanttView({ tasks }: Props) {
  const tasksWithDates = tasks.filter((t) => t.due_date);
  const tasksWithoutDates = tasks.filter((t) => !t.due_date);

  const { startDate, endDate, totalDays } = useMemo(() => {
    if (!tasksWithDates.length) {
      const now = new Date();
      return { startDate: now, endDate: new Date(now.getTime() + 30 * 86400000), totalDays: 30 };
    }
    const dates = tasksWithDates.map((t) => new Date(t.due_date!).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000);
    return { startDate: minDate, endDate: maxDate, totalDays };
  }, [tasksWithDates]);

  function getDayOffset(date: Date) {
    return Math.floor((date.getTime() - startDate.getTime()) / 86400000);
  }

  const today = new Date();
  const todayOffset = getDayOffset(today);

  const weeks: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No tasks yet</h3>
        <p className="text-sm text-muted-foreground">Create tasks on the Kanban board to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-px bg-red-500" />
          <span>Today</span>
        </div>
      </div>

      {/* Gantt chart — only if tasks have due dates */}
      {tasksWithDates.length > 0 && (
        <Card className="border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(800, totalDays * 24) }}>
              {/* Header: weeks */}
              <div className="flex border-b border-border bg-muted/30">
                <div className="w-48 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border">
                  Task
                </div>
                <div className="flex-1 relative" style={{ height: 32 }}>
                  {weeks.map((week) => {
                    const left = (getDayOffset(week) / totalDays) * 100;
                    return (
                      <div
                        key={week.toISOString()}
                        className="absolute top-0 border-l border-border/50 px-1 py-2"
                        style={{ left: `${left}%` }}
                      >
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {week.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows */}
              {tasksWithDates.map((task) => {
                const dueOffset = getDayOffset(new Date(task.due_date!));
                const pct = (dueOffset / totalDays) * 100;
                const barColor = STATUS_COLOR[task.status];

                return (
                  <div
                    key={task.id}
                    className="flex border-b border-border/30 hover:bg-muted/20 transition-colors"
                    style={{ height: 44 }}
                  >
                    <div className="w-48 shrink-0 px-3 flex items-center gap-2 border-r border-border/30">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                      <span className="text-xs font-medium truncate">{task.title}</span>
                      {task.milestone && <Flag className="h-3 w-3 text-amber-500 shrink-0" />}
                    </div>
                    <div className="flex-1 relative">
                      {todayOffset >= 0 && todayOffset <= totalDays && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-500/50"
                          style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                        />
                      )}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                        style={{ left: `${Math.min(Math.max(pct, 1), 99)}%` }}
                      >
                        <div
                          className="h-5 w-5 rounded-full border-2 border-background shadow-sm"
                          style={{ backgroundColor: barColor }}
                          title={`Due: ${formatDate(task.due_date!)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Milestones */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tasksWithDates.filter((t) => t.milestone).map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <Flag className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium flex-1">{task.title}</span>
                <Badge variant="secondary" className="text-xs capitalize">{task.status.replace("_", " ")}</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(task.due_date!)}</span>
              </div>
            ))}
            {!tasksWithDates.filter((t) => t.milestone).length && (
              <p className="text-sm text-muted-foreground text-center py-2">No milestones set</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tasks without due date */}
      {tasksWithoutDates.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">No Due Date</CardTitle>
              <Badge variant="secondary">{tasksWithoutDates.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {tasksWithoutDates.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLOR[task.status] }}
                  />
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  <Badge variant="secondary" className="text-xs capitalize shrink-0">
                    {task.status.replace("_", " ")}
                  </Badge>
                  <Badge className={cn("text-xs capitalize shrink-0", PRIORITY_COLOR[task.priority])}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
