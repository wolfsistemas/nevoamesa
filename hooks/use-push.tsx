"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canOperateKitchen } from "@/lib/permissions";
import { enablePushNotifications } from "@/lib/push";

export function PushPrompt() {
  const { user } = useAuth();
  const [asked, setAsked] = useState(false);

  const subscribe = useCallback(async () => {
    if (!user) return;
    try {
      await enablePushNotifications(user.organization.id, user.profile.id);
    } catch {
      // permission denied is fine
    }
  }, [user]);

  useEffect(() => {
    if (!user || asked) return;
    if (!canOperateKitchen(user.roles) && !user.roles.includes("WAITER") && !user.roles.includes("CASHIER")) {
      return;
    }
    setAsked(true);
    void subscribe();
  }, [user, asked, subscribe]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") {
        toast.info(event.data.title || "Novo aviso", { description: event.data.body });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
