"use client";

import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import type { Task } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  columnId: "backlog" | "in_progress" | "review" | "done";
  label: string;
  colorClass: string;
  tasks: Task[];
  workspaceId: string;
  onCreateTask: (data: Partial<Task>) => Promise<any>;
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<void>;
}

export function KanbanColumn({
  columnId, label, colorClass, tasks, workspaceId,
  onCreateTask, onUpdateTask, onDeleteTask,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function handleAdd() {
    if (!title.trim()) return;
    await onCreateTask({
      workspace_id: workspaceId,
      title: title.trim(),
      status: columnId,
      priority: "medium",
      position: tasks.length,
    });
    setTitle("");
    setAdding(false);
  }

  const bgClass: Record<string, string> = {
    backlog: "var(--kanban-backlog)",
    in_progress: "var(--kanban-progress)",
    review: "var(--kanban-review)",
    done: "var(--kanban-done)",
  };

  return (
    <div className="w-72 shrink-0 rounded-xl flex flex-col" style={{ backgroundColor: bgClass[columnId] }}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorClass}`} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground font-medium tabular-nums">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 px-2 pb-2 space-y-2 min-h-[4rem] rounded-lg transition-colors",
              snapshot.isDraggingOver && "bg-primary/5",
            )}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add task */}
      <div className="px-2 pb-2">
        {adding ? (
          <div className="bg-background rounded-lg p-2 border border-border/50 space-y-2">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              className="h-8 text-sm border-none shadow-none focus-visible:ring-0 px-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setTitle(""); }
              }}
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs pressable" onClick={handleAdd}>Add</Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 pressable" onClick={() => { setAdding(false); setTitle(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
              "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
              "transition-colors duration-150",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}
