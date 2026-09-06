import type { DataISO } from "@/shared/utils/datas";

/**
 * Quem casa com quem entre a linha do banco e o lancamento do sistema.
 *
 * ⚠️ Funcao PURA, e por isso ela mora aqui. A tela mostra a sugestao e o
 * servidor grava o vinculo lendo a MESMA funcao: duas implementacoes
 * divergiriam no primeiro caso de borda, e o estrago seria dinheiro conciliado
 * contra o lancamento errado — que ninguem percebe, porque o saldo continua
 * fechando.
 */

/** Uma linha do arquivo do banco, ja gravada e ainda sem par. */
export type LinhaDoBanco = {
  id: number;
  data: DataISO;
  /** Centavos COM sinal: negativo saiu da conta. */
  valor: number;
  nome: string;
};

/** Um lancamento do sistema que ainda nao foi conferido. */
export type LancamentoDoSistema = {
  id: number;
  data: DataISO;
  /** Centavos COM sinal, na mesma convencao da linha do banco. */
  valor: number;
  /** Cliente, fornecedor ou historico. E o que se compara com o nome do banco. */
  nome: string;
};

export type Confianca = "exata" | "provavel";

export type Par = {
  linhaId: number;
  lancamentoId: number;
  confianca: Confianca;
  /** Por que casou, para a tela poder dizer. */
  motivo: string;
};

/**
 * Quantos dias de folga o casamento aceita.
 *
 * ⚠️ Tres, e nao trinta. PIX lancado no dia seguinte e boleto que compensa dois
 * dias depois sao o caso comum; alem disso, a chance de dois lancamentos de
 * mesmo valor existirem por acaso cresce mais rapido que a chance de ser o
 * mesmo dinheiro. Janela larga nao acha mais: erra mais.
 */
const JANELA_DE_DIAS = 3;

