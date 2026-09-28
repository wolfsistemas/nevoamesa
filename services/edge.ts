import { getSupabase } from "@/lib/supabase/client";

async function readErrorMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = (await (context as Response).json()) as Record<string, unknown>;
      const message = body?.error ?? body?.message;
      if (message) return String(message);
    } catch {
      // Corpo da resposta não é JSON; mantém a mensagem original.
    }
  }
  return null;
}

export async function invokeFunction<TInput extends Record<string, unknown>, TOutput>(
  name: string,
  body: TInput,
): Promise<TOutput> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await readErrorMessage(error);
    throw new Error(message || error.message || "Falha ao executar operação protegida.");
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as TOutput;
}
