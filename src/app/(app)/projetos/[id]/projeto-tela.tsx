"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  IncluirButton,
  PageHeader,
  PageLayout,
  Panel,
  SearchInput,
} from "@/components/ui/kit";
import { Quadro } from "@/components/ui/quadro";
import { useAvisos } from "@/components/ui/avisos";
import { ProjetoDrawer, type OpcaoCliente } from "../projeto-drawer";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { faturavel, progressoDoChecklist, type Projeto } from "@/modules/projetos/projetos.types";
import { TarefaDrawer } from "./tarefa-drawer";
import { CobrancaDrawer } from "./cobranca-drawer";

/**
 * A pagina do projeto — quadro de demandas.
 *
 * E subpagina e nao drawer: aqui se trabalha, nao se consulta. Drawer e para
 * olhar um registro e fechar; arrastar tarefa a tarde inteira dentro de um
 * painel sobreposto deixa o resto do sistema atras, inutilizado e visivel.
 */
export function ProjetoTela({
  projeto: inicial,
  clientes,
  responsaveis,
}: {
  projeto: Projeto;
  clientes: OpcaoCliente[];
  responsaveis: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [projeto, setProjeto] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [faturando, setFaturando] = useState(false);

  // Filtra o CARTÃO, não a coluna: com colunas sumindo o quadro mudaria de
  // forma a cada letra digitada, e o lugar de cada demanda deixaria de ser fixo.
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return projeto.demandas;
    return projeto.demandas.filter(
      (d) =>
        d.titulo.toLowerCase().includes(termo) ||
        (d.responsavelNome ?? "").toLowerCase().includes(termo),
    );
  }, [projeto.demandas, busca]);

  async function chamar(url: string, metodo: string, corpo?: unknown) {
    const r = await fetch(url, {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível salvar");
      return null;
    }

    router.refresh();
    return dados?.data as Projeto;
  }

  const tarefaAberta = projeto.demandas.find((d) => d.id === aberta) ?? null;
  const temOQueFaturar = projeto.demandas.some(faturavel);

  return (
    <PageLayout>
      <Panel>
        {/* Sem o nome do cliente sob o título: ele já está no cadastro, e
            repetido aqui empurraria a barra de trabalho para baixo por um dado
            que ninguém consulta enquanto arrasta tarefa. */}
        <PageHeader title={projeto.nome} acima={{ rotulo: "Projetos", href: "/projetos" }}>
          {/* Faturar e do projeto, nao da tarefa: o ticket sai com todas as
              entregas do periodo, e uma a uma seria uma nota por tarefa. */}
          {projeto.modalidade === "POR_DEMANDA" && (
            <Button
              size="sm"
              variant="primary"
              disabled={!temOQueFaturar}
              title={temOQueFaturar ? undefined : "Nenhuma tarefa concluída com valor a cobrar"}
              onClick={() => setFaturando(true)}
            >
              Faturar tarefas
            </Button>
          )}

          <BotaoConfiguracao onClick={() => setEditando(true)} />
          <SearchInput
            value={busca}
            onSearch={setBusca}
            placeholder="Buscar tarefa"
            width="var(--toolbar-search-w)"
          />
          <IncluirButton onClick={() => setCriando(true)} rotulo="Tarefa" />
        </PageHeader>

        <Quadro
          colunas={projeto.colunas
            .filter((c) => c.ativo)
            .map((c) => ({ id: c.id, descricao: c.descricao, cor: c.cor }))}
          cartoes={visiveis.map((d) => ({
            ...d,
            colunaId: d.colunaId,
            // Demanda que já virou ticket não se move: o ticket referencia o
            // estado em que ela foi cobrada.
            arrastavel: d.ticketId == null,
          }))}
          aoMover={async (id, colunaId) => {
            const p = await chamar(`/api/v1/projetos/demandas/${id}`, "PATCH", { colunaId });
            if (p) setProjeto(p);
          }}
          larguraFixa
          vazio="Nenhuma tarefa"
          aoAbrir={(d) => setAberta(d.id)}
          corpo={(d) => (
            <CardTarefa
              tarefa={d}
              aoConcluir={async () => {
                const p = await chamar(`/api/v1/projetos/demandas/${d.id}`, "PATCH", {
                  concluida: d.concluidaEm == null,
                });
                if (p) setProjeto(p);
              }}
            />
          )}
          rodape={(d) => (
            <>
              <SinaisDaTarefa tarefa={d} />
              <span style={{ flex: 1 }} />
              {d.prazo && <Prazo data={d.prazo} concluida={d.concluidaEm != null} />}
            </>
          )}
        />
      </Panel>

      {criando && (
        <TarefaDrawer
          criando
          projeto={projeto}
          responsaveis={responsaveis}
          aoAtualizar={setProjeto}
          onClose={() => setCriando(false)}
        />
      )}

      {tarefaAberta && (
        <TarefaDrawer
          tarefa={tarefaAberta}
          projeto={projeto}
          responsaveis={responsaveis}
          aoAtualizar={setProjeto}
          onClose={() => setAberta(null)}
        />
      )}

      {faturando && (
        <CobrancaDrawer
          projeto={projeto}
          aoAtualizar={setProjeto}
          onClose={() => setFaturando(false)}
        />
      )}

      {editando && (
        <ProjetoDrawer
          projetoId={projeto.id}
          clientes={clientes}
          onClose={() => {
            setEditando(false);
            router.refresh();
          }}
          // O projeto deixou de existir: ficar na subpagina dele mostraria um
          // quadro de um registro apagado ate o proximo refresh.
          aoExcluir={() => router.push("/projetos")}
        />
      )}
    </PageLayout>
  );
}

