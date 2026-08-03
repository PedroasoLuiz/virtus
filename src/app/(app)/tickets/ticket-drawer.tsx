"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import {
  Badge,
  Button,
  CampoBloqueado,
  CampoNumerico,
  CampoQuantidade,
  Field,
  PanelTabs,
  inputStyle,
  selectStyle,
  type Tom,
} from "@/components/ui/kit";
import { Icon } from "@/components/layout/icones";
import { Historico } from "@/components/ui/historico";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";


/**
 * A conta a receber e carregada sob demanda porque `fatura-drawer` importa ESTE
 * arquivo — abrir um ticket a partir de uma conta ja era possivel. Import
 * estatico nos dois sentidos fecharia um ciclo, e ciclo entre componentes React
 * quebra em runtime, nao no build.
 */
/**
 * O gerador de PDF entra sob demanda: jsPDF e autotable pesam mais que o resto
 * da tela somado, e quase toda abertura de ticket nao imprime nada.
 */
/**
 * O gerador de PDF entra sob demanda: jsPDF e autotable pesam mais que o resto
 * da tela somado, e quase toda abertura de ticket nao imprime nada.
 *
 * `pdf.ts` — a replica do documento do FlutterFlow — continua no codigo, mas
 * sem botao. Ficou como referencia do layout antigo e como dona de
 * `carregarLogo`, que os dois usam.
 */
async function imprimir(ticket: unknown, emitidoPor: string) {
  const { imprimirRecibo } = await import("./pdf-recibo");
  await imprimirRecibo(ticket as Parameters<typeof imprimirRecibo>[0], emitidoPor);
}

const FaturaDrawer = dynamic(
  () => import("../faturas/fatura-drawer").then((m) => m.FaturaDrawer),
  { ssr: false },
);

/**
 * Detalhe do ticket, em tres modos: ver, editar e incluir.
 *
 * Sao o mesmo componente porque os campos, as regras e o layout sao os mesmos —
 * dois arquivos divergiriam no primeiro campo novo. O que muda e se o campo
 * aceita digitacao e para onde o Salvar aponta.
 *
 * As abas existem porque empilhado o drawer teria servicos, contas e totais um
 * embaixo do outro, e a segunda pergunta ja cairia abaixo da dobra.
 */

type Item = {
  id: number;
  servicoId: number | null;
  servicoNome: string | null;
  descricao: string;
  /** A tarefa de projeto que virou esta linha. Nulo em serviço digitado à mão. */
  demandaId: number | null;
  demandaTitulo: string | null;
  data: string | null;
  quantidade: number;
  unidade: "UN" | "H";
  valorUnitario: number;
  desconto: number;
  acrescimo: number;
  despesas: { id: number; descricao: string; valor: number }[];
  total: number;
};

type FaturaDoTicket = {
  faturaId: number;
  valor: number;
  totalFatura: number;
  situacao: string;
  emitidaEm: string | null;
  observacoes: string | null;
  pago: number;
  atrasado: number;
  aVencer: number;
  proximoVencimento: string | null;
};

type Autoria = {
  criadoPor: string | null;
  criadoEm: string | null;
  editadoPor: string | null;
  editadoEm: string | null;
};

type Ticket = {
  id: number;
  numero: number;
  centroCustoId: number | null;
  enderecoId: number | null;
  titulo: string;
  statusChave: string | null;
  autoria: Autoria;
  clienteId: number | null;
  clienteNome: string | null;
  centroCustoNome: string | null;
  status: string;
  cancelada: boolean;
  origem: string;
  inicio: string | null;
  fim: string | null;
  descricao: string | null;
  local: string | null;
  total: number;
  faturado: number;
  saldo: number;
  qtdFaturas: number;
  itens: Item[];
  faturas: FaturaDoTicket[];
};

export type OpcaoEndereco = { id: number; resumo: string };
export type OpcaoCentro = { id: number; descricao: string; enderecos: OpcaoEndereco[] };
export type OpcaoCliente = { id: number; nome: string; centros: OpcaoCentro[] };
export type OpcaoServico = { id: number; descricao: string; valor: number };

const TOM_FATURA: Record<string, Tom> = {
  "ORÇAMENTO": "neutral",
  ABERTA: "info",
  FATURADA: "info",
  "PARC. PAGA": "warning",
  PAGA: "success",
  CANCELADA: "danger",
};

const ABA_SERVICOS = "Serviços";
const SUB_HISTORICO = "Histórico";
const ABA_FINANCEIRO = "Financeiro";

export function TicketDrawer({
  ticketId,
  resumo,
  criando,
  clientes = [],
  servicos = [],
  somenteLeitura,
  emitidoPor,
  onClose,
}: {
  /** null com `criando` falso = fechado. */
  ticketId: number | null;
  /**
   * O que a listagem ja tem em memoria sobre este ticket.
   *
   * Desenha cabecalho e totais no primeiro quadro, sem esperar a rede: o
   * usuario clicou num card que ja mostrava cliente, periodo e valor, e ver
   * esses mesmos campos como esqueleto por meio segundo e o que fazia a tela
   * parecer mais lenta que a antiga. O `fetch` continua e completa o resto
   * (servicos, contas, autoria).
   */
  resumo?: Partial<Ticket> | null;
  criando?: boolean;
  clientes?: OpcaoCliente[];
  servicos?: OpcaoServico[];
  /**
   * Esconde o Editar. Usado quando o drawer abre empilhado sobre outro — ali
   * ele e uma espiada no registro, e as listas de cliente e servico nem foram
   * carregadas.
   */
  somenteLeitura?: boolean;
  /** Nome de quem esta com a tela aberta — vai no rodape do PDF. */
  emitidoPor?: string;
  onClose: () => void;
}) {
  // `key` remonta a cada ticket: estado nasce vazio sozinho, sem limpar a mao
  // num efeito, e sem mostrar o registro anterior enquanto carrega.
  if (!criando && ticketId == null) return null;

  return (
    <Conteudo
      key={criando ? "novo" : ticketId}
      ticketId={criando ? null : ticketId}
      resumo={resumo}
      clientes={clientes}
      servicos={servicos}
      somenteLeitura={somenteLeitura}
      emitidoPor={emitidoPor}
      onClose={onClose}
    />
  );
}

