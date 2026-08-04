import { BusinessRuleError } from "@/shared/errors/app-error";
import {
  dividir,
  somar,
  subtrair,
  type Centavos,
  ZERO,
} from "@/shared/utils/money";
import {
  diffEmDias,
  proximoDiaUtil,
  somarDias,
  type DataISO,
} from "@/shared/utils/datas";

/**
 * Parcelamento — regra compartilhada entre contas a receber (faturas) e contas
 * a pagar. No legado eram dois arquivos quase identicos que ja divergiam entre
 * si (docs/04 §1 e §3); aqui e uma implementacao so.
 *
 * Funcoes puras: nao tocam banco, nao conhecem HTTP, nao dependem de relogio.
 * Sao o unico lugar do sistema onde o cronograma de um titulo e decidido, e por
 * isso o alvo natural dos testes.
 *
 * INVARIANTE, valido em toda operacao deste arquivo:
 *     soma(parcelas.valor) === total do titulo
 */

export type Parcela = {
  numero: number;
  vencimento: DataISO;
  valor: Centavos;
};

export type ParcelaExistente = Parcela & {
  id: number;
  pago: boolean;
};

export const INTERVALO_PADRAO_DIAS = 30;
const MAX_PARCELAS = 360;

// ── Geracao ─────────────────────────────────────────────────────────────────

export type EntradaGerar = {
  total: Centavos;
  quantidade: number;
  primeiroVencimento: DataISO;
  intervaloDias?: number;
};

/**
 * Monta o cronograma de um titulo novo.
 *
 * Cada vencimento e empurrado para o proximo dia util. A divisao distribui o
 * resto de centavos entre as primeiras parcelas em vez de acumular tudo na
 * ultima, como fazia o legado.
 */
export function gerarParcelas({
  total,
  quantidade,
  primeiroVencimento,
  intervaloDias = INTERVALO_PADRAO_DIAS,
}: EntradaGerar): Parcela[] {
  if (total <= 0) {
    throw new BusinessRuleError("Total do titulo deve ser maior que zero");
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_PARCELAS) {
    throw new BusinessRuleError(`Quantidade de parcelas deve estar entre 1 e ${MAX_PARCELAS}`);
  }
  if (!Number.isInteger(intervaloDias) || intervaloDias < 1) {
    throw new BusinessRuleError("Intervalo entre parcelas deve ser de ao menos 1 dia");
  }

  const valores = dividir(total, quantidade);

  return valores.map((valor, i) => ({
    numero: i + 1,
    // O deslocamento parte SEMPRE da data original, nao da anterior ja
    // ajustada — senao o ajuste de dia util acumula e a ultima parcela sai
    // dias adiante do previsto.
    vencimento: proximoDiaUtil(somarDias(primeiroVencimento, intervaloDias * i)),
    valor,
  }));
}

// ── Adicionar ───────────────────────────────────────────────────────────────

/**
 * Divide a ultima parcela em duas. Preserva o total.
 *
 * O intervalo e inferido da distancia entre as duas ultimas parcelas; com uma
 * parcela so, cai no padrao de 30 dias.
 */
export function adicionarParcela(parcelas: ParcelaExistente[]): {
  atualizar: { id: number; valor: Centavos };
  criar: Parcela;
} {
  const ordenadas = ordenar(parcelas);
  const ultima = ordenadas.at(-1);

  if (!ultima) {
    throw new BusinessRuleError("Titulo sem parcelas");
  }
  if (ultima.pago) {
    // Guarda que o legado nao tinha: dividir uma parcela ja baixada
    // desalinharia o titulo do pagamento registrado.
    throw new BusinessRuleError("A ultima parcela ja foi paga e nao pode ser dividida");
  }
  if (ultima.valor < 2) {
    throw new BusinessRuleError("Parcela pequena demais para ser dividida");
  }

  const [ficaNaUltima, vaiParaNova] = dividir(ultima.valor, 2);

  const anterior = ordenadas.at(-2);
  const intervalo = anterior
    ? Math.max(1, diffEmDias(anterior.vencimento, ultima.vencimento))
    : INTERVALO_PADRAO_DIAS;

  return {
    atualizar: { id: ultima.id, valor: ficaNaUltima },
    criar: {
      numero: ultima.numero + 1,
      vencimento: proximoDiaUtil(somarDias(ultima.vencimento, intervalo)),
      valor: vaiParaNova,
    },
  };
}

// ── Excluir ─────────────────────────────────────────────────────────────────

/**
 * Remove uma parcela e joga o valor dela na ultima restante, renumerando o
 * cronograma. Preserva o total.
 */
