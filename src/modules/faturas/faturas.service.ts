import { BusinessRuleError, NotFoundError } from "@/shared/errors/app-error";
import {
  centavos,
  formatarSemSimbolo,
  multiplicar,
  somar,
  subtrair,
  type Centavos,
  ZERO,
} from "@/shared/utils/money";
import type { Paginacao, Pagina } from "@/shared/utils/paginacao";
import {
  adicionarParcela,
  conferirTotal,
  excluirParcela,
  gerarParcelas,
  type ParcelaExistente,
} from "@/shared/domain/parcelas";
import * as repo from "@/modules/faturas/faturas.repository";
import { enviarEmail } from "@/shared/email/enviar";
import { htmlDaFatura } from "@/shared/email/fatura-template";
import { paraFormatoBR, periodoEmMeses } from "@/shared/utils/datas";
import {
  apagarDocumento,
  caminhoDoDocumento,
  enviarDocumento,
  urlDoDocumento,
} from "@/shared/storage/documentos";
import {
  podeTransicionar,
  type Fatura,
  type FaturaResumo,
  type FiltroFaturas,
  type ItemNovo,
  type OrigemNova,
  type StatusFatura,
} from "@/modules/faturas/faturas.types";
import type { DataISO } from "@/shared/utils/datas";

/**
 * Regra de negocio de faturas.
 *
 * Nao conhece req/res, nao conhece Supabase. Recebe dado limpo do controller,
 * decide, e chama o repositorio. Se precisar de outra feature, chama o SERVICO
 * dela, nunca o repositorio.
 */

export async function listarFaturas(
  empresaId: number,
  filtro: FiltroFaturas,
  paginacao: Paginacao,
): Promise<Pagina<FaturaResumo>> {
  return repo.listar(empresaId, filtro, paginacao);
}

export async function obterFatura(empresaId: number, id: number): Promise<Fatura> {
  const fatura = await repo.buscarPorId(empresaId, id);
  if (!fatura) throw new NotFoundError("Fatura nao encontrada");
  return fatura;
}

// ── Criacao ─────────────────────────────────────────────────────────────────

export type EntradaCriarFatura = {
  clienteId: number;
  apuracaoInicio: DataISO;
  apuracaoFim: DataISO;
  itens: ItemNovo[];
  origens?: OrigemNova[];
  parcelamento: {
    quantidade: number;
    primeiroVencimento: DataISO;
    intervaloDias?: number;
  };
  observacoes?: string | null;
  rodape?: string | null;
  emitir?: boolean;
};

export async function criarFatura(
  empresaId: number,
  usuarioId: string,
  entrada: EntradaCriarFatura,
): Promise<{ id: number; total: Centavos; parcelas: number }> {
  if (entrada.itens.length === 0) {
    throw new BusinessRuleError("Fatura precisa de ao menos um item");
  }
  if (entrada.apuracaoFim < entrada.apuracaoInicio) {
    throw new BusinessRuleError("Fim da competencia anterior ao inicio");
  }

  const itensComTotal = entrada.itens.map((item) => ({
    ...item,
    total: totalDoItem(item),
  }));

  const total = itensComTotal.reduce<Centavos>((acc, i) => somar(acc, i.total), ZERO);
  if (total <= 0) {
    throw new BusinessRuleError("Total da fatura deve ser maior que zero");
  }

  const origens = entrada.origens ?? [];
  await conferirOrigens(empresaId, origens, total);

  const parcelas = gerarParcelas({
    total,
    quantidade: entrada.parcelamento.quantidade,
    primeiroVencimento: entrada.parcelamento.primeiroVencimento,
    intervaloDias: entrada.parcelamento.intervaloDias,
  });

  // Barato, e converte um erro de centavos num 422 explicito em vez de num
  // titulo silenciosamente errado no banco.
  conferirTotal(parcelas, total);

  const id = await repo.criar({
    empresaId,
    usuarioId,
    clienteId: entrada.clienteId,
    apuracaoInicio: entrada.apuracaoInicio,
    apuracaoFim: entrada.apuracaoFim,
    status: entrada.emitir ? "ABERTA" : "ORÇAMENTO",
    total,
    observacoes: entrada.observacoes ?? null,
    rodape: entrada.rodape ?? null,
    itens: itensComTotal,
    origens,
    parcelas,
  });

  return { id, total, parcelas: parcelas.length };
}

