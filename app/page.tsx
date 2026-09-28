"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { loading, user, homePath } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? `${homePath}/` : "/login/");
  }, [loading, user, homePath, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      Abrindo RestaurantOS...
    </div>
  );
}
