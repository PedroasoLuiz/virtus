import type { DataISO } from "@/shared/utils/datas";

/**
 * Leitura de extrato bancario em OFX.
 *
 * ⚠️ OFX, e nao CSV. Cresol, Sicoob, Sicredi, Bradesco, Banco do Brasil, Itau e
 * Cora exportam OFX, e e UM parser para todos. CSV exigiria um layout por banco,
 * e eles mudam sem avisar — o dia em que o Sicoob acrescenta uma coluna, a
 * importacao daquele banco quebra sozinha e ninguem descobre ate alguem
 * conciliar errado.
 *
 * ⚠️ E e o formato que a base JA TEM. Os 99 lancamentos importados em 2025
 * guardam `descricao` como "DEBIT"/"CREDIT", que e o `TRNTYPE` do OFX, e `nome`
 * com o conteudo do `MEMO`. Importar em outro formato criaria duas geracoes de
 * linha na mesma tabela.
 *
 * ⚠️ O arquivo NAO e XML, e nao adianta tentar um parser de XML nele.
 *
 * OFX 1.x e SGML: as tags quase nunca fecham, e o valor vai do fim da tag ate a
 * quebra de linha. `<TRNAMT>-22.00` e uma linha inteira e valida. Por isso a
 * leitura aqui e por varredura de texto, que atravessa tanto o SGML antigo
 * quanto o OFX 2.x, que ja e XML de verdade.
 */

export type LancamentoOfx = {
  /** `DEBIT`, `CREDIT`, `PIX`, `XFER`... como o banco escreveu. */
  tipo: string;
  data: DataISO;
  /**
   * Em centavos, com SINAL: negativo saiu da conta.
   *
   * ⚠️ O sinal vem do `TRNAMT` e nao do `TRNTYPE`. Ha banco que manda
   * `TRNTYPE=DEBIT` com valor positivo e banco que manda o tipo generico
   * `OTHER` com o sinal certo. O numero e a fonte confiavel; o tipo e rotulo.
   */
  valor: number;
  /** O historico. Vem de `MEMO`, e cai para `NAME` quando o banco so manda ele. */
  nome: string;
  /** Identificador do banco para a transacao. Nem todo banco manda. */
  fitid: string | null;
};

export type ExtratoOfx = {
  /** Numero da conta declarado no arquivo, quando ha. */
  conta: string | null;
  lancamentos: LancamentoOfx[];
};

/**
 * O que ha dentro de uma tag, tolerando as duas gramaticas.
 *
 * Pega tanto `<MEMO>texto` (SGML, sem fechar) quanto `<MEMO>texto</MEMO>`
 * (XML), cortando no primeiro `<` ou na quebra de linha.
 */
function valorDaTag(bloco: string, tag: string): string | null {
  const achado = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(bloco);
  return achado ? achado[1].trim() || null : null;
}

/**
 * A data do OFX vira `AAAA-MM-DD`.
 *
 * ⚠️ Corta nos oito primeiros digitos e IGNORA hora e fuso.
 *
 * O campo vem como `20251216120000[-3:BRT]`. Convertendo com `Date`, um
 * lancamento gravado a meia-noite no fuso do banco vira o dia anterior no fuso
 * de quem importa — e o extrato passa a divergir do papel em um dia, no comeco
 * e no fim de todo mes. O banco ja disse a data dele; ela nao se recalcula.
 */
function dataDoOfx(bruto: string): DataISO | null {
  const digitos = bruto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length !== 8) return null;

  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6, 8)}` as DataISO;
}

/**
 * O valor do OFX em centavos.
 *
 * ⚠️ Vem por TEXTO e nunca por `parseFloat` direto. O separador decimal muda de
 * banco para banco — `-22.00` e `-22,00` aparecem os dois —, e `parseFloat`
 * lendo "1.234,56" devolve 1.234, que e mil vezes menos. A conversao aqui olha
 * qual dos dois sinais e o ultimo, que e sempre o decimal.
 */
function valorDoOfx(bruto: string): number | null {
  const limpo = bruto.replace(/\s/g, "");
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");

  const decimal = Math.max(ultimaVirgula, ultimoPonto);
  const semSeparadorDeMilhar =
    decimal === -1
      ? limpo
      : `${limpo.slice(0, decimal).replace(/[.,]/g, "")}.${limpo.slice(decimal + 1)}`;

  const numero = Number(semSeparadorDeMilhar);
  if (!Number.isFinite(numero)) return null;

  return Math.round(numero * 100);
}

/**
 * A linha e um SALDO, e nao um lancamento.
 *
 * ⚠️ Varios bancos mandam "SALDO ANTERIOR", "SALDO DO DIA" e "SALDO BLOQUEADO"
 * dentro do bloco de transacoes, com o valor do saldo. Importadas, elas viram
 * lancamentos que nunca vao achar par no sistema — porque nao sao dinheiro que
 * se moveu, sao o retrato de um instante — e ficam para sempre na pilha do que
 * falta conciliar, dizendo que o trabalho nao acabou.
 *
 * A comparacao e por INICIO do texto: "SALDO ANTERIOR" e saldo, mas um
 * pagamento para "SALDO COMERCIO DE PECAS" nao e.
 */
function ehSaldo(nome: string): boolean {
  return /^\s*s\s*a\s*l\s*d\s*o\b/i.test(
    nome.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  );
}

export function lerOfx(conteudo: string): ExtratoOfx {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];

  const lancamentos = blocos
    .map((bloco): LancamentoOfx | null => {
      const data = dataDoOfx(valorDaTag(bloco, "DTPOSTED") ?? "");
      const valor = valorDoOfx(valorDaTag(bloco, "TRNAMT") ?? "");
      if (!data || valor == null) return null;

      return {
        tipo: (valorDaTag(bloco, "TRNTYPE") ?? "OTHER").toUpperCase(),
        data,
        valor,
        // `MEMO` primeiro: e onde vai o historico util. `NAME` costuma trazer so
        // o nome curto da contraparte, e ha banco que preenche so um dos dois.
        nome: valorDaTag(bloco, "MEMO") ?? valorDaTag(bloco, "NAME") ?? "",
        fitid: valorDaTag(bloco, "FITID"),
      };
    })
    .filter((l): l is LancamentoOfx => l !== null)
    // Valor zero nao move saldo e nao tem o que conciliar.
    .filter((l) => l.valor !== 0)
    .filter((l) => !ehSaldo(l.nome));

  return { conta: valorDaTag(conteudo, "ACCTID"), lancamentos };
}

/**
 * O texto do arquivo, respeitando o charset que ele declara.
 *
 * ⚠️ OFX brasileiro quase sempre vem em cp1252, e nao em UTF-8. Lido como UTF-8,
 * "JOSÉ" chega como "JOSé" — e o nome sujo entra no banco, aparece na tela e
 * ainda atrapalha o casamento por nome. O cabecalho do proprio arquivo diz qual
 * e; quando nao diz, cp1252 e o palpite certo para o Brasil.
 */
export function textoDoOfx(bytes: ArrayBuffer): string {
  const inicio = new TextDecoder("ascii").decode(bytes.slice(0, 512));
  const utf8 = /CHARSET:\s*(UTF-8|UNICODE)/i.test(inicio) || /encoding="UTF-8"/i.test(inicio);

  return new TextDecoder(utf8 ? "utf-8" : "windows-1252").decode(bytes);
}