/**
 * Confere de onde vem o dinheiro antes de gravar.
 *
 * Duas coisas so o servidor sabe: se o ticket e mesmo desta empresa, e quanto
 * dele ainda esta em aberto. A tela manda o que o usuario escolheu; se o saldo
 * mudou no meio do caminho — outra fatura entrou, o ticket foi cancelado — quem
 * percebe e aqui.
 */
async function conferirOrigens(
  empresaId: number,
  origens: OrigemNova[],
  totalDaFatura: Centavos,
): Promise<void> {
  if (origens.length === 0) return;

  const ids = origens.map((o) => o.ticketId);
  if (new Set(ids).size !== ids.length) {
    throw new BusinessRuleError("O mesmo ticket aparece duas vezes na fatura");
  }

  const soma = origens.reduce<Centavos>((acc, o) => somar(acc, o.valor), ZERO);
  if (soma > totalDaFatura) {
    throw new BusinessRuleError(
      "A soma tirada dos tickets e maior que o total da fatura",
    );
  }

  const saldos = await repo.saldoDosTickets(empresaId, ids);

  for (const o of origens) {
    const ticket = saldos.get(o.ticketId);

    if (!ticket) {
      throw new BusinessRuleError("Ticket nao encontrado nesta empresa");
    }
    if (ticket.cancelado) {
      throw new BusinessRuleError(`O ticket ${ticket.numero} esta cancelado`);
    }
    if (o.valor > ticket.saldo) {
      throw new BusinessRuleError(
        `O ticket ${ticket.numero} tem apenas ${formatarSemSimbolo(ticket.saldo)} em aberto`,
      );
    }
  }
}

/** (unitario x quantidade) + acrescimo - desconto, em centavos. */
function totalDoItem(item: ItemNovo): Centavos {
  if (item.quantidade <= 0) {
    throw new BusinessRuleError(`Quantidade invalida no item "${item.descricao}"`);
  }

  const bruto = multiplicar(item.valorUnitario, item.quantidade);
  const total = subtrair(somar(bruto, item.acrescimo), item.desconto);

  if (total < 0) {
    throw new BusinessRuleError(`Desconto maior que o valor do item "${item.descricao}"`);
  }
  return total;
}

// ── Ciclo de vida ───────────────────────────────────────────────────────────

export async function alterarStatus(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
  novo: StatusFatura,
): Promise<void> {
  const fatura = await obterFatura(empresaId, faturaId);

  if (fatura.cancelada) {
    throw new BusinessRuleError("Fatura cancelada nao muda de status");
  }
  if (fatura.status === novo) return; // idempotente

  if (!podeTransicionar(fatura.status, novo)) {
    throw new BusinessRuleError(
      `Transicao invalida: fatura ${fatura.status} nao pode ir para ${novo}`,
    );
  }

  await repo.atualizarStatus(empresaId, faturaId, novo, usuarioId);
}

/**
 * Cancelamento e coluna propria no banco, nao um status — por isso operacao
 * separada da transicao de status.
 */
export async function cancelarFatura(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
): Promise<void> {
  const fatura = await obterFatura(empresaId, faturaId);

  if (fatura.cancelada) return; // idempotente

  if (fatura.parcelas.some((p) => p.pago)) {
    throw new BusinessRuleError(
      "Fatura com parcela paga nao pode ser cancelada; estorne o pagamento antes",
    );
  }

  await repo.definirCancelada(empresaId, faturaId, true, usuarioId);
}

// ── Parcelas ────────────────────────────────────────────────────────────────