/** Estado editavel. Espelha o corpo da API, nao a linha do banco. */
type Form = {
  clienteId: string;
  centroCustoId: string;
  enderecoId: string;
  descricao: string;
  itens: Item[];
};

function vazio(): Form {
  return { clienteId: "", centroCustoId: "", enderecoId: "", descricao: "", itens: [] };
}

function doTicket(t: Ticket): Form {
  return {
    clienteId: t.clienteId ? String(t.clienteId) : "",
    centroCustoId: t.centroCustoId ? String(t.centroCustoId) : "",
    enderecoId: t.enderecoId ? String(t.enderecoId) : "",
    descricao: t.descricao ?? "",
    itens: t.itens,
  };
}

function Conteudo({
  ticketId,
  resumo,
  clientes,
  servicos,
  somenteLeitura,
  emitidoPor = "",
  onClose,
}: {
  ticketId: number | null;
  resumo?: Partial<Ticket> | null;
  clientes: OpcaoCliente[];
  servicos: OpcaoServico[];
  somenteLeitura?: boolean;
  /** Nome de quem esta com a tela aberta — vai no rodape do PDF. */
  emitidoPor?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const criando = ticketId == null;

  // Comeca com o que a listagem sabe; o fetch substitui pelo completo.
  const [ticket, setTicket] = useState<Ticket | null>(
    () => (resumo ? ({ itens: [], faturas: [], ...resumo } as Ticket) : null),
  );
  const [completo, setCompleto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState(ABA_SERVICOS);
  const [editando, setEditando] = useState(criando);
  const [form, setForm] = useState<Form>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [salvandoNota, setSalvandoNota] = useState(false);

  useEffect(() => {
    if (ticketId == null) return;
    const controle = new AbortController();

    fetch(`/api/v1/tickets/${ticketId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o ticket");
        setTicket(corpo.data);
        setForm(doTicket(corpo.data));
        setCompleto(true);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [ticketId]);

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const centrosDoCliente = useMemo(
    () => clientes.find((c) => String(c.id) === form.clienteId)?.centros ?? [],
    [clientes, form.clienteId],
  );

  const enderecosDoCentro = useMemo(
    () => centrosDoCliente.find((c) => String(c.id) === form.centroCustoId)?.enderecos ?? [],
    [centrosDoCliente, form.centroCustoId],
  );

  /**
   * Trocar de cliente limpa centro e endereço.
   *
   * Mantê-los seria deixar no formulário um centro que não pertence ao cliente
   * novo — o banco recusaria só no Salvar, depois de tudo preenchido.
   */
  function escolherCliente(id: string) {
    const centros = clientes.find((c) => String(c.id) === id)?.centros ?? [];
    const unico = centros.length === 1 ? centros[0] : null;
    const enderecoUnico = unico?.enderecos.length === 1 ? unico.enderecos[0] : null;

    setForm((f) => ({
      ...f,
      clienteId: id,
      centroCustoId: unico ? String(unico.id) : "",
      enderecoId: enderecoUnico ? String(enderecoUnico.id) : "",
    }));
  }

  function escolherCentro(id: string) {
    const enderecos = centrosDoCliente.find((c) => String(c.id) === id)?.enderecos ?? [];
    const unico = enderecos.length === 1 ? enderecos[0] : null;

    setForm((f) => ({
      ...f,
      centroCustoId: id,
      enderecoId: unico ? String(unico.id) : "",
    }));
  }

  // Enquanto edita, o total vem dos itens em tela — nao do que o servidor
  // devolveu. Senao o rodape mostraria o valor anterior ate salvar.
  const totalEmTela = useMemo(
    () => form.itens.reduce((s, i) => s + totalDoItem(i), 0),
    [form.itens],
  );

  // Periodo tambem: e derivado das datas dos servicos, entao acompanha a edicao.
  const periodoEmTela = useMemo(() => {
    const datas = form.itens.map((i) => i.data).filter(Boolean).sort() as DataISO[];
    return datas.length ? periodoEmMeses(datas[0], datas[datas.length - 1]) : null;
  }, [form.itens]);

  async function salvar() {
    setSalvando(true);
    setErro(null);

    const corpo = {
      clienteId: Number(form.clienteId),
      centroCustoId: form.centroCustoId ? Number(form.centroCustoId) : null,
      enderecoId: form.enderecoId ? Number(form.enderecoId) : null,
      descricao: form.descricao.trim() || null,
      itens: form.itens.map((i) => ({
        servicoId: i.servicoId,
        descricao: i.descricao,
        data: i.data,
        quantidade: i.quantidade,
        unidade: i.unidade,
        valorUnitario: i.valorUnitario,
        desconto: i.desconto,
        acrescimo: i.acrescimo,
        despesas: i.despesas.map((d) => ({ descricao: d.descricao, valor: d.valor })),
      })),
    };

    try {
      const r = await fetch(criando ? "/api/v1/tickets" : `/api/v1/tickets/${ticketId}`, {
        method: criando ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        // `details` traz o campo que o Zod recusou; so "Dados invalidos"
        // obrigaria o usuario a adivinhar qual.
        const detalhe = dados?.error?.details?.[0];
        setErro(
          detalhe
            ? `${detalhe.campo}: ${detalhe.mensagem}`
            : (dados?.error?.message ?? "Não foi possível salvar."),
        );
        return;
      }

      router.refresh();
      if (criando) {
        onClose();
        return;
      }
      setTicket(dados.data);
      setForm(doTicket(dados.data));
      setEditando(false);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  /**
   * A descricao salva sozinha, fora do modo de edicao.
   *
   * E o campo que se anota no meio do atendimento — obrigar a entrar em edicao,
   * mexer e sair faria a anotacao rapida custar tres cliques, e o que nao e
   * barato de escrever nao e escrito.
   *
   * So ela vai no PATCH: mandar o resto arriscaria gravar campo que o usuario
   * nem abriu para editar.
   */
  async function salvarDescricao() {
    if (criando || ticket == null) return;
    const texto = form.descricao.trim();
    if (texto === (ticket.descricao ?? "").trim()) return;

    setSalvandoNota(true);
    try {
      const r = await fetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: texto || null }),
      });
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(dados?.error?.message ?? "Não foi possível salvar a descrição.");
        setForm((f) => ({ ...f, descricao: ticket.descricao ?? "" }));
        return;
      }

      setTicket(dados.data);
      router.refresh();
    } catch {
      setErro("Falha de conexão ao salvar a descrição.");
    } finally {
      setSalvandoNota(false);
    }
  }

  /**
   * Ter faturamento NAO tranca a edicao.
   *
   * A versao anterior travava os servicos sempre que `faturado > 0`, e isso
   * pegava os 151 tickets migrados — inclusive os que estao em "Orcamento" —,
   * porque a migracao criou vinculo em `faturasorigens` para TODA fatura, ate
   * as que nunca foram cobranca de verdade.
   *
   * A regra que e sempre verdadeira e outra: o total nao pode cair abaixo do
   * que ja virou cobranca. Quem a aplica e `atualizarTicket`, com o valor exato
   * na mensagem — e o gatilho `guarda_saldo_por_origem` fecha a porta do outro
   * lado. Aqui fica so o aviso.
   */
  const faturado = (ticket?.faturado ?? 0) > 0;

  /**
   * Encerrado e ponto final: faturado por inteiro e recebido por inteiro.
   *
   * O drawer nem oferece "Editar" — barrar so no Salvar faria o usuario
   * preencher para depois descobrir que nao podia. A descricao tambem trava:
   * ela grava sozinha no blur, e sem isso um clique acidental no campo viraria
   * erro de API.
   */
  const encerrado = ticket?.statusChave === "ENCERRADA";

  const carregando = !criando && !ticket && !erro;
  const carregandoDetalhe = !criando && !completo && !erro;
  const podeSalvar =
    form.clienteId !== "" &&
    form.centroCustoId !== "" &&
    form.itens.every((i) => i.quantidade > 0);

  return (
    <Drawer
      open
      onClose={onClose}
      title={criando ? "Novo ticket" : ticket ? `Ticket ${ticket.numero}` : "Ticket"}
      headerExtra={
        // `completo`, nao `ticket`: o drawer nasce com o resumo da listagem, e
        // ele nao traz emitente, endereco nem autoria. Imprimir nesse momento
        // estourava em `t.empresa.logo` — o botao existia antes do dado.
        completo && ticket && (
          <div style={{ display: "flex", gap: 6 }}>
            <BotaoDeCabecalho
              rotulo="Imprimir"
              onClick={() => void imprimir(ticket, emitidoPor)}
            >
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a1 1 0 01-1-1v-5a2 2 0 012-2h14a2 2 0 012 2v5a1 1 0 01-1 1h-2" />
              <rect x="6" y="14" width="12" height="7" rx="1" />
            </BotaoDeCabecalho>
            {/* A ficha e a mesma da tarefa do projeto — ver components/ui/historico. */}
            <Historico
              marcos={[
                {
                  rotulo: "Criado",
                  quem: ticket.autoria.criadoPor,
                  quando: ticket.autoria.criadoEm,
                },
                {
                  rotulo: "Última alteração",
                  quem: ticket.autoria.editadoPor,
                  quando: ticket.autoria.editadoEm,
                },
              ]}
            />
          </div>
        )
      }
      footer={
        <Rodape
          editando={editando}
          criando={criando}
          salvando={salvando}
          podeSalvar={podeSalvar}
          podeEditar={!somenteLeitura && completo && !encerrado}
          onEditar={() => setEditando(true)}
          onCancelar={() => {
            if (criando) return onClose();
            if (ticket) setForm(doTicket(ticket));
            setEditando(false);
            setErro(null);
          }}
          onSalvar={salvar}
        />
      }
    >
      {erro && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            marginBottom: 12,
            borderRadius: "var(--radius-md)",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger-text)",
            fontSize: "var(--text-base)",
          }}
        >
          {erro}
        </div>
      )}

      {carregando && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[70, 90, 55, 100].map((l, i) => (
            <div
              key={i}
              className="sk"
              style={{
                height: 14,
                width: `${l}%`,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-3)",
              }}
            />
          ))}
        </div>
      )}

      {(ticket || criando) && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 18 }}>
            <Field label="Cliente" required={editando && !faturado}>
              {editando && !faturado ? (
                <select
                  value={form.clienteId}
                  onChange={(e) => escolherCliente(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Selecione…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <CampoBloqueado
                  valor={ticket?.clienteNome ?? "—"}
                  titulo={
                    faturado
                      ? "Já existe conta a receber emitida — o cliente não pode ser trocado"
                      : undefined
                  }
                />
              )}
            </Field>

            {/* Cascata: o centro pertence ao cliente, o endereço ao centro.
                Cada nível só oferece o que existe no nível de cima — e quando
                há uma opção só, ela já vem escolhida: obrigar a abrir um select
                de item único é clique que não decide nada. */}
            <Field label="Centro de custo" required={editando}>
              {editando ? (
                <select
                  value={form.centroCustoId}
                  onChange={(e) => escolherCentro(e.target.value)}
                  disabled={!form.clienteId}
                  style={selectStyle}
                >
                  <option value="">
                    {form.clienteId ? "Selecione…" : "Escolha o cliente primeiro"}
                  </option>
                  {centrosDoCliente.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.descricao}
                    </option>
                  ))}
                </select>
              ) : (
                <CampoBloqueado valor={ticket?.centroCustoNome ?? "—"} />
              )}
            </Field>

            <Field label="Local">
              {editando ? (
                <select
                  value={form.enderecoId}
                  onChange={(e) => set("enderecoId", e.target.value)}
                  disabled={!form.centroCustoId}
                  style={selectStyle}
                >
                  <option value="">
                    {form.centroCustoId
                      ? enderecosDoCentro.length === 0
                        ? "Nenhum endereço neste centro de custo"
                        : "Selecione…"
                      : "Escolha o centro de custo primeiro"}
                  </option>
                  {enderecosDoCentro.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.resumo}
                    </option>
                  ))}
                </select>
              ) : (
                <CampoBloqueado valor={ticket?.local || "—"} />
              )}
            </Field>

            <Field label="Período">
              <CampoBloqueado
                titulo="Vem das datas dos serviços"
                valor={
                  (editando ? periodoEmTela : periodoEmMeses(ticket?.inicio ?? null, ticket?.fim ?? null)) ??
                  "—"
                }
              />
            </Field>

            <Field label="Situação">
              <CampoBloqueado
                valor={ticket?.cancelada ? "CANCELADO" : (ticket?.status ?? "—")}
                titulo="Muda ao arrastar o card no quadro ou ao faturar"
              />
            </Field>

            {/* Sempre editavel, mesmo fora do modo de edicao. */}
            <Field label="Descrição" hint={salvandoNota ? "Salvando…" : undefined}>
              {encerrado ? (
                <CampoBloqueado
                  valor={ticket?.descricao || "—"}
                  multilinha
                  titulo="Ticket encerrado — não pode mais ser alterado"
                />
              ) : (
                <textarea
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  onBlur={editando ? undefined : salvarDescricao}
                  rows={3}
                  placeholder="Anotações sobre este ticket"
                  style={{
                    ...inputStyle,
                    width: "100%",
                    height: "auto",
                    padding: 8,
                    resize: "vertical",
                  }}
                />
              )}
            </Field>
          </div>

          <PanelTabs
            tabs={[`${ABA_SERVICOS} (${form.itens.length})`, ABA_FINANCEIRO]}
            active={
              aba === ABA_SERVICOS ? `${ABA_SERVICOS} (${form.itens.length})` : ABA_FINANCEIRO
            }
            onChange={(t) => setAba(t.startsWith(ABA_SERVICOS) ? ABA_SERVICOS : ABA_FINANCEIRO)}
          />

          {aba === ABA_SERVICOS && carregandoDetalhe && <EsqueletoLista />}
          {aba === ABA_SERVICOS && !carregandoDetalhe && (
            <ListaServicos
              itens={form.itens}
              editando={editando}
              avisoFaturado={editando && faturado ? (ticket?.faturado ?? 0) : 0}
              servicos={servicos}
              aoMudar={(itens) => set("itens", itens)}
            />
          )}

          {aba === ABA_FINANCEIRO && (
            <Financeiro
              itens={form.itens}
              totalEmTela={editando ? totalEmTela : (ticket?.total ?? 0)}
              faturado={ticket?.faturado ?? 0}
              faturas={ticket?.faturas ?? []}
            />
          )}
        </>
      )}
    </Drawer>
  );
}

function Rodape({
  editando,
  criando,
  salvando,
  podeSalvar,
  podeEditar,
  onEditar,
  onCancelar,
  onSalvar,
}: {
  editando: boolean;
  criando: boolean;
  salvando: boolean;
  podeSalvar: boolean;
  podeEditar: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  if (!editando) {
    return (
      // Sem "Gerar conta a receber": a cobranca nasce na tela de contas a
      // receber, que e onde se escolhe QUAIS tickets entram nela. Um botao aqui
      // sugeriria a conta 1:1 com o ticket, que e justamente o que o modelo
      // desfez.
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {podeEditar && (
          <Button size="sm" onClick={onEditar}>
            Editar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
      <Button size="sm" onClick={onCancelar} disabled={salvando}>
        Cancelar
      </Button>
      <Button size="sm" variant="primary" onClick={onSalvar} disabled={salvando || !podeSalvar}>
        {salvando ? "Salvando…" : criando ? "Criar" : "Salvar"}
      </Button>
    </div>
  );
}

// ── Aba Financeiro ──────────────────────────────────────────────────────────

/**
 * Os numeros que ficavam na barra do topo, em campos.
 *
 * A barra ocupava a primeira dobra do drawer com uma pergunta que quase nunca e
 * a primeira — quem abre um ticket quer ver o que foi executado. Em aba, o
 * numero continua a um clique e para de disputar o comeco da tela.
 *
 * Mede FATURAMENTO, nao recebimento: o dinheiro so entra quando a conta a
 * receber for baixada.
 */
function Financeiro({
  itens,
  totalEmTela,
  faturado,
  faturas,
}: {
  itens: Item[];
  totalEmTela: number;
  faturado: number;
  faturas: FaturaDoTicket[];
}) {
  const [faturaAberta, setFaturaAberta] = useState<number | null>(null);

  return (
    <>
      <Resumo itens={itens} total={totalEmTela} faturado={faturado} />

      {/* Uma aba so, sem contador: aqui ela nao escolhe entre conteudos — e o
          rotulo da tabela, no mesmo desenho das outras listas do drawer. */}
      <div style={{ marginTop: 18 }}>
        <PanelTabs tabs={[SUB_HISTORICO]} active={SUB_HISTORICO} onChange={() => {}} />
      </div>

      <TabelaFaturas faturas={faturas} aoAbrir={setFaturaAberta} />

      <FaturaDrawer faturaId={faturaAberta} onClose={() => setFaturaAberta(null)} />
    </>
  );
}

/**
 * Composicao do valor do ticket.
 *
 * Desconto e acrescimo sao SOMA DOS ITENS, nao campos do ticket: eles ja vivem
 * na linha do servico, e um segundo par no cabecalho criaria dois lugares para
 * dar o mesmo desconto — com resultados diferentes dependendo de onde foi
 * digitado.
 */
function Resumo({
  itens,
  total,
  faturado,
}: {
  itens: Item[];
  total: number;
  faturado: number;
}) {
  const bruto = itens.reduce((s, i) => s + Math.round(i.quantidade * i.valorUnitario), 0);
  const desconto = itens.reduce((s, i) => s + i.desconto, 0);
  const acrescimo = itens.reduce((s, i) => s + i.acrescimo, 0);
  const despesas = itens.reduce((s, i) => s + i.despesas.reduce((t, d) => t + d.valor, 0), 0);
  const saldo = Math.max(0, total - faturado);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Field label="Serviços">
        <CampoBloqueado valor={formatarSemSimbolo(bruto as Centavos)} />
      </Field>
      <Field label="Desconto">
        <CampoBloqueado valor={formatarSemSimbolo(desconto as Centavos)} />
      </Field>
      <Field label="Acréscimo">
        <CampoBloqueado valor={formatarSemSimbolo(acrescimo as Centavos)} />
      </Field>

      {/* Soma das despesas lancadas em cada servico — abastecimento, pedagio,
          material. Diferente de acrescimo, que e ajuste de preco sem
          justificativa itemizada. */}
      <Field label="Despesas adicionais">
        <CampoBloqueado valor={formatarSemSimbolo(despesas as Centavos)} />
      </Field>

      <Separador />

      <Field label="Total do ticket">
        <CampoBloqueado valor={formatarSemSimbolo(total as Centavos)} />
      </Field>
      <Field label="Faturado">
        <CampoBloqueado valor={formatarSemSimbolo(faturado as Centavos)} />
      </Field>
      <Field label="Saldo a faturar">
        <CampoBloqueado valor={formatarSemSimbolo(saldo as Centavos)} />
      </Field>
    </div>
  );
}

function Separador() {
  return <div style={{ height: 1, background: "var(--border)", margin: "7px 0" }} />;
}

// ── Aba Serviços ────────────────────────────────────────────────────────────

/**
 * Valor final do servico: bruto − desconto + acrescimo + despesas.
 *
 * ⚠️ Tem de bater com `totalDoItem` em `tickets.service.ts`, que e quem grava.
 * As despesas ficaram de fora daqui quando foram criadas — a tela mostrava o
 * total sem elas enquanto se editava, e o numero so "pulava" depois de salvar.
 */
function totalDoItem(i: Item): number {
  const bruto = Math.round(i.quantidade * i.valorUnitario);
  const despesas = i.despesas.reduce((s, d) => s + d.valor, 0);
  return Math.max(0, bruto - i.desconto + i.acrescimo + despesas);
}

/** Id negativo em linha nova: distingue do id real sem precisar de outro campo. */
let proximoIdLocal = -1;

/**
 * Servicos como lista de cards, nao tabela.
 *
 * Em tabela, mostrar desconto e acrescimo exigiria seis colunas numa largura de
 * 720 — todas espremidas e a descricao cortada. Em card, o nome fica com a
 * linha inteira e a composicao do preco vem embaixo, no lugar onde ela e lida:
 * quantidade x unitario, os ajustes, e o total na direita.
 *
 * Desconto e acrescimo so aparecem quando existem. Fixos em "0,00" pintariam de
 * ruido todos os itens que nao tem ajuste nenhum — que sao a maioria.
 */
function ListaServicos({
  itens,
  editando,
  avisoFaturado = 0,
  servicos,
  aoMudar,
}: {
  itens: Item[];
  editando: boolean;
  /** Quanto ja virou cobranca. Zero nao mostra aviso. */
  avisoFaturado?: number;
  servicos: OpcaoServico[];
  aoMudar: (itens: Item[]) => void;
}) {
  function mudar(id: number, campos: Partial<Item>) {
    aoMudar(itens.map((i) => (i.id === id ? { ...i, ...campos } : i)));
  }

  function adicionar() {
    aoMudar([
      ...itens,
      {
        id: proximoIdLocal--,
        servicoId: null,
        servicoNome: null,
        demandaId: null,
        demandaTitulo: null,
        descricao: "",
        data: null,
        quantidade: 1,
        unidade: "UN",
        valorUnitario: 0,
        desconto: 0,
        acrescimo: 0,
        despesas: [],
        total: 0,
      },
    ]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {avisoFaturado > 0 && (
        <div
          style={{
            padding: "8px 11px",
            borderRadius: "var(--radius-md)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            color: "var(--warning-text)",
            fontSize: "var(--text-sm)",
          }}
        >
          {formatarSemSimbolo(avisoFaturado as Centavos)} deste ticket já virou conta a receber.
          O total dos serviços não pode ficar abaixo disso.
        </div>
      )}

      {itens.length === 0 && !editando && (
        <div
          style={{
            padding: "28px 12px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-base)",
          }}
        >
          Nenhum serviço lançado.
        </div>
      )}

      {itens.map((it) =>
        editando ? (
          <CardServicoEdicao
            key={it.id}
            item={it}
            servicos={servicos}
            aoMudar={(c) => mudar(it.id, c)}
            aoRemover={() => aoMudar(itens.filter((x) => x.id !== it.id))}
          />
        ) : (
          <CardServico key={it.id} item={it} />
        ),
      )}

      {/* Sem totalizador aqui: a soma e a contagem sao a aba Financeiro, e
          repetir na lista dava dois lugares dizendo a mesma coisa. */}
      {editando && (
        <AreaDeAdicionar primeira={itens.length === 0} onClick={adicionar} />
      )}
    </div>
  );
}

/**
 * O convite para lancar servico.
 *
 * Com a lista vazia ele e a tela inteira, e explica o que esta em jogo: o total
 * do ticket nasce daqui, e sem servico nao ha o que faturar. Um botao pequeno
 * embaixo de uma caixa escrita "nenhum servico lancado" dizia duas vezes que
 * nao havia nada, e nenhuma vez o que fazer a respeito.
 *
 * Com a lista cheia ele encolhe para uma faixa: ja nao precisa ensinar, so
 * precisa estar no caminho de quem quer somar mais um.
 */
function AreaDeAdicionar({ primeira, onClick }: { primeira: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: primeira ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: primeira ? 4 : 7,
        padding: primeira ? "30px 16px" : "11px 16px",
        borderRadius: "var(--radius-lg)",
        border: "1px dashed var(--primary-border)",
        background: hover ? "var(--primary-subtle)" : "transparent",
        color: "var(--primary)",
        fontFamily: "var(--font)",
        cursor: "pointer",
        transition: "border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: primeira ? 34 : 18,
          height: primeira ? 34 : 18,
          marginBottom: primeira ? 6 : 0,
          borderRadius: "var(--radius-full)",
          background: "var(--primary-subtle)",
          color: "var(--primary)",
        }}
      >
        <svg
          width={primeira ? 15 : 10}
          height={primeira ? 15 : 10}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M6.75 1.75a.75.75 0 0 0-1.5 0V5.25H1.75a.75.75 0 0 0 0 1.5H5.25v3.5a.75.75 0 0 0 1.5 0V6.75h3.5a.75.75 0 0 0 0-1.5H6.75V1.75z" />
        </svg>
      </span>

      <span
        style={{
          fontSize: primeira ? "var(--text-md)" : "var(--text-base)",
          fontWeight: "var(--fw-medium)",
          letterSpacing: "var(--tracking-normal)",
        }}
      >
        {primeira ? "Adicionar o primeiro serviço" : "Adicionar serviço"}
      </span>

      {primeira && (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          O valor do ticket é a soma dos serviços. Sem eles não há o que faturar.
        </span>
      )}
    </button>
  );
}

const MOLDURA_ITEM: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "11px 13px",
};

function CardServico({ item }: { item: Item }) {
  const bruto = Math.round(item.quantidade * item.valorUnitario);

  return (
    <div style={MOLDURA_ITEM}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {/* Despesas DEPOIS do nome, na mesma linha, com quebra quando nao
              couberem. Embaixo elas empurravam a descricao para longe do nome e
              o card crescia uma faixa inteira so para dizer "teve pedagio". */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-base)",
              fontWeight: "var(--fw-medium)",
              letterSpacing: "var(--tracking-normal)",
            }}
          >
            {/* Sem servico vinculado, o texto livre assume o topo — senao a
                linha ficaria sem identificacao. */}
            <span>{item.servicoNome ?? item.descricao ?? "Serviço avulso"}</span>

            {/* De onde veio o valor. Sem isto o ticket mostrava o número sem
                dizer o que foi entregue para chegar nele. */}
            {item.demandaTitulo && (
              <span
                title={`Gerado pela tarefa "${item.demandaTitulo}"`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--fw-medium)",
                  color: "var(--text-tertiary)",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                <svg
                  aria-hidden
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 12.2l2.5 2.5 4.5-5" />
                </svg>
                TAREFA
              </span>
            )}

            {item.despesas.map((d) => (
              <Etiqueta key={d.id} rotulo={d.descricao || "Despesa"} valor={d.valor} />
            ))}
          </div>

          {item.servicoNome && item.descricao && (
            <div
              style={{
                marginTop: 2,
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                letterSpacing: "var(--tracking-normal)",
              }}
            >
              {item.descricao}
            </div>
          )}
        </div>

        <Preco bruto={bruto} liquido={totalDoItem(item)} />
      </div>
    </div>
  );
}

/**
 * Preco no formato de vitrine.
 *
 * De cima para baixo: o valor cheio riscado, o valor que vale, e o percentual
 * do abatimento em verde. E a leitura que ja esta no olho de quem compra
 * online — dispensa rotulo, e mostra desconto e acrescimo sem gastar duas
 * linhas de texto explicando cada um.
 *
 * Sem ajuste nenhum, so o numero: riscar um preco igual ao outro anunciaria
 * desconto que nao existe.
 */
function Preco({ bruto, liquido }: { bruto: number; liquido: number }) {
  const abatimento = bruto - liquido;
  const pct = bruto > 0 ? Math.round((abatimento / bruto) * 100) : 0;

  return (
    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
      {abatimento !== 0 && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            textDecoration: "line-through",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatarSemSimbolo(bruto as Centavos)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "flex-end",
          gap: 7,
        }}
      >
        {/* Percentual a ESQUERDA do valor: lido antes dele, funciona como sinal
            do que vem — e nao como carimbo de promocao pendurado no fim.
            Verde no desconto, ambar no acrescimo: os dois mudam o preco, so um
            e boa noticia para quem paga. */}
        {abatimento !== 0 && (
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
              fontVariantNumeric: "tabular-nums",
              color: abatimento > 0 ? "var(--credito)" : "var(--warning-text)",
            }}
          >
            {abatimento > 0 ? "−" : "+"}
            {Math.abs(pct)}%
          </span>
        )}

        <span
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-snug)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatarSemSimbolo(liquido as Centavos)}
        </span>
      </div>
    </div>
  );
}

let proximoIdDespesa = -1;

/**
 * Servico em edicao: UM rotulo e UM campo por linha, empilhados.
 *
 * A grade de tres colunas cabia na largura mas quebrava o padrao do resto do
 * drawer, onde todo campo tem rotulo a esquerda e campo a direita. Duas
 * gramaticas de formulario na mesma tela obrigam o olho a reaprender onde
 * procurar o rotulo a cada bloco.
 */
function CardServicoEdicao({
  item,
  servicos,
  aoMudar,
  aoRemover,
}: {
  item: Item;
  servicos: OpcaoServico[];
  aoMudar: (campos: Partial<Item>) => void;
  aoRemover: () => void;
}) {
  function mudarDespesa(id: number, campos: Partial<{ descricao: string; valor: number }>) {
    aoMudar({
      despesas: item.despesas.map((d) => (d.id === id ? { ...d, ...campos } : d)),
    });
  }

  return (
    <div style={{ ...MOLDURA_ITEM, background: "var(--surface-2)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Field label="Serviço">
            <select
              value={item.servicoId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const s = servicos.find((x) => x.id === id);
                // Nao mexe na `descricao`: ela e complemento livre, e
                // sobrescrever apagaria o que o usuario escreveu ao trocar.
                aoMudar({
                  servicoId: id,
                  servicoNome: s ? s.descricao : null,
                  valorUnitario: s ? s.valor : item.valorUnitario,
                });
              }}
              style={selectStyle}
            >
              <option value="">Serviço avulso</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.descricao}
                </option>
              ))}
            </select>
        </Field>

        <Field label="Descrição">
          <input
            value={item.descricao}
            onChange={(e) => aoMudar({ descricao: e.target.value })}
            placeholder={item.servicoId == null ? "Nome do serviço" : "Complemento (opcional)"}
            maxLength={255}
            style={inputStyle}
          />
        </Field>

        <Field label="Data">
          <input
            type="date"
            value={item.data ?? ""}
            onChange={(e) => aoMudar({ data: e.target.value || null })}
            style={inputStyle}
          />
        </Field>

        <Field label="Quantidade">
          <CampoQuantidade
            valor={item.quantidade}
            unidade={item.unidade}
            aoMudar={(v, u) => aoMudar({ quantidade: v, unidade: u })}
          />
        </Field>

        <Field label="Valor unitário">
          <CampoValor
            valor={item.valorUnitario}
            aoMudar={(v) => aoMudar({ valorUnitario: v })}
          />
        </Field>

        <Field label="Desconto">
          <CampoValor valor={item.desconto} aoMudar={(v) => aoMudar({ desconto: v })} />
        </Field>

        <Field label="Acréscimo">
          <CampoValor valor={item.acrescimo} aoMudar={(v) => aoMudar({ acrescimo: v })} />
        </Field>
      </div>

      {/* Despesas: cada gasto com nome e valor. Entram no total do servico. */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <div
          className="rotulo"
          style={{ fontSize: "var(--text-xs)", marginBottom: item.despesas.length ? 6 : 8 }}
        >
          Despesas adicionais
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {item.despesas.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={d.descricao}
                onChange={(e) => mudarDespesa(d.id, { descricao: e.target.value })}
                placeholder="Abastecimento, pedágio…"
                maxLength={120}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <div style={{ width: 110, flexShrink: 0 }}>
                <CampoValor valor={d.valor} aoMudar={(v) => mudarDespesa(d.id, { valor: v })} />
              </div>
              <button
                type="button"
                title="Remover despesa"
                aria-label="Remover despesa"
                onClick={() =>
                  aoMudar({ despesas: item.despesas.filter((x) => x.id !== d.id) })
                }
                style={BOTAO_REMOVER}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* Calculado, nunca digitado: quem manda no total sao os campos acima,
            e um campo editavel aqui abriria a chance de eles nao fecharem. */}
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatarSemSimbolo(totalDoItem(item) as Centavos)}
        </span>

        {/* As duas acoes do card juntas na direita, no mesmo corpo de texto.
            Acrescentar e remover sao o mesmo tipo de gesto — separa-las por
            peso visual faria uma parecer mais importante que a outra. A cor e
            que diz o que cada uma faz. */}
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="sm"
            onClick={() =>
              aoMudar({
                despesas: [
                  ...item.despesas,
                  { id: proximoIdDespesa--, descricao: "", valor: 0 },
                ],
              })
            }
          >
            + Despesa
          </Button>

          {/* Remover mora aqui e nao ao lado do dropdown: la ficava na frente
              do campo mais usado do card. */}
          <Button size="sm" variant="danger" onClick={aoRemover}>
            Remover serviço
          </Button>
        </div>
      </div>
    </div>
  );
}

const BOTAO_REMOVER: React.CSSProperties = {
  width: 26,
  height: 26,
  flexShrink: 0,
  border: "none",
  background: "transparent",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  borderRadius: "var(--radius-xs)",
};

/** Dinheiro em reais na tela, centavos inteiros no estado. */
function CampoValor({ valor, aoMudar }: { valor: number; aoMudar: (v: number) => void }) {
  return <CampoNumerico valor={valor} aoMudar={aoMudar} escala={100} casas={2} />;
}


/**
 * Historico de cobranca do ticket.
 *
 * Cada linha e uma conta a receber que consumiu valor daqui. "Deste ticket" e o
 * que saiu DAQUI; pago e a receber sao da CONTA inteira, porque ratear a baixa
 * entre origens exigiria decidir qual ticket foi pago primeiro numa conta
 * composta — invencao, nao dado.
 *
 * Atrasado e a vencer nao sao duas colunas: os dois sao dinheiro que ainda nao
 * entrou, e somam em "A receber". Quem diz se passou do prazo e a SITUACAO.
 */
function TabelaFaturas({
  faturas,
  aoAbrir,
}: {
  faturas: FaturaDoTicket[];
  aoAbrir: (id: number) => void;
}) {
  return (
    <Moldura>
      <thead>
        <tr style={{ background: "var(--surface-2)" }}>
          <Cabecalho align="left">Título</Cabecalho>
          <Cabecalho align="center">Situação</Cabecalho>
          <Cabecalho align="right">Deste ticket</Cabecalho>
          <Cabecalho align="right">Pago</Cabecalho>
          <Cabecalho align="right">A receber</Cabecalho>
        </tr>
      </thead>
      <tbody>
        {faturas.length === 0 && (
          <Vazia colSpan={5}>Este ticket ainda não gerou conta a receber.</Vazia>
        )}
        {faturas.map((f, i) => (
          <tr
            key={f.faturaId}
            onClick={() => aoAbrir(f.faturaId)}
            style={{
              borderTop: i === 0 ? undefined : "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <Celula>
              {/* Icone do modulo financeiro na frente: no mesmo drawer convivem
                  numero de ticket e numero de conta, e so o "#" nao separa os
                  dois. */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <Icon name="faturas" size={13} color="var(--text-tertiary)" />
                {f.faturaId}
              </span>
            </Celula>

            <Celula align="center">
              <Badge tom={f.atrasado > 0 ? "danger" : (TOM_FATURA[f.situacao] ?? "neutral")}>
                {f.atrasado > 0 ? "ATRASADA" : f.situacao}
              </Badge>
            </Celula>

            <Celula align="right" forte>
              {formatarSemSimbolo(f.valor as Centavos)}
            </Celula>

            <Valor v={f.pago} cor="var(--credito)" />

            <Celula align="right">
              {/* Vermelho so quando parte disso ja venceu — o valor e o mesmo,
                  o que muda e a urgencia. */}
              <div
                style={{
                  color:
                    f.atrasado > 0
                      ? "var(--debito)"
                      : f.aVencer > 0
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                }}
              >
                {formatarSemSimbolo((f.atrasado + f.aVencer) as Centavos)}
              </div>
              {/* O vencimento so aparece se ha o que vencer — data solta numa
                  conta quitada leria como cobranca pendente. */}
              {f.aVencer > 0 && f.proximoVencimento && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  {paraFormatoBR(f.proximoVencimento as DataISO)}
                </div>
              )}
            </Celula>
          </tr>
        ))}
      </tbody>
    </Moldura>
  );
}

/** Valor que so ganha cor quando existe: zero colorido vira ruido. */
function Valor({ v, cor }: { v: number; cor: string }) {
  return (
    <Celula align="right">
      <span style={{ color: v > 0 ? cor : "var(--text-tertiary)" }}>
        {formatarSemSimbolo(v as Centavos)}
      </span>
    </Celula>
  );
}

// ── Peças de tabela ─────────────────────────────────────────────────────────

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        {children}
      </table>
    </div>
  );
}

function Cabecalho({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "center" | "right";
}) {
  return (
    <th
      className="rotulo"
      style={{
        height: 32,
        padding: "0 12px",
        textAlign: align,
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

/**
 * Celula com respiro por PADDING, nao por altura fixa.
 *
 * Com `height: 34` o texto que quebrava em duas linhas encostava nas bordas de
 * cima e de baixo: altura fixa nao cresce, ela so espreme. `minHeight` mantem a
 * linha de uma linha com a mesma altura de antes e deixa a de duas respirar.
 */
function Celula({
  children,
  align = "left",
  forte,
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  forte?: boolean;
}) {
  return (
    <td
      style={{
        padding: "9px 12px",
        lineHeight: 1.4,
        textAlign: align,
        verticalAlign: "middle",
        fontVariantNumeric: align === "right" ? "tabular-nums" : undefined,
        fontWeight: forte ? "var(--fw-medium)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function Vazia({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-tertiary)" }}
      >
        {children}
      </td>
    </tr>
  );
}

/**
 * Despesa do serviço como etiqueta.
 *
 * Nome e valor juntos porque separados não dizem nada: "R$ 42,50" solto no card
 * não sustenta a conversa com o cliente — "Pedágio 42,50" sustenta.
 *
 * Azul só no valor. O rótulo é o que se lê para saber do que se trata; o valor
 * é o que se procura quando a pergunta é quanto — pintar os dois tiraria da cor
 * a função de apontar.
 */
function Etiqueta({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 19,
        padding: "0 8px",
        borderRadius: "var(--radius-full)",
        background: "var(--info-bg)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-normal)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {rotulo}
      <strong style={{ fontWeight: "var(--fw-semi)", color: "var(--info-text)" }}>
        {formatarSemSimbolo(valor as Centavos)}
      </strong>
    </span>
  );
}

/** Placeholder da lista de serviços enquanto o detalhe não chegou. */
function EsqueletoLista() {
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ ...MOLDURA_ITEM, opacity: 1 - i * 0.4 }}>
          <div
            className="sk"
            style={{ height: 12, width: "58%", borderRadius: 6, background: "var(--surface-3)" }}
          />
          <div
            className="sk"
            style={{
              height: 10,
              width: "34%",
              marginTop: 8,
              borderRadius: 6,
              background: "var(--surface-3)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
