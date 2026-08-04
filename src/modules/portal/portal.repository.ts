import { serverClient } from "@/infra/supabase/client";
import { doBanco, type Centavos } from "@/shared/utils/money";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { hoje, type DataISO } from "@/shared/utils/datas";
import type {
  ClienteDoPortal,
  OrcamentoDoCliente,
  ParcelaDoCliente,
} from "@/modules/portal/portal.types";

/**
 * Leitura do portal.
 *
 * ⚠️ Nao ha filtro por cliente em nenhuma consulta daqui, e isso e proposital: o
 * escopo vem das policies `*_portal`, que respondem por `clientes_do_usuario()`.
 * Repetir o filtro no codigo daria a impressao de que ele e a protecao — e no
 * dia em que alguem o esquecesse, ninguem notaria a falta.
 *
 * O corolario: quem nao tem vinculo em `usuariosxclientes` recebe listas vazias,
 * que e o padrao seguro.
 */

/** Empresa da casa que emite a cobranca, como o cliente a le. */
function emitenteDe(e: { id: number; fantasia: string | null; razaosocial: string | null } | null) {
  return {
    id: e?.id ?? 0,
    nome: primeiroPreenchido(e?.fantasia, e?.razaosocial) ?? "Emitente",
  };
}

/** As empresas do CLIENTE que este usuario representa. Vazio = sem acesso. */
export async function meusClientes(): Promise<ClienteDoPortal[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao, nomefantasia, fkEmpresa")
    .order("id", { ascending: true });

  if (error) throw error;

  /*
   * Razao social inteira, e nao o nome fantasia.
   *
   * Aqui o nome identifica QUAL CNPJ do grupo deve — "RION LED INDUSTRIA
   * COMERCIO E SERVICOS ELETRICOS LTDA" e "RION PRESTACAO DE SERVICOS LTDA" sao
   * duas dividas separadas, e o fantasia das duas e "RION". No sistema o
   * fantasia serve porque a lista e da casa; aqui ele apagaria a distincao que
   * o cliente precisa fazer.
   */
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: primeiroPreenchido(c.razao, c.nomefantasia) ?? `Cliente ${c.id}`,
    emitenteId: c.fkEmpresa ?? 0,
  }));
}

/**
 * As parcelas das cobrancas deste cliente.
 *
 * Traz pagas e em aberto: o cliente quer o historico tanto quanto o que deve, e
 * e no que ja pagou que ele confere se a baixa entrou.
 */
export async function minhasParcelas(clientes: ClienteDoPortal[]): Promise<ParcelaDoCliente[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasparcelas")
    .select(
      "id, token, numeroparcela, vencimento, valor, total, pago, nfs, boleto, pagamentosxparcelas(valor), faturas!inner(id, parcelas, fkCliente, fkEmpresa, empresas(id, fantasia, razaosocial), faturasorigens(ordensservico(idtenant, id)))",
    )
    .order("vencimento", { ascending: true });

  if (error) throw error;

  const porCliente = new Map(clientes.map((c) => [c.id, c]));
  const hojeISO = hoje();

  return (data ?? []).map((l) => {
    const f = l.faturas as unknown as {
      parcelas: number | null;
      fkCliente: number | null;
      fkEmpresa: number | null;
      empresas: { id: number; fantasia: string | null; razaosocial: string | null } | null;
      faturasorigens: { ordensservico: { idtenant: number | null; id: number } | null }[] | null;
    };

    // Espelha `public.devido_da_parcela`: `total` manda, `valor` e o antigo.
    const total = doBanco(l.total ?? l.valor);
    const recebido = doBanco(
      ((l.pagamentosxparcelas ?? []) as unknown as { valor: number }[]).reduce(
        (soma, v) => soma + (v.valor ?? 0),
        0,
      ),
    );

    const vencimento = l.vencimento ? ((l.vencimento.slice(0, 10)) as DataISO) : null;
    const pago = l.pago ?? false;
    const emitente = emitenteDe(f.empresas);

    return {
      parcelaId: l.id,
      token: l.token,
      emitente,
      cliente: porCliente.get(f.fkCliente ?? 0) ?? {
        id: f.fkCliente ?? 0,
        nome: "Cliente",
        emitenteId: f.fkEmpresa ?? 0,
      },
      numero: l.numeroparcela ?? 0,
      totalParcelas: f.parcelas ?? 0,
      vencimento,
      total,
      recebido,
      emAberto: Math.max(total - recebido, 0) as Centavos,
      pago,
      atrasada: !pago && vencimento != null && vencimento < hojeISO,
      temBoleto: Boolean(l.boleto),
      temNota: Boolean(l.nfs),
      // O numero por tenant e o que o cliente ve no documento; o id interno so
      // aparece em ticket antigo, sem numeracao propria.
      tickets: (f.faturasorigens ?? [])
        .map((o) => o.ordensservico?.idtenant ?? o.ordensservico?.id)
        .filter((n): n is number => n != null),
    };
  });
}

/**
 * As propostas esperando resposta.
 *
 * A policy `ordensservico_portal` ja limita a status ORCAMENTO: os demais
 * estados do ticket sao vida interna da casa.
 */
export async function meusOrcamentos(clientes: ClienteDoPortal[]): Promise<OrcamentoDoCliente[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("ordensservico")
    .select("id, idtenant, titulo, datainicio, fkCliente, fkEmpresa, empresas(id, fantasia, razaosocial), ordensservicoxservicos(total)")
    .order("datainicio", { ascending: true });

  if (error) throw error;

  const porCliente = new Map(clientes.map((c) => [c.id, c]));

  return (data ?? []).map((t) => {
    const itens = (t.ordensservicoxservicos ?? []) as unknown as { total: number | null }[];

    return {
      ticketId: t.id,
      numero: t.idtenant ?? t.id,
      titulo: (t.titulo ?? "").trim() || "Proposta",
      cliente: porCliente.get(t.fkCliente ?? 0) ?? {
        id: t.fkCliente ?? 0,
        nome: "Cliente",
        emitenteId: t.fkEmpresa ?? 0,
      },
      emitente: emitenteDe(
        t.empresas as unknown as {
          id: number;
          fantasia: string | null;
          razaosocial: string | null;
        } | null,
      ),
      emitidoEm: t.datainicio ? ((t.datainicio.slice(0, 10)) as DataISO) : null,
      total: doBanco(itens.reduce((soma, i) => soma + (i.total ?? 0), 0)),
    };
  });
}
