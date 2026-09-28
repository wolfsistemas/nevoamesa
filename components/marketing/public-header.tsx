"use client";

import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-primary">
          {APP_NAME}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <Link href="/termos/">Termos</Link>
          <Link href="/privacidade/">Privacidade</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login/">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup/">Começar grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          {APP_NAME} — operação de salão, cozinha e caixa em tempo real.
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href="/termos/" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link href="/privacidade/" className="hover:text-foreground">
            Política de Privacidade
          </Link>
          <Link href="/login/" className="hover:text-foreground">
            Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
