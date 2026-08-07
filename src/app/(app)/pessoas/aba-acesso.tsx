"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Avatar } from "@/components/ui/avatar";
import { Button, CabecalhoDeSecao, selectStyle } from "@/components/ui/kit";
import type { UsuarioDaPessoa } from "@/modules/clientes/clientes.types";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Quem enxerga os dados desta pessoa pelo portal.
 *
 * ⚠️ É acesso ao PORTAL, e não permissão de sistema. Quem está aqui vê as
 * faturas, os tickets e os documentos deste cadastro do lado de fora; não ganha
 * nada dentro do sistema da empresa.
 *
 * ⚠️ Vincular alguém é dar acesso a dado financeiro de terceiro. A lista de
 * candidatos sai de `usuarios_visiveis()`: ninguém consegue dar acesso a um
 * usuário que nem enxerga.
 */
type Acesso = { comAcesso: UsuarioDaPessoa[]; disponiveis: UsuarioDaPessoa[] };

export function AbaDeAcesso({
  clienteId,
  nome,
  cache,
}: {
  clienteId: number;
  nome: string;
  cache: CacheDoDrawer;
}) {
  const { avisar } = useAvisos();

  const [escolhido, setEscolhido] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { dados, recarregar: carregar } = useRecursoDaPessoa<Acesso>(
    cache,
    "acesso",
    `/api/v1/clientes/${clienteId}/acesso`,
  );

  const comAcesso = dados?.comAcesso ?? null;
  const disponiveis = dados?.disponiveis ?? [];

  async function gravar(usuarios: string[]) {
    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/acesso`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarios }),
    });

    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", "Não foi possível salvar o acesso");
      return;
    }

    setEscolhido("");
    void carregar();
  }

  const atuais = (comAcesso ?? []).map((u) => u.id);
  const faltam = disponiveis.filter((u) => !atuais.includes(u.id));

  return (
    <>
      <CabecalhoDeSecao
        primeiro
        colado
        titulo="Acesso ao portal"
        legenda={`Quem estiver aqui vê as faturas, os tickets e os documentos de ${nome} pelo portal do cliente. Não é permissão dentro do sistema: é o lado de fora.`}
      />

      {comAcesso == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Carregando…</p>
      ) : comAcesso.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Ninguém tem acesso a este cadastro pelo portal.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {comAcesso.map((u) => (
            <div
              key={u.id}
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
              <Avatar nome={u.nome || u.email || "?"} semente={u.id} tamanho={26} />

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
                  {/*
                    Sem nome nem e-mail, sai o uuid. É feio e é honesto: o
                    usuário existe, e mostrar "—" faria parecer que a linha está
                    quebrada.
                  */}
                  {u.nome || u.email || u.id}
                </span>

                {u.nome && u.email && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 1,
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {u.email}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={() => void gravar(atuais.filter((id) => id !== u.id))}
                disabled={salvando}
                aria-label="Tirar o acesso"
                title="Tirar o acesso"
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

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <select
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
          style={{ ...selectStyle, flex: 1 }}
          aria-label="Usuário"
        >
          <option value="">
            {faltam.length === 0 ? "Nenhum usuário disponível" : "Escolher usuário…"}
          </option>

          {faltam.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome || u.email || u.id}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          variant="secondary"
          disabled={!escolhido || salvando}
          onClick={() => void gravar([...atuais, escolhido])}
        >
          Dar acesso
        </Button>
      </div>
    </>
  );
}
