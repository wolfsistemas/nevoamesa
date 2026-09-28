import { getSupabase } from "@/lib/supabase/client";

export async function invokeFunction<TInput extends Record<string, unknown>, TOutput>(
  name: string,
  body: TInput,
): Promise<TOutput> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new Error(error.message || "Falha ao executar operação protegida.");
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as TOutput;
}
