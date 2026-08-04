import type { Centavos } from "@/shared/utils/money";
import type { DataISO } from "@/shared/utils/datas";

/**
 * O portal do cliente.
 *
 * Quem entra aqui e pessoa do CLIENTE, nao da casa: o financeiro da OCB, o
 * comercial da RION. Ele nao administra empresa nenhuma — `empresas_do_usuario()`
 * o ignora de proposito — e enxerga apenas as cobrancas dos clientes aos quais
 * esta vinculado em `usuariosxclientes`.
 *
 * O escopo e garantido pela RLS, nao por filtro no codigo: as policies
 * `*_portal` respondem por cliente, entao mesmo uma consulta escrita errada aqui
 * nao alcanca a cobranca de outro.
 *
 * ⚠️ Somente leitura, e sem numero de conta a receber. A conta e controle
 * interno; o que o cliente conhece e o TICKET e o vencimento (ver docs/10).
 */

export type ParcelaDoCliente = {
  parcelaId: number;
  /** Credencial da pagina publica `/p/{token}`, onde ficam os documentos. */
  token: string | null;
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

export type ClienteDoPortal = {
  id: number;
  nome: string;
};

export type CarteiraDoCliente = {
  clientes: ClienteDoPortal[];
  parcelas: ParcelaDoCliente[];
  /** Somas do que esta em aberto. O que ja foi pago nao entra. */
  emAberto: Centavos;
  vencido: Centavos;
};