type Demanda = Projeto["demandas"][number];

/**
 * Cartao da tarefa: o que se le de relance.
 *
 * Titulo, sinais de que ha mais dentro (checklist, comentario, descricao) e o
 * ticket quando ja foi cobrada. O resto vive no drawer — encher o cartao faria
 * a coluna virar uma lista de blocos altos, e o quadro perde a leitura de
 * conjunto que e a razao de existir.
 */
function CardTarefa({
  tarefa,
  aoConcluir,
}: {
  tarefa: Demanda;
  aoConcluir: () => void;
}) {
  const [hover, setHover] = useState(false);
  const feita = tarefa.concluidaEm != null;

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
        {/*
         * Concluir e marca da TAREFA, nao da coluna.
         *
         * As colunas sao do usuario — ele cria "Revisao", "Aguardando cliente",
         * o que quiser — entao nenhuma delas pode ser a resposta para "isto foi
         * entregue?". Quando nao esta concluida e o mouse nao esta no cartao, a
         * marca some: um circulo vazio em cada linha seria uma coluna de vazios.
         */}
        {(feita || hover) && (
          <button
            type="button"
            role="checkbox"
            aria-checked={feita}
            title={feita ? "Reabrir tarefa" : "Marcar como concluída"}
            onClick={(e) => {
              // O cartao inteiro abre o drawer; a marca nao pode abrir junto.
              e.stopPropagation();
              aoConcluir();
            }}
            style={{
              flexShrink: 0,
              width: 14,
              height: 14,
              // Alinhada ao topo, na altura da primeira linha do titulo, e nao
              // ao centro: com titulo de duas linhas ela descia para o meio.
              marginTop: 1,
              display: "grid",
              placeItems: "center",
              padding: 0,
              borderRadius: "var(--radius-full)",
              border: feita ? "none" : "1.5px solid var(--border-strong)",
              background: feita ? "var(--success)" : "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {feita && (
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </button>
        )}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-medium)",
            lineHeight: 1.32,
            letterSpacing: "var(--tracking-normal)",
            color: feita ? "var(--text-tertiary)" : undefined,
          }}
        >
          {tarefa.titulo}
        </div>
      </div>

      {/* Duas linhas da descricao: o titulo raramente cabe o suficiente, e o
          texto inteiro faria cartoes de alturas muito diferentes na mesma
          coluna. */}
      {tarefa.descricao && (
        <div
          style={{
            marginTop: 4,
            // O mesmo par do cartao de ticket: --text-sm em tertiary para a
            // linha de apoio. --text-xs sao 9px, tamanho de etiqueta, nao de
            // texto que alguem le.
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            letterSpacing: "var(--tracking-normal)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {tarefa.descricao}
        </div>
      )}
    </div>
  );
}

