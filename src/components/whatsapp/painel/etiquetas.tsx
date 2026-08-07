"use client";

import { useEffect, useRef, useState } from "react";
import { CORES_DE_ETIQUETA } from "@/modules/whatsapp/whatsapp.schema";
import type { CorDeEtiqueta, Etiqueta } from "@/modules/whatsapp/whatsapp.types";

/**
 * Etiquetas de conversa: o chip e o menu de marcar.
 *
 * Fora do `painel.tsx` porque aquele arquivo ja passa de duas mil linhas, e
 * etiqueta e um assunto fechado: nada aqui precisa saber de mensagem, janela de
 * 24h ou envio.
 */

/**
 * A paleta, presa aos tokens de status.
 *
 * ⚠️ Nao ha cor livre. Um seletor de hex parece generosidade e cobra caro
 * depois: o tom que a pessoa escolheu no tema claro some no escuro, e nao ha
 * ninguem para consertar conversa por conversa.
 */
export const PALETA: Record<CorDeEtiqueta, { fundo: string; borda: string; texto: string }> = {
  verde: { fundo: "var(--success-bg)", borda: "var(--success-border)", texto: "var(--success-text)" },
  azul: { fundo: "var(--info-bg)", borda: "var(--info-border)", texto: "var(--info-text)" },
  ambar: { fundo: "var(--warning-bg)", borda: "var(--warning-border)", texto: "var(--warning-text)" },
  vermelho: { fundo: "var(--danger-bg)", borda: "var(--danger-border)", texto: "var(--danger-text)" },
  roxo: { fundo: "var(--roxo-bg)", borda: "var(--roxo-border)", texto: "var(--roxo-text)" },
  cinza: { fundo: "var(--neutral-bg)", borda: "var(--neutral-border)", texto: "var(--text-secondary)" },
};

const NOME_DA_COR: Record<CorDeEtiqueta, string> = {
  verde: "Verde",
  azul: "Azul",
  ambar: "Âmbar",
  vermelho: "Vermelho",
  roxo: "Roxo",
  cinza: "Cinza",
};

/**
 * Chip de etiqueta. Serve de filtro e de exibição.
 *
 * ⚠️ Quando é filtro, o estado APAGADO é o cinza e não a cor: com todos os chips
 * coloridos o tempo todo, a fileira vira um arco-íris e ninguém enxerga quais
 * estão ligados.
 */
export function ChipDeEtiqueta({
  etiqueta,
  ativa = true,
  miudo = false,
  onClick,
  onRemover,
}: {
  etiqueta: Etiqueta;
  ativa?: boolean;
  /** Versao da LISTA de conversas: menor, sem ponto, so o nome tingido. */
  miudo?: boolean;
  onClick?: () => void;
  onRemover?: () => void;
}) {
  const cor = PALETA[etiqueta.cor] ?? PALETA.cinza;

  const conteudo = (
    <>
      {/*
        O ponto some na versao miuda. Ali o chip inteiro ja e da cor da
        etiqueta, e um ponto da mesma cor dentro dele so gastaria largura numa
        linha que precisa caber ao lado da previa.
      */}
      {!miudo && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            flexShrink: 0,
            borderRadius: "var(--radius-full)",
            background: ativa ? cor.texto : "var(--text-disabled)",
          }}
        />
      )}
      {etiqueta.nome}
      {onRemover && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Tirar ${etiqueta.nome}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemover();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onRemover();
          }}
          style={{ marginLeft: 1, marginRight: -2, cursor: "pointer", opacity: 0.65 }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      )}
    </>
  );

  const estilo = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: miudo ? 17 : 22,
    padding: miudo ? "0 7px" : "0 9px",
    borderRadius: "var(--radius-full)",
    border: `1px solid ${ativa ? cor.borda : "var(--border)"}`,
    background: ativa ? cor.fundo : "var(--surface)",
    color: ativa ? cor.texto : "var(--text-secondary)",
    fontSize: miudo ? "var(--text-2xs)" : "var(--text-xs)",
    fontWeight: "var(--fw-semi)" as const,
    fontFamily: "var(--font)",
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
  };

  if (!onClick) return <span style={estilo}>{conteudo}</span>;

  return (
    <button type="button" onClick={onClick} aria-pressed={ativa} style={{ ...estilo, cursor: "pointer" }}>
      {conteudo}
    </button>
  );
}

/**
 * Botão de etiquetar, com o menu preso a ele.
 *
 * ⚠️ Marca e desmarca gravando na hora, uma etiqueta por clique. Um "salvar" no
 * pé do menu daria a chance de fechar sem querer e perder o que foi marcado, e
 * classificar é justamente o gesto rápido de quem está no meio de outra coisa.
 */
