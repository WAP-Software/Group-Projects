"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (content: string) => Promise<void>;
}

export function MessageInput({ onSend }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setContent("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSend(trimmed);
    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-border px-4 py-3 bg-background">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { setContent(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Shift+Enter for new line)"
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground",
            "min-h-[24px] max-h-[160px] leading-6",
          )}
        />
        <Button
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg pressable transition-opacity",
            !content.trim() && "opacity-40",
          )}
          onClick={handleSend}
          disabled={!content.trim() || sending}
          aria-label="Send message"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
