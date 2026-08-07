import { serverClient } from "@/infra/supabase/client";
import type { ClienteRow } from "@/infra/supabase/database.types";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { intervalo, type Paginacao, type Pagina } from "@/shared/utils/paginacao";
import type {
  CampoDeOrdem,
  Cliente,
  ClienteNovo,
  ContagemPorPapel,
  FiltroClientes,
  PapelPessoa,
} from "@/modules/clientes/clientes.types";

/** Unica porta de acesso aos dados de clientes. */

const COLUNAS =
  "id, razao, nomefantasia, cnpj, email, contato, responsavel, fkGrupo, fkCentroCusto, ativo, cliente, fornecedor, colaborador";

/**
 * O nome do centro vem por join, nao copiado para `clientes`: renomear o centro
 * tem de refletir em todo mundo que aponta para ele.
 */
const RELACOES = "centrodecusto(descricao)";

/** A coluna do BANCO de cada campo de ordem da tela. */
const COLUNA_DA_ORDEM: Record<CampoDeOrdem, string> = {
  id: "id",
  razao: "razao",
  cnpj: "cnpj",
  contato: "contato",
  email: "email",
  responsavel: "responsavel",
};

/**
 * A pagina da listagem, com a busca e a ordem resolvidas NO BANCO.
 *
 * ⚠️ Antes a tela recebia duzentos registros e fazia tudo na memoria: buscar,
 * ordenar e paginar. Funcionava com cem pessoas e mentia com trezentas — o
 * registro de numero 201 simplesmente nao existia para a busca, e o contador
 * dizia 200 para sempre.
 *
 * ⚠️ A busca varre razao, fantasia, documento, telefone, e-mail e responsavel. E
 * `ilike '%termo%'`, que sem indice varreria a tabela inteira a cada tecla: por
 * isso existem os indices de trigrama em `clientes`. Sem eles, esta funcao e uma
 * bomba-relogio de escala.
 */
export async function listar(
  empresaId: number,
  filtro: FiltroClientes,
  paginacao: Paginacao,
): Promise<Pagina<Cliente>> {
  const supabase = await serverClient();
  const [de, ate] = intervalo(paginacao);

  let query = supabase
    .from("clientes")
    .select(`${COLUNAS}, ${RELACOES}`, { count: "exact" })
    .eq("fkEmpresa", empresaId);

  if (filtro.ativo !== undefined) query = query.eq("ativo", filtro.ativo);
  if (filtro.papel) query = query.eq(filtro.papel, true);

  if (filtro.busca) {
    const termo = `%${filtro.busca}%`;
    /*
     * ⚠️ Os digitos vao numa condicao PROPRIA. Quem digita "35 99845" procura um
     * telefone, e o texto com pontuacao nunca casaria: o cadastro guarda
     * "(35) 9 9845-6712". Sem isso, buscar por numero so funcionava se a pessoa
     * acertasse a formatacao.
     */
    const digitos = filtro.busca.replace(/\D/g, "");
    const porDigito = digitos.length >= 3 ? `,cnpj.ilike.%${digitos}%` : "";

    query = query.or(
      `razao.ilike.${termo},nomefantasia.ilike.${termo},cnpj.ilike.${termo},` +
        `contato.ilike.${termo},email.ilike.${termo},responsavel.ilike.${termo}${porDigito}`,
    );
  }

  const coluna = COLUNA_DA_ORDEM[filtro.ordem ?? "razao"];

  const { data, error, count } = await query
    /*
     * ⚠️ `nullsFirst: false` nas duas direcoes. Coluna opcional (e-mail,
     * responsavel) tem muito vazio, e invertendo a ordem eles subiam todos para
     * o topo: a tela ficava com uma parede de tracos e o dado que importa fora
     * da primeira pagina.
     */
    .order(coluna, { ascending: filtro.dir !== "desc", nullsFirst: false })
    // Desempate estavel: sem ele, duas pessoas com o mesmo nome trocam de lugar
    // entre paginas e uma delas some da listagem.
    .order("id", { ascending: true })
    .range(de, ate);

  if (error) throw error;
  return { itens: (data ?? []).map(paraDominio), total: count ?? 0 };
}

