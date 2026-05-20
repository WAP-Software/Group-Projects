"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PollWidget } from "@/components/polls/PollWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Vote } from "lucide-react";
import { toast } from "sonner";
import type { Poll } from "@/types/database";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

let _uid = 0;
function uid() { return `opt-${++_uid}`; }

export default function PollsPage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    question: "",
    multiple_choice: false,
    anonymous: false,
    expires_at: "",
    options: [{ id: uid(), text: "" }, { id: uid(), text: "" }],
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
    loadPolls();
    const sub = supabase
      .channel(`polls:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls", filter: `workspace_id=eq.${workspaceId}` }, loadPolls)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, loadPolls)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId]);

  async function loadPolls() {
    setLoading(true);
    const { data } = await supabase
      .from("polls")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setPolls(data ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.question.trim()) { toast.error("Enter a question"); return; }
    const validOptions = form.options.filter((o) => o.text.trim());
    if (validOptions.length < 2) { toast.error("At least 2 options required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("polls").insert({
      workspace_id: workspaceId,
      question: form.question,
      options: validOptions,
      multiple_choice: form.multiple_choice,
      anonymous: form.anonymous,
      expires_at: form.expires_at || null,
      created_by: user?.id,
    });
    if (error) { toast.error("Failed to create poll"); return; }
    toast.success("Poll created!");
    setDialogOpen(false);
    setForm({ question: "", multiple_choice: false, anonymous: false, expires_at: "", options: [{ id: uid(), text: "" }, { id: uid(), text: "" }] });
    loadPolls();
  }

  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, { id: uid(), text: "" }] }));
  }

  function updateOption(id: string, text: string) {
    setForm((f) => ({ ...f, options: f.options.map((o) => o.id === id ? { ...o, text } : o) }));
  }

  function removeOption(id: string) {
    setForm((f) => ({ ...f, options: f.options.filter((o) => o.id !== id) }));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Polls</h1>
          <p className="text-sm text-muted-foreground mt-1">Team voting with real-time results</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 pressable">
          <Plus className="h-4 w-4" /> Create Poll
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : polls.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center fade-in stagger-2">
          <Vote className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No polls yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create a poll to gather team input.</p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 pressable">
            <Plus className="h-4 w-4" /> Create Poll
          </Button>
        </div>
      ) : (
        <div className="space-y-4 fade-in stagger-2">
          {polls.map((poll) => (
            <PollWidget key={poll.id} poll={poll} currentUserId={userId} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="What should we prioritize next?" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>Options</Label>
              {form.options.map((opt, i) => (
                <div key={opt.id} className="flex gap-2">
                  <Input
                    value={opt.text}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="h-9"
                  />
                  {form.options.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 pressable" onClick={() => removeOption(opt.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption} className="pressable">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add option
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Multiple choice</Label>
                <Switch checked={form.multiple_choice} onCheckedChange={(v) => setForm({ ...form, multiple_choice: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Anonymous</Label>
                <Switch checked={form.anonymous} onCheckedChange={(v) => setForm({ ...form, anonymous: v })} />
              </div>
              <div className="space-y-2">
                <Label>Expires at (optional)</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="pressable">Create Poll</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
