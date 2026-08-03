import { notFound } from "next/navigation";
import { cobrancaPorToken } from "@/modules/publico/publico.repository";
import { CobrancaPublicaView } from "./cobranca-publica";

/**
 * A página que o cliente abre pelo link da cobrança.
 *
 * Fora de `(app)`: não tem menu, não tem sessão, não tem empresa ativa. Quem
 * chega aqui não é usuário do sistema — é quem recebeu uma cobrança.
 *
 * Sem marca própria por enquanto, só as cores: a identidade visual entra depois,
 * e um nome provisório num documento que vai ao cliente é pior que nenhum.
 */

export const metadata = { title: "Sua cobrança" };

/** Nunca em cache: o link é revogável, e cache serviria a página depois disso. */
export const dynamic = "force-dynamic";

export default async function CobrancaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cobranca = await cobrancaPorToken(token).catch(() => null);

  // 404 e não uma tela de erro: quem tem link inválido não precisa saber se o
  // token existiu um dia.
  if (!cobranca) notFound();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f7f6",
        padding: "32px 16px 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <CobrancaPublicaView cobranca={cobranca} token={token} />
    </main>
  );
}
