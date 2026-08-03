"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoNumerico,
  EmptyRow,
  Field,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { Historico } from "@/components/ui/historico";
import { VinculoDrawer } from "./vinculo-drawer";
import { ContratoDrawer } from "../contratos/contrato-drawer";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import {
  ROTULO_SITUACAO,
  SITUACOES,
  type ContratoDoProjeto,
  type SituacaoProjeto,
  type TicketDisponivel,
} from "@/modules/projetos/projetos.types";

/**
 * Cadastro do projeto — só os dados.
 *
 * O quadro de demandas NÃO mora aqui: ele é a subpágina `/projetos/[id]`. Ali
 * se trabalha a tarde inteira arrastando tarefa, e drawer é para olhar um
 * registro e fechar — deixaria o resto do sistema atrás, inutilizado e visível.
 */

type Coluna = { id: number; descricao: string; cor: string; ativo: boolean; conclui: boolean };

type Demanda = {
  id: number;
  titulo: string;
  descricao: string | null;
  colunaId: number | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  prazo: string | null;
  concluidaEm: string | null;
  ticketId: number | null;
};

type TicketNaLista = {
  id: number;
  numero: number;
  /** Nulo quando o registro so tem o numero antigo no lugar do titulo. */
  titulo: string | null;
  valor: number;
  situacao: string | null;
  inicio: string | null;
};

type Projeto = {
  id: number;
  numero: number;
  nome: string;
  descricao: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  modalidade: "FECHADO" | "POR_DEMANDA";
  situacao: SituacaoProjeto;
  /** Os tickets que o projeto ja gerou — o segundo em diante e aditivo. */
  tickets: TicketNaLista[];
  contratos: ContratoDoProjeto[];
  valor: number;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
  cancelado: boolean;
  qtdDemandas: number;
  qtdConcluidas: number;
  autoria: {
    criadoEm: string;
    criadoPor: string | null;
    editadoEm: string | null;
    editadoPor: string | null;
  };
  colunas: Coluna[];
  demandas: Demanda[];
};

export type OpcaoCliente = { id: number; nome: string };

export function ProjetoDrawer({
  projetoId,
  criando,
  clientes,
  onClose,
  aoExcluir,
}: {
  projetoId: number | null;
  criando?: boolean;
  clientes: OpcaoCliente[];
  onClose: () => void;
  /** Chamado depois de excluir. Quem abriu decide para onde ir. */
  aoExcluir?: () => void;
}) {
  if (!criando && projetoId == null) return null;
  return (
    <Conteudo
      key={criando ? "novo" : projetoId}
      projetoId={criando ? null : projetoId}
      clientes={clientes}
      onClose={onClose}
      aoExcluir={aoExcluir}
    />
  );
}

