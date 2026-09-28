import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/marketing/public-header";
import { APP_NAME } from "@/lib/constants";

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-sm leading-7 text-muted-foreground">
        <h1 className="text-3xl font-bold text-foreground">Termos de Uso</h1>
        <p>Versão 2026-09. Estes termos regulam o uso do {APP_NAME} (NevoaMesa).</p>
        <h2 className="text-lg font-semibold text-foreground">1. Conta e organização</h2>
        <p>
          Ao criar uma conta, você registra um restaurante (organização) e torna-se o proprietário (OWNER).
          Você é responsável pelos usuários, pedidos, pagamentos e dados lançados no sistema.
        </p>
        <h2 className="text-lg font-semibold text-foreground">2. Planos e assinatura</h2>
        <p>
          O plano Free é gratuito. Planos pagos podem iniciar em trial de 14 dias. A cobrança recorrente
          é pré-vinculada ao Mercado Pago Assinatura e só é efetivada quando as credenciais do provedor
          estiverem configuradas. O cancelamento pode ser feito a qualquer momento em Admin &gt; Assinatura.
        </p>
        <h2 className="text-lg font-semibold text-foreground">3. Uso aceitável</h2>
        <p>
          O sistema destina-se à operação interna de restaurantes. É proibido usar a plataforma para
          atividades ilícitas, tentativa de acesso a outras organizações ou extração indevida de dados.
        </p>
        <h2 className="text-lg font-semibold text-foreground">4. Disponibilidade</h2>
        <p>
          Empregamos esforços razoáveis para manter o serviço disponível, sem garantia de
          disponibilidade ininterrupta. Backups e auditoria fazem parte da operação.
        </p>
        <h2 className="text-lg font-semibold text-foreground">5. Contato</h2>
        <p>
          Dúvidas: use o e-mail do proprietário cadastrado ou o canal de suporte informado no painel.
        </p>
        <p>
          <Link href="/privacidade/" className="text-primary hover:underline">
            Ver Política de Privacidade
          </Link>
        </p>
      </article>
      <PublicFooter />
    </div>
  );
}
