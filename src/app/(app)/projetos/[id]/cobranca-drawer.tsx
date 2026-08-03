"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { faturavel, type Demanda, type Projeto } from "@/modules/projetos/projetos.types";

/**
 * Faturar tarefas — um lote de entregas vira UM ticket.
 *
 * Uma cobranca por tarefa faria doze entregas do mes virarem doze faturas para o
 * mesmo cliente. O lote e como se fatura de verdade: o periodo inteiro numa nota
 * so, discriminada item a item.
 *
 * So aparece o que PODE ser cobrado — concluida, com valor e ainda nao cobrada.
 * Listar as outras desabilitadas encheria a tela de linhas que nao se clica, e a
 * pergunta aqui e "o que entra nesta nota", nao "como vai o projeto".
 */
export function CobrancaDrawer({
  projeto,
  aoAtualizar,
  onClose,
}: {
  projeto: Projeto;
  aoAtualizar: (p: Projeto) => void;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();
  const elegiveis = projeto.demandas.filter(faturavel);

  // Tudo marcado ao abrir: quem clica em "Faturar" quase sempre quer o periodo
  // inteiro, e desmarcar uma e menos trabalho que marcar oito.
  const [marcadas, setMarcadas] = useState<number[]>(() => elegiveis.map((d) => d.id));
  const [gerando, setGerando] = useState(false);

  const total = elegiveis
    .filter((d) => marcadas.includes(d.id))
    .reduce((soma, d) => soma + d.valor, 0) as Centavos;

  async function gerar() {
    setGerando(true);
    const r = await fetch(`/api/v1/projetos/${projeto.id}/cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demandas: marcadas }),
    });
    const dados = await r.json().catch(() => null);
    setGerando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível gerar o ticket");
      return;
    }

    avisar("sucesso", `Ticket ${dados.data.ticketId} gerado`, "Ele já está na tela de tickets.");
    aoAtualizar(dados.data.projeto as Projeto);
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Faturar tarefas"
      subtitle={projeto.clienteNome ?? undefined}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
              {marcadas.length} de {elegiveis.length}
            </div>
            <div
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--fw-semi)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatarSemSimbolo(total)}
            </div>
          </div>

          <span style={{ flex: 1 }} />
          <Button size="sm" onClick={onClose} disabled={gerando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={gerar}
            disabled={gerando || marcadas.length === 0}
          >
            {gerando ? "Gerando…" : "Gerar ticket"}
          </Button>
        </div>
      }
    >
      {elegiveis.length === 0 ? (
        <div
          style={{
            padding: "28px 16px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-base)",
            lineHeight: 1.6,
          }}
        >
          Nenhuma tarefa pronta para cobrar.
          <br />
          Para entrar aqui ela precisa estar <strong>concluída</strong>, ter{" "}
          <strong>valor</strong> e ainda <strong>não ter sido cobrada</strong>.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span className="rotulo" style={{ fontSize: "var(--text-xs)", flex: 1 }}>
              Tarefas concluídas e ainda não cobradas
            </span>
            <button
              type="button"
              onClick={() =>
                setMarcadas((m) =>
                  m.length === elegiveis.length ? [] : elegiveis.map((d) => d.id),
                )
              }
              style={{
                border: "none",
                background: "none",
                padding: 0,
                color: "var(--primary)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              {marcadas.length === elegiveis.length ? "Desmarcar todas" : "Marcar todas"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {elegiveis.map((d) => (
              <LinhaTarefa
                key={d.id}
                tarefa={d}
                marcada={marcadas.includes(d.id)}
                aoAlternar={() =>
                  setMarcadas((m) =>
                    m.includes(d.id) ? m.filter((x) => x !== d.id) : [...m, d.id],
                  )
                }
              />
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

function LinhaTarefa({
  tarefa,
  marcada,
  aoAlternar,
}: {
  tarefa: Demanda;
  marcada: boolean;
  aoAlternar: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={aoAlternar}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 8px",
        borderRadius: "var(--radius-md)",
        background: hover ? "var(--surface-2)" : "transparent",
        cursor: "pointer",
        transition: "background var(--dur) var(--ease)",
      }}
    >
      {/* Mesma caixa desenhada do checklist da tarefa: a nativa muda de forma e
          de cor a cada navegador, e aqui ela aparece dez vezes seguidas. */}
      <span
        role="checkbox"
        aria-checked={marcada}
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--radius-full)",
          border: marcada ? "none" : "1.5px solid var(--border-strong)",
          background: marcada ? "var(--success)" : "transparent",
          color: "#fff",
        }}
      >
        {marcada && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-base)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tarefa.titulo}
        </div>
        {(tarefa.prazo || tarefa.responsavelNome) && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            {[tarefa.responsavelNome, tarefa.prazo && paraFormatoBR(tarefa.prazo as DataISO)]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--fw-medium)",
          fontVariantNumeric: "tabular-nums",
          color: marcada ? "var(--text-primary)" : "var(--text-tertiary)",
        }}
      >
        {formatarSemSimbolo(tarefa.valor)}
      </span>
    </div>
  );
}