function Conteudo({
  projetoId,
  clientes,
  onClose,
  aoExcluir,
}: {
  projetoId: number | null;
  clientes: OpcaoCliente[];
  onClose: () => void;
  aoExcluir?: () => void;
}) {
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();
  const criando = projetoId == null;

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [salvando, setSalvando] = useState(false);

  /*
   * O valor do escopo e perguntado na hora de gerar, e nao guardado no projeto:
   * guardado, ele seria um segundo lugar dizendo quanto o projeto vale, e
   * divergiria do ticket no primeiro ajuste de servico.
   */
  const [valorEscopo, setValorEscopo] = useState(0);
  const [tituloAditivo, setTituloAditivo] = useState("");
  const [nomeFocado, setNomeFocado] = useState(false);


  const temTicket = (projeto?.tickets.length ?? 0) > 0;
  const [gerando, setGerando] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    clienteId: "",
    modalidade: "FECHADO" as "FECHADO" | "POR_DEMANDA",
    situacao: "FILA" as SituacaoProjeto,
    inicio: "",
    fim: "",
  });

  async function gerarTicketDoEscopo() {
    setGerando(true);
    const r = await fetch(`/api/v1/projetos/${projetoId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: valorEscopo, titulo: tituloAditivo.trim() || null }),
    });
    const dados = await r.json().catch(() => null);
    setGerando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Nao foi possivel gerar o ticket");
      return;
    }

    avisar("sucesso", `Ticket ${dados.data.ticketId} gerado`, "Ele ja esta na tela de tickets.");
    setProjeto(dados.data.projeto as Projeto);
    setValorEscopo(0);
    setTituloAditivo("");
    router.refresh();
  }

  async function desvincular(ticketId: number, numero: number) {
    const r = await fetch(`/api/v1/projetos/${projetoId}/cobranca/${ticketId}`, {
      method: "DELETE",
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Nao foi possivel remover o vinculo");
      return;
    }

    avisar(
      "sucesso",
      `Ticket ${numero} desvinculado`,
      "Ele continua existindo na tela de tickets.",
    );
    setProjeto(dados.data as Projeto);
    router.refresh();
  }

  async function desvincularContrato(contratoId: number) {
    const p = await chamar(`/api/v1/projetos/${projetoId}/contratos/${contratoId}`, "DELETE");
    if (p) setProjeto(p);
  }

  function excluirProjeto() {
    confirmar(
      `Excluir "${form.nome}"?`,
      "Excluir",
      async () => {
        const r = await fetch(`/api/v1/projetos/${projetoId}`, { method: "DELETE" });
        const dados = await r.json().catch(() => null);

        if (!r.ok) {
          avisar("atencao", dados?.error?.message ?? "Nao foi possivel excluir o projeto");
          return;
        }

        avisar("sucesso", "Projeto excluido");
        onClose();
        aoExcluir?.();
      },
      // O numero de tarefas no aviso porque e o que se perde junto, e o quadro
      // esta atras do drawer, fora de vista na hora de decidir.
      projeto && projeto.qtdDemandas > 0
        ? `As ${projeto.qtdDemandas} tarefas do projeto vao junto.`
        : undefined,
    );
  }

  useEffect(() => {
    if (projetoId == null) return;
    const controle = new AbortController();

    fetch(`/api/v1/projetos/${projetoId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o projeto");
        aplicar(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") avisar("erro", e.message);
      });

    return () => controle.abort();
  }, [projetoId, avisar]);

  function aplicar(p: Projeto) {
    setProjeto(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? "",
      clienteId: p.clienteId ? String(p.clienteId) : "",
      modalidade: p.modalidade,
      situacao: p.situacao,
      inicio: p.inicio ?? "",
      fim: p.fim ?? "",
    });
  }

  async function chamar(url: string, metodo: string, corpo?: unknown): Promise<Projeto | null> {
    const r = await fetch(url, {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível salvar",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return null;
    }

    router.refresh();
    return dados?.data as Projeto;
  }

  async function salvarDados() {
    setSalvando(true);
    const corpo = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      clienteId: form.clienteId ? Number(form.clienteId) : null,
      modalidade: form.modalidade,
      situacao: form.situacao,
      inicio: form.inicio || null,
      fim: form.fim || null,
    };

    const p = await chamar(
      criando ? "/api/v1/projetos" : `/api/v1/projetos/${projetoId}`,
      criando ? "POST" : "PATCH",
      corpo,
    );

    setSalvando(false);
    if (!p) return;

    if (criando) {
      avisar("sucesso", `Projeto ${p.numero} criado`, "O quadro já nasceu com o fluxo padrão.");
      onClose();
      return;
    }
    aplicar(p);
    avisar("sucesso", "Projeto salvo");
  }

  const podeSalvar = form.nome.trim().length > 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={criando ? "Novo projeto" : projeto ? `Projeto ${projeto.numero}` : "Projeto"}
      headerExtra={
        !criando && projeto ? (
          <>
            <Historico
              marcos={[
                {
                  rotulo: "Criado",
                  quem: projeto.autoria.criadoPor,
                  quando: projeto.autoria.criadoEm,
                },
                {
                  rotulo: "Última alteração",
                  quem: projeto.autoria.editadoPor,
                  quando: projeto.autoria.editadoEm,
                },
              ]}
            />

            {/* Excluir e acao do REGISTRO, como imprimir no ticket e anexo na
                tarefa — os tres vivem na mesma quina. No rodape ela dividia a
                linha com Salvar, e um clique torto ali vira perda. */}
            <BotaoDeCabecalho
            rotulo={
              temTicket
                ? "Remova o vínculo dos tickets antes de excluir o projeto"
                : "Excluir projeto"
            }
            perigo
            desabilitado={salvando || temTicket}
            onClick={excluirProjeto}
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
            <path d="M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
            <path d="M10 11v6M14 11v6" />
            </BotaoDeCabecalho>
          </>
        ) : undefined
      }
      /* Sem Cancelar: o X do cabecalho ja fecha, e dois jeitos de sair na mesma
         tela so dividem a atencao de quem procura Salvar. */
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button
            size="sm"
            variant="primary"
            onClick={salvarDados}
            disabled={salvando || !podeSalvar}
          >
            {salvando ? "Salvando…" : criando ? "Criar" : "Salvar"}
          </Button>
        </div>
      }
    >
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/*
           * O nome foge do padrao de campo, como o titulo da tarefa: ele e o
           * assunto da tela, e um rotulo "Nome" em cima so repetiria o que a
           * frase ja diz. Editavel no lugar onde e lido, alinhado com os rotulos
           * abaixo.
           */}
          <input
            autoFocus={criando}
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            onFocus={() => setNomeFocado(true)}
            onBlur={() => setNomeFocado(false)}
            maxLength={120}
            placeholder="Nome do projeto"
            style={{
              width: "100%",
              marginBottom: 14,
              padding: "4px 6px",
              marginLeft: -6,
              border: "none",
              borderRadius: "var(--radius-sm)",
              // Sem moldura em repouso: so ao focar aparece um fundo, o
              // suficiente para dizer "isto se edita".
              background: nomeFocado ? "var(--surface-2)" : "transparent",
              color: "var(--text-primary)",
              font: "inherit",
              fontSize: "var(--text-xl)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-snug)",
              lineHeight: "var(--lh-tight)",
              outline: "none",
              transition: "background var(--dur) var(--ease)",
            }}
          />

          <Field label="Cliente">
            <select
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
              style={selectStyle}
            >
              <option value="">Sem cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>

          {/* A modalidade decide de onde vem o dinheiro. Depois que o primeiro
              ticket nasce ela congela — o serviço barra a troca. */}
          <Field
            label="Modalidade"
            hint={
              form.modalidade === "FECHADO"
                ? "Valor combinado num ticket só; as demandas medem progresso."
                : "Cada demanda concluída vira serviço num ticket."
            }
          >
            <select
              value={form.modalidade}
              onChange={(e) =>
                setForm((f) => ({ ...f, modalidade: e.target.value as "FECHADO" | "POR_DEMANDA" }))
              }
              style={selectStyle}
            >
              <option value="FECHADO">Escopo fechado</option>
              <option value="POR_DEMANDA">Por demanda</option>
            </select>
          </Field>

          {/* Situação mora aqui e não no cabeçalho da página: mudar a etapa do
              projeto é decisão de quem o conduz, não gesto de quem organiza
              tarefa — e o cabeçalho é a barra de trabalho do quadro. */}
          <Field label="Situação">
            <select
              value={form.situacao}
              onChange={(e) =>
                setForm((f) => ({ ...f, situacao: e.target.value as SituacaoProjeto }))
              }
              style={selectStyle}
            >
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SITUACAO[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Início">
            <input
              type="date"
              value={form.inicio}
              onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Fim">
            <input
              type="date"
              value={form.fim}
              onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
            />
          </Field>

          {/*
            * A cobranca do escopo fechado nasce daqui, e nao do cabecalho do
            * quadro: gerar o ticket e decisao de quem conduz o projeto, do mesmo
            * grupo que modalidade e situacao. No cabecalho ela dividia a barra
            * com "+ Tarefa", que e gesto de rotina — um clique errado ali criava
            * cobranca.
            */}
          {/*
           * Ticket e contrato viram ABAS, e nao mais campos do formulario.
           *
           * Sao listas que crescem — projeto grande tem varios de cada — e
           * empilhadas no meio dos campos empurravam Descricao e Situacao para
           * fora da tela. Como abas, ocupam o mesmo espaco e so uma por vez.
           */}
          {!criando && projeto && (
            <VinculosDoProjeto
              projeto={projeto}
              clientes={clientes}
              modalidade={form.modalidade}
              onAtualizar={setProjeto}
              onGerar={gerarTicketDoEscopo}
              valorEscopo={valorEscopo}
              aoMudarValor={setValorEscopo}
              tituloAditivo={tituloAditivo}
              aoMudarTitulo={setTituloAditivo}
              gerando={gerando}
              aoDesvincularTicket={desvincular}
              aoDesvincularContrato={desvincularContrato}
              confirmar={confirmar}
            />
          )}
        </div>
      </>
    </Drawer>
  );
}

