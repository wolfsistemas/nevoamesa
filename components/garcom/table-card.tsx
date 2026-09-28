"use client";

import { TABLE_STATUS_CLASS, TABLE_STATUS_LABEL } from "@/lib/constants";
import { elapsedLabel, formatCurrency } from "@/lib/utils";
import type { Attendance, DiningTable } from "@/types";

export function TableCard({
  table,
  attendance,
  onClick,
}: {
  table: DiningTable;
  attendance?: Attendance | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[132px] flex-col justify-between rounded-xl border p-4 text-left transition hover:scale-[1.01] ${TABLE_STATUS_CLASS[table.status]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-80">Mesa</div>
          <div className="text-2xl font-bold">{table.number}</div>
        </div>
        <span className="rounded-full bg-black/20 px-2 py-1 text-[11px] font-semibold">
          {TABLE_STATUS_LABEL[table.status]}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="font-semibold">
          {attendance ? formatCurrency(attendance.total || attendance.subtotal) : "R$ 0,00"}
        </div>
        <div className="opacity-80">
          {attendance ? elapsedLabel(attendance.opened_at) : "Disponível"}
        </div>
        <div className="truncate text-xs opacity-70">{attendance?.waiter?.full_name ?? "Sem garçom"}</div>
      </div>
    </button>
  );
}
