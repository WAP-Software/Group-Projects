"use client";

import { useState, useEffect } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/useTasks";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Profile, Task } from "@/types/database";

const COLUMNS = [
  { id: "backlog" as const, label: "Backlog", color: "bg-slate-400" },
  { id: "in_progress" as const, label: "In Progress", color: "bg-blue-500" },
  { id: "review" as const, label: "Review", color: "bg-yellow-500" },
  { id: "done" as const, label: "Done", color: "bg-green-500" },
];

type Status = "backlog" | "in_progress" | "review" | "done";
type TasksByStatus = Record<Status, Task[]>;
type Member = { user_id: string; role: string; profile: Profile };
type FilterPriority = "all" | "urgent" | "high";

interface Props {
  workspaceId: string;
}

export function KanbanBoard({ workspaceId }: Props) {
  const { tasks, loading, moveTask, createTask, updateTask, deleteTask, subtaskCounts, fileCounts } = useTasks(workspaceId);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filterMine, setFilterMine] = useState(false);
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    supabase
      .from("workspace_members")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", workspaceId)
      .then(({ data }) => setMembers((data ?? []) as any));
  }, [workspaceId]);

  const filteredTasks: TasksByStatus = Object.fromEntries(
    COLUMNS.map(({ id }) => [
      id,
      tasks[id].filter((t) => {
        if (filterMine && currentUserId && t.assigned_to !== currentUserId) return false;
        if (filterPriority !== "all" && t.priority !== filterPriority) return false;
        return true;
      }),
    ]),
  ) as TasksByStatus;

  const hasActiveFilter = filterMine || filterPriority !== "all";

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    await moveTask(result.draggableId, result.destination.droppableId as any, result.destination.index);
  }

  if (loading) {
    return (
      <div className="flex gap-4 p-6 overflow-x-auto">
        {COLUMNS.map((col) => (
          <div key={col.id} className="w-72 shrink-0 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-background/80">
        <Button
          variant={filterMine ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs pressable"
          onClick={() => setFilterMine(!filterMine)}
        >
          My Tasks
        </Button>
        {(["urgent", "high"] as FilterPriority[]).map((p) => (
          <Button
            key={p}
            variant={filterPriority === p ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs pressable capitalize"
            onClick={() => setFilterPriority(filterPriority === p ? "all" : p)}
          >
            {p}
          </Button>
        ))}
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs pressable ml-auto text-muted-foreground"
            onClick={() => { setFilterMine(false); setFilterPriority("all"); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-10rem)] items-start">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              columnId={col.id}
              label={col.label}
              colorClass={col.color}
              tasks={filteredTasks[col.id]}
              workspaceId={workspaceId}
              members={members}
              subtaskCounts={subtaskCounts}
              fileCounts={fileCounts}
              onCreateTask={createTask}
              onDeleteTask={deleteTask}
              onOpenDetail={setSelectedTaskId}
            />
          ))}
        </div>
      </DragDropContext>

      <TaskDetailPanel
        taskId={selectedTaskId}
        workspaceId={workspaceId}
        members={members}
        open={selectedTaskId !== null}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />
    </>
  );
}
