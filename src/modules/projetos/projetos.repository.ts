import { serverClient } from "@/infra/supabase/client";
import { doBanco, paraBanco, type Centavos } from "@/shared/utils/money";
import { primeiroPreenchido } from "@/shared/utils/texto";
import type { DataISO } from "@/shared/utils/datas";
import type { ProjetoDemandaRow, ProjetoRow } from "@/infra/supabase/database.types";
import type {
  ColunaProjeto,
  Demanda,
  FiltroProjetos,
  Modalidade,
  Projeto,
  ProjetoNovo,
  ProjetoResumo,
  ContratoDoProjeto,
  SituacaoProjeto,
  TicketDisponivel,
  TicketDoProjeto,
  Anexo,
  Comentario,
  ItemDaTarefa,
} from "@/modules/projetos/projetos.types";

/** Unica porta de acesso aos dados de projeto. */

const COLUNAS =
  'id, idtenant, nome, descricao, modalidade, situacao, inicio, fim, ativo, cancelado, "fkCliente"';

const RELACOES = "clientes(razao, nomefantasia)";

/*
 * Autoria so no detalhe: na listagem seriam dois embeds a mais por linha para um
 * dado que vive atras de um clique.
 *
 * ⚠️ Qualificado pelo nome da constraint — `projetos` tem DUAS chaves para
 * `usuarios` (criacao e modificacao), e sem qualificar o PostgREST responde
 * PGRST201. Literal unico, nunca concatenado: o supabase-js interpreta a string
 * do `select` em tempo de tipo.
 */
const RELACOES_DETALHE =
  'clientes(razao, nomefantasia), criador:usuarios!projetos_fkUserCriacao_fkey(nome, email), editor:usuarios!projetos_fkUserModificacao_fkey(nome, email)';

export async function listar(
  empresaId: number,
  filtro: FiltroProjetos,
): Promise<ProjetoResumo[]> {
  const supabase = await serverClient();

  let query = supabase
    .from("projetos")
    .select(`${COLUNAS}, ${RELACOES}`)
    .eq("fkEmpresa", empresaId);

  if (!filtro.incluirEncerrados) query = query.eq("ativo", true);
  if (filtro.clienteId) query = query.eq("fkCliente", filtro.clienteId);
  if (filtro.modalidade) query = query.eq("modalidade", filtro.modalidade);

  const { data, error } = await query.order("id", { ascending: false });
  if (error) throw error;

  const linhas = data ?? [];
  const ids = linhas.map((l) => l.id);
  const [contagens, tickets] = await Promise.all([contarDemandas(ids), ticketsDosProjetos(ids)]);

  return linhas.map((l) => paraDominio(l, contagens.get(l.id), tickets.get(l.id)));
}

/**
 * Quantas demandas cada projeto tem, e quantas ja concluiram.
 *
 * Uma consulta para a lista inteira, nao uma por projeto: com trinta projetos
 * em tela o N+1 apareceria no primeiro carregamento.
 */
async function contarDemandas(
  ids: number[],
): Promise<Map<number, { total: number; concluidas: number }>> {
  const mapa = new Map<number, { total: number; concluidas: number }>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandas")
    .select('"fkProjeto", concluida_em')
    .in("fkProjeto", ids);

  if (error) throw error;

  for (const l of data ?? []) {
    const atual = mapa.get(l.fkProjeto) ?? { total: 0, concluidas: 0 };
    atual.total += 1;
    if (l.concluida_em) atual.concluidas += 1;
    mapa.set(l.fkProjeto, atual);
  }
  return mapa;
}

/**
 * O titulo do ticket, quando ele tem um de verdade.
 *
 * ⚠️ Na base migrada `ordensservico.titulo` guarda o NUMERO antigo do
 * FlutterFlow, nao um nome: "173". Exibido ao lado do numero por tenant, viram
 * dois numeros diferentes para o mesmo ticket, e nenhum dos dois se explica.
 * So numero, entao, e o mesmo que nao ter titulo — quem identifica a cobranca e
 * o cliente.
 */
