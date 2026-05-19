"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626",
  "#d97706", "#16a34a", "#0891b2", "#0f172a",
];

interface Props {
  userId: string;
}

export function WorkspaceCreateDialog({ userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    course_name: "",
    semester: "",
    color: COLORS[0],
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);

    const slug = `${slugify(form.name)}-${Date.now()}`;

    const { data: ws, error } = await supabase
      .from("workspaces")
      .insert({ ...form, slug, created_by: userId })
      .select()
      .single();

    if (error || !ws) {
      toast.error("Failed to create workspace");
      setLoading(false);
      return;
    }

    await supabase.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: userId,
      role: "owner",
    });

    await supabase.from("channels").insert({
      workspace_id: ws.id,
      name: "general",
      is_default: true,
    });

    toast.success("Workspace created!");
    setOpen(false);
    setForm({ name: "", description: "", course_name: "", semester: "", color: COLORS[0] });
    router.push(`/workspaces/${ws.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="pressable gap-2">
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Set up a shared space for your finance project team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name *</Label>
            <Input
              id="ws-name"
              placeholder="M&A Case Study — Group 4"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea
              id="ws-desc"
              placeholder="Brief description of this workspace's purpose…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ws-course">Course</Label>
              <Input
                id="ws-course"
                placeholder="Corporate Finance"
                value={form.course_name}
                onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-semester">Semester</Label>
              <Input
                id="ws-semester"
                placeholder="Fall 2025"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="h-7 w-7 rounded-full pressable ring-offset-2 transition-shadow"
                  style={{
                    backgroundColor: c,
                    boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined,
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="pressable">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
