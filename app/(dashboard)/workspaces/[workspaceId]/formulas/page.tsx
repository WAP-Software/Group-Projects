"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FormulaCard } from "@/components/formulas/FormulaCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Formula } from "@/types/database";

const CATEGORIES = ["All", "DCF", "LBO", "WACC", "Options", "Derivatives", "Statistics", "General"];

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default function FormulasPage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFormula, setEditFormula] = useState<Formula | null>(null);
  const [form, setForm] = useState({
    title: "", latex: "", description: "", category: "General", tags: "",
  });

  useEffect(() => {
    loadFormulas();
    const sub = supabase
      .channel(`formulas:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "formulas", filter: `workspace_id=eq.${workspaceId}` }, loadFormulas)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId]);

  async function loadFormulas() {
    setLoading(true);
    const { data } = await supabase
      .from("formulas")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("category")
      .order("title");
    setFormulas(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditFormula(null);
    setForm({ title: "", latex: "", description: "", category: "General", tags: "" });
    setDialogOpen(true);
  }

  function openEdit(f: Formula) {
    setEditFormula(f);
    setForm({ title: f.title, latex: f.latex, description: f.description ?? "", category: f.category, tags: (f.tags ?? []).join(", ") });
    setDialogOpen(true);
  }

  async function handleSave() {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title,
      latex: form.latex,
      description: form.description || null,
      category: form.category,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      workspace_id: workspaceId,
      created_by: user?.id,
    };

    if (editFormula) {
      const { error } = await supabase.from("formulas").update(payload).eq("id", editFormula.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Formula updated");
    } else {
      const { error } = await supabase.from("formulas").insert(payload);
      if (error) { toast.error("Failed to create"); return; }
      toast.success("Formula added");
    }
    setDialogOpen(false);
    loadFormulas();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this formula?")) return;
    await supabase.from("formulas").delete().eq("id", id);
    toast.success("Deleted");
    loadFormulas();
  }

  const filtered = formulas.filter((f) => {
    const matchesSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.latex.includes(search);
    const matchesCategory = category === "All" || f.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Formula Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Shared formulas with LaTeX rendering</p>
        </div>
        <Button onClick={openCreate} className="gap-2 pressable">
          <Plus className="h-4 w-4" /> Add Formula
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 fade-in stagger-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search formulas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="flex-wrap h-auto">
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c} className="text-xs">{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No formulas found</p>
          <p className="text-sm">Add your first formula to the library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 fade-in stagger-3">
          {filtered.map((f) => (
            <FormulaCard key={f.id} formula={f} editable onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editFormula ? "Edit Formula" : "Add Formula"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="WACC Formula" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>LaTeX</Label>
              <Textarea
                value={form.latex}
                onChange={(e) => setForm({ ...form, latex: e.target.value })}
                placeholder="WACC = \frac{E}{V} \cdot Re + \frac{D}{V} \cdot Rd \cdot (1 - Tc)"
                rows={3}
                className="font-mono text-sm"
              />
              {form.latex && (
                <div className="rounded-lg bg-muted/50 p-3 overflow-x-auto">
                  <BlockMath
                    math={form.latex}
                    renderError={() => (
                      <span className="text-xs text-destructive">Invalid LaTeX syntax</span>
                    )}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="dcf, valuation" className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Explain what this formula is used for…"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="pressable">{editFormula ? "Update" : "Add"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
