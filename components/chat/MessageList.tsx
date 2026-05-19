"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message } from "@/types/database";
import { cn } from "@/lib/utils";

interface MessageWithProfile extends Message {
  profile?: { full_name: string | null; avatar_url: string | null };
}

interface Props {
  messages: Message[];
  currentUserId: string;
}

export function MessageList({ messages, currentUserId }: Props) {
  const supabase = createClient();
  const [enriched, setEnriched] = useState<MessageWithProfile[]>([]);

  useEffect(() => {
    async function enrich() {
      const userIds = [...new Set(messages.map((m) => m.user_id))];
      if (!userIds.length) { setEnriched(messages); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setEnriched(messages.map((m) => ({ ...m, profile: profileMap[m.user_id] })));
    }
    enrich();
  }, [messages, supabase]);

  if (enriched.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No messages yet. Start the conversation!
      </div>
    );
  }

  let prevUserId = "";
  let prevDate = "";

  return (
    <div className="space-y-0.5 py-2">
      {enriched.map((msg) => {
        const isMine = msg.user_id === currentUserId;
        const msgDate = new Date(msg.created_at).toDateString();
        const showDate = msgDate !== prevDate;
        const grouped = msg.user_id === prevUserId && !showDate;
        prevUserId = msg.user_id;
        prevDate = msgDate;

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleDateString()}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div
              className={cn(
                "flex items-start gap-3 px-2 py-1 rounded-lg transition-colors hover:bg-muted/30",
                grouped && "ml-9",
              )}
            >
              {!grouped && (
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarImage src={msg.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(msg.profile?.full_name ?? "?")}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                {!grouped && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={cn("text-sm font-semibold", isMine && "text-primary")}>
                      {msg.profile?.full_name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(msg.created_at)}</span>
                    {msg.edited && <span className="text-xs text-muted-foreground">(edited)</span>}
                  </div>
                )}
                <p className="text-sm text-foreground/90 break-words leading-relaxed">{msg.content}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