function tituloDoTicket(bruto: string | null): string | null {
  const limpo = (bruto ?? "").trim();
  if (!limpo || /^\d+$/.test(limpo)) return null;
  return limpo;
}

/**
 * Os tickets de cada projeto, ja com o valor somado.
 *
 * Duas consultas para a lista inteira — o vinculo e depois os valores — e nao
 * uma por projeto: com trinta projetos em tela o N+1 aparece no primeiro
 * carregamento.
 *
 * O valor vem da view que ja soma os itens do ticket, e nao do que foi digitado
 * ao gerar: depois de gerado quem manda e o ticket, e um servico ajustado la
 * deve aparecer aqui.
 */
async function ticketsDosProjetos(ids: number[]): Promise<Map<number, TicketDoProjeto[]>> {
  const mapa = new Map<number, TicketDoProjeto[]>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosordens")
    /*
     * ⚠️ `coluna:` qualificado pelo nome da constraint — `ordensservico` tem
     * DUAS chaves para `ordensservicostatus`, e sem qualificar o PostgREST
     * responde PGRST201.
     */
    .select(
      '"fkProjeto", "fkOrdem", ordensservico(id, idtenant, titulo, datainicio, coluna:ordensservicostatus!ordensservico_fkStatus_fkey(descricao))',
    )
    .in("fkProjeto", ids)
    .order("id", { ascending: true });

  if (error) throw error;

  const linhas = data ?? [];
  const ordens = linhas.map((l) => l.fkOrdem);
  if (ordens.length === 0) return mapa;

  const { data: totais, error: erroTotais } = await supabase
    .from("vw_origens_faturamento")
    .select("origem_id, total")
    .eq("tipo", "TICKET")
    .in("origem_id", ordens);

  if (erroTotais) throw erroTotais;
  const porOrdem = new Map((totais ?? []).map((t) => [t.origem_id, t.total ?? 0]));

  for (const l of linhas) {
    const o = l.ordensservico as unknown as {
      id: number;
      idtenant: number | null;
      titulo: string | null;
      datainicio: string | null;
      coluna: { descricao: string | null } | null;
    } | null;
    if (!o) continue;

    const lista = mapa.get(l.fkProjeto) ?? [];
    lista.push({
      id: o.id,
      numero: o.idtenant ?? o.id,
      titulo: tituloDoTicket(o.titulo),
      valor: doBanco(porOrdem.get(l.fkOrdem) ?? 0),
      situacao: o.coluna?.descricao ?? null,
      inicio: o.datainicio ? ((o.datainicio.slice(0, 10)) as DataISO) : null,
    });
    mapa.set(l.fkProjeto, lista);
  }
  return mapa;
}

export async function buscarPorId(empresaId: number, id: number): Promise<Projeto | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("projetos")
    .select(`${COLUNAS}, created_at, updated_at, ${RELACOES_DETALHE}`)
    .eq("fkEmpresa", empresaId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [colunas, demandas, tickets, contratos] = await Promise.all([
    listarColunas(id),
    listarDemandas(id),
    ticketsDosProjetos([id]),
    contratosDosProjetos([id]),
  ]);

  const concluidas = demandas.filter((d) => d.concluidaEm).length;
  const doProjeto = tickets.get(id) ?? [];
  type Pessoa = { nome: string | null; email: string | null } | null;
  const criador = data.criador as unknown as Pessoa;
  const editor = data.editor as unknown as Pessoa;

  return {
    ...paraDominio(data, { total: demandas.length, concluidas }, doProjeto),
    descricao: data.descricao,
    colunas,
    demandas,
    tickets: doProjeto,
    contratos: contratos.get(id) ?? [],
    autoria: {
      criadoEm: data.created_at,
      criadoPor: primeiroPreenchido(criador?.nome, criador?.email),
      editadoEm: data.updated_at,
      editadoPor: primeiroPreenchido(editor?.nome, editor?.email),
    },
  };
}

