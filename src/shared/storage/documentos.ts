import "server-only";
import { serverClient } from "@/infra/supabase/client";
import { AppError } from "@/shared/errors/app-error";

/**
 * Arquivos do cliente — nota fiscal, boleto.
 *
 * Bucket `documentos`, PRIVADO. O legado guardava tudo em `virtusmind`, publico:
 * qualquer URL abria sem login e o caminho era adivinhavel. Nota fiscal tras
 * CNPJ, endereco e valor; boleto tras a linha digitavel.
 *
 * O acesso passa a ser por URL assinada, com validade, gerada para quem ja
 * provou ter permissao. Toda operacao roda sob o token do usuario — a policy do
 * Storage confere a empresa pelo PRIMEIRO segmento do caminho.
 */

/** Quanto tempo o link vive. */
const VALIDADE_SEGUNDOS = 60 * 60;

/**
 * Uma hora e o suficiente para abrir, conferir e baixar; nao e o suficiente para
 * o link virar um endereco permanente circulando por ai. O e-mail ao cliente
 * leva um link novo a cada envio.
 */

const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

/**
 * `empresa/{id}/...` — a primeira pasta e o tenant, e e ela que a policy confere.
 *
 * O legado usava o NOME do cliente no caminho. Nome muda quando alguem corrige o
 * cadastro, e o arquivo antigo vira orfao num caminho que ninguem mais monta
 * igual.
 */
export function caminhoDoDocumento(
  empresaId: number,
  faturaId: number,
  tipo: "nfs" | "boleto" | "comprovante" | "anexo",
  nomeOriginal: string,
): string {
  const extensao = (nomeOriginal.split(".").pop() ?? "pdf").toLowerCase().slice(0, 5);

  /*
   * O nome do arquivo e um UUID, nao a hora do envio.
   *
   * O legado usava timestamp: `1783387484074000.pdf`. Num bucket que a pagina
   * publica precisa poder ler, timestamp e adivinhavel — varrer alguns milhoes
   * de milissegundos e barato. Com UUID o proprio CAMINHO vira segredo, e so
   * chega ao arquivo quem recebeu o link.
   */
  return `empresa/${empresaId}/faturas/${faturaId}/${tipo}/${crypto.randomUUID()}.${extensao}`;
}

export async function enviarDocumento(caminho: string, arquivo: File): Promise<void> {
  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new AppError("VALIDATION_ERROR", 422, "Arquivo maior que 20 MB");
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new AppError("VALIDATION_ERROR", 422, "Envie um PDF ou uma imagem");
  }

  const supabase = await serverClient();
  const { error } = await supabase.storage.from("documentos").upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
  });

  if (error) throw error;
}

/**
 * Link temporario para um documento.
 *
 * ⚠️ Aceita os dois formatos. O que foi gravado pelo legado e uma URL publica
 * inteira (`https://.../virtusmind/...`) e continua funcionando como esta —
 * reescrever essas linhas invalidaria links ja enviados a clientes. O que este
 * codigo grava e um CAMINHO, e so ele e assinado.
 */
export async function urlDoDocumento(referencia: string): Promise<string> {
  if (referencia.startsWith("http")) return referencia;

  const supabase = await serverClient();
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(referencia, VALIDADE_SEGUNDOS);

  if (error) throw error;
  return data.signedUrl;
}

export async function apagarDocumento(referencia: string): Promise<void> {
  // Arquivo do legado nao e apagado daqui: ele vive em outro bucket, e o link
  // pode estar num e-mail que o cliente ainda vai abrir.
  if (referencia.startsWith("http")) return;

  const supabase = await serverClient();
  const { error } = await supabase.storage.from("documentos").remove([referencia]);
  if (error) throw error;
}
