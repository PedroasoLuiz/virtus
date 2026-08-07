"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { CabecalhoDeSecao } from "@/components/ui/kit";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Em que centros de custo esta pessoa entra.
 *
 * ⚠️ Diferente do centro PADRÃO, que fica em Informações. O padrão é o que vem
 * preenchido ao lançar; esta é a lista do que ela pode usar. Uma construtora que
 * atende três obras aparece nas três, e o padrão só decide qual chega
 * preenchido.
 *
 * ⚠️ Lista vazia não significa "nenhum". Sem vínculo nenhum, a pessoa continua
 * disponível em qualquer centro — o vínculo existe para RESTRINGIR quem quer
 * restringir, e exigir cadastro de todo mundo transformaria uma facilidade em
 * obrigação.
 */
export function AbaDeCentros({
  clienteId,
  centros,
  cache,
}: {
  clienteId: number;
  centros: { id: number; descricao: string }[];
  cache: CacheDoDrawer;
}) {
  const { avisar } = useAvisos();
  const [salvando, setSalvando] = useState(false);

  const { dados, recarregar } = useRecursoDaPessoa<{ centros: number[] }>(
    cache,
    "centros",
    `/api/v1/clientes/${clienteId}/centros`,
  );

  const marcados = dados?.centros ?? null;

  async function alternar(id: number) {
    const atuais = marcados ?? [];
    const proximos = atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id];

    /*
     * ⚠️ O CACHE muda junto com a tela, antes da resposta.
     *
     * Marcar caixa é gesto de passagem, e uma que só acende depois da ida e
     * volta faz clicar de novo. Mas sem mexer no cache, trocar de aba e voltar
     * desfazia o que acabou de ser marcado: a aba remonta lendo o guardado.
     */
    cache.gravar("centros", { centros: proximos });
    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/centros`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centros: proximos }),
    });

    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", "Não foi possível salvar");
      // Volta ao que o servidor tem: o otimismo era só sobre o que ele aceitaria.
      cache.esquecer("centros");
      void recarregar();
    }
  }

  return (
    <>
      <CabecalhoDeSecao
        primeiro
        colado
        titulo="Centros de custo"
        legenda="Onde esta pessoa pode ser lançada. Sem nenhum marcado, ela fica disponível em todos — a lista existe para restringir, não para liberar."
      />

      {marcados == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Carregando…</p>
      ) : centros.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Nenhum centro de custo de receita cadastrado na empresa.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {centros.map((c) => {
            const marcado = marcados.includes(c.id);

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => void alternar(c.id)}
                disabled={salvando}
                aria-pressed={marcado}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "8px 10px",
                  border: `1px solid ${marcado ? "var(--primary-border)" : "var(--border)"}`,
                  borderRadius: "var(--radius-md)",
                  background: marcado ? "var(--primary-subtle)" : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-base)",
                  color: "var(--text-primary)",
                  transition: "background var(--dur-fast) var(--ease)",
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
                    border: `1px solid ${marcado ? "var(--primary)" : "var(--border-strong)"}`,
                    background: marcado ? "var(--primary)" : "transparent",
                    color: "var(--primary-fg)",
                  }}
                >
                  {marcado && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12.5l5.5 5.5L20 6.5" />
                    </svg>
                  )}
                </span>

                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.descricao}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
