import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/marketing/public-header";
import { APP_NAME } from "@/lib/constants";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-sm leading-7 text-muted-foreground">
        <h1 className="text-3xl font-bold text-foreground">Política de Privacidade (LGPD)</h1>
        <p>Versão 2026-09. Esta política descreve como o {APP_NAME} trata dados pessoais.</p>
        <h2 className="text-lg font-semibold text-foreground">1. Controlador</h2>
        <p>
          Cada restaurante é controlador dos dados de seus clientes, colaboradores e operação. A
          plataforma atua como operadora da infraestrutura (Supabase: autenticação, banco e functions).
        </p>
        <h2 className="text-lg font-semibold text-foreground">2. Dados coletados</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cadastro: nome, e-mail, telefone, CNPJ do restaurante.</li>
          <li>Operação: pedidos, mesas, pagamentos, estoque e logs de auditoria.</li>
          <li>Técnicos: sessão, IP no aceite legal e inscrição de push (endpoint Web Push).</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">3. Finalidades</h2>
        <p>
          Prestação do SaaS, autenticação, cobrança de assinatura, notificações de cozinha,
          segurança, suporte e cumprimento de obrigações legais.
        </p>
        <h2 className="text-lg font-semibold text-foreground">4. Base legal</h2>
        <p>
          Execução de contrato, legítimo interesse operacional e consentimento no cadastro
          (termos e privacidade). O aceite é registrado com versão e data.
        </p>
        <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento</h2>
        <p>
          Dados podem ser processados por Supabase e, quando a assinatura estiver ativa, pelo
          Mercado Pago. Não vendemos dados pessoais.
        </p>
        <h2 className="text-lg font-semibold text-foreground">6. Direitos do titular</h2>
        <p>
          Acesso, correção, exclusão, portabilidade e revogação de consentimento podem ser
          solicitados ao OWNER da organização. O OWNER pode encerrar a conta e cancelar a assinatura
          no painel.
        </p>
        <h2 className="text-lg font-semibold text-foreground">7. Retenção e segurança</h2>
        <p>
          Dados operacionais permanecem enquanto a organização existir. RLS isola restaurantes.
          Senhas são geridas pelo Auth do Supabase. A service role nunca é exposta no frontend.
        </p>
        <p>
          <Link href="/termos/" className="text-primary hover:underline">
            Ver Termos de Uso
          </Link>
        </p>
      </article>
      <PublicFooter />
    </div>
  );
}
