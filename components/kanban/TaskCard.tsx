"use client";

import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { formatDate, priorityColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Flag, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Task } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  index: number;
  onUpdate: (id: string, data: Partial<Task>) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, index, onUpdate, onDelete }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ title: task.title, description: task.description ?? "", priority: task.priority, due_date: task.due_date ?? "" });

  async function handleSave() {
    await onUpdate(task.id, form as Partial<Task>);
    setEditOpen(false);
  }

  return (
    <>
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              "bg-background rounded-lg p-3 border border-border/50 cursor-grab active:cursor-grabbing",
              "transition-shadow duration-150",
              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20 rotate-1" : "shadow-sm hover:shadow-md",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-label="Task options">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Badge className={cn("text-xs px-1.5 py-0.5", priorityColor(task.priority))}>
                <Flag className="h-2.5 w-2.5 mr-1" />
                {task.priority}
              </Badge>
              {task.due_date && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
              {task.milestone && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5">Milestone</Badge>
              )}
            </div>
          </div>
        )}
      </Draggable>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="pressable">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
