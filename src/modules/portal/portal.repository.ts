import { serverClient } from "@/infra/supabase/client";
import { doBanco, type Centavos } from "@/shared/utils/money";
import { primeiroPreenchido } from "@/shared/utils/texto";
import type { DataISO } from "@/shared/utils/datas";
import type { ClienteDoPortal, ParcelaDoCliente } from "@/modules/portal/portal.types";

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

/** Os clientes que este usuario representa. Vazio = sem acesso a nada. */
export async function meusClientes(): Promise<ClienteDoPortal[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao, nomefantasia")
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    nome: primeiroPreenchido(c.nomefantasia, c.razao) ?? `Cliente ${c.id}`,
  }));
}

/**
 * As parcelas das cobrancas deste cliente.
 *
 * Traz pagas e em aberto: o cliente quer o historico tanto quanto o que deve, e
 * e no recibo do que ja pagou que ele confere se a baixa entrou.
 */
export async function minhasParcelas(): Promise<ParcelaDoCliente[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("faturasparcelas")
    .select(
      "id, token, numeroparcela, vencimento, valor, total, pago, nfs, boleto, pagamentosxparcelas(valor), faturas!inner(id, parcelas, fkEmpresa, empresas(id, fantasia, razaosocial), faturasorigens(ordensservico(idtenant, id)))",
    )
    .order("vencimento", { ascending: true });

  if (error) throw error;

  const hoje = new Date().toISOString().slice(0, 10);

  return (data ?? []).map((l) => {
    const f = l.faturas as unknown as {
      parcelas: number | null;
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

    const emAberto = Math.max(total - recebido, 0) as Centavos;
    const vencimento = l.vencimento ? ((l.vencimento.slice(0, 10)) as DataISO) : null;
    const pago = l.pago ?? false;

    return {
      parcelaId: l.id,
      token: l.token,
      emitente: {
        id: f.empresas?.id ?? f.fkEmpresa ?? 0,
        nome:
          primeiroPreenchido(f.empresas?.fantasia, f.empresas?.razaosocial) ?? "Emitente",
      },
      numero: l.numeroparcela ?? 0,
      totalParcelas: f.parcelas ?? 0,
      vencimento,
      total,
      recebido,
      emAberto,
      pago,
      atrasada: !pago && vencimento != null && vencimento < hoje,
      temBoleto: Boolean(l.boleto),
      temNota: Boolean(l.nfs),
      // O numero por tenant e o que o cliente ve no documento; o id interno so
      // aparece se o ticket for antigo e nao tiver numeracao propria.
      tickets: (f.faturasorigens ?? [])
        .map((o) => o.ordensservico?.idtenant ?? o.ordensservico?.id)
        .filter((n): n is number => n != null),
    };
  });
}
