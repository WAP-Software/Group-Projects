"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hash, ChevronDown } from "lucide-react";
import type { Channel } from "@/types/database";

interface Props {
  workspaceId: string;
}

export function ChatPanel({ workspaceId }: Props) {
  const supabase = createClient();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [profile, setProfile] = useState<{ id: string; full_name: string | null } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, loading, hasMore, loadMore, addOptimistic } = useRealtimeMessages(activeChannel?.id ?? null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileResult, channelsResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("id", user.id).single(),
        supabase.from("channels").select("*").eq("workspace_id", workspaceId).order("created_at"),
      ]);

      if (profileResult.data) setProfile(profileResult.data);
      if (channelsResult.data?.length) {
        setChannels(channelsResult.data);
        setActiveChannel(channelsResult.data.find((c) => c.is_default) ?? channelsResult.data[0]);
      }
    }
    init();
  }, [workspaceId, supabase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend(content: string) {
    if (!activeChannel || !profile) return;
    await supabase.from("messages").insert({
      channel_id: activeChannel.id,
      user_id: profile.id,
      content,
    });
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden">
      {/* Channel list */}
      <div className="w-48 shrink-0 border-r border-border bg-sidebar/50 flex flex-col">
        <div className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Channels
        </div>
        <div className="flex-1 space-y-0.5 px-2">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors ${
                activeChannel?.id === ch.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={async () => {
              const name = prompt("Channel name:");
              if (!name) return;
              const { data } = await supabase.from("channels").insert({ workspace_id: workspaceId, name }).select().single();
              if (data) { setChannels((prev) => [...prev, data]); setActiveChannel(data); }
            }}
          >
            + Add channel
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeChannel ? (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{activeChannel.name}</span>
              {activeChannel.description && (
                <span className="text-xs text-muted-foreground">· {activeChannel.description}</span>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4">
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button variant="ghost" size="sm" onClick={loadMore} className="text-xs text-muted-foreground">
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    Load earlier messages
                  </Button>
                </div>
              )}
              <MessageList messages={messages} currentUserId={profile?.id ?? ""} />
              <div ref={bottomRef} />
            </div>

            <MessageInput onSend={handleSend} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a channel
          </div>
        )}
      </div>
    </div>
  );
}
