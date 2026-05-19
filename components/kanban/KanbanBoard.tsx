"use client";

import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useTasks } from "@/hooks/useTasks";
import { KanbanColumn } from "./KanbanColumn";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = [
  { id: "backlog" as const, label: "Backlog", color: "bg-slate-400" },
  { id: "in_progress" as const, label: "In Progress", color: "bg-blue-500" },
  { id: "review" as const, label: "Review", color: "bg-yellow-500" },
  { id: "done" as const, label: "Done", color: "bg-green-500" },
];

interface Props {
  workspaceId: string;
}

export function KanbanBoard({ workspaceId }: Props) {
  const { tasks, loading, moveTask, createTask, updateTask, deleteTask } = useTasks(workspaceId);

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    await moveTask(
      draggableId,
      destination.droppableId as any,
      destination.index,
    );
  }

  if (loading) {
    return (
      <div className="flex gap-4 p-6 overflow-x-auto">
        {COLUMNS.map((col) => (
          <div key={col.id} className="w-72 shrink-0 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
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
            onCreateTask={createTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
