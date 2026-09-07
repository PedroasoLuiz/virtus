import { notFound } from "next/navigation";
import { cobrancaPorToken, tokenLimpo } from "@/modules/publico/publico.repository";
import { TicketPublicoView } from "./ticket-publico";

/**
 * A folha de um ticket da conta, aberta pelo número na composição.
 *
 * ⚠️ Mesmo token da conta. A autorização é a mesma — quem tem o link da parcela
 * pode ver de onde o valor dela veio —, e o ticket precisa estar NESTA conta:
 * um número de outra conta cai em 404, e não numa folha que o token não cobre.
 */

export const metadata = { title: "Serviço da cobrança" };

/** Nunca em cache: o link é revogável, e cache serviria a página depois disso. */
export const dynamic = "force-dynamic";

export default async function TicketDaCobrancaPage({
  params,
}: {
  params: Promise<{ token: string; numero: string }>;
}) {
  const { token, numero } = await params;
  const cobranca = await cobrancaPorToken(token).catch(() => null);
  const limpo = tokenLimpo(token);

  // 404 e não uma tela de erro: quem tem link inválido não precisa saber se o
  // token existiu um dia.
  if (!cobranca) notFound();

  const ticket = cobranca.tickets.find((t) => String(t.numero) === numero);
  if (!ticket) notFound();

  return (
    <main
      style={{
        minHeight: "100vh",
        // Cinza do visualizador, nao do documento: a folha e branca, e o fundo
        // escuro em volta e o que faz ela parecer papel.
        background: "#e8eae8",
        padding: "20px 10px 32px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <TicketPublicoView
        ticket={ticket}
        empresa={cobranca.empresa}
        conta={cobranca.conta.numero}
        token={limpo}
      />
    </main>
  );
}
