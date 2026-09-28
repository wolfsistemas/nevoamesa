"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/adicionais", label: "Adicionais" },
  { href: "/admin/mesas", label: "Mesas" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/estoque", label: "Estoque" },
  { href: "/admin/caixas", label: "Caixas" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/vendas", label: "Vendas" },
  { href: "/admin/relatorios", label: "Relatórios" },
  { href: "/admin/configuracoes", label: "Configurações" },
  { href: "/admin/assinatura", label: "Assinatura" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm",
            pathname.startsWith(link.href)
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
