import { createHash, randomInt } from "node:crypto";
import type { SaldoDoCliente } from "@/modules/atendimento/atendimento.types";

/**
 * Identificacao de quem escreve, antes de qualquer numero sair daqui.
 *
 * ⚠️ Todo texto que contem valor ou vencimento e escrito NESTE arquivo, a
 * partir de dados do banco. O modelo nunca redige numero: quando o dado nao
 * vem, ele preenche a lacuna com algo plausivel e o cliente acredita, porque a
 * mensagem chegou pelo numero oficial da empresa.
 */

/** Seis digitos. Menos que isso cai por tentativa e erro mesmo com limite. */
export function gerarCodigo(): string {
  return String(randomInt(100_000, 1_000_000));
}

/**
 * O que vai para o banco no lugar do codigo.
 *
 * A conversa entra no hash como sal: sem ela, o mesmo codigo geraria o mesmo
 * hash em toda a tabela, e quem lesse duas linhas iguais saberia que os dois
 * codigos sao iguais sem descobrir nenhum dos dois.
 */
export function hashDoCodigo(conversaId: number, codigo: string): string {
  return createHash("sha256").update(`${conversaId}:${codigo.replace(/\D/g, "")}`).digest("hex");
}

/** Só dígitos, do jeito que o banco compara. */
export function digitosDoDocumento(bruto: string): string {
  return (bruto ?? "").replace(/\D/g, "");
}

/** Documento com cara de CPF ou de CNPJ. Validade real quem confere e o cadastro. */
export function pareceDocumento(bruto: string): boolean {
  const d = digitosDoDocumento(bruto);
  return d.length === 11 || d.length === 14;
}

export function pareceCodigo(bruto: string): boolean {
  return digitosDoDocumento(bruto).length === 6;
}

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function emData(iso: string): string {
  // Fatiado em vez de `new Date`: a coluna e `date`, sem hora, e o construtor a
  // leria como meia-noite UTC — no Brasil isso vira o dia anterior.
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * O e-mail com o codigo.
 *
 * Diz de onde veio e o que fazer se nao foi a pessoa que pediu. Codigo que
 * chega sem contexto parece phishing, e quem recebe ignora.
 */
export function corpoDoEmail(codigo: string, empresa: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.55">
      <p>Alguém pediu, pelo WhatsApp, para consultar a situação financeira deste cadastro.</p>
      <p style="margin: 24px 0">
        <span style="font-size: 30px; font-weight: 700; letter-spacing: 6px">${codigo}</span>
      </p>
      <p>O código vale por 10 minutos.</p>
      <p style="color: #666">
        Se não foi você, ignore este e-mail e avise ${empresa}. Sem o código,
        ninguém consegue ver nada da sua conta.
      </p>
    </div>
  `;
}

/**
 * A resposta sobre a conta, montada com o que veio do banco.
 *
 * Totais e datas, nunca a lista de titulos e nunca meio de pagamento. Quem quer
 * pagar precisa de boleto, e boleto por WhatsApp e o formato exato do golpe do
 * boleto trocado: a pessoa recebe um numero pelo mesmo canal e paga sem
 * conferir. Para isso a conversa vai para o financeiro.
 */
export function textoDoSaldo(s: SaldoDoCliente): string {
  if (s.emAberto <= 0) {
    return "Consultei aqui e não há nada em aberto no seu cadastro. Se você recebeu alguma cobrança, me avisa que eu chamo o financeiro.";
  }

  const partes = [`Você tem ${REAIS.format(s.emAberto)} em aberto`];

  if (s.vencidas > 0) {
    partes.push(
      s.vencidas === 1
        ? ", sendo 1 parcela já vencida"
        : `, sendo ${s.vencidas} parcelas já vencidas`,
    );
  }

  partes.push(".");

  if (s.proximoVencimento) {
    const valor = s.valorDoProximo ? ` de ${REAIS.format(s.valorDoProximo)}` : "";
    partes.push(` O próximo vencimento${valor} é em ${emData(s.proximoVencimento)}.`);
  }

  partes.push(" Se precisar da segunda via para pagar, me diz que eu passo para o financeiro.");

  return partes.join("");
}
