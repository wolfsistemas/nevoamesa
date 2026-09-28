"use client";

import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

export function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary"
    >
      <div>
        <div className="font-medium">{product.name}</div>
        <div className="text-xs text-muted-foreground">{product.description}</div>
        <div className="mt-1 text-sm font-semibold text-primary">{formatCurrency(product.price)}</div>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Plus className="h-4 w-4" />
      </span>
    </button>
  );
}
