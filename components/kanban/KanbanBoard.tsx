"use client";

import { useState, useEffect } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/useTasks";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { Skeleton } from "@/components/ui/skeleton";
import type { Profile } from "@/types/database";

const COLUMNS = [
  { id: "backlog" as const, label: "Backlog", color: "bg-slate-400" },
  { id: "in_progress" as const, label: "In Progress", color: "bg-blue-500" },
  { id: "review" as const, label: "Review", color: "bg-yellow-500" },
  { id: "done" as const, label: "Done", color: "bg-green-500" },
];

type Member = { user_id: string; role: string; profile: Profile };

interface Props {
  workspaceId: string;
}

export function KanbanBoard({ workspaceId }: Props) {
  const { tasks, loading, moveTask, createTask, updateTask, deleteTask, subtaskCounts, fileCounts } = useTasks(workspaceId);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("workspace_members")
      .select("*, profile:profiles(*)")
      .eq("workspace_id", workspaceId)
      .then(({ data }) => setMembers((data ?? []) as any));
  }, [workspaceId]);

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
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-8rem)] items-start">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              columnId={col.id}
              label={col.label}
              colorClass={col.color}
              tasks={tasks[col.id]}
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
