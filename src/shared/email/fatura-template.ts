import "server-only";

/**
 * O e-mail da cobranca.
 *
 * Copy enxuto de proposito. O template do legado explicava em cinco paragrafos o
 * que cabe em dois: quanto, quando, e onde pagar. Quem recebe cobranca por
 * e-mail nao le — procura o valor, a data e o botao.
 *
 * Sem marca propria por enquanto, so as cores. Quem assina e a EMPRESA que
 * cobra: e o nome dela que o cliente reconhece, e um nome de sistema no meio so
 * levantaria a duvida de quem esta pedindo o dinheiro.
 *
 * HTML de e-mail nao e HTML de pagina: `<style>` no `<head>` e descartado por
 * varios clientes, entao tudo vai em `style=` na propria tag.
 */

export type DocumentoDoEmail = {
  rotulo: string;
  url: string;
};

const VERDE = "#006A28";

export function htmlDaFatura(dados: {
  empresaNome: string;
  numeroFatura: number;
  competencia: string;
  vencimento: string;
  valor: string;
  documentos: DocumentoDoEmail[];
  urlDoPortal: string;
}): string {
  /*
   * UM botao, nao um por documento.
   *
   * O link e o mesmo para todos — a pagina e que oferece nota, boleto e
   * impressao. Tres botoes identicos apontando para o mesmo lugar so fazem a
   * pessoa parar para escolher.
   */
  const rotulo = dados.documentos.length > 0 ? "Ver fatura e documentos" : "Ver fatura";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Fatura ${dados.numeroFatura}</title></head>
<body style="margin:0;padding:0;background-color:#f6f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="width:90%;max-width:560px;margin:0 auto;padding:32px 0;">
    <div style="background-color:#ffffff;border-radius:12px;border:1px solid #e5e5e5;padding:32px 24px;">

      <p style="margin:0 0 4px;font-size:13px;color:#6b6b6b;text-align:center;">${escapar(dados.empresaNome)}</p>
      <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:${VERDE};text-align:center;">
        Fatura ${dados.numeroFatura}
      </h1>

      <!-- O que a pessoa abriu o e-mail para saber. -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${linha("Referente a", dados.competencia)}
        ${linha("Vencimento", dados.vencimento)}
        ${linha("Valor", dados.valor, true)}
      </table>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${escapar(dados.urlDoPortal)}" style="display:block;max-width:280px;margin:0 auto;background-color:${VERDE};color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px;text-align:center;">${rotulo}</a>
      </div>

      <p style="margin:0;color:#6b6b6b;font-size:13px;line-height:1.6;text-align:center;">
        Na página você baixa o boleto e a nota fiscal, e pode imprimir a fatura.<br />
        Se já efetuou o pagamento, desconsidere este aviso.
      </p>
    </div>

    <p style="text-align:center;color:#9a9a9a;font-size:12px;line-height:1.6;margin:20px 0 0;">
      Mensagem destinada ao destinatário indicado e possivelmente confidencial.
      Se você a recebeu por engano, por favor apague-a.
    </p>
  </div>
</body>
</html>`;
}

/** Uma linha do quadro de valores. */
function linha(rotulo: string, valor: string, destaque = false): string {
  return `<tr>
    <td style="padding:9px 0;border-top:1px solid #f0f0f0;font-size:14px;color:#6b6b6b;">${escapar(rotulo)}</td>
    <td style="padding:9px 0;border-top:1px solid #f0f0f0;font-size:${destaque ? "18px" : "14px"};font-weight:${destaque ? "700" : "500"};color:#1a1a1a;text-align:right;">${escapar(valor)}</td>
  </tr>`;
}

/**
 * Escapa o que vem do banco.
 *
 * Nome de cliente com `&` ou `<` quebraria o HTML; e um nome escolhido por
 * terceiro nunca deveria virar marcacao dentro de um e-mail que sai em nome da
 * empresa.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