export async function adicionarParcelaNaFatura(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
): Promise<void> {
  const fatura = await obterFatura(empresaId, faturaId);
  garantirEditavel(fatura);

  const plano = adicionarParcela(paraParcelasExistentes(fatura));

  const novasParcelas = paraParcelasExistentes(fatura)
    .filter((p) => !p.pago)
    .map((p) => ({
      numero: p.numero,
      vencimento: p.vencimento,
      valor: p.id === plano.atualizar.id ? plano.atualizar.valor : p.valor,
    }))
    .concat(plano.criar);

  conferirTotal([...fatura.parcelas.filter((p) => p.pago), ...novasParcelas], fatura.total);
  await repo.substituirParcelas(faturaId, usuarioId, novasParcelas);
}

export async function excluirParcelaDaFatura(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
  parcelaId: number,
): Promise<void> {
  const fatura = await obterFatura(empresaId, faturaId);
  garantirEditavel(fatura);

  const plano = excluirParcela(paraParcelasExistentes(fatura), parcelaId);

  const porId = new Map(paraParcelasExistentes(fatura).map((p) => [p.id, p]));
  const novasParcelas = plano.atualizar
    .filter((p) => !porId.get(p.id)?.pago)
    .map((p) => ({
      numero: p.numero,
      vencimento: porId.get(p.id)!.vencimento,
      valor: p.valor,
    }));

  conferirTotal([...fatura.parcelas.filter((p) => p.pago), ...novasParcelas], fatura.total);
  await repo.substituirParcelas(faturaId, usuarioId, novasParcelas);
}

function garantirEditavel(fatura: Fatura): void {
  if (fatura.cancelada) {
    throw new BusinessRuleError("Fatura cancelada nao pode ter as parcelas alteradas");
  }
  if (fatura.status === "PAGA") {
    throw new BusinessRuleError("Fatura paga nao pode ter as parcelas alteradas");
  }
}

/**
 * Registro antigo pode ter parcela sem vencimento. Recalcular cronograma a
 * partir de data ausente produziria data errada em silencio — melhor recusar a
 * operacao e obrigar a corrigir o cadastro.
 */
function paraParcelasExistentes(fatura: Fatura): ParcelaExistente[] {
  return fatura.parcelas.map((p) => {
    if (!p.vencimento) {
      throw new BusinessRuleError(
        `Parcela ${p.numero} nao tem vencimento; corrija o cadastro antes de alterar o parcelamento`,
      );
    }
    return {
      id: p.id,
      numero: p.numero,
      vencimento: p.vencimento,
      valor: centavos(p.valor),
      pago: p.pago,
    };
  });
}

// ── Documentos da parcela ───────────────────────────────────────────────────

/**
 * Nota fiscal e boleto ficam na PARCELA, nao na fatura.
 *
 * E como o legado fazia, e esta certo: conta de tres parcelas tem tres boletos,
 * e muitas vezes tres notas. Preso na fatura, o segundo boleto sobrescreveria o
 * primeiro.
 */
export async function anexarDocumento(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
  parcelaId: number,
  tipo: "nfs" | "boleto",
  arquivo: File,
): Promise<void> {
  const fatura = await obterFatura(empresaId, faturaId);
  const parcela = fatura.parcelas.find((p) => p.id === parcelaId);

  if (!parcela) throw new NotFoundError("Parcela nao encontrada nesta conta");
  if (fatura.cancelada) {
    throw new BusinessRuleError("Conta cancelada nao recebe documento");
  }

  const caminho = caminhoDoDocumento(empresaId, faturaId, tipo, arquivo.name);
  await enviarDocumento(caminho, arquivo);

  /*
   * O anterior so e apagado DEPOIS que o novo entrou e o registro aponta para
   * ele. Na ordem inversa, uma falha no meio deixaria a parcela sem documento
   * nenhum — e o arquivo velho ja destruido.
   */
  const anterior = parcela[tipo];
  await repo.gravarDocumentoDaParcela(parcelaId, usuarioId, tipo, caminho);
  if (anterior) await apagarDocumento(anterior);
}

export async function removerDocumento(
  empresaId: number,
  usuarioId: string,
  faturaId: number,
  parcelaId: number,
  tipo: "nfs" | "boleto",
): Promise<void> {
  const fatura = await obterFatura(empresaId, faturaId);
  const parcela = fatura.parcelas.find((p) => p.id === parcelaId);

  if (!parcela) throw new NotFoundError("Parcela nao encontrada nesta conta");

  const referencia = parcela[tipo];
  if (!referencia) return;

  await repo.gravarDocumentoDaParcela(parcelaId, usuarioId, tipo, null);
  await apagarDocumento(referencia);
}

