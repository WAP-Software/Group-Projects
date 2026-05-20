"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types/database";

type TasksByStatus = Record<"backlog" | "in_progress" | "review" | "done", Task[]>;
const COLUMNS: Array<"backlog" | "in_progress" | "review" | "done"> = ["backlog", "in_progress", "review", "done"];

export function useTasks(workspaceId: string) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TasksByStatus>({ backlog: [], in_progress: [], review: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!workspaceId) return;

    async function load(silent = false) {
      if (!silent) setLoading(true);
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true });

      if (data) {
        const grouped = COLUMNS.reduce((acc, s) => ({ ...acc, [s]: [] }), {} as TasksByStatus);
        data.forEach((t) => {
          if (grouped[t.status as keyof TasksByStatus]) grouped[t.status as keyof TasksByStatus].push(t);
        });
        setTasks(grouped);

        if (data.length > 0) {
          const ids = data.map((t) => t.id);

          const [subtasksRes, filesRes] = await Promise.all([
            supabase.from("task_subtasks").select("task_id, completed").in("task_id", ids),
            supabase.from("task_files").select("task_id").in("task_id", ids),
          ]);

          const sc: Record<string, { total: number; done: number }> = {};
          (subtasksRes.data ?? []).forEach((s: any) => {
            if (!sc[s.task_id]) sc[s.task_id] = { total: 0, done: 0 };
            sc[s.task_id].total++;
            if (s.completed) sc[s.task_id].done++;
          });
          setSubtaskCounts(sc);

          const fc: Record<string, number> = {};
          (filesRes.data ?? []).forEach((f: any) => { fc[f.task_id] = (fc[f.task_id] ?? 0) + 1; });
          setFileCounts(fc);
        }
      }
      setLoading(false);
    }

    load();

    const sub = supabase
      .channel(`tasks:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_subtasks" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_files" }, () => load(true))
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [workspaceId]);

  async function moveTask(taskId: string, newStatus: keyof TasksByStatus, newPosition: number) {
    const allTasks = Object.values(tasks).flat();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistically update state before the DB call
    const updated: TasksByStatus = { ...tasks };
    updated[task.status as keyof TasksByStatus] = updated[task.status as keyof TasksByStatus].filter((t) => t.id !== taskId);
    const moved = { ...task, status: newStatus, position: newPosition };
    updated[newStatus] = [...updated[newStatus].slice(0, newPosition), moved, ...updated[newStatus].slice(newPosition)];
    setTasks(updated);

    await supabase.from("tasks").update({ status: newStatus, position: newPosition }).eq("id", taskId);
  }

  async function createTask(data: Partial<Task>) {
    const { data: created, error } = await supabase
      .from("tasks")
      .insert(data as any)
      .select()
      .single();
    return { id: (created as any)?.id as string ?? null, error };
  }

  async function updateTask(id: string, data: Partial<Task>) {
    const { error } = await supabase.from("tasks").update(data as any).eq("id", id);
    if (!error) {
      setTasks((prev) => {
        const updated = { ...prev };
        for (const col of COLUMNS) {
          updated[col] = updated[col].map((t) => (t.id === id ? { ...t, ...data } : t));
        }
        return updated;
      });
    }
    return error;
  }

  async function deleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
  }

  return { tasks, loading, moveTask, createTask, updateTask, deleteTask, subtaskCounts, fileCounts };
}