/**
 * Os vinculos do projeto com o dinheiro: tickets de um lado, contratos do outro.
 *
 * Duas listas que crescem — projeto grande tem varios de cada — entao vivem em
 * abas: empilhadas, empurravam os campos do formulario para fora da tela.
 *
 * Tabela e nao cartoes porque a pergunta e de conferencia: "quantos, de quanto,
 * em que situacao". Cartao serve para escolher; aqui ja esta escolhido.
 */
function VinculosDoProjeto({
  projeto,
  clientes,
  modalidade,
  onAtualizar,
  onGerar,
  valorEscopo,
  aoMudarValor,
  tituloAditivo,
  aoMudarTitulo,
  gerando,
  aoDesvincularTicket,
  aoDesvincularContrato,
  confirmar,
}: {
  projeto: Projeto;
  clientes: OpcaoCliente[];
  modalidade: "FECHADO" | "POR_DEMANDA";
  onAtualizar: (p: Projeto) => void;
  onGerar: () => void;
  valorEscopo: number;
  aoMudarValor: (v: number) => void;
  tituloAditivo: string;
  aoMudarTitulo: (v: string) => void;
  gerando: boolean;
  aoDesvincularTicket: (id: number, numero: number) => void;
  aoDesvincularContrato: (id: number) => void;
  confirmar: (t: string, r: string, f: () => void, d?: string) => void;
}) {
  const ABA_TICKETS = `Tickets (${projeto.tickets.length})`;
  const ABA_CONTRATOS = `Contratos (${projeto.contratos.length})`;

  const [aba, setAba] = useState(ABA_TICKETS);
  const [vinculando, setVinculando] = useState<"tickets" | "contratos" | null>(null);
  const [novoTicket, setNovoTicket] = useState(false);
  const [novoContrato, setNovoContrato] = useState(false);

  const emTickets = aba.startsWith("Tickets");
  const semContrato = projeto.contratos.length === 0;

  return (
    <div style={{ marginTop: 18 }}>
      <PanelTabs
        tabs={[ABA_TICKETS, ABA_CONTRATOS]}
        active={emTickets ? ABA_TICKETS : ABA_CONTRATOS}
        onChange={(t) => setAba(t)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, margin: "10px 0" }}>
        {/* Gerar so no escopo fechado: em POR_DEMANDA o ticket nasce das tarefas
            concluidas, pela tela do quadro. */}
        {emTickets && modalidade === "FECHADO" && (
          <BotaoNovo
            onClick={() => setNovoTicket((v) => !v)}
            desabilitado={projeto.cancelado}
            titulo={projeto.cancelado ? "Projeto cancelado não gera cobrança" : undefined}
          >
            Novo ticket
          </BotaoNovo>
        )}

        {/* Contrato novo abre o cadastro de contrato, e ja volta vinculado — sem
            isso o caminho seria sair do projeto, criar, e voltar para vincular. */}
        {!emTickets && (
          <BotaoNovo onClick={() => setNovoContrato(true)}>Novo contrato</BotaoNovo>
        )}

        <BotaoVincular onClick={() => setVinculando(emTickets ? "tickets" : "contratos")} />
      </div>

      {novoTicket && emTickets && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 10,
            padding: 10,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--input-border)",
            background: "var(--kanban-coluna-bg)",
          }}
        >
          {/* Sem contrato PASSA: projeto fechado no boca a boca existe, e travar
              impedia registrar o que ja aconteceu. O aviso fica — a falta de
              documento e um risco a lembrar, nao um erro a impedir. */}
          {semContrato && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              Sem contrato vinculado: a cobrança fica sem documento por trás.
            </span>
          )}

          {/* Titulo proprio so a partir do segundo: dois tickets com o nome do
              projeto na mesma lista nao se distinguem. */}
          {projeto.tickets.length > 0 && (
            <input
              value={tituloAditivo}
              onChange={(e) => aoMudarTitulo(e.target.value)}
              placeholder={`Aditivo ${projeto.tickets.length} — o que entrou a mais`}
              maxLength={120}
              style={inputStyle}
            />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <CampoNumerico valor={valorEscopo} escala={100} aoMudar={aoMudarValor} />
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={valorEscopo <= 0 || gerando}
              onClick={() => {
                onGerar();
                setNovoTicket(false);
              }}
            >
              {gerando ? "Gerando…" : "Gerar"}
            </Button>
          </div>
        </div>
      )}

      {emTickets ? (
        <Tabela
          colunas={[
            { rotulo: "Ticket" },
            { rotulo: "Situação" },
            { rotulo: "Início" },
            { rotulo: "Valor", align: "right" },
          ]}
          vazio="Nenhum ticket. Gere o do escopo ou vincule um que já existe."
          linhas={projeto.tickets.map((t) => ({
            id: t.id,
            celulas: [
              // So o numero: a coluna ja se chama Ticket, e repetir a palavra em
              // cada linha e a mesma informacao duas vezes. O titulo, quando ha
              // (o nome do aditivo), fica no hover.
              <span key="m" title={t.titulo ?? undefined} style={{ fontVariantNumeric: "tabular-nums" }}>
                {t.numero}
              </span>,
              t.situacao ?? "—",
              t.inicio ? paraFormatoBR(t.inicio as DataISO) : "—",
              formatarSemSimbolo(t.valor as Centavos),
            ],
            aoRemover: () =>
              confirmar(
                `Desvincular o ticket ${t.numero}?`,
                "Desvincular",
                () => aoDesvincularTicket(t.id, t.numero),
                "O ticket continua existindo. As tarefas dele voltam a poder ser cobradas.",
              ),
          }))}
        />
      ) : (
        <Tabela
          colunas={[
            { rotulo: "Contrato" },
            { rotulo: "Descrição" },
            { rotulo: "Vigência" },
            { rotulo: "Valor", align: "right" },
          ]}
          vazio="Nenhum contrato vinculado. É ele que autoriza cobrar o escopo."
          linhas={projeto.contratos.map((c) => ({
            id: c.id,
            celulas: [
              <span key="m" style={{ fontVariantNumeric: "tabular-nums" }}>
                {c.numero ?? c.id}
              </span>,
              c.descricao ?? "—",
              [c.inicio && paraFormatoBR(c.inicio as DataISO), c.fim && paraFormatoBR(c.fim as DataISO)]
                .filter(Boolean)
                .join(" a ") || "—",
              formatarSemSimbolo(c.valor as Centavos),
            ],
            aoRemover: () =>
              confirmar(
                `Desvincular o contrato ${c.numero ?? c.id}?`,
                "Desvincular",
                () => aoDesvincularContrato(c.id),
                "O contrato continua existindo. Os tickets já gerados não mudam.",
              ),
          }))}
        />
      )}

      {novoContrato && (
        <ContratoDrawer
          contratoId={null}
          criando
          clientes={clientes}
          clienteInicial={projeto.clienteId}
          onClose={() => setNovoContrato(false)}
          aoCriar={async (contratoId: number) => {
            /* Vincula sozinho: quem criou o contrato daqui ja disse a que projeto
               ele pertence — pedir para vincular em seguida seria perguntar de
               novo o que acabou de ser respondido. */
            const r = await fetch(`/api/v1/projetos/${projeto.id}/contratos/${contratoId}`, {
              method: "POST",
            });
            const dados = await r.json().catch(() => null);
            if (r.ok) onAtualizar(dados.data as Projeto);
          }}
        />
      )}

      {vinculando === "tickets" && (
        <VinculoDrawer
          titulo="Vincular tickets"
          rotuloMarca="Ticket"
          vazio="Nenhum ticket disponível. Aparecem aqui os deste cliente que ainda não pertencem a nenhum projeto e não estão cancelados."
          urlLista={`/api/v1/projetos/${projeto.id}/cobranca/disponiveis`}
          urlVinculo={(id) => `/api/v1/projetos/${projeto.id}/cobranca/${id}`}
          mapear={(t: TicketDisponivel) => ({
            id: t.id,
            marca: String(t.numero),
            descricao: t.titulo,
            apoio: [t.situacao, t.inicio && paraFormatoBR(t.inicio as DataISO)]
              .filter(Boolean)
              .join(" · "),
            valor: t.valor,
          })}
          aoVincular={(p) => onAtualizar(p as Projeto)}
          onClose={() => setVinculando(null)}
        />
      )}

      {vinculando === "contratos" && (
        <VinculoDrawer
          titulo="Vincular contratos"
          rotuloMarca="Contrato"
          vazio="Nenhum contrato disponível. Aparecem aqui os ativos deste cliente que ainda não estão no projeto."
          urlLista={`/api/v1/projetos/${projeto.id}/contratos/disponiveis`}
          urlVinculo={(id) => `/api/v1/projetos/${projeto.id}/contratos/${id}`}
          mapear={(c: ContratoDoProjeto) => ({
            id: c.id,
            marca: c.numero ?? String(c.id),
            descricao: c.descricao,
            apoio: [c.inicio && paraFormatoBR(c.inicio as DataISO), c.fim && paraFormatoBR(c.fim as DataISO)]
              .filter(Boolean)
              .join(" a "),
            valor: c.valor,
          })}
          aoVincular={(p) => onAtualizar(p as Projeto)}
          onClose={() => setVinculando(null)}
        />
      )}
    </div>
  );
}