/** Marca redonda com a inicial. Nao ha foto no cadastro de usuario. */
function AvatarTarefa({ nome }: { nome: string }) {
  return (
    <span
      title={nome}
      className="redondo"
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        display: "grid",
        placeItems: "center",
        borderRadius: "50%",
        background: "var(--surface-3)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        lineHeight: 1,
      }}
    >
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Checklist, conversa, anexos e cobranca — o rodape do cartao.
 *
 * O checklist leva contador porque "3/7" e o proprio andamento; a conversa nao,
 * porque so importa saber que ela existe — quantas mensagens tem se descobre
 * abrindo, e o numero ali competiria com o do checklist ao lado.
 */
function SinaisDaTarefa({ tarefa }: { tarefa: Demanda }) {
  const { feitos, total } = progressoDoChecklist(tarefa.itens);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: "var(--text-sm)",
        color: "var(--text-tertiary)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Quem faz, como marca redonda: o nome por extenso ocupava uma linha
          inteira do cartao para dizer o que a inicial ja diz num quadro onde a
          equipe e sempre a mesma meia duzia. Fica com os outros sinais, e nao na
          linha do titulo, porque tambem e sinal — nao faz parte do assunto. */}
      {tarefa.responsavelNome && <AvatarTarefa nome={tarefa.responsavelNome} />}

      {total > 0 && (
        <span
          title={`${feitos} de ${total} itens do checklist`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: feitos === total ? "var(--credito)" : undefined,
          }}
        >
          <IconeSinal>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12.2l2.5 2.5 4.5-5" />
          </IconeSinal>
          {feitos}/{total}
        </span>
      )}

      {tarefa.anexos.length > 0 && (
        <span
          title={`${tarefa.anexos.length} anexo(s)`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <IconeSinal>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </IconeSinal>
          {tarefa.anexos.length}
        </span>
      )}

      {tarefa.ticketId != null && <Badge tom="success">TICKET {tarefa.ticketId}</Badge>}
    </div>
  );
}

function IconeSinal({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}



/** Vermelho só quando venceu e não concluiu — data passada de tarefa feita é história. */
function Prazo({ data, concluida }: { data: string; concluida: boolean }) {
  const atrasada = !concluida && data < hoje();

  return (
    <span
      style={{
        // Menor que os sinais da esquerda de proposito: a data e referencia, nao
        // o assunto do cartao. So o atraso se impoe, e ai pelo peso e pela cor.
        fontSize: "var(--text-xs)",
        fontWeight: atrasada ? "var(--fw-semi)" : "var(--fw-normal)",
        color: atrasada ? "var(--debito)" : "var(--text-tertiary)",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {paraFormatoBR(data as DataISO)}
    </span>
  );
}

/** Engrenagem: escopo, situação e edição do projeto. */
function BotaoConfiguracao({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Configurações do projeto"
      aria-label="Configurações do projeto"
      onClick={onClick}
      style={{
        width: "var(--h-btn-sm)",
        height: "var(--h-btn-sm)",
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-md)",
        // A mesma borda do campo de busca ao lado: os dois dividem a barra, e
        // uma moldura mais escura fazia o botao parecer de outro conjunto.
        border: "1px solid var(--input-border)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </button>
  );
}

