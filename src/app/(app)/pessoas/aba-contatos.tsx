"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Button, CabecalhoDeSecao, inputStyle } from "@/components/ui/kit";
import type { ContatoDaPessoa } from "@/modules/clientes/clientes.types";

/**
 * Telefones e e-mails da pessoa.
 *
 * ⚠️ Lista, e não um campo de cada. Uma empresa tem o e-mail do financeiro, o do
 * comercial e o telefone de cada um — guardar um só obrigava a escolher qual
 * perder, e quem precisava do outro anotava num papel.
 *
 * ⚠️ Em subguias, e não numa lista misturada. Telefone e e-mail se procuram em
 * momentos diferentes: quem vai ligar não quer ler endereços de e-mail no meio
 * do caminho.
 */

const SUB = ["Telefones", "E-mails"] as const;
type Sub = (typeof SUB)[number];

export function AbaDeContatos({
  clienteId,
  contatos,
  onMudou,
}: {
  clienteId: number;
  /** `null` enquanto carrega. Vem de fora: o Informações também usa. */
  contatos: ContatoDaPessoa[] | null;
  onMudou: () => void;
}) {
  const [sub, setSub] = useState<Sub>("Telefones");

  const tipo = sub === "Telefones" ? "telefone" : "email";
  const daVez = (contatos ?? []).filter((c) => c.tipo === tipo);

  return (
    <>
      <CabecalhoDeSecao
        primeiro
        colado
        titulo="Contatos"
        legenda="Todos os telefones e e-mails desta pessoa. O que estiver marcado como principal na aba Informações é o que a cobrança usa; os demais ficam aqui para quem precisar falar com outro setor."
      />

      {/*
        Subguias como pastilhas, e não como as abas do drawer: são o mesmo
        assunto visto de dois jeitos, e repetir a anatomia das abas de cima faria
        parecer que se saiu de Contatos para outro lugar.
      */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {SUB.map((s) => {
          const ativa = sub === s;
          const quantos = (contatos ?? []).filter(
            (c) => c.tipo === (s === "Telefones" ? "telefone" : "email"),
          ).length;

          return (
            <button
              key={s}
              type="button"
              onClick={() => setSub(s)}
              aria-pressed={ativa}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 26,
                padding: "0 11px",
                borderRadius: "var(--radius-full)",
                border: "1px solid transparent",
                background: ativa ? "var(--primary-subtle)" : "var(--surface-3)",
                color: ativa ? "var(--primary)" : "var(--text-secondary)",
                fontSize: "var(--text-sm)",
                fontWeight: ativa ? "var(--fw-semi)" : "var(--fw-normal)",
                fontFamily: "var(--font)",
                cursor: "pointer",
              }}
            >
              {s}
              <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{quantos}</span>
            </button>
          );
        })}
      </div>

      {/*
        `key` pelo TIPO: trocar de subguia remonta a lista, e o que estava sendo
        digitado morre junto. Um e-mail meio escrito no campo de telefone é lixo
        esperando para virar cadastro errado.
      */}
      <Lista
        key={tipo}
        clienteId={clienteId}
        tipo={tipo}
        itens={contatos == null ? null : daVez}
        onMudou={onMudou}
      />
    </>
  );
}

function Lista({
  clienteId,
  tipo,
  itens,
  onMudou,
}: {
  clienteId: number;
  tipo: "telefone" | "email";
  itens: ContatoDaPessoa[] | null;
  onMudou: () => void;
}) {
  const { avisar } = useAvisos();

  const [valor, setValor] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    const limpo = valor.trim();
    if (!limpo || salvando) return;

    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/contatos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, valor: limpo, rotulo: rotulo.trim() || null }),
    });

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      const detalhe = corpo?.error?.details?.[0];

      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível adicionar"),
      );
      return;
    }

    setValor("");
    setRotulo("");
    onMudou();
  }

  async function remover(id: number) {
    const r = await fetch(`/api/v1/clientes/${clienteId}/contatos/${id}`, { method: "DELETE" });

    if (!r.ok) {
      avisar("atencao", "Não foi possível remover");
      return;
    }

    onMudou();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {itens == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Carregando…</p>
      ) : itens.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          {tipo === "telefone"
            ? "Nenhum telefone cadastrado."
            : "Nenhum e-mail cadastrado."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {itens.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--text-base)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.valor}
                </span>

                {c.rotulo && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 1,
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {c.rotulo}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={() => void remover(c.id)}
                aria-label={`Remover ${c.valor}`}
                title="Remover"
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  border: "none",
                  background: "transparent",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/*
        ⚠️ O rótulo fica ao lado, e não é obrigatório.

        "Financeiro", "Comercial", "Portaria" é o que faz três telefones da mesma
        empresa deixarem de ser três números iguais. Obrigatório, viraria uma
        caixa preenchida com qualquer coisa só para o botão liberar.
      */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 2 }}>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void adicionar();
          }}
          placeholder={tipo === "telefone" ? "(00) 00000-0000" : "financeiro@empresa.com.br"}
          type={tipo === "email" ? "email" : "text"}
          style={{ ...inputStyle, flex: 2 }}
        />

        <input
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void adicionar();
          }}
          placeholder="Setor (opcional)"
          style={{ ...inputStyle, flex: 1 }}
        />

        <Button
          size="sm"
          variant="secondary"
          disabled={!valor.trim() || salvando}
          onClick={() => void adicionar()}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