export async function listarColunas(projetoId: number): Promise<ColunaProjeto[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("projetosstatus")
    .select("id, descricao, indice, cor, ativo, conclui")
    .eq("fkProjeto", projetoId)
    .order("indice", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((l) => ({
    id: l.id,
    descricao: (l.descricao ?? "").trim() || "Sem nome",
    indice: l.indice ?? 0,
    cor: l.cor ?? "neutral",
    ativo: l.ativo ?? true,
    conclui: l.conclui ?? false,
  }));
}

export async function listarDemandas(projetoId: number): Promise<Demanda[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("projetosdemandas")
    .select(
      /*
       * Qualificado pelo nome da constraint: `projetosdemandas` tem TRES chaves
       * estrangeiras para `usuarios` — responsavel, criacao e modificacao. Sem
       * qualificar, o PostgREST responde PGRST201 (ambiguo).
       *
       * ⚠️ Literal unico, nunca concatenado: o supabase-js interpreta a string
       * do `select` EM TEMPO DE TIPO, e `'a' + 'b'` devolve `GenericStringError`
       * no lugar da linha tipada.
       */
      'id, titulo, descricao, "fkStatus", "fkResponsavel", inicio, prazo, valor, concluida_em, "fkOrdem", created_at, updated_at, responsavel:usuarios!projetosdemandas_fkResponsavel_fkey(nome, email), criador:usuarios!projetosdemandas_fkUserCriacao_fkey(nome, email), editor:usuarios!projetosdemandas_fkUserModificacao_fkey(nome, email)',
    )
    .eq("fkProjeto", projetoId)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  const linhas = data ?? [];
  const ids = linhas.map((l) => l.id);
  const [itens, comentarios, anexos] = await Promise.all([
    itensDasTarefas(ids),
    comentariosDasTarefas(ids),
    anexosDasTarefas(ids),
  ]);

  return linhas.map((l) => {
    type Pessoa = { nome: string | null; email: string | null } | null;
    const u = l.responsavel as unknown as Pessoa;
    const criador = l.criador as unknown as Pessoa;
    const editor = l.editor as unknown as Pessoa;
    const data = (v: string | null) => (v ? ((v.slice(0, 10)) as DataISO) : null);

    return {
      id: l.id,
      titulo: l.titulo,
      descricao: l.descricao,
      colunaId: l.fkStatus,
      responsavelId: l.fkResponsavel,
      responsavelNome: primeiroPreenchido(u?.nome, u?.email),
      inicio: data(l.inicio),
      prazo: data(l.prazo),
      concluidaEm: l.concluida_em,
      criadaEm: l.created_at,
      criadaPor: primeiroPreenchido(criador?.nome, criador?.email),
      alteradaEm: l.updated_at,
      alteradaPor: primeiroPreenchido(editor?.nome, editor?.email),
      valor: doBanco(l.valor),
      ticketId: l.fkOrdem,
      itens: itens.get(l.id) ?? [],
      comentarios: comentarios.get(l.id) ?? [],
      anexos: anexos.get(l.id) ?? [],
    };
  });
}

/**
 * Checklist e comentarios de TODAS as tarefas do projeto, em duas consultas.
 *
 * Uma por tarefa seria N+1 num quadro que pode ter dezenas delas — e o card
 * precisa do progresso do checklist para desenhar.
 */
async function itensDasTarefas(ids: number[]): Promise<Map<number, ItemDaTarefa[]>> {
  const mapa = new Map<number, ItemDaTarefa[]>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandasitens")
    .select('id, "fkDemanda", descricao, feito')
    .in("fkDemanda", ids)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  for (const l of data ?? []) {
    const lista = mapa.get(l.fkDemanda) ?? [];
    lista.push({ id: l.id, descricao: l.descricao, feito: l.feito });
    mapa.set(l.fkDemanda, lista);
  }
  return mapa;
}

async function comentariosDasTarefas(ids: number[]): Promise<Map<number, Comentario[]>> {
  const mapa = new Map<number, Comentario[]>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandascomentarios")
    .select('id, "fkDemanda", texto, created_at, usuarios(nome, email)')
    .in("fkDemanda", ids)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const l of data ?? []) {
    const u = l.usuarios as unknown as { nome: string | null; email: string | null } | null;
    const lista = mapa.get(l.fkDemanda) ?? [];
    lista.push({
      id: l.id,
      texto: l.texto,
      autorNome: primeiroPreenchido(u?.nome, u?.email),
      em: l.created_at,
    });
    mapa.set(l.fkDemanda, lista);
  }
  return mapa;
}