export function excluirParcela(
  parcelas: ParcelaExistente[],
  idExcluir: number,
): {
  excluir: number;
  atualizar: { id: number; numero: number; valor: Centavos }[];
} {
  const ordenadas = ordenar(parcelas);

  if (ordenadas.length <= 1) {
    throw new BusinessRuleError("Nao e possivel excluir a unica parcela do titulo");
  }

  const alvo = ordenadas.find((p) => p.id === idExcluir);
  if (!alvo) {
    throw new BusinessRuleError("Parcela nao pertence a este titulo");
  }
  if (alvo.pago) {
    throw new BusinessRuleError("Parcela ja paga nao pode ser excluida");
  }

  const restantes = ordenadas.filter((p) => p.id !== idExcluir);
  const ultima = restantes.at(-1)!;

  if (ultima.pago) {
    throw new BusinessRuleError(
      "A ultima parcela ja foi paga e nao pode absorver o valor da parcela excluida",
    );
  }

  const atualizar = restantes.map((p, i) => ({
    id: p.id,
    numero: i + 1,
    valor: p.id === ultima.id ? somar(p.valor, alvo.valor) : p.valor,
  }));

  return { excluir: idExcluir, atualizar };
}

// ── Ordem de recebimento ────────────────────────────────────────────────────

/**
 * O minimo para saber se uma parcela ainda espera dinheiro.
 *
 * Numeros crus, e nao `Centavos`/`DataISO`: a mesma regra roda no servico e na
 * tela, e o componente de tela nao carrega os tipos de dominio. Os branded types
 * entram aqui sem conversao, porque sao numero e string por baixo.
 */
export type ParcelaNaFila = {
  id: number;
  numero: number;
  vencimento: string | null;
  total: number;
  recebido: number;
  pago: boolean;
};

export function esperaDinheiro(p: ParcelaNaFila): boolean {
  return !p.pago && p.total - p.recebido > 0;
}

/**
 * A ordem em que as parcelas sao recebidas: vencimento manda, o numero so
 * desempata.
 *
 * Parcela sem vencimento vai para o FIM e nao para o comeco: nao se sabe quando
 * ela vence, e travar o titulo inteiro atras de uma data que ninguem preencheu
 * seria pior do que deixa-la por ultimo.
 */
export function filaDeRecebimento<T extends ParcelaNaFila>(parcelas: T[]): T[] {
  const chave = (p: T) => p.vencimento ?? "9999-12-31";

  return [...parcelas].sort((a, b) =>
    chave(a) === chave(b) ? a.numero - b.numero : chave(a) < chave(b) ? -1 : 1,
  );
}

/**
 * A unica parcela que pode receber agora. Nula quando nao ha nada em aberto.
 *
 * Receber fora de ordem quebra a leitura do saldo: com a 3 baixada e a 1 em
 * aberto, "em atraso" e "a vencer" deixam de dizer o que dizem, e quem deve a
 * parcela mais velha aparece em dia na listagem. Quem quer encerrar a primeira
 * sem receber usa o desconto da baixa, que registra a decisao; pular nao
 * registra nada.
 */
export function proximaAReceber<T extends ParcelaNaFila>(parcelas: T[]): T | null {
  return filaDeRecebimento(parcelas).find(esperaDinheiro) ?? null;
}

/**
 * Qual parcela impede este recebimento. Nula quando a ordem esta respeitada.
 *
 * Nao proibe quitar varias de uma vez: proibe DEIXAR uma para tras. Um dinheiro
 * que cobre as parcelas 1, 2 e 3 passa; um que cobre a 2 sem fechar a 1, nao.
 *
 * Vale por titulo, e nao entre titulos: duas contas do mesmo cliente sao acordos
 * independentes, e travar a segunda porque a primeira atrasou impediria de
 * receber um dinheiro que o cliente esta pagando de verdade.
 */
export function paradaNaFila<T extends ParcelaNaFila>(
  parcelas: T[],
  destinos: { parcelaId: number; valor: number; quitar?: boolean }[],
): T | null {
  const porDestino = new Map(destinos.map((d) => [d.parcelaId, d]));
  let pendente: T | null = null;

  for (const p of filaDeRecebimento(parcelas).filter(esperaDinheiro)) {
    const destino = porDestino.get(p.id);
    if (destino && pendente) return pendente;

    // Sobra depois desta baixa. Quem escolheu quitar fecha a parcela mesmo
    // recebendo menos, entao nao segura a fila.
    const sobra = p.total - p.recebido - (destino?.valor ?? 0);
    if (!pendente && sobra > 0 && !destino?.quitar) pendente = p;
  }

  return null;
}

// ── Verificacao ─────────────────────────────────────────────────────────────

/**
 * Confere o invariante. Chamado pelos services antes de persistir — barato, e
 * transforma um erro de centavos num 422 explicito em vez de num titulo
 * silenciosamente errado.
 */
export function conferirTotal(parcelas: { valor: Centavos }[], total: Centavos): void {
  const soma = parcelas.reduce<Centavos>((acc, p) => somar(acc, p.valor), ZERO);
  if (soma !== total) {
    throw new BusinessRuleError("Soma das parcelas nao confere com o total do titulo", {
      soma,
      total,
      diferenca: subtrair(soma, total),
    });
  }
}

function ordenar(parcelas: ParcelaExistente[]): ParcelaExistente[] {
  return [...parcelas].sort((a, b) => a.numero - b.numero);
}
