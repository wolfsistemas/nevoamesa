import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rwtvrxyfmwioyncrluvn.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3dHZyeHlmbXdpb3luY3JsdXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDA5NTQsImV4cCI6MjEwNjE3Njk1NH0._1jn103xP8WikvMvjjAOuLta4zoItSMIn1H0lgwTr0Q";

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "restaurantos-auth",
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }

  return browserClient;
}