async function anexosDasTarefas(ids: number[]): Promise<Map<number, Anexo[]>> {
  const mapa = new Map<number, Anexo[]>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandasanexos")
    .select('id, "fkDemanda", url, nome')
    .in("fkDemanda", ids)
    .order("id", { ascending: true });

  if (error) throw error;

  for (const l of data ?? []) {
    const lista = mapa.get(l.fkDemanda) ?? [];
    lista.push({ id: l.id, url: l.url, nome: nomeDoAnexo(l.nome, l.url) });
    mapa.set(l.fkDemanda, lista);
  }
  return mapa;
}

/** Sem nome, usa o arquivo do fim da URL — melhor que exibir a URL crua. */
function nomeDoAnexo(nome: string | null, url: string): string {
  const limpo = (nome ?? "").trim();
  if (limpo) return limpo;

  try {
    const caminho = new URL(url).pathname;
    return decodeURIComponent(caminho.split("/").filter(Boolean).pop() ?? url);
  } catch {
    return url;
  }
}

// ── Checklist, comentarios e anexos ─────────────────────────────────────────

export async function criarItem(demandaId: number, usuarioId: string | null, descricao: string) {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("projetosdemandasitens")
    .insert({ fkDemanda: demandaId, descricao, fkUserCriacao: usuarioId });
  if (error) throw error;
}

export async function alternarItem(itemId: number, feito: boolean) {
  const supabase = await serverClient();
  const { error } = await supabase.from("projetosdemandasitens").update({ feito }).eq("id", itemId);
  if (error) throw error;
}

export async function excluirItem(itemId: number) {
  const supabase = await serverClient();
  const { error } = await supabase.from("projetosdemandasitens").delete().eq("id", itemId);
  if (error) throw error;
}

export async function comentar(demandaId: number, usuarioId: string | null, texto: string) {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("projetosdemandascomentarios")
    .insert({ fkDemanda: demandaId, fkUsuario: usuarioId, texto });
  if (error) throw error;
}

export async function anexar(
  demandaId: number,
  usuarioId: string | null,
  entrada: { url: string; nome?: string | null },
) {
  const supabase = await serverClient();
  const { error } = await supabase.from("projetosdemandasanexos").insert({
    fkDemanda: demandaId,
    url: entrada.url,
    nome: entrada.nome ?? null,
    fkUserCriacao: usuarioId,
  });
  if (error) throw error;
}

export async function excluirAnexo(anexoId: number) {
  const supabase = await serverClient();
  const { error } = await supabase.from("projetosdemandasanexos").delete().eq("id", anexoId);
  if (error) throw error;
}

export async function demandaDoAnexo(anexoId: number): Promise<number | null> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandasanexos")
    .select('"fkDemanda"')
    .eq("id", anexoId)
    .maybeSingle();

  if (error) throw error;
  return data?.fkDemanda ?? null;
}

