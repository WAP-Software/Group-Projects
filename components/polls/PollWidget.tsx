"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Poll, PollVote } from "@/types/database";

interface PollOption {
  id: string;
  text: string;
}

interface Props {
  poll: Poll;
  currentUserId: string;
}

export function PollWidget({ poll, currentUserId }: Props) {
  const supabase = createClient();
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [myVote, setMyVote] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const options = poll.options as unknown as PollOption[];
  const expired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
  const hasVoted = !!myVote.length;

  useEffect(() => {
    loadVotes();
    const sub = supabase
      .channel(`poll:${poll.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${poll.id}` }, loadVotes)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [poll.id]);

  async function loadVotes() {
    const { data } = await supabase.from("poll_votes").select("*").eq("poll_id", poll.id);
    setVotes(data ?? []);
    const mine = (data ?? []).find((v) => v.user_id === currentUserId);
    setMyVote((mine?.option_ids as string[]) ?? []);
    setSelected((mine?.option_ids as string[]) ?? []);
  }

  function toggleOption(id: string) {
    if (hasVoted || expired) return;
    if (poll.multiple_choice) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setSelected([id]);
    }
  }

  async function handleVote() {
    if (!selected.length) return;
    setSubmitting(true);
    const { error } = await supabase.from("poll_votes").upsert({
      poll_id: poll.id,
      user_id: currentUserId,
      option_ids: selected,
    });
    if (error) toast.error("Failed to vote");
    else toast.success("Vote cast!");
    setSubmitting(false);
  }

  function getVoteCount(optionId: string) {
    return votes.filter((v) => (v.option_ids as string[]).includes(optionId)).length;
  }

  const totalVotes = votes.length;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{poll.question}</CardTitle>
          <div className="flex gap-2 shrink-0">
            {expired && <Badge variant="secondary" className="text-xs">Closed</Badge>}
            {poll.multiple_choice && <Badge variant="outline" className="text-xs">Multi-choice</Badge>}
            {poll.anonymous && <Badge variant="outline" className="text-xs">Anonymous</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{totalVotes} votes</span>
          {poll.expires_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {expired ? "Expired" : `Closes ${formatDate(poll.expires_at)}`}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {options.map((option) => {
          const count = getVoteCount(option.id);
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isSelected = selected.includes(option.id);
          const isMyChoice = myVote.includes(option.id);

          return (
            <button
              key={option.id}
              onClick={() => toggleOption(option.id)}
              disabled={hasVoted || expired}
              className={`w-full text-left rounded-lg border p-3 transition-all pressable ${
                isSelected && !hasVoted
                  ? "border-primary bg-primary/5"
                  : hasVoted && isMyChoice
                  ? "border-green-500 bg-green-50 dark:bg-green-950 dark:text-green-100"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              } ${(hasVoted || expired) ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{option.text}</span>
                <div className="flex items-center gap-2">
                  {isMyChoice && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                  {hasVoted && <span className="text-xs text-muted-foreground tabular-nums">{count} ({pct.toFixed(0)}%)</span>}
                </div>
              </div>
              {hasVoted && <Progress value={pct} className="h-1.5" />}
            </button>
          );
        })}

        {!hasVoted && !expired && (
          <Button
            className="w-full pressable mt-2"
            onClick={handleVote}
            disabled={!selected.length || submitting}
          >
            {poll.multiple_choice ? `Vote (${selected.length} selected)` : "Vote"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
