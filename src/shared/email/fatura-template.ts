import "server-only";

/**
 * O e-mail da cobranca.
 *
 * ⚠️ A referencia e o TICKET, nao a fatura. A fatura e controle interno —
 * numero de conta a receber, parcelamento, baixa. Mandar esse numero ao cliente
 * o obriga a decorar uma referencia que so existe do nosso lado; o ticket ele
 * conhece, porque e o servico que contratou.
 *
 * Sem marca propria por enquanto, so as cores. Quem assina e a EMPRESA que
 * cobra: e o nome dela que o cliente reconhece, e um nome de sistema no meio so
 * levantaria a duvida de quem esta pedindo o dinheiro.
 *
 * HTML de e-mail nao e HTML de pagina: `<style>` no `<head>` e descartado por
 * varios clientes, entao tudo vai em `style=` na propria tag, e a estrutura e
 * feita com `<table>` — flex e grid o Outlook ignora.
 */

const VERDE = "#006A28";
const VERDE_CLARO = "#eef7f0";

export function htmlDaFatura(dados: {
  empresaNome: string;
  /** Os tickets desta cobranca. E a referencia que o cliente reconhece. */
  tickets: number[];
  clienteNome: string | null;
  competencia: string;
  vencimento: string;
  valor: string;
  parcela: string | null;
  urlDoPortal: string;
}): string {
  const referencia =
    dados.tickets.length === 0
      ? null
      : dados.tickets.length === 1
        ? `Ticket ${dados.tickets[0]}`
        : `Tickets ${dados.tickets.join(", ")}`;

  const saudacao = dados.clienteNome
    ? `Olá, ${escapar(primeiroNome(dados.clienteNome))}.`
    : "Olá.";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapar(referencia ?? "Cobrança")}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f4f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
  <!-- Tabela externa: e o que centraliza em cliente que ignora margin:auto. -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f4;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <!-- O cartao ocupa a largura toda ate 600px e para de crescer: linha
             comprida demais cansa, e no celular ele encosta nas bordas. -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e3e6e3;">

          <!-- Faixa da empresa -->
          <tr>
            <td style="padding:26px 32px 0;text-align:center;">
              <div style="font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#8a8a8a;">
                ${escapar(dados.empresaNome)}
              </div>
              <div style="height:3px;width:44px;background-color:${VERDE};border-radius:2px;margin:14px auto 0;"></div>
            </td>
          </tr>

          <!-- Assunto -->
          <tr>
            <td style="padding:22px 32px 0;text-align:center;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:#1a1a1a;">
                ${referencia ? `Sua cobrança do ${escapar(referencia.toLowerCase())}` : "Sua cobrança"}
              </h1>
              ${
                dados.competencia !== "—"
                  ? `<p style="margin:6px 0 0;font-size:14px;color:#6b6b6b;">Referente a ${escapar(dados.competencia)}</p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Texto -->
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0;font-size:15px;line-height:1.65;color:#444444;">
                ${saudacao} Seu fechamento já está disponível. Abaixo estão os dados da
                cobrança — na página você confere o detalhamento do serviço, baixa o boleto
                e a nota fiscal, e pode imprimir o documento.
              </p>
            </td>
          </tr>

          <!-- Quadro de valores -->
          <tr>
            <td style="padding:22px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${VERDE_CLARO};border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${referencia ? linha("Referência", referencia) : ""}
                      ${dados.parcela ? linha("Parcela", dados.parcela) : ""}
                      ${linha("Vencimento", dados.vencimento)}
                      ${linha("Valor", dados.valor, true)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ação -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${VERDE};">
                    <a href="${escapar(dados.urlDoPortal)}" style="display:block;padding:15px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Ver cobrança e documentos
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:#8a8a8a;text-align:center;line-height:1.5;">
                O link é pessoal — evite encaminhá-lo.
              </p>
            </td>
          </tr>

          <!-- Fecho -->
          <tr>
            <td style="padding:22px 32px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.65;color:#6b6b6b;border-top:1px solid #eeeeee;padding-top:18px;">
                Se o pagamento já foi feito, desconsidere este aviso. Qualquer dúvida sobre
                valores ou prazos, é só responder a este e-mail.
              </p>
            </td>
          </tr>
        </table>

        <p style="max-width:600px;margin:18px auto 0;font-size:11px;line-height:1.6;color:#a0a0a0;text-align:center;">
          Mensagem destinada ao destinatário indicado e possivelmente confidencial.
          Se você a recebeu por engano, por favor apague-a.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Uma linha do quadro de valores. */
function linha(rotulo: string, valor: string, destaque = false): string {
  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:#5b6b5e;">${escapar(rotulo)}</td>
    <td style="padding:6px 0;font-size:${destaque ? "20px" : "14px"};font-weight:${destaque ? "700" : "600"};color:${destaque ? VERDE : "#1a1a1a"};text-align:right;">${escapar(valor)}</td>
  </tr>`;
}

/**
 * Primeiro nome, nao a razao social inteira.
 *
 * "Olá, COMERCIO DE MATERIAIS ELETRICOS LTDA" nao cumprimenta ninguem.
 */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
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
