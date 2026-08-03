import "server-only";

/**
 * O e-mail da parcela.
 *
 * Reproduz o template do legado — mesmo verde (`#006A28`, que e o `--primary`
 * do app), mesma estrutura, mesmos avisos. O cliente ja reconhece este e-mail; a
 * migracao nao e a hora de reeducar quem paga.
 *
 * HTML de e-mail nao e HTML de pagina: `<style>` no `<head>` e descartado por
 * varios clientes, entao o essencial vai em `style=` na propria tag. E tabela no
 * lugar de flex/grid, que o Outlook ignora.
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
  const botoes = dados.documentos
    .map(
      (d) => `
      <a href="${escapar(d.url)}" style="display:block;width:80%;max-width:300px;margin:10px auto;background-color:${VERDE};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">${escapar(d.rotulo)}</a>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Documentos disponíveis</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="width:90%;max-width:640px;margin:0 auto;padding:40px 0;">
    <div style="background-color:#ffffff;border-radius:12px;border:1px solid #e5e5e5;box-shadow:0 4px 12px rgba(0,0,0,0.05);padding:32px 16px;">

      <h2 style="color:${VERDE};font-size:20px;font-weight:700;text-align:center;margin:0 0 8px;">Seu fechamento já está disponível!</h2>

      <div style="text-align:center;color:#6b6b6b;font-size:15px;margin-bottom:8px;">
        Referente ao fechamento: <strong style="color:#1f1f1f;">${escapar(dados.competencia)}</strong>
      </div>
      <div style="text-align:center;color:${VERDE};font-size:15px;font-weight:600;margin-bottom:24px;">${escapar(dados.empresaNome)}</div>

      <p style="color:#444444;font-size:15px;line-height:1.6;margin-bottom:16px;text-align:center;">
        Encaminhamos abaixo os documentos referentes à <b>Fatura ${dados.numeroFatura}</b> apurada no período informado.
        Clique nos botões para visualizar ou baixar.
      </p>

      <div style="text-align:center;margin:24px 0 32px 0;">${botoes}</div>

      <p style="color:#444444;font-size:15px;line-height:1.6;margin-bottom:16px;text-align:center;">
        Vencimento em <strong style="color:#1f1f1f;">${escapar(dados.vencimento)}</strong>, no valor de
        <strong style="color:#1f1f1f;">${escapar(dados.valor)}</strong>.
      </p>

      <p style="color:#444444;font-size:15px;line-height:1.6;margin-bottom:16px;text-align:center;">
        Pedimos a gentileza de efetuar o pagamento até a data de vencimento indicada.<br />
        Caso já tenha realizado o pagamento, favor desconsiderar esta mensagem.
      </p>

      <p style="color:#444444;font-size:15px;line-height:1.6;margin-bottom:16px;text-align:center;">
        <strong style="color:#1f1f1f;">Importante:</strong> O não pagamento até a data de vencimento pode gerar encargos adicionais.
      </p>

      <p style="color:#444444;font-size:15px;line-height:1.6;margin-bottom:16px;text-align:center;">
        Em caso de dúvidas, entre em contato com o nosso time financeiro.
      </p>

      <p style="color:#444444;font-size:15px;line-height:1.6;margin-bottom:0;text-align:center;">
        Você acompanha todos estes documentos, os pagamentos e as parcelas pendentes em:<br />
        <a href="${escapar(dados.urlDoPortal)}" style="color:${VERDE};text-decoration:none;">${escapar(semProtocolo(dados.urlDoPortal))}</a>
      </p>
    </div>

    <div style="text-align:center;padding:28px 16px;">
      <p style="color:#7a7a7a;font-size:13px;line-height:1.6;margin:4px 0;"><strong>V-Pay, o seu gerenciador financeiro</strong></p>
      <p style="color:#7a7a7a;font-size:13px;line-height:1.6;margin:4px 0;">
        Este e-mail e seus anexos são destinados exclusivamente ao uso do destinatário e podem conter
        informações confidenciais. Caso não seja o destinatário pretendido, apague esta mensagem
        imediatamente. Preserve o meio ambiente: evite imprimir este e-mail sempre que possível.
      </p>
    </div>
  </div>
</body>
</html>`;
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

function semProtocolo(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
