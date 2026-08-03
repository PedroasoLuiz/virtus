import { arquivoPorToken } from "@/modules/publico/publico.repository";

/**
 * /p/{token}/documento?tipo=nfs|boleto — download sem login.
 *
 * Fora de `/api/v1` e sem o `handler`: aquele exige sessão e devolve o envelope
 * JSON padrão. Aqui quem chega é o cliente, com um link, e o que sai é um
 * arquivo.
 *
 * A rota TRANSMITE o conteúdo em vez de redirecionar para o Storage — assim o
 * caminho interno nunca chega ao navegador, e o único endereço que circula é o
 * que demos, que dá para revogar.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const tipo = new URL(req.url).searchParams.get("tipo");

  if (tipo !== "nfs" && tipo !== "boleto") {
    return new Response("Documento inválido", { status: 400 });
  }

  const arquivo = await arquivoPorToken(token, tipo);
  // 404 e não 403: dizer "proibido" confirmaria que o token existe.
  if (!arquivo) return new Response("Documento não encontrado", { status: 404 });

  return new Response(arquivo.conteudo, {
    headers: {
      "Content-Type": arquivo.conteudo.type || "application/pdf",
      "Content-Disposition": `attachment; filename="${arquivo.nome}"`,
      // Nunca em cache compartilhado: é documento de um cliente só.
      "Cache-Control": "private, no-store",
    },
  });
}