/**
 * Quantas pessoas ha em cada papel.
 *
 * ⚠️ NAO leva a busca. A contagem responde "quantos existem", e nao "quantos
 * bateram com o que eu digitei": mudando a cada tecla, ela deixaria de ser o
 * panorama do cadastro e viraria um segundo resultado da busca ao lado do
 * primeiro.
 */
export async function contagemPorPapel(
  empresaId: number,
  incluirInativos: boolean,
): Promise<ContagemPorPapel> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("clientes_contagem_por_papel", {
    p_empresa: empresaId,
    p_inativos: incluirInativos,
  });

  if (error) throw error;

  const l = data?.[0];

  return {
    total: Number(l?.total ?? 0),
    cliente: Number(l?.cliente ?? 0),
    fornecedor: Number(l?.fornecedor ?? 0),
    colaborador: Number(l?.colaborador ?? 0),
  };
}

export async function buscarPorId(empresaId: number, id: number): Promise<Cliente | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .select(`${COLUNAS}, ${RELACOES}`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? paraDominio(data) : null;
}

export async function buscarPorCnpj(empresaId: number, cnpj: string): Promise<Cliente | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .select(COLUNAS)
    .eq("fkEmpresa", empresaId)
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (error) throw error;
  return data ? paraDominio(data) : null;
}

