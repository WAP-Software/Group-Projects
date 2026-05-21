"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
}

export function FloatingChat({ workspaceId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center",
          "hover:bg-primary/90 transition-colors pressable",
        )}
        aria-label="Open chat"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col overflow-hidden">
          <ChatPanel workspaceId={workspaceId} />
        </SheetContent>
      </Sheet>
    </>
  );
}