/** Cheio e verde: e o que CRIA. */
function BotaoNovo({
  onClick,
  desabilitado,
  titulo,
  children,
}: {
  onClick: () => void;
  desabilitado?: boolean;
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant="primary" onClick={onClick} disabled={desabilitado} title={titulo}>
      + {children}
    </Button>
  );
}

/** Vazado: aponta para algo que ja existe, entao nao compete com o que cria. */
function BotaoVincular({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: "var(--h-btn-sm)",
        padding: "0 10px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--primary)",
        background: "transparent",
        color: "var(--primary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        fontFamily: "var(--font)",
        cursor: "pointer",
      }}
    >
      + Vincular
    </button>
  );
}

/**
 * Tabelinha do drawer, com as pecas do kit.
 *
 * Simples de proposito: nao ordena, nao pagina, nao filtra. Sao poucos vinculos
 * por projeto, e cada recurso desses seria um controle a mais competindo com o
 * formulario em volta.
 *
 * `TableFrame` nao serve aqui — ele ocupa a altura toda da pagina, e esta tabela
 * divide o drawer com os campos.
 */
function Tabela({
  colunas,
  linhas,
  vazio,
}: {
  colunas: { rotulo: string; align?: "left" | "right" }[];
  linhas: { id: number; celulas: React.ReactNode[]; aoRemover: () => void }[];
  vazio: string;
}) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <TableArea minWidth={0}>
        <TableHead>
          {colunas.map((c) => (
            <Th key={c.rotulo} align={c.align}>
              {c.rotulo}
            </Th>
          ))}
          <Th />
        </TableHead>
        <tbody>
          {linhas.length === 0 && <EmptyRow colSpan={colunas.length + 1} message={vazio} />}

          {linhas.map((l, n) => (
            <Tr key={l.id} delay={n * 12}>
              {l.celulas.map((celula, i) => (
                <Td
                  key={i}
                  style={{
                    textAlign: colunas[i]?.align,
                    fontVariantNumeric: colunas[i]?.align === "right" ? "tabular-nums" : undefined,
                    whiteSpace: "nowrap",
                  }}
                >
                  {celula}
                </Td>
              ))}
              <Td style={{ width: 40, padding: "0 12px 0 0", textAlign: "right" }}>
                <button
                  type="button"
                  title="Remover vínculo"
                  aria-label="Remover vínculo"
                  onClick={l.aoRemover}
                  style={{
                    width: 20,
                    height: 20,
                    display: "inline-grid",
                    placeItems: "center",
                    border: "none",
                    background: "none",
                    padding: 0,
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableArea>
    </div>
  );
}
