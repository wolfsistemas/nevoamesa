"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";

export function useRealtimeTable(
  table: string,
  organizationId: string | undefined,
  onChange: () => void,
) {
  useEffect(() => {
    if (!organizationId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`rt-${table}-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          onChange();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, organizationId, onChange]);
}
