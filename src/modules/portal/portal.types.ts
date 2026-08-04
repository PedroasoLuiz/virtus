import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * O portal do cliente.
 *
 * Quem entra aqui e pessoa do CLIENTE, nao da casa: o financeiro da OCB, o
 * comercial da RION. Ele nao administra empresa nenhuma — `empresas_do_usuario()`
 * o ignora de proposito — e enxerga apenas o que pertence aos clientes aos quais
 * esta vinculado em `usuariosxclientes`.
 *
 * O escopo e garantido pela RLS, nao por filtro no codigo: as policies `*_portal`
 * respondem por cliente, entao mesmo uma consulta escrita errada aqui nao
 * alcanca a cobranca de outro.
 *
 * ⚠️ Somente leitura, e sem numero de conta a receber. A conta e controle
 * interno; o que o cliente conhece e o TICKET e o vencimento (ver docs/10).
 */

/**
 * Uma empresa da casa que cobra este cliente.
 *
 * O mesmo cliente pode ser atendido por mais de uma — RION LED e cliente da
 * Virtus E da PMX PMO —, e para ele sao cobrancas de origens diferentes.
 */
export type Emitente = {
  id: number;
  nome: string;
};

/** Qual das empresas DO CLIENTE deve. Um grupo tem mais de um CNPJ. */
export type ClienteDoPortal = {
  id: number;
  nome: string;
  emitenteId: number;
};

export type ParcelaDoCliente = {
  parcelaId: number;
  /** Credencial da pagina publica `/p/{token}`, onde ficam os documentos. */
  token: string;
  emitente: Emitente;
  cliente: ClienteDoPortal;
  numero: number;
  totalParcelas: number;
  vencimento: DataISO | null;
  total: Centavos;
  recebido: Centavos;
  emAberto: Centavos;
  pago: boolean;
  /** Vencida e ainda em aberto. Calculado, nunca guardado. */
  atrasada: boolean;
  temBoleto: boolean;
  temNota: boolean;
  /** Os tickets que originaram a cobranca. E o que o cliente reconhece. */
  tickets: number[];
};

/**
 * Proposta enviada, esperando resposta.
 *
 * Nao e cobranca: nao tem vencimento nem parcela, e pode nunca virar nenhuma.
 * Aparece no quadro porque e o unico estado de ticket que existe PARA o cliente
 * — os demais sao vida interna da casa.
 */
export type OrcamentoDoCliente = {
  ticketId: number;
  /** Numero por empresa. E o que aparece no documento. */
  numero: number;
  titulo: string;
  cliente: ClienteDoPortal;
  emitente: Emitente;
  emitidoEm: DataISO | null;
  total: Centavos;
};

export type CarteiraDoCliente = {
  clientes: ClienteDoPortal[];
  /** Empresas que cobram este cliente. Mais de uma habilita a escolha. */
  emitentes: Emitente[];
  /** O emitente ativo. Nulo so quando o cliente nao tem nenhum. */
  emitenteAtual: Emitente | null;
  orcamentos: OrcamentoDoCliente[];
  parcelas: ParcelaDoCliente[];
  /** Somas do que esta em aberto. O que ja foi pago nao entra. */
  emAberto: Centavos;
  vencido: Centavos;
};