/** Link temporario para abrir o documento. */
export async function linkDoDocumento(
  empresaId: number,
  faturaId: number,
  parcelaId: number,
  tipo: "nfs" | "boleto",
): Promise<string> {
  const fatura = await obterFatura(empresaId, faturaId);
  const parcela = fatura.parcelas.find((p) => p.id === parcelaId);
  const referencia = parcela?.[tipo];

  if (!referencia) throw new NotFoundError("Documento nao encontrado");
  return urlDoDocumento(referencia);
}

// ── Envio ao cliente ────────────────────────────────────────────────────────

/**
 * Manda a parcela para o cliente, com os documentos anexados.
 *
 * ⚠️ Os arquivos vao ANEXADOS, nao como link.
 *
 * O legado mandava link para o bucket publico — que abria para qualquer um, para
 * sempre. Aqui o bucket e privado e o link e assinado por uma hora: bom para
 * quem esta na tela, inutil num e-mail que sera aberto amanha. Anexo resolve os
 * dois lados, e e o que o cliente espera de uma cobranca.
 */
export async function enviarParcelaPorEmail(
  empresaId: number,
  faturaId: number,
  parcelaId: number,
  paraAlternativo?: string | null,
): Promise<{ para: string }> {
  const fatura = await obterFatura(empresaId, faturaId);
  const parcela = fatura.parcelas.find((p) => p.id === parcelaId);

  if (!parcela) throw new NotFoundError("Parcela nao encontrada nesta conta");
  if (fatura.cancelada) {
    throw new BusinessRuleError("Conta cancelada nao e enviada");
  }
  if (parcela.pago) {
    throw new BusinessRuleError("Esta parcela ja foi baixada");
  }

  const destino = await repo.destinatarioDaFatura(empresaId, fatura.clienteId);
  const para = (paraAlternativo ?? "").trim() || destino.email;

  if (!para) {
    throw new BusinessRuleError(
      "Este cliente nao tem e-mail cadastrado. Informe um endereco ou preencha o cadastro.",
    );
  }

  /*
   * Sem documento nenhum, o e-mail seria um aviso de cobranca sem cobranca —
   * o cliente abre, nao tem o que pagar, e liga perguntando.
   */
  if (!parcela.nfs && !parcela.boleto) {
    throw new BusinessRuleError("Anexe a nota fiscal ou o boleto antes de enviar.");
  }

  /*
   * O e-mail leva um LINK NOSSO, nao o arquivo nem a URL do banco.
   *
   * Anexo funciona, mas vira um arquivo solto na caixa de entrada: nao da para
   * saber se foi aberto, nao da para corrigir uma nota errada depois de enviada,
   * e nao da para revogar. Link proprio resolve os tres — trocar o arquivo no
   * sistema muda o que o cliente baixa, sem reenviar nada.
   */
  const token = await repo.tokenDaParcela(parcelaId);
  const portal = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const link = `${portal}/p/${token}`;

  const documentos = [
    parcela.nfs ? { rotulo: "Baixar nota fiscal", url: link } : null,
    parcela.boleto ? { rotulo: "Baixar boleto", url: link } : null,
  ].filter((d): d is { rotulo: string; url: string } => d !== null);

  await enviarEmail({
    para: [para],
    assunto: `${destino.empresaNome} — Fatura ${fatura.numero}, parcela ${parcela.numero}`,
    html: htmlDaFatura({
      empresaNome: destino.empresaNome,
      numeroFatura: fatura.numero,
      competencia: periodoEmMeses(fatura.apuracaoInicio, fatura.apuracaoFim) ?? "—",
      vencimento: parcela.vencimento ? paraFormatoBR(parcela.vencimento) : "—",
      valor: formatarSemSimbolo(parcela.total),
      documentos,
      urlDoPortal: link,
    }),
  });

  return { para };
}