/**
 * Ticket do escopo fechado, e ticket de um LOTE de tarefas concluidas.
 *
 * Vao por RPC porque criam ticket, itens e vinculo na MESMA transacao: com o
 * ticket entrando sem o vinculo, o proximo clique geraria outro e o projeto
 * cobraria duas vezes.
 */
export async function gerarTicketDoProjeto(
  projetoId: number,
  usuarioId: string | null,
  valor: Centavos,
  titulo: string | null,
): Promise<number> {
  const supabase = await serverClient();
  const { data, error } = await supabase.rpc("gerar_ticket_do_projeto", {
    p_projeto: projetoId,
    p_usuario: usuarioId,
    p_valor: paraBanco(valor),
    p_titulo: titulo,
  });

  if (error) throw error;
  return data as number;
}

export async function gerarTicketDasDemandas(
  demandaIds: number[],
  usuarioId: string | null,
): Promise<number> {
  const supabase = await serverClient();
  const { data, error } = await supabase.rpc("gerar_ticket_das_demandas", {
    p_demandas: demandaIds,
    p_usuario: usuarioId,
  });

  if (error) throw error;
  return data as number;
}

/** Confere o tenant de um item/comentario — nenhum dos dois tem `fkEmpresa`. */
export async function demandaDoItem(itemId: number): Promise<number | null> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandasitens")
    .select('"fkDemanda"')
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw error;
  return data?.fkDemanda ?? null;
}

// ── Escrita ─────────────────────────────────────────────────────────────────

