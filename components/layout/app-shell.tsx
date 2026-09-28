"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  Wallet,
  Settings,
  LogOut,
  Moon,
  Sun,
  WifiOff,
  Menu,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useOnline } from "@/hooks/use-online";
import { PushPrompt } from "@/hooks/use-push";
import { APP_NAME, ROLE_LABEL } from "@/lib/constants";
import { canOperateCash, canOperateKitchen, canOperateWaiter, canViewReports } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, check: canViewReports },
  { href: "/garcom", label: "Garçom", icon: UtensilsCrossed, check: canOperateWaiter },
  { href: "/cozinha", label: "Cozinha", icon: ChefHat, check: canOperateKitchen },
  { href: "/caixa", label: "Caixa", icon: Wallet, check: canOperateCash },
  { href: "/admin/produtos", label: "Admin", icon: Settings, check: canViewReports },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/admin/produtos") return pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const online = useOnline();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const prevOnline = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevOnline.current === null) {
      prevOnline.current = online;
      return;
    }
    if (prevOnline.current === online) return;
    prevOnline.current = online;
    if (!online) toast.warning("Você está offline.");
    else toast.success("Conexão restaurada.");
  }, [online]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login/");
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login/");
  }, [loading, user, router]);

  const items = useMemo(
    () => (user ? NAV.filter((item) => item.check(user.roles)) : []),
    [user],
  );

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        Carregando RestaurantOS...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {!online ? (
        <div className="flex items-center justify-center gap-2 bg-danger px-3 py-2 text-sm text-white">
          <WifiOff className="h-4 w-4" /> Você está offline.
        </div>
      ) : null}
      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-4 lg:flex lg:flex-col">
          <div className="mb-8 px-2">
            <div className="text-lg font-bold tracking-tight text-primary">{APP_NAME}</div>
            <div className="text-xs text-muted-foreground">{user.organization.name}</div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <div className="px-2 text-sm">
              <div className="font-medium">{user.profile.full_name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.profile.primary_role]}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="text-sm font-semibold">{APP_NAME}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu do usuário">
                  <UserRound className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <div className="text-sm font-medium">{user.profile.full_name}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.profile.primary_role]}</div>
                </div>
                <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {theme === "dark" ? "Tema claro" : "Tema escuro"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          {open ? (
            <div className="border-b border-border bg-surface p-3 lg:hidden">
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-accent px-3 py-2 text-sm"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <Button variant="outline" className="mt-2 w-full" onClick={() => void handleSignOut()}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          ) : null}
          <main className="flex-1 p-4 pb-28 lg:p-6">{children}</main>
          <PushPrompt />
          <nav
            className="fixed bottom-0 left-0 right-0 z-30 grid border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
            style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[11px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