export async function criar(
  empresaId: number,
  usuarioId: string,
  entrada: ClienteNovo,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      fkEmpresa: empresaId,
      fkUserCriacao: usuarioId,
      razao: entrada.razao,
      nomefantasia: entrada.nomeFantasia ?? null,
      cnpj: entrada.cnpj ?? null,
      email: entrada.email ?? null,
      contato: entrada.contato ?? null,
      responsavel: entrada.responsavel ?? null,
      fkGrupo: entrada.grupoId ?? null,
      // Omitido, `trg_clientes_centro_padrao` preenche com o "Geral".
      fkCentroCusto: entrada.centroCustoId ?? null,
      ativo: true,
      cliente: entrada.papeis.includes("cliente"),
      fornecedor: entrada.papeis.includes("fornecedor"),
      colaborador: entrada.papeis.includes("colaborador"),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

type Linha = {
  id: number;
  razao: string | null;
  nomefantasia: string | null;
  cnpj: string | null;
  email: string | null;
  contato: string | null;
  responsavel: string | null;
  fkGrupo: number | null;
  fkCentroCusto: number | null;
  ativo: boolean | null;
  cliente: boolean | null;
  fornecedor: boolean | null;
  colaborador: boolean | null;
  centrodecusto?: unknown;
};

function paraDominio(l: Linha): Cliente {
  const papeis: PapelPessoa[] = [];
  if (l.cliente) papeis.push("cliente");
  if (l.fornecedor) papeis.push("fornecedor");
  if (l.colaborador) papeis.push("colaborador");

  return {
    id: l.id,
    razao: l.razao ?? "",
    nomeFantasia: l.nomefantasia,
    cnpj: l.cnpj,
    email: l.email,
    contato: l.contato,
    responsavel: l.responsavel,
    papeis,
    grupoId: l.fkGrupo,
    centroCustoId: l.fkCentroCusto,
    centroCustoNome: (l.centrodecusto as { descricao: string | null } | null)?.descricao ?? null,
    ativo: l.ativo ?? true,
  };
}

export async function atualizar(
  empresaId: number,
  id: number,
  usuarioId: string,
  entrada: Partial<ClienteNovo> & { ativo?: boolean },
): Promise<void> {
  const supabase = await serverClient();

  // Monta so o que veio: enviar `undefined` apagaria coluna nao editada.
  const campos: Partial<ClienteRow> = { updated_at: new Date().toISOString() };
  if (entrada.razao !== undefined) campos.razao = entrada.razao;
  if (entrada.nomeFantasia !== undefined) campos.nomefantasia = entrada.nomeFantasia;
  if (entrada.cnpj !== undefined) campos.cnpj = entrada.cnpj;
  if (entrada.email !== undefined) campos.email = entrada.email;
  if (entrada.contato !== undefined) campos.contato = entrada.contato;
  if (entrada.responsavel !== undefined) campos.responsavel = entrada.responsavel;
  if (entrada.grupoId !== undefined) campos.fkGrupo = entrada.grupoId;
  if (entrada.centroCustoId !== undefined) campos.fkCentroCusto = entrada.centroCustoId;
  if (entrada.ativo !== undefined) campos.ativo = entrada.ativo;
  if (entrada.papeis !== undefined) {
    campos.cliente = entrada.papeis.includes("cliente");
    campos.fornecedor = entrada.papeis.includes("fornecedor");
    campos.colaborador = entrada.papeis.includes("colaborador");
  }

  const { error } = await supabase
    .from("clientes")
    .update(campos)
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
  void usuarioId;
}

/**
 * Arvore cliente -> centro de custo -> endereco, para os selects em cascata.
 *
 * Vem inteira numa consulta e viaja com a pagina em vez de virar endpoint: sao
 * ~116 clientes com um punhado de centros e enderecos cada, e um `fetch` por
 * troca de cliente colocaria latencia de rede no meio do preenchimento de um
 * formulario.
 *
 * Se um dia isso crescer a ponto de pesar, o corte natural e buscar os centros
 * sob demanda — o formato ja e o mesmo.
 */
export type CentroDoCliente = {
  id: number;
  descricao: string;
  enderecos: { id: number; resumo: string }[];
};

export type ClienteComCentros = {
  id: number;
  nome: string;
  centros: CentroDoCliente[];
};

export async function arvoreDeClientes(empresaId: number): Promise<ClienteComCentros[]> {
  const supabase = await serverClient();

  const [pessoas, vinculos, enderecos] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, razao, nomefantasia")
      .eq("fkEmpresa", empresaId)
      .eq("cliente", true)
      .eq("ativo", true)
      .order("razao"),
    supabase
      .from("clientesxcentrocusto")
      .select('"fkCliente", "fkCentroCusto", centrodecusto(descricao)'),
    supabase
      .from("clientesenderecos")
      .select('id, "fkCliente", "fkCentroCusto", logradouro, numero, bairro, cidade, uf'),
  ]);

  if (pessoas.error) throw pessoas.error;
  if (vinculos.error) throw vinculos.error;
  if (enderecos.error) throw enderecos.error;

  return (pessoas.data ?? []).map((c) => {
    const centros = (vinculos.data ?? []).filter((v) => v.fkCliente === c.id);

    return {
      id: c.id,
      nome: primeiroPreenchido(c.nomefantasia, c.razao) ?? `Cliente ${c.id}`,
      centros: centros.map((v) => {
        const nome = (v.centrodecusto as unknown as { descricao: string | null } | null)?.descricao;

        return {
          id: v.fkCentroCusto,
          descricao: (nome ?? "").trim() || "Sem nome",
          enderecos: (enderecos.data ?? [])
            .filter((e) => e.fkCliente === c.id && e.fkCentroCusto === v.fkCentroCusto)
            .map((e) => ({
              id: e.id,
              resumo:
                [
                  [e.logradouro, e.numero].filter(Boolean).join(", "),
                  e.bairro,
                  [e.cidade, e.uf].filter(Boolean).join("/"),
                ]
                  .filter(Boolean)
                  .join(" · ") || `Endereço ${e.id}`,
            })),
        };
      }),
    };
  });
}
