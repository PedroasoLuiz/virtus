"use client";

import { useState } from "react";

/**
 * Quadro kanban genérico.
 *
 * Extraído do quadro de tickets quando as demandas de projeto precisaram do
 * mesmo desenho: colunas que dividem a largura, card com moldura de 2px e
 * rodapé fora do branco, silhuetas na coluna vazia. Duplicar isso significaria
 * dois quadros divergindo no primeiro ajuste de espaçamento.
 *
 * O que é genérico: layout, arraste, coluna vazia, moldura do card.
 * O que a tela dá: o conteúdo do card, o rodapé, e se a coluna aceita o card.
 */

export type ColunaQuadro = {
  id: number;
  descricao: string;
  cor: string;
  /** Falso desenha a coluna, mas recusa card arrastado. */
  aceitaSolta?: boolean;
};

export type CartaoQuadro = {
  id: number;
  colunaId: number | null;
  /** Falso impede arrastar — registro travado por regra de negócio. */
  arrastavel?: boolean;
};

export function Quadro<T extends CartaoQuadro>({
  colunas,
  cartoes,
  aoMover,
  aoAbrir,
  corpo,
  rodape,
  cabecalhoExtra,
  larguraFixa,
  vazio = "Nada aqui",
}: {
  colunas: ColunaQuadro[];
  cartoes: T[];
  aoMover: (cartaoId: number, colunaId: number) => void;
  aoAbrir?: (cartao: T) => void;
  /** Conteúdo do cartão branco. */
  corpo: (cartao: T) => React.ReactNode;
  /** Faixa da moldura, fora do branco. Ausente = sem faixa. */
  rodape?: (cartao: T) => React.ReactNode;
  /** Ações do cabeçalho da coluna, à direita da contagem. */
  cabecalhoExtra?: (coluna: ColunaQuadro, quantidade: number) => React.ReactNode;
  /**
   * Colunas com largura fixa e rolagem lateral, em vez de dividirem o espaço.
   *
   * Serve para quadro em que o usuário cria colunas: dividindo, cada nova
   * coluna estreita todas as outras, e a partir de umas seis nenhuma cabe um
   * cartão legível. Quadro de conjunto fechado — o de tickets, o de situação de
   * projeto — continua dividindo, porque ali o número de colunas não cresce.
   */
  larguraFixa?: boolean;
  vazio?: string;
}) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  return (
    /*
     * Sem `larguraFixa`, as colunas dividem o espaço em vez de rolar: rolagem
     * horizontal esconde coluna atrás da borda, e quem arrasta um card precisa
     * rolar segurando o card.
     *
     * Com ela, o oposto — e é o certo quando o usuário cria colunas: dividir
     * faria cada coluna nova estreitar todas as outras.
     */
    <div
      style={{
        flex: 1,
        overflowX: larguraFixa ? "auto" : "hidden",
        overflowY: "hidden",
        padding: "0 16px",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--kanban-gap)",
          height: "100%",
          alignItems: "stretch",
          minWidth: larguraFixa ? "max-content" : undefined,
        }}
      >
        {colunas.map((coluna) => {
          const daColuna = cartoes.filter((c) => c.colunaId === coluna.id);
          const aceita = arrastando != null && coluna.aceitaSolta !== false;
          const realcada = aceita && sobre === coluna.id;

          return (
            <div
              key={coluna.id}
              onDragOver={(e) => {
                if (!aceita) return;
                e.preventDefault();
                setSobre(coluna.id);
              }}
              onDragLeave={() => setSobre((s) => (s === coluna.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                if (aceita && arrastando != null) aoMover(arrastando, coluna.id);
                setArrastando(null);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                // `minWidth: 0` permite encolher abaixo do conteúdo; sem ele o
                // flex respeita a largura mínima do texto e a rolagem volta.
                ...(larguraFixa
                  ? { width: "var(--kanban-coluna-w)", flexShrink: 0 }
                  : { flex: 1, minWidth: 0 }),
                height: "100%",
                minHeight: 0,
                background: "var(--kanban-coluna-bg)",
                borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
                boxShadow: realcada ? "inset 0 0 0 2px var(--primary)" : "none",
                transition: "box-shadow var(--dur-fast) var(--ease)",
              }}
            >
              <div style={{ padding: "12px 13px 10px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, height: 22 }}>
                  <span
                    style={{
                      fontSize: "var(--text-md)",
                      fontWeight: "var(--fw-semi)",
                      letterSpacing: "var(--tracking-snug)",
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {coluna.descricao}
                  </span>

                  <span style={{ flex: 1 }} />

                  {cabecalhoExtra?.(coluna, daColuna.length)}

                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--fw-medium)",
                      color: "var(--text-tertiary)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {daColuna.length}
                  </span>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  padding: "0 9px 14px",
                }}
              >
                {daColuna.length === 0 ? (
                  <ColunaVazia texto={vazio} />
                ) : (
                  daColuna.map((c) => (
                    <Cartao
                      key={c.id}
                      arrastavel={c.arrastavel !== false}
                      onArrastar={() => setArrastando(c.id)}
                      onSoltar={() => {
                        setArrastando(null);
                        setSobre(null);
                      }}
                      onAbrir={aoAbrir ? () => aoAbrir(c) : undefined}
                      rodape={rodape?.(c)}
                    >
                      {corpo(c)}
                    </Cartao>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Moldura do cartão. O branco leva o registro; a faixa leva a leitura de apoio. */
function Cartao({
  children,
  rodape,
  arrastavel,
  onArrastar,
  onSoltar,
  onAbrir,
}: {
  children: React.ReactNode;
  rodape?: React.ReactNode;
  arrastavel: boolean;
  onArrastar: () => void;
  onSoltar: () => void;
  onAbrir?: () => void;
}) {
  return (
    <div
      draggable={arrastavel}
      onDragStart={onArrastar}
      onDragEnd={onSoltar}
      onClick={onAbrir}
      style={{
        background: "var(--kanban-card-moldura)",
        borderRadius: "var(--radius-md)",
        padding: 2,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.09)",
        cursor: onAbrir ? "pointer" : "default",
        userSelect: "none",
        flexShrink: 0,
        transition: "box-shadow 120ms var(--ease), transform 100ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 5px 14px rgba(0, 0, 0, 0.13)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.09)";
        e.currentTarget.style.transform = "none";
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 12px 11px",
        }}
      >
        {children}
      </div>

      {rodape && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px 4px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rodape}
        </div>
      )}
    </div>
  );
}

/**
 * Silhuetas no lugar dos cartões.
 *
 * Só o texto não mostrava que ali cabe card. A altura vem de repetir as linhas
 * de um cartão com conteúdo vazio, não de um `height` fixo — fixar faria as
 * duas divergirem no primeiro ajuste de tipografia.
 */
function ColunaVazia({ texto }: { texto: string }) {
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {[1, 0.6, 0.32].map((opacidade, i) => (
        <div
          key={i}
          style={{
            background: "var(--kanban-card-moldura)",
            borderRadius: "var(--radius-md)",
            padding: 2,
            opacity: opacidade,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.35)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px 11px",
            }}
          >
            <div style={{ fontSize: "var(--text-sm)" }}>&nbsp;</div>
            <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.32, marginTop: 7 }}>&nbsp;</div>
          </div>
        </div>
      ))}

      <div
        style={{
          textAlign: "center",
          marginTop: 4,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
        }}
      >
        {texto}
      </div>
    </div>
  );
}
