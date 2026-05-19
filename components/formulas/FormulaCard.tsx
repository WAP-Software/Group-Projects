"use client";

import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Formula } from "@/types/database";

interface Props {
  formula: Formula;
  onEdit?: (formula: Formula) => void;
  onDelete?: (id: string) => void;
  editable?: boolean;
}

export function FormulaCard({ formula, onEdit, onDelete, editable = false }: Props) {
  function copyLatex() {
    navigator.clipboard.writeText(formula.latex);
    toast.success("LaTeX copied!");
  }

  return (
    <Card className="border-border/50 hover:shadow-md transition-shadow group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">{formula.title}</h3>
            <Badge variant="secondary" className="text-xs">{formula.category}</Badge>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 pressable"
              onClick={copyLatex}
              aria-label="Copy LaTeX"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {editable && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 pressable"
                onClick={() => onEdit(formula)}
                aria-label="Edit formula"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {editable && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 pressable text-destructive hover:text-destructive"
                onClick={() => onDelete(formula.id)}
                aria-label="Delete formula"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-lg bg-muted/50 p-3 overflow-x-auto">
          <BlockMath math={formula.latex} />
        </div>
        {formula.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{formula.description}</p>
        )}
        {formula.tags && formula.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {formula.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