export async function criar(
  empresaId: number,
  usuarioId: string | null,
  entrada: ProjetoNovo,
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("projetos")
    .insert({
      nome: entrada.nome,
      descricao: entrada.descricao ?? null,
      fkCliente: entrada.clienteId ?? null,
      modalidade: entrada.modalidade,
      situacao: entrada.situacao ?? "FILA",
      inicio: entrada.inicio ?? null,
      fim: entrada.fim ?? null,
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
  entrada: Partial<ProjetoNovo> & { ativo?: boolean; cancelado?: boolean },
): Promise<void> {
  const supabase = await serverClient();

  // Monta so o que veio: enviar `undefined` apagaria coluna nao editada.
  const campos: Partial<ProjetoRow> = {
    updated_at: new Date().toISOString(),
    fkUserModificacao: usuarioId,
  };
  if (entrada.nome !== undefined) campos.nome = entrada.nome;
  if (entrada.descricao !== undefined) campos.descricao = entrada.descricao;
  if (entrada.clienteId !== undefined) campos.fkCliente = entrada.clienteId;
  if (entrada.modalidade !== undefined) campos.modalidade = entrada.modalidade;
  if (entrada.situacao !== undefined) campos.situacao = entrada.situacao;
  if (entrada.inicio !== undefined) campos.inicio = entrada.inicio;
  if (entrada.fim !== undefined) campos.fim = entrada.fim;
  if (entrada.ativo !== undefined) campos.ativo = entrada.ativo;
  if (entrada.cancelado !== undefined) campos.cancelado = entrada.cancelado;

  const { error } = await supabase
    .from("projetos")
    .update(campos)
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/**
 * Apaga o projeto. Colunas, tarefas, checklist, comentarios e anexos vao junto
 * por `on delete cascade` — o servico e que confere se pode.
 */
export async function excluirProjeto(empresaId: number, id: number): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("projetos")
    .delete()
    .eq("fkEmpresa", empresaId)
    .eq("id", id);

  if (error) throw error;
}

/**
 * Solta o ticket do projeto. O TICKET continua existindo — o que sai e o
 * vinculo, e com ele o "ja cobrada" das tarefas que estavam nele.
 */
export async function desvincularTicket(projetoId: number, ticketId: number): Promise<void> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from("projetosordens")
    .delete()
    .eq("fkProjeto", projetoId)
    .eq("fkOrdem", ticketId);

  if (error) throw error;

  // As tarefas daquele ticket voltam a poder ser cobradas. Sem isto elas
  // ficariam apontando para um ticket que o projeto nao conhece mais, e nem
  // apareceriam em "Faturar tarefas" nem teriam como ser desfeitas.
  const { error: erroDemandas } = await supabase
    .from("projetosdemandas")
    .update({ fkOrdem: null, updated_at: new Date().toISOString() })
    .eq("fkProjeto", projetoId)
    .eq("fkOrdem", ticketId);

  if (erroDemandas) throw erroDemandas;
}

const COLUNAS_CONTRATO = "id, numero, descricao, valor, inicio, fim, ativo";

/** Os contratos que cobrem cada projeto. Uma consulta para a lista inteira. */
async function contratosDosProjetos(ids: number[]): Promise<Map<number, ContratoDoProjeto[]>> {
  const mapa = new Map<number, ContratoDoProjeto[]>();
  if (ids.length === 0) return mapa;

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetoscontratos")
    .select('"fkProjeto", contratos(id, numero, descricao, valor, inicio, fim, ativo)')
    .in("fkProjeto", ids)
    .order("id", { ascending: true });

  if (error) throw error;

  for (const l of data ?? []) {
    const c = l.contratos as unknown as {
      id: number;
      numero: string | null;
      descricao: string | null;
      valor: number | null;
      inicio: string | null;
      fim: string | null;
      ativo: boolean | null;
    } | null;
    if (!c) continue;

    const lista = mapa.get(l.fkProjeto) ?? [];
    lista.push({
      id: c.id,
      numero: c.numero,
      descricao: c.descricao,
      valor: doBanco(c.valor ?? 0),
      inicio: c.inicio ? ((c.inicio.slice(0, 10)) as DataISO) : null,
      fim: c.fim ? ((c.fim.slice(0, 10)) as DataISO) : null,
      ativo: c.ativo ?? true,
    });
    mapa.set(l.fkProjeto, lista);
  }
  return mapa;
}

/**
 * Contratos que ainda nao cobrem este projeto.
 *
 * Ao contrario do ticket, o contrato PODE servir a varios projetos — um retainer
 * cobre o ano inteiro. O que se exclui e so o que ja esta neste.
 */
export async function contratosDisponiveis(
  empresaId: number,
  projetoId: number,
  clienteId: number | null,
): Promise<ContratoDoProjeto[]> {
  const supabase = await serverClient();

  const { data: usados, error: erroUsados } = await supabase
    .from("projetoscontratos")
    .select('"fkContrato"')
    .eq("fkProjeto", projetoId);

  if (erroUsados) throw erroUsados;
  const jaTem = (usados ?? []).map((u) => u.fkContrato);

  let query = supabase
    .from("contratos")
    .select(COLUNAS_CONTRATO)
    .eq("fkEmpresa", empresaId)
    .eq("ativo", true);

  // Contrato e de um cliente so: oferecer os dos outros seria oferecer o que a
  // propria cobranca contradiz.
  if (clienteId != null) query = query.eq("fkCliente", clienteId);
  if (jaTem.length > 0) query = query.not("id", "in", `(${jaTem.join(",")})`);

  const { data, error } = await query.order("id", { ascending: false }).limit(200);
  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    numero: c.numero,
    descricao: c.descricao,
    valor: doBanco(c.valor ?? 0),
    inicio: c.inicio ? ((c.inicio.slice(0, 10)) as DataISO) : null,
    fim: c.fim ? ((c.fim.slice(0, 10)) as DataISO) : null,
    ativo: c.ativo ?? true,
  }));
}

export async function vincularContrato(
  projetoId: number,
  contratoId: number,
  usuarioId: string | null,
): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("projetoscontratos")
    .insert({ fkProjeto: projetoId, fkContrato: contratoId, fkUserCriacao: usuarioId });

  if (error) throw error;
}

