"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Download, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Source } from "@/types/database";

const SOURCE_TYPES = ["url", "pdf", "book", "paper", "news", "other"] as const;

const TYPE_COLORS: Record<string, string> = {
  url: "bg-blue-50 text-blue-700 dark:bg-blue-950",
  pdf: "bg-red-50 text-red-700 dark:bg-red-950",
  book: "bg-amber-50 text-amber-700 dark:bg-amber-950",
  paper: "bg-violet-50 text-violet-700 dark:bg-violet-950",
  news: "bg-green-50 text-green-700 dark:bg-green-950",
  other: "bg-slate-50 text-slate-700 dark:bg-slate-800",
};

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default function SourcesPage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSource, setEditSource] = useState<Source | null>(null);
  const [form, setForm] = useState({
    title: "", url: "", source_type: "url" as Source["source_type"],
    notes: "", tags: "",
  });

  function openEdit(source: Source) {
    setEditSource(source);
    setForm({
      title: source.title,
      url: source.url ?? "",
      source_type: source.source_type,
      notes: source.notes ?? "",
      tags: (source.tags ?? []).join(", "),
    });
    setDialogOpen(true);
  }

  function openCreate() {
    setEditSource(null);
    setForm({ title: "", url: "", source_type: "url", notes: "", tags: "" });
    setDialogOpen(true);
  }

  useEffect(() => {
    loadSources();
    const sub = supabase
      .channel(`sources:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sources", filter: `workspace_id=eq.${workspaceId}` }, loadSources)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId]);

  async function loadSources() {
    setLoading(true);
    const { data } = await supabase
      .from("sources")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setSources(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    const payload = {
      title: form.title,
      url: form.url || null,
      source_type: form.source_type,
      notes: form.notes || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };

    if (editSource) {
      const { error } = await supabase.from("sources").update(payload).eq("id", editSource.id);
      if (error) { toast.error("Failed to update source"); return; }
      toast.success("Source updated!");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sources").insert({ ...payload, workspace_id: workspaceId, added_by: user?.id });
      if (error) { toast.error("Failed to add source"); return; }
      toast.success("Source added!");
    }
    setDialogOpen(false);
    setEditSource(null);
    setForm({ title: "", url: "", source_type: "url", notes: "", tags: "" });
    loadSources();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this source?")) return;
    await supabase.from("sources").delete().eq("id", id);
    toast.success("Removed");
    loadSources();
  }

  function exportSources(format: "bibtex" | "apa" | "csv") {
    const list = filtered.length > 0 ? filtered : sources;
    let content = "";
    let filename = "";
    let mime = "text/plain";

    if (format === "bibtex") {
      const typeMap: Record<string, string> = {
        book: "book", paper: "article", url: "misc", pdf: "techreport", news: "misc", other: "misc",
      };
      content = list.map((s, i) => {
        const key = s.title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30) + i;
        const type = typeMap[s.source_type] ?? "misc";
        const fields = [`  title = {${s.title}}`];
        if (s.url) fields.push(`  url = {${s.url}}`);
        if (s.notes) fields.push(`  note = {${s.notes.replace(/[{}]/g, "")}}`);
        if (s.tags?.length) fields.push(`  keywords = {${s.tags.join(", ")}}`);
        fields.push(`  year = {${new Date(s.created_at).getFullYear()}}`);
        return `@${type}{${key},\n${fields.join(",\n")}\n}`;
      }).join("\n\n");
      filename = "sources.bib";
    } else if (format === "apa") {
      content = list.map((s) => {
        const year = new Date(s.created_at).getFullYear();
        let entry = `${s.title}. (${year}).`;
        if (s.notes) entry += ` ${s.notes}.`;
        if (s.url) entry += ` Retrieved from ${s.url}`;
        return entry;
      }).join("\n\n");
      filename = "sources_apa.txt";
    } else {
      const header = "Title,Type,URL,Notes,Tags,Added\n";
      const rows = list.map((s) =>
        [s.title, s.source_type, s.url ?? "", s.notes ?? "", (s.tags ?? []).join("; "), s.created_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      content = header + rows.join("\n");
      filename = "sources.csv";
      mime = "text/csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} source${list.length !== 1 ? "s" : ""} as ${format.toUpperCase()}`);
  }

  const filtered = sources.filter(
    (s) => !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.notes?.toLowerCase().includes(search.toLowerCase()) ||
      (s.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Source Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Shared research sources and references</p>
        </div>
        <div className="flex gap-2">
          {sources.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 pressable">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportSources("bibtex")}>BibTeX (.bib)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSources("apa")}>APA (.txt)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSources("csv")}>CSV (.csv)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={openCreate} className="gap-2 pressable">
            <Plus className="h-4 w-4" /> Add Source
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm mb-6 fade-in stagger-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sources…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center fade-in stagger-3">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No sources yet</h3>
          <p className="text-sm text-muted-foreground">Add research sources to share with the team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in stagger-3">
          {filtered.map((source) => (
            <Card key={source.id} className="border-border/50 hover:shadow-md transition-shadow group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge className={`text-xs capitalize ${TYPE_COLORS[source.source_type]}`}>
                    {source.source_type}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7 pressable">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 pressable"
                      onClick={() => openEdit(source)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 pressable text-destructive hover:text-destructive"
                      onClick={() => handleDelete(source.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{source.title}</h3>
                {source.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{source.notes}</p>
                )}
                {source.tags && source.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {source.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{formatDate(source.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditSource(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editSource ? "Edit Source" : "Add Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Source title or paper name" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v as any })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL (optional)</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Key insights or why this is relevant…" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="dcf, valuation, equity" className="h-10" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditSource(null); }}>Cancel</Button>
              <Button onClick={handleSave} className="pressable">{editSource ? "Save Changes" : "Add Source"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
