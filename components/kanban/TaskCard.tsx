"use client";

import { Draggable } from "@hello-pangea/dnd";
import { formatDate, priorityColor, getInitials, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Flag, MoreHorizontal, Pencil, Trash2, Paperclip, CheckSquare } from "lucide-react";
import type { Task, Profile } from "@/types/database";

type Member = { user_id: string; role: string; profile: Profile };

interface Props {
  task: Task;
  index: number;
  members: Member[];
  subtaskCount?: { total: number; done: number };
  fileCount?: number;
  onDelete: (id: string) => Promise<void>;
  onOpenDetail: (taskId: string) => void;
}

export function TaskCard({ task, index, members, subtaskCount, fileCount, onDelete, onOpenDetail }: Props) {
  const assignee = members.find((m) => m.user_id === task.assigned_to);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-background rounded-lg border border-border/50 cursor-pointer select-none",
            "transition-shadow duration-150",
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20 rotate-1" : "shadow-sm hover:shadow-md",
          )}
          onClick={() => onOpenDetail(task.id)}
        >
          <div className="p-3 space-y-2.5">
            {/* Title + menu */}
            <div className="flex items-start gap-2">
              <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    aria-label="Task options"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenDetail(task.id); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Priority + due date */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-xs px-1.5 py-0.5 gap-1", priorityColor(task.priority))}>
                <Flag className="h-2.5 w-2.5" />
                {task.priority}
              </Badge>
              {task.due_date && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>

            {/* Footer: subtasks + files + assignee */}
            {(subtaskCount?.total || fileCount || assignee) && (
              <div className="flex items-center gap-2">
                {subtaskCount && subtaskCount.total > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckSquare className="h-3 w-3" />
                    <span className={cn(subtaskCount.done === subtaskCount.total && "text-green-600 font-medium")}>
                      {subtaskCount.done}/{subtaskCount.total}
                    </span>
                  </span>
                )}
                {fileCount && fileCount > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    {fileCount}
                  </span>
                ) : null}
                {assignee && (
                  <div className="ml-auto">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={assignee.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(assignee.profile?.full_name ?? assignee.profile?.email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
