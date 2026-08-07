"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { formatarTelefone, type ContatoDoPainel } from "@/modules/whatsapp/whatsapp.types";

/**
 * A agenda, no lugar da lista de conversas.
 *
 * ⚠️ NO LUGAR, e não num drawer por cima. Escolher com quem falar é o mesmo
 * gesto de escolher qual conversa abrir — é a mesma coluna, com outro conteúdo.
 * Num drawer, a tela ganharia uma terceira camada para fazer o que a primeira já
 * faz, e fechar viraria uma pergunta ("volto para onde?").
 *
 * ⚠️ Uma linha por TELEFONE. Um cliente com dois números aparece duas vezes,
 * como no WhatsApp: quem escolhe está escolhendo para onde a mensagem vai.
 */
export function ListaDeContatos({
  contaId,
  estreito,
  onEscolher,
  onFechar,
}: {
  contaId: number;
  /** Única coluna na tela: ocupa tudo em vez dos 384 fixos. */
  estreito: boolean;
  /**
   * `conversaId` preenchido = já existe conversa neste número, e ela é aberta.
   * Nulo = rascunho: a conversa nasce quando o modelo sair.
   */
  onEscolher: (c: ContatoDoPainel) => void;
  onFechar: () => void;
}) {
  const [contatos, setContatos] = useState<ContatoDoPainel[] | null>(null);
  const [busca, setBusca] = useState("");

  /*
   * A busca vai ao SERVIDOR, com espera entre teclas.
   *
   * ⚠️ Filtrar na memória exigiria a agenda inteira no navegador. Numa base de
   * cinco mil clientes, isso é cinco mil linhas trafegadas por abertura de tela
   * para desenhar as vinte que cabem — e ainda deixaria a lista sempre
   * incompleta, porque nenhum limite razoável cobre a base toda.
   *
   * 280ms: o bastante para uma palavra digitada de uma vez virar UMA consulta, e
   * curto o suficiente para não parecer travado.
   */
  useEffect(() => {
    const controle = new AbortController();

    const t = setTimeout(() => {
      const termo = busca.trim();
      const url = `/api/v1/whatsapp/contatos?contaId=${contaId}${
        termo ? `&busca=${encodeURIComponent(termo)}` : ""
      }`;

      fetch(url, { signal: controle.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const corpo = await r.json();
          setContatos(corpo.data ?? []);
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") setContatos([]);
        });
    }, 280);

    return () => {
      clearTimeout(t);
      controle.abort();
    };
  }, [contaId, busca]);

  const listados = contatos ?? [];

  return (
    <div
      style={{
        width: estreito ? "100%" : 384,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "12px 12px 10px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Voltar para as conversas"
            title="Voltar"
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              marginLeft: -6,
              display: "grid",
              placeItems: "center",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Nova conversa
          </span>
        </div>

        <div style={{ position: "relative", display: "flex" }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-tertiary)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente ou número"
            style={{
              flex: 1,
              height: 32,
              padding: "0 10px 0 28px",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingBottom: 8 }}>
        {contatos == null ? (
          <Aviso texto="Carregando a agenda…" />
        ) : listados.length === 0 ? (
          <Aviso
            texto={
              busca.trim()
                ? "Nenhum contato com esse nome ou número."
                : "Nenhum cliente com telefone cadastrado."
            }
          />
        ) : (
          listados.map((c) => (
            <LinhaDeContato
              key={`${c.clienteId}-${c.telefone}`}
              contato={c}
              onClick={() => onEscolher(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p
      style={{
        padding: "24px 16px",
        fontSize: "var(--text-sm)",
        color: "var(--text-tertiary)",
        textAlign: "center",
        lineHeight: "var(--lh-snug)",
      }}
    >
      {texto}
    </p>
  );
}

function LinhaDeContato({
  contato,
  onClick,
}: {
  contato: ContatoDoPainel;
  onClick: () => void;
}) {
  const titulo = contato.nome || formatarTelefone(contato.telefone);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 16px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 120ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Avatar nome={titulo} semente={contato.telefone} foto={contato.icone} />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-md)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {titulo}
        </span>

        <span
          style={{
            display: "block",
            marginTop: 1,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          {formatarTelefone(contato.telefone)}
        </span>
      </span>

      {/*
        ⚠️ Quem JÁ tem conversa é marcado.

        Sem isso, a agenda parecia uma lista de contatos novos, e clicar em quem
        já estava na caixa de entrada dava a impressão de que ia começar do zero
        — quando o que acontece é a conversa antiga abrir com o histórico todo.
      */}
      {contato.conversaId != null && (
        <span
          title="Já tem conversa neste número"
          style={{
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            color: "var(--text-tertiary)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.7A8.4 8.4 0 1 1 21 11.5z" />
          </svg>
        </span>
      )}
    </button>
  );
}
