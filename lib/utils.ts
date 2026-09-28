import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value || 0);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function minutesSince(value?: string | Date | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

export function elapsedLabel(value?: string | Date | null) {
  const minutes = minutesSince(value);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min`;
}

export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const raw = row[header];
          const value = raw == null ? "" : String(raw).replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(";"),
    ),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function friendlyError(error: unknown, fallback = "Não foi possível concluir a operação.") {
  if (!error) return fallback;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "";
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("rls") || lower.includes("not authorized")) {
    return "Você não possui permissão para esta ação.";
  }
  if (lower.includes("jwt") || lower.includes("auth")) {
    return "Sessão expirada. Entre novamente.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Não foi possível conectar ao servidor.";
  }
  if (lower.includes("already") || lower.includes("finaliz")) {
    return "Este pedido já foi finalizado.";
  }
  if (message && message.length < 140 && !lower.includes("postgres") && !lower.includes("sql")) {
    return message;
  }
  return fallback;
}

export function generateRequestId() {
  return crypto.randomUUID();
}
