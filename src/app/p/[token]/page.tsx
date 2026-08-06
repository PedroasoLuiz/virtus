import { notFound } from "next/navigation";
import { cobrancaPorToken, tokenLimpo } from "@/modules/publico/publico.repository";
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

  /*
   * Os links de dentro da pagina saem do token LIMPO.
   *
   * Chegando torto, o de fora ja e o que e; propagar o defeito para o download
   * do boleto faria a sujeira se multiplicar a cada clique, em vez de parar na
   * porta de entrada.
   */
  const limpo = tokenLimpo(token);

  // 404 e não uma tela de erro: quem tem link inválido não precisa saber se o
  // token existiu um dia.
  if (!cobranca) notFound();

  return (
    <main
      style={{
        minHeight: "100vh",
        // Cinza do visualizador, nao do documento: a folha e branca, e o fundo
        // escuro em volta e o que faz ela parecer papel.
        background: "#e8eae8",
        // Padding pequeno no celular: a folha ja e estreita, e margem de 16px
        // de cada lado tira 32px de uma largura que faz falta.
        padding: "20px 10px 32px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <CobrancaPublicaView cobranca={cobranca} token={limpo} />
    </main>
  );
}
