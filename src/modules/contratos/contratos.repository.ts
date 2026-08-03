import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, type Centavos } from "@/shared/utils/money";
import { primeiroPreenchido } from "@/shared/utils/texto";
import type { ContratoRow } from "@/infra/supabase/database.types";
import type { DataISO } from "@/shared/utils/datas";
import type {
  Competencia,
  Contrato,
  ContratoNovo,
  ContratoResumo,
  Periodicidade,
} from "@/modules/contratos/contratos.types";

/** Unica porta de acesso aos dados de contrato. */

const COLUNAS =
  'id, numero, descricao, valor, periodicidade, dia_vencimento, inicio, fim, proxima_competencia, ativo, "fkCliente"';

export async function listar(empresaId: number, incluirInativos: boolean): Promise<ContratoResumo[]> {
  const supabase = await serverClient();

  let query = supabase
    .from("contratos")
    .select(`${COLUNAS}, clientes(razao, nomefantasia)`)
    .eq("fkEmpresa", empresaId)
    .eq("deletado", false);

  if (!incluirInativos) query = query.eq("ativo", true);

  const { data, error } = await query.order("id", { ascending: false });
  if (error) throw error;

  const linhas = data ?? [];
  const contagens = await contarCompetencias(linhas.map((l) => l.id));

  return linhas.map((l) => paraDominio(l, contagens.get(l.id) ?? 0));
}

/** Uma consulta para a lista inteira: contar por linha seria N+1 na abertura. */
async function contarCompetencias(ids: number[]): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("contratoscompetencias")
    .select('"fkContrato"')
    .in("fkContrato", ids);

  if (error) throw error;
  for (const l of data ?? []) mapa.set(l.fkContrato, (mapa.get(l.fkContrato) ?? 0) + 1);
  return mapa;
}

export async function buscarPorId(empresaId: number, id: number): Promise<Contrato | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contratos")
    .select(`${COLUNAS}, clientes(razao, nomefantasia)`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const competencias = await listarCompetencias(id);
  return { ...paraDominio(data, competencias.length), competencias };
}

export async function listarCompetencias(contratoId: number): Promise<Competencia[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contratoscompetencias")
    .select('id, competencia, valor, created_at, "fkOrdem"')
    .eq("fkContrato", contratoId)
    .order("competencia", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id,
    competencia: l.competencia.slice(0, 10) as DataISO,
    ticketId: l.fkOrdem,
    valor: doBanco(l.valor),
    geradaEm: l.created_at,
  }));
}

export async function criar(
  empresaId: number,
  usuarioId: string | null,
  entrada: ContratoNovo,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("contratos")
    .insert({
      numero: entrada.numero ?? null,
      descricao: entrada.descricao ?? null,
      fkCliente: entrada.clienteId ?? null,
      valor: paraBanco(entrada.valor),
      periodicidade: entrada.periodicidade,
      dia_vencimento: entrada.diaVencimento ?? null,
      inicio: entrada.inicio ?? null,
      fim: entrada.fim ?? null,
      // Nasce apontando para o próprio início: a primeira competência a gerar é
      // a do mês em que o contrato começou, não a do mês em que foi cadastrado.
      proxima_competencia: entrada.inicio ?? null,
      ativo: true,
      deletado: false,
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function atualizar(
  empresaId: number,
  id: number,
  usuarioId: string | null,
  entrada: Partial<ContratoNovo> & { ativo?: boolean },
): Promise<void> {
  const supabase = await serverClient();

  const campos: Partial<ContratoRow> = {
    updated_at: new Date().toISOString(),
    fkUserModificacao: usuarioId,
  };
  if (entrada.numero !== undefined) campos.numero = entrada.numero;
  if (entrada.descricao !== undefined) campos.descricao = entrada.descricao;
  if (entrada.clienteId !== undefined) campos.fkCliente = entrada.clienteId;
  if (entrada.valor !== undefined) campos.valor = paraBanco(entrada.valor as Centavos);
  if (entrada.periodicidade !== undefined) campos.periodicidade = entrada.periodicidade;
  if (entrada.diaVencimento !== undefined) campos.dia_vencimento = entrada.diaVencimento;
  if (entrada.inicio !== undefined) campos.inicio = entrada.inicio;
  if (entrada.fim !== undefined) campos.fim = entrada.fim;
  if (entrada.ativo !== undefined) campos.ativo = entrada.ativo;

  const { error } = await supabase
    .from("contratos")
    .update(campos)
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/**
 * Gera a próxima competência.
 *
 * Vai por RPC porque cria o ticket e registra a competência na MESMA transação:
 * se o ticket entrasse sem o registro, o próximo clique geraria outro. A RPC
 * também repete as guardas (contrato ativo, competência não gerada, não passar
 * do mês corrente) — a tela evita a viagem, o banco é quem garante.
 */
export async function gerarCompetencia(
  contratoId: number,
  usuarioId: string | null,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("gerar_competencia_do_contrato", {
    p_contrato: contratoId,
    p_usuario: usuarioId,
  });

  if (error) throw error;
  return data as number;
}

type Linha = {
  id: number;
  numero: string | null;
  descricao: string | null;
  valor: number | null;
  periodicidade: string;
  dia_vencimento: number | null;
  inicio: string | null;
  fim: string | null;
  proxima_competencia: string | null;
  ativo: boolean | null;
  fkCliente: number | null;
  clientes?: unknown;
};

function paraDominio(l: Linha, qtdCompetencias: number): ContratoResumo {
  const cliente = l.clientes as { razao: string | null; nomefantasia: string | null } | null;
  const data = (v: string | null) => (v ? (v.slice(0, 10) as DataISO) : null);

  return {
    id: l.id,
    numero: l.numero,
    descricao: l.descricao,
    clienteId: l.fkCliente,
    clienteNome: primeiroPreenchido(cliente?.nomefantasia, cliente?.razao),
    valor: doBanco(l.valor),
    periodicidade: l.periodicidade as Periodicidade,
    diaVencimento: l.dia_vencimento,
    inicio: data(l.inicio),
    fim: data(l.fim),
    proximaCompetencia: data(l.proxima_competencia),
    ativo: l.ativo ?? true,
    qtdCompetencias,
  };
}
