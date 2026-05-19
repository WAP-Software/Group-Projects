"use client";

import { useEffect, useState, useRef, useOptimistic } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/database";

const PAGE_SIZE = 30;

export function useRealtimeMessages(channelId: string | null) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (state: Message[], newMsg: Message) => [...state, newMsg],
  );
  const oldestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!channelId) return;

    setMessages([]);
    setHasMore(true);
    oldestIdRef.current = null;

    async function loadInitial() {
      setLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId!)
        .is("thread_id", null)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (data) {
        const sorted = data.reverse();
        setMessages(sorted);
        setHasMore(data.length === PAGE_SIZE);
        oldestIdRef.current = sorted[0]?.created_at ?? null;
      }
      setLoading(false);
    }

    loadInitial();

    const sub = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? (payload.new as Message) : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, supabase]);

  async function loadMore() {
    if (!channelId || !hasMore || loading || !oldestIdRef.current) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .is("thread_id", null)
      .lt("created_at", oldestIdRef.current)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      const sorted = data.reverse();
      setMessages((prev) => [...sorted, ...prev]);
      setHasMore(data.length === PAGE_SIZE);
      oldestIdRef.current = sorted[0]?.created_at ?? oldestIdRef.current;
    }
    setLoading(false);
  }

  return { messages: optimisticMessages, loading, hasMore, loadMore, addOptimistic };
}