export async function desvincularContrato(projetoId: number, contratoId: number): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("projetoscontratos")
    .delete()
    .eq("fkProjeto", projetoId)
    .eq("fkContrato", contratoId);

  if (error) throw error;
}

/**
 * Tickets que ainda nao pertencem a projeto nenhum.
 *
 * Cancelado fica de fora: vincular uma cobranca cancelada faria o projeto somar
 * um valor que ninguem vai receber. Os ja vinculados tambem, porque a `UNIQUE`
 * de `projetosordens` recusaria depois — melhor nao oferecer do que oferecer e
 * negar no clique.
 */
export async function ticketsDisponiveis(empresaId: number): Promise<TicketDisponivel[]> {
  const supabase = await serverClient();

  const { data: vinculados, error: erroVinculos } = await supabase
    .from("projetosordens")
    .select('"fkOrdem"');

  if (erroVinculos) throw erroVinculos;
  const usados = (vinculados ?? []).map((v) => v.fkOrdem);

  let query = supabase
    .from("ordensservico")
    .select(
      'id, idtenant, titulo, datainicio, "fkCliente", clientes(razao, nomefantasia), coluna:ordensservicostatus!ordensservico_fkStatus_fkey(descricao)',
    )
    .eq("fkEmpresa", empresaId)
    .eq("cancelada", false);

  if (usados.length > 0) query = query.not("id", "in", `(${usados.join(",")})`);

  const { data, error } = await query.order("id", { ascending: false }).limit(200);
  if (error) throw error;

  const linhas = data ?? [];
  if (linhas.length === 0) return [];

  const { data: totais, error: erroTotais } = await supabase
    .from("vw_origens_faturamento")
    .select("origem_id, total")
    .eq("tipo", "TICKET")
    .in("origem_id", linhas.map((l) => l.id));

  if (erroTotais) throw erroTotais;
  const porOrdem = new Map((totais ?? []).map((t) => [t.origem_id, t.total ?? 0]));

  return linhas.map((l) => {
    const c = l.clientes as unknown as { razao: string | null; nomefantasia: string | null } | null;
    const coluna = l.coluna as unknown as { descricao: string | null } | null;

    return {
      id: l.id,
      numero: l.idtenant ?? l.id,
      titulo: tituloDoTicket(l.titulo),
      valor: doBanco(porOrdem.get(l.id) ?? 0),
      situacao: coluna?.descricao ?? null,
      inicio: l.datainicio ? ((l.datainicio.slice(0, 10)) as DataISO) : null,
      clienteId: l.fkCliente,
      clienteNome: primeiroPreenchido(c?.nomefantasia, c?.razao),
    };
  });
}

/** Prende um ticket que ja existe ao projeto. A `UNIQUE` fecha o resto. */
export async function vincularTicket(
  projetoId: number,
  ticketId: number,
  usuarioId: string | null,
): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase
    .from("projetosordens")
    .insert({ fkProjeto: projetoId, fkOrdem: ticketId, fkUserCriacao: usuarioId });

  if (error) throw error;
}

