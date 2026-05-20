"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, Plus, Star, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Review, FileRecord } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800",
  in_review: "bg-blue-50 text-blue-700 dark:bg-blue-950",
  changes_requested: "bg-orange-50 text-orange-700 dark:bg-orange-950",
  approved: "bg-green-50 text-green-700 dark:bg-green-950",
};

interface Props {
  params: Promise<{ workspaceId: string }>;
}

interface FeedbackRow {
  id: string;
  reviewer_id: string;
  reviewer_name?: string;
  feedback: string | null;
  rating: number | null;
  status: string;
  submitted_at: string | null;
}

interface ReviewWithFile extends Review {
  file?: { name: string } | null;
  assignments?: FeedbackRow[];
}

export default function ReviewsPage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();
  const [reviews, setReviews] = useState<ReviewWithFile[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", file_id: "", due_date: "" });

  // Feedback flow state
  const [feedbackDialog, setFeedbackDialog] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ text: "", rating: "4", reviewerName: "" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [userId, setUserId] = useState("");
  const [userProfile, setUserProfile] = useState<{ full_name?: string; email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
        setUserProfile(profile);
      }
    });
    loadData();
    const sub = supabase
      .channel(`reviews:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `workspace_id=eq.${workspaceId}` }, () => loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "review_assignments" }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    const [reviewsResult, filesResult] = await Promise.all([
      supabase
        .from("reviews")
        .select("*, file:files(name), assignments:review_assignments(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase.from("files").select("id, name").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    ]);
    setReviews((reviewsResult.data as ReviewWithFile[]) ?? []);
    setFiles((filesResult.data as FileRecord[]) ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.title) { toast.error("Please enter a title"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reviews").insert({
      workspace_id: workspaceId,
      title: form.title,
      file_id: form.file_id || null,
      document_id: null,
      due_date: form.due_date || null,
      submitted_by: user?.id,
    });
    if (error) { toast.error("Failed to create review"); return; }
    toast.success("Review submitted!");
    setDialogOpen(false);
    setForm({ title: "", file_id: "", due_date: "" });
    loadData();
  }

  function openFeedbackDialog(reviewId: string) {
    setFeedbackForm({ text: "", rating: "4", reviewerName: "" });
    setFeedbackDialog(reviewId);
  }

  function requestConfirm() {
    if (!feedbackForm.reviewerName.trim()) { toast.error("Please enter your name to sign off"); return; }
    if (!feedbackForm.text.trim()) { toast.error("Please write your feedback"); return; }
    setConfirmOpen(true);
  }

  async function submitFeedback() {
    if (!feedbackDialog) return;
    const { error } = await supabase.from("review_assignments").upsert({
      review_id: feedbackDialog,
      reviewer_id: userId,
      feedback: feedbackForm.text,
      rating: parseInt(feedbackForm.rating),
      status: "done",
      submitted_at: new Date().toISOString(),
    });
    if (error) { toast.error("Failed to submit feedback"); return; }
    await supabase.from("reviews").update({ status: "approved" }).eq("id", feedbackDialog);
    toast.success(`Feedback submitted — signed as ${feedbackForm.reviewerName}`);
    setConfirmOpen(false);
    setFeedbackDialog(null);
    setFeedbackForm({ text: "", rating: "4", reviewerName: "" });
    loadData();
  }

  function renderStars(rating: number | null) {
    const r = rating ?? 0;
    return (
      <span className="text-amber-500 text-sm tracking-tight">
        {"★".repeat(r)}
        <span className="text-muted-foreground/40">{"★".repeat(5 - r)}</span>
      </span>
    );
  }

  const canSubmit = feedbackForm.reviewerName.trim().length > 0 && feedbackForm.text.trim().length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Peer Review</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit files for peer review and feedback</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 pressable self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Submit for Review
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center fade-in stagger-2">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No reviews yet</h3>
          <p className="text-sm text-muted-foreground">Submit a file for peer review to get started.</p>
        </div>
      ) : (
        <div className="space-y-4 fade-in stagger-2">
          {reviews.map((review) => {
            const feedbackRows = (review.assignments ?? []).filter((a) => a.feedback);
            const canGiveFeedback = review.submitted_by !== userId && review.status !== "approved";
            return (
              <Card key={review.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{review.title}</CardTitle>
                      {review.file && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{review.file.name}</span>
                        </p>
                      )}
                    </div>
                    <Badge className={`text-xs capitalize shrink-0 ${STATUS_COLORS[review.status]}`}>
                      {review.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Submitted {formatDate(review.created_at)}
                      {review.due_date && ` · Due ${formatDate(review.due_date)}`}
                    </div>
                    {canGiveFeedback && (
                      <Button size="sm" variant="outline" className="pressable self-start sm:self-auto" onClick={() => openFeedbackDialog(review.id)}>
                        <Star className="h-3.5 w-3.5 mr-1.5" /> Give Feedback
                      </Button>
                    )}
                  </div>

                  {feedbackRows.length > 0 && (
                    <div className="pt-3 border-t border-border/50 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Feedback ({feedbackRows.length})
                      </p>
                      {feedbackRows.map((a) => (
                        <div key={a.id} className="space-y-1 p-3 rounded-lg bg-muted/40">
                          <div className="flex items-center gap-2 flex-wrap">
                            {renderStars(a.rating)}
                            <span className="text-xs text-muted-foreground">({a.rating}/5)</span>
                            {a.submitted_at && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {formatDate(a.submitted_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.feedback}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submit for review dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for Review</DialogTitle>
            <DialogDescription>Create a peer review request for your team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Review title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Q3 DCF Analysis Review" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>File (optional)</Label>
              <Select value={form.file_id || "__none__"} onValueChange={(v) => setForm({ ...form, file_id: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select a file" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No file</SelectItem>
                  {files.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="h-10" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="pressable">Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback dialog — step 1: fill in feedback + sign with name */}
      <Dialog open={!!feedbackDialog && !confirmOpen} onOpenChange={(v) => { if (!v) setFeedbackDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
            <DialogDescription>Rate the work and sign off with your name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rating (1–5)</Label>
              <Select value={feedbackForm.rating} onValueChange={(v) => setFeedbackForm({ ...feedbackForm, rating: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <SelectItem key={r} value={String(r)}>{"★".repeat(r)}{"☆".repeat(5 - r)} ({r}/5)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Feedback *</Label>
              <Textarea
                value={feedbackForm.text}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, text: e.target.value })}
                placeholder="Your detailed feedback…"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Your name (sign off) *</Label>
              <Input
                value={feedbackForm.reviewerName}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, reviewerName: e.target.value })}
                placeholder={userProfile?.full_name ?? userProfile?.email ?? "Enter your full name"}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">Your name will be attached to this review as your signature.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFeedbackDialog(null)}>Cancel</Button>
              <Button onClick={requestConfirm} disabled={!canSubmit} className="pressable">
                Review →
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog — step 2: final sign-off confirmation */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!v) setConfirmOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm your review</DialogTitle>
            <DialogDescription>This action is final and cannot be changed afterwards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm font-medium">Signed as: {feedbackForm.reviewerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm">Rating: {feedbackForm.rating}/5</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{feedbackForm.text}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              By confirming, you permanently submit this feedback under your name.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Back</Button>
              <Button onClick={submitFeedback} className="pressable gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirm & Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
