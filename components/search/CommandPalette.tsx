"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CommandDialog, CommandInput, CommandList,
  CommandItem, CommandGroup, CommandEmpty,
} from "@/components/ui/command";
import { Kanban, FolderOpen, BookOpen, Calculator } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ tasks: any[]; files: any[]; sources: any[]; formulas: any[] }>({
    tasks: [], files: [], sources: [], formulas: [],
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const workspaceId = pathname.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
  const base = workspaceId ? `/workspaces/${workspaceId}` : "";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() { setOpen(true); }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("openSearch", onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("openSearch", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ tasks: [], files: [], sources: [], formulas: [] });
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !workspaceId) {
      setResults({ tasks: [], files: [], sources: [], formulas: [] });
      return;
    }
    setLoading(true);
    const like = `%${q}%`;
    const [tasksRes, filesRes, sourcesRes, formulasRes] = await Promise.all([
      supabase.from("tasks").select("id, title, status").eq("workspace_id", workspaceId).ilike("title", like).limit(5),
      supabase.from("files").select("id, name, mime_type").eq("workspace_id", workspaceId).ilike("name", like).limit(5),
      supabase.from("sources").select("id, title, source_type").eq("workspace_id", workspaceId).ilike("title", like).limit(5),
      supabase.from("formulas").select("id, title, category").eq("workspace_id", workspaceId).ilike("title", like).limit(5),
    ]);
    setResults({
      tasks: tasksRes.data ?? [],
      files: filesRes.data ?? [],
      sources: sourcesRes.data ?? [],
      formulas: formulasRes.data ?? [],
    });
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
  }, [query, search]);

  function go(path: string) {
    router.push(path);
    setOpen(false);
  }

  const hasResults =
    results.tasks.length + results.files.length + results.sources.length + results.formulas.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={
          workspaceId
            ? "Search tasks, files, sources, formulas…"
            : "Open a workspace first to search"
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!query.trim() ? (
          <CommandEmpty>Type to search across this workspace…</CommandEmpty>
        ) : loading ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : !hasResults ? (
          <CommandEmpty>No results for &ldquo;{query}&rdquo;</CommandEmpty>
        ) : (
          <>
            {results.tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {results.tasks.map((t) => (
                  <CommandItem key={t.id} onSelect={() => go(`${base}/tasks`)}>
                    <Kanban className="text-violet-500" />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {t.status.replace("_", " ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.files.length > 0 && (
              <CommandGroup heading="Files">
                {results.files.map((f) => (
                  <CommandItem key={f.id} onSelect={() => go(`${base}/files`)}>
                    <FolderOpen className="text-amber-500" />
                    <span className="flex-1 truncate">{f.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.sources.length > 0 && (
              <CommandGroup heading="Sources">
                {results.sources.map((s) => (
                  <CommandItem key={s.id} onSelect={() => go(`${base}/sources`)}>
                    <BookOpen className="text-blue-500" />
                    <span className="flex-1 truncate">{s.title}</span>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {s.source_type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.formulas.length > 0 && (
              <CommandGroup heading="Formulas">
                {results.formulas.map((f) => (
                  <CommandItem key={f.id} onSelect={() => go(`${base}/formulas`)}>
                    <Calculator className="text-green-500" />
                    <span className="flex-1 truncate">{f.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{f.category}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
