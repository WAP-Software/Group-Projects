"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Mention from "@tiptap/extension-mention";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createClient } from "@/lib/supabase/client";
import { generateCursorColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code2, Undo2, Redo2,
} from "lucide-react";
import { CommentSidebar } from "./CommentSidebar";
import { cn } from "@/lib/utils";

interface Props {
  docId: string;
  workspaceId: string;
  readOnly?: boolean;
}

export function CollaborativeEditor({ docId, workspaceId, readOnly = false }: Props) {
  const supabase = createClient();

  // Y.Doc must be created eagerly (not in useEffect) so it's ready for useEditor
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState<{ id: string; full_name: string | null; color: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("id, full_name").eq("id", user.id).single().then(({ data }) => {
        setProfile({ id: user.id, full_name: data?.full_name ?? "Anonymous", color: generateCursorColor(user.id) });
      });
    });
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_YJS_WS_URL;
    // Skip if no real WebSocket server configured yet
    if (!wsUrl || wsUrl.includes("placeholder") || wsUrl.includes("localhost")) {
      return;
    }

    let p: WebsocketProvider | null = null;
    try {
      p = new WebsocketProvider(wsUrl, `doc-${docId}`, ydocRef.current, {
        connect: true,
      });
      p.on("status", ({ status }: { status: string }) => {
        setConnected(status === "connected");
      });
      setProvider(p);
    } catch (e) {
      console.warn("Y.js WebSocket unavailable, running in offline mode");
    }

    return () => {
      p?.destroy();
      setProvider(null);
      setConnected(false);
    };
  }, [docId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      // Y.Doc is always ready — editor works offline too
      Collaboration.configure({ document: ydocRef.current }),
      // Cursors only when there's a live WebSocket connection
      ...(provider
        ? [
            CollaborationCursor.configure({
              provider,
              user: profile
                ? { name: profile.full_name ?? "Anonymous", color: profile.color }
                : { name: "Anonymous", color: "#94a3b8" },
            }),
          ]
        : []),
      Mention.configure({
        suggestion: {
          items: async ({ query }) => {
            const { data } = await supabase
              .from("workspace_members")
              .select("*, profile:profiles(full_name)")
              .eq("workspace_id", workspaceId);
            return (data ?? [])
              .map((m: any) => ({ id: m.user_id, label: m.profile?.full_name ?? "" }))
              .filter((u: any) => u.label.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 5);
          },
        },
      }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: { class: "tiptap-editor" },
    },
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        await supabase.from("documents").update({
          content: editor.getJSON(),
          updated_at: new Date().toISOString(),
        }).eq("id", docId);
        setSaving(false);
      }, 1500);
    },
  }, [provider, profile]);

  if (!editor) {
    return (
      <div className="flex-1 p-6 space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        {!readOnly && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 flex-wrap">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} aria-label="Bold"><Bold className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} aria-label="Italic"><Italic className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} aria-label="Strikethrough"><Strikethrough className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} aria-label="Code"><Code2 className="h-4 w-4" /></ToolbarButton>
            <div className="h-4 w-px bg-border mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} aria-label="H1"><Heading1 className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} aria-label="H2"><Heading2 className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} aria-label="H3"><Heading3 className="h-4 w-4" /></ToolbarButton>
            <div className="h-4 w-px bg-border mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} aria-label="Bullet list"><List className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} aria-label="Ordered list"><ListOrdered className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} aria-label="Quote"><Quote className="h-4 w-4" /></ToolbarButton>
            <div className="h-4 w-px bg-border mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} aria-label="Undo"><Undo2 className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} aria-label="Redo"><Redo2 className="h-4 w-4" /></ToolbarButton>
            <div className="ml-auto flex items-center gap-2">
              {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
              <Badge variant={connected ? "default" : "secondary"} className={cn("text-xs", connected && "bg-green-500")}>
                {connected ? "Live" : "Offline"}
              </Badge>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} className="min-h-full" />
        </div>
      </div>
      <CommentSidebar documentId={docId} />
    </div>
  );
}

function ToolbarButton({
  children, onClick, active, ...props
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-sm pressable transition-colors duration-100",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
