"use client";

import { useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Maximize2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Formula } from "@/types/database";

interface Props {
  formula: Formula;
  onEdit?: (formula: Formula) => void;
  onDelete?: (id: string) => void;
  editable?: boolean;
}

function renderLatex(latex: string): string {
  return katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    output: "html",
  });
}

export function FormulaCard({ formula, onEdit, onDelete, editable = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  async function copyLatex() {
    try {
      await navigator.clipboard.writeText(formula.latex);
      toast.success("LaTeX copied!");
    } catch {
      toast.error("Clipboard access denied");
    }
  }

  return (
    <>
      <Card className="border-border/50 hover:shadow-md transition-shadow group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight">{formula.title}</h3>
              <Badge variant="secondary" className="text-xs">{formula.category}</Badge>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7 pressable" onClick={copyLatex} aria-label="Copy LaTeX">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 pressable" onClick={() => setExpanded(true)} aria-label="Fullscreen">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              {editable && onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7 pressable" onClick={() => onEdit(formula)} aria-label="Edit formula">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {editable && onDelete && (
                <Button variant="ghost" size="icon" className="h-7 w-7 pressable text-destructive hover:text-destructive" onClick={() => onDelete(formula.id)} aria-label="Delete formula">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            className="rounded-lg bg-muted/50 p-3 overflow-x-auto katex-display-wrap cursor-zoom-in"
            onClick={() => setExpanded(true)}
            dangerouslySetInnerHTML={{ __html: renderLatex(formula.latex) }}
          />
          {formula.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{formula.description}</p>
          )}
          {formula.tags && formula.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formula.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formula.title}
              <Badge variant="secondary" className="text-xs font-normal">{formula.category}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div
            className="rounded-xl bg-muted/50 p-6 overflow-x-auto [&_.katex]:text-3xl"
            dangerouslySetInnerHTML={{ __html: renderLatex(formula.latex) }}
          />
          {formula.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{formula.description}</p>
          )}
          {formula.tags && formula.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {formula.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={copyLatex} className="gap-2 text-xs">
              <Copy className="h-3.5 w-3.5" /> LaTeX kopieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