export function BotaoDeEtiquetas({
  etiquetas,
  marcadas,
  onAlternar,
  onCriar,
}: {
  etiquetas: Etiqueta[];
  marcadas: number[];
  onAlternar: (id: number) => void;
  /** Devolve o id da etiqueta criada, para ela ja entrar marcada. */
  onCriar: (nome: string, cor: CorDeEtiqueta) => Promise<number | null>;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Clique fora fecha. Sem isso o menu ficaria aberto por cima da conversa,
  // tapando justamente o que a pessoa quer ler para decidir a etiqueta.
  useEffect(() => {
    if (!aberto) return;

    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };

    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div ref={caixa} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Etiquetar conversa"
        title="Etiquetar"
        aria-expanded={aberto}
        style={{
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--border)",
          background: aberto ? "var(--surface-2)" : "var(--surface)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          color: marcadas.length > 0 ? "var(--primary)" : "var(--text-secondary)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" />
          <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" />
        </svg>
      </button>

      {aberto && (
        <MenuDeEtiquetas
          etiquetas={etiquetas}
          marcadas={marcadas}
          onAlternar={onAlternar}
          onCriar={onCriar}
        />
      )}
    </div>
  );
}

function MenuDeEtiquetas({
  etiquetas,
  marcadas,
  onAlternar,
  onCriar,
}: {
  etiquetas: Etiqueta[];
  marcadas: number[];
  onAlternar: (id: number) => void;
  onCriar: (nome: string, cor: CorDeEtiqueta) => Promise<number | null>;
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorDeEtiqueta>("verde");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    const limpo = nome.trim();
    if (!limpo || salvando) return;

    setSalvando(true);
    const id = await onCriar(limpo, cor);
    setSalvando(false);
    setNome("");
    setCriando(false);

    /*
     * ⚠️ Criada JA MARCADA nesta conversa.
     *
     * Ninguem abre o menu de uma conversa para cadastrar etiqueta: cria porque
     * quer classificar ESTA. Deixar a criacao sem efeito obrigava a um segundo
     * clique para fazer o que o primeiro parecia ter feito.
     */
    if (id) onAlternar(id);
  };

  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: 34,
        right: 0,
        width: 232,
        zIndex: 5,
        padding: 6,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        animation: "pop-in 140ms var(--ease-out)",
      }}
    >
      {etiquetas.length === 0 && !criando && (
        <p
          style={{
            padding: "10px 8px",
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Nenhuma etiqueta ainda. Crie a primeira para começar a classificar.
        </p>
      )}

      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {etiquetas.map((e) => {
          const marcada = marcadas.includes(e.id);
          const paleta = PALETA[e.cor] ?? PALETA.cinza;

          return (
            <button
              key={e.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={marcada}
              onClick={() => onAlternar(e.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 8px",
                border: "none",
                background: "transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 4,
                  border: `1px solid ${marcada ? paleta.borda : "var(--border)"}`,
                  background: marcada ? paleta.fundo : "transparent",
                  color: paleta.texto,
                }}
              >
                {marcada && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5.5 5.5L20 6.5" />
                  </svg>
                )}
              </span>

              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  flexShrink: 0,
                  borderRadius: "var(--radius-full)",
                  background: paleta.texto,
                }}
              />

              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.nome}
              </span>
            </button>
          );
        })}
      </div>

      {criando ? (
        <div style={{ padding: "8px 8px 4px", borderTop: "1px solid var(--border)", marginTop: 4 }}>
          <input
            autoFocus
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") void criar();
              if (ev.key === "Escape") setCriando(false);
            }}
            placeholder="Nome da etiqueta"
            maxLength={24}
            style={{
              width: "100%",
              height: 30,
              padding: "0 9px",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {CORES_DE_ETIQUETA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={NOME_DA_COR[c]}
                title={NOME_DA_COR[c]}
                style={{
                  width: 18,
                  height: 18,
                  padding: 0,
                  borderRadius: "var(--radius-full)",
                  border: cor === c ? "2px solid var(--text-primary)" : "1px solid var(--border)",
                  background: PALETA[c].texto,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setCriando(false)}
              style={{
                height: 26,
                padding: "0 10px",
                border: "none",
                background: "transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void criar()}
              disabled={!nome.trim() || salvando}
              style={{
                height: 26,
                padding: "0 12px",
                border: "none",
                background: nome.trim() ? "var(--primary)" : "var(--neutral-bg)",
                color: nome.trim() ? "var(--primary-fg)" : "var(--text-disabled)",
                borderRadius: "var(--radius-sm)",
                cursor: nome.trim() ? "pointer" : "default",
                fontFamily: "var(--font)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--fw-semi)",
              }}
            >
              Criar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCriando(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 4,
            padding: "8px",
            border: "none",
            borderTop: "1px solid var(--border)",
            background: "transparent",
            borderRadius: 0,
            cursor: "pointer",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            textAlign: "left",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova etiqueta
        </button>
      )}
    </div>
  );
}