export async function criarDemanda(
  projetoId: number,
  usuarioId: string | null,
  entrada: {
    titulo: string;
    descricao?: string | null;
    colunaId?: number | null;
    responsavelId?: string | null;
    inicio?: string | null;
    prazo?: string | null;
  },
): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("projetosdemandas")
    .insert({
      fkProjeto: projetoId,
      titulo: entrada.titulo,
      descricao: entrada.descricao ?? null,
      fkStatus: entrada.colunaId ?? null,
      fkResponsavel: entrada.responsavelId ?? null,
      inicio: entrada.inicio ?? null,
      prazo: entrada.prazo ?? null,
      fkUserCriacao: usuarioId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function atualizarDemanda(
  id: number,
  usuarioId: string | null,
  entrada: {
    titulo?: string;
    descricao?: string | null;
    colunaId?: number | null;
    responsavelId?: string | null;
    inicio?: string | null;
    prazo?: string | null;
    valor?: number;
    concluida?: boolean;
  },
): Promise<void> {
  const supabase = await serverClient();

  const campos: Partial<ProjetoDemandaRow> = {
    updated_at: new Date().toISOString(),
    fkUserModificacao: usuarioId,
  };
  if (entrada.titulo !== undefined) campos.titulo = entrada.titulo;
  if (entrada.descricao !== undefined) campos.descricao = entrada.descricao;
  if (entrada.colunaId !== undefined) campos.fkStatus = entrada.colunaId;
  if (entrada.responsavelId !== undefined) campos.fkResponsavel = entrada.responsavelId;
  if (entrada.inicio !== undefined) campos.inicio = entrada.inicio;
  if (entrada.prazo !== undefined) campos.prazo = entrada.prazo;
  if (entrada.valor !== undefined) campos.valor = paraBanco(entrada.valor as Centavos);

  /*
   * Concluir e marca da TAREFA, nao da coluna.
   *
   * As colunas sao do usuario — ele cria "Revisao", "Aguardando cliente". Antes
   * a conclusao era consequencia da coluna, e tarefa entregue que voltasse para
   * revisao deixava de estar concluida e sumia de "Faturar tarefas".
   */
  if (entrada.concluida !== undefined) {
    campos.concluida_em = entrada.concluida ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("projetosdemandas").update(campos).eq("id", id);
  if (error) throw error;
}

export async function excluirDemanda(id: number): Promise<void> {
  const supabase = await serverClient();
  const { error } = await supabase.from("projetosdemandas").delete().eq("id", id);
  if (error) throw error;
}

/** Confere o tenant antes de escrever numa demanda — ela nao tem `fkEmpresa`. */
export async function projetoDaDemanda(id: number): Promise<number | null> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from("projetosdemandas")
    .select('"fkProjeto"')
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data?.fkProjeto ?? null;
}

// ── Traducao ────────────────────────────────────────────────────────────────

type Linha = {
  id: number;
  idtenant: number | null;
  nome: string;
  descricao: string | null;
  modalidade: string;
  situacao: string;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
  cancelado: boolean;
  fkCliente: number | null;
  clientes?: unknown;
};

function paraDominio(
  l: Linha,
  contagem?: { total: number; concluidas: number },
  tickets?: TicketDoProjeto[],
): ProjetoResumo {
  const cliente = l.clientes as { razao: string | null; nomefantasia: string | null } | null;

  return {
    id: l.id,
    numero: l.idtenant ?? l.id,
    nome: l.nome,
    clienteId: l.fkCliente,
    clienteNome: primeiroPreenchido(cliente?.nomefantasia, cliente?.razao),
    modalidade: l.modalidade as Modalidade,
    situacao: l.situacao as SituacaoProjeto,
    qtdTickets: tickets?.length ?? 0,
    valor: ((tickets ?? []).reduce((soma, t) => soma + t.valor, 0) as Centavos),
    inicio: l.inicio ? ((l.inicio.slice(0, 10)) as DataISO) : null,
    fim: l.fim ? ((l.fim.slice(0, 10)) as DataISO) : null,
    ativo: l.ativo,
    cancelado: l.cancelado,
    qtdDemandas: contagem?.total ?? 0,
    qtdConcluidas: contagem?.concluidas ?? 0,
  };
}

/**
 * Quem pode ser responsavel por uma demanda.
 *
 * `usuarios_visiveis()` ja limita ao que o usuario enxerga, entao nao ha filtro
 * de empresa aqui — a RLS da tabela e quem decide.
 */
export async function listarUsuarios(): Promise<{ id: string; nome: string }[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select('"fkUser", nome, email')
    .eq("ativo", true)
    .order("nome");

  if (error) throw error;

  return (data ?? []).map((u) => ({
    id: u.fkUser,
    nome: primeiroPreenchido(u.nome, u.email) ?? "Sem nome",
  }));
}