function diasEntre(a: DataISO, b: DataISO): number {
  const ms = Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`);
  return Math.abs(Math.round(ms / 86_400_000));
}

/**
 * O nome reduzido ao que da para comparar.
 *
 * ⚠️ Sem acento, sem pontuacao e sem as palavras que todo cadastro tem. "RION
 * PRESTACAO DE SERVICOS LTDA" e "Rion Prestação de Serviços Ltda." precisam
 * virar a mesma coisa, e "LTDA" nao pode contar como palavra em comum — senao
 * duas empresas quaisquer parecem parentes.
 */
const RUIDO = new Set([
  "ltda", "me", "epp", "sa", "eireli", "mei", "de", "da", "do", "das", "dos", "e",
  "pix", "ted", "doc", "transf", "transferencia", "pagamento", "pgto", "recebido",
  "enviado", "credito", "debito", "banco",
]);

function palavras(nome: string): Set<string> {
  return new Set(
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      // Palavra de uma letra nao distingue nada e infla a semelhanca.
      .filter((p) => p.length > 1 && !RUIDO.has(p)),
  );
}

/**
 * Quanto dois nomes se parecem, de 0 a 1.
 *
 * Proporcao de palavras em comum sobre o menor dos dois conjuntos: o extrato
 * abrevia, entao "RION LED IND COM" contra "Rion Led Industria Comercio e
 * Servicos Eletricos" tem de contar como parecido, e nao como metade.
 */
function semelhanca(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;

  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;

  return comuns / Math.min(pa.size, pb.size);
}

/** Acima disto, dois nomes contam como a mesma parte. */
const NOME_PARECIDO = 0.5;

/**
 * Casa as linhas do banco com os lancamentos do sistema.
 *
 * ⚠️ O VALOR e eliminatorio, sempre. Data e nome apenas ORDENAM os candidatos
 * que ja tem o mesmo valor e a mesma direcao — nunca criam um par sozinhos.
 * Nome de extrato vem abreviado, truncado e as vezes com o nome da maquininha no
 * lugar do cliente; casar por texto erraria de um jeito que so aparece no
 * fechamento do mes.
 *
 * ⚠️ Cada linha e cada lancamento entram em UM par so. Sem isso, um deposito de
 * 500 casaria com as tres contas de 500 do mesmo dia, e o total conciliado
 * passaria do que existe no extrato.
 *
 * A ordem em que os pares sao aceitos e o que faz o resultado ser estavel: os
 * mais certos primeiro, e o que sobra fica para a mao.
 */
export function casar(
  linhas: LinhaDoBanco[],
  lancamentos: LancamentoDoSistema[],
): { pares: Par[]; linhasSemPar: number[]; lancamentosSemPar: number[] } {
  const candidatos: (Par & { ordem: number })[] = [];

  for (const linha of linhas) {
    for (const lancamento of lancamentos) {
      // Valor com sinal: cobre valor e direcao de uma vez. Uma saida de 500 nao
      // pode casar com uma entrada de 500.
      if (linha.valor !== lancamento.valor) continue;

      const dias = diasEntre(linha.data, lancamento.data);
      if (dias > JANELA_DE_DIAS) continue;

      const parecido = semelhanca(linha.nome, lancamento.nome) >= NOME_PARECIDO;

      /*
       * ⚠️ So o mesmo dia vira "exata", e o nome NAO promove.
       *
       * Nome parecido em data diferente continua sendo palpite: o extrato traz
       * o nome da adquirente, do banco intermediario ou da maquininha, e tres
       * lancamentos do mesmo cliente na semana se parecem todos entre si. Quem
       * confirma e a pessoa.
       */
      const confianca: Confianca = dias === 0 ? "exata" : "provavel";

      const motivo =
        dias === 0
          ? parecido
            ? "Mesmo valor, mesma data e o nome bate"
            : "Mesmo valor e mesma data"
          : parecido
            ? `Mesmo valor, o nome bate, ${dias} ${dias === 1 ? "dia" : "dias"} de diferença`
            : `Mesmo valor, ${dias} ${dias === 1 ? "dia" : "dias"} de diferença`;

      // Menor ordena melhor: primeiro a data, depois o nome como desempate.
      candidatos.push({
        linhaId: linha.id,
        lancamentoId: lancamento.id,
        confianca,
        motivo,
        ordem: dias * 2 + (parecido ? 0 : 1),
      });
    }
  }

  candidatos.sort((a, b) => a.ordem - b.ordem || a.linhaId - b.linhaId);

  const linhasUsadas = new Set<number>();
  const lancamentosUsados = new Set<number>();
  const pares: Par[] = [];

  for (const c of candidatos) {
    if (linhasUsadas.has(c.linhaId) || lancamentosUsados.has(c.lancamentoId)) continue;

    linhasUsadas.add(c.linhaId);
    lancamentosUsados.add(c.lancamentoId);
    pares.push({
      linhaId: c.linhaId,
      lancamentoId: c.lancamentoId,
      confianca: c.confianca,
      motivo: c.motivo,
    });
  }

  return {
    pares,
    linhasSemPar: linhas.filter((l) => !linhasUsadas.has(l.id)).map((l) => l.id),
    lancamentosSemPar: lancamentos.filter((l) => !lancamentosUsados.has(l.id)).map((l) => l.id),
  };
}

/**
 * A chave que impede a mesma linha de entrar duas vezes.
 *
 * ⚠️ Espelha EXATAMENTE o formato que as 99 linhas ja gravadas usam:
 * `conta|data|valor|tipo|nome|indice`, em base64. Mudar o formato faria toda
 * reimportacao de um periodo ja carregado duplicar o extrato inteiro, porque
 * nenhuma chave nova bateria com as antigas.
 *
 * ⚠️ O INDICE no fim nao e enfeite. Duas tarifas de 4,50 no mesmo dia, com o
 * mesmo historico, sao duas linhas de verdade no extrato do banco — sem o
 * indice elas teriam a mesma chave e a segunda seria descartada como repetida.
 */
export function chaveDaLinha(entrada: {
  contaId: number;
  data: DataISO;
  valor: number;
  tipo: string;
  nome: string;
  indice: number;
}): string {
  const texto = [
    entrada.contaId,
    entrada.data,
    // Em reais e sem zeros a direita, que e como o legado gravou.
    String(entrada.valor / 100).replace(/\.?0+$/, "") || "0",
    entrada.tipo,
    entrada.nome,
    entrada.indice,
  ].join("|");

  return base64(texto);
}

/**
 * Base64 de um texto UTF-8, no servidor e no navegador.
 *
 * ⚠️ Sem `Buffer`: ele nao existe no navegador, e este modulo e lido pelos dois
 * lados — a tela precisa da chave para saber o que ja importou antes de mandar.
 *
 * ⚠️ E sem `btoa` direto no texto: ele so aceita Latin-1, e estoura em qualquer
 * nome com acento. O caminho e virar bytes UTF-8 primeiro, que e o que o `Buffer`
 * fazia por dentro e o que as 99 linhas ja gravadas assumem.
 */
function base64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);

  return btoa(binario);
}

/**
 * O que muda na data do lancamento quando ele e conciliado.
 *
 * ⚠️ Quem manda na data e o BANCO. O extrato diz o dia em que o dinheiro se
 * moveu de verdade; a data digitada na baixa e a intencao de quem lancou, e
 * quase sempre e o dia do combinado, nao o da compensacao. Conciliar e afirmar
 * que os dois sao o mesmo dinheiro — e a partir dali so um deles pode estar
 * certo sobre quando ele andou.
 *
 * ⚠️ Mudar de MES nao passa calado. Dentro do mes, a correcao nao mexe em
 * fechamento nenhum. Cruzando a virada, ela reescreve o resultado de dois meses
 * que talvez ja tenham sido apresentados — e isso e decisao de quem concilia,
 * nao efeito colateral de um clique.
 */
export function ajusteDeData(
  doLancamento: DataISO,
  doExtrato: DataISO,
): { muda: boolean; mudaDeMes: boolean } {
  const muda = doLancamento !== doExtrato;

  return {
    muda,
    // `YYYY-MM`: comparar o texto basta, e nao acorda fuso nenhum.
    mudaDeMes: muda && doLancamento.slice(0, 7) !== doExtrato.slice(0, 7),
  };
}
