"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import {
  EmptyRow,
  GrupoDeCampos,
  MarcaDePrincipal,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Em que centros de custo esta pessoa entra, e qual vem preenchido.
 *
 * ⚠️ São duas coisas, e por isso duas colunas. "Usa" é onde ela PODE ser
 * lançada; "padrão" é o que já vem escolhido ao lançar. Num campo só, quem
 * escolhia o padrão acabava restringindo a pessoa a ele sem querer.
 *
 * ⚠️ Nenhum marcado em "usa" não significa "nenhum": sem vínculo, a pessoa
 * continua disponível em qualquer centro. O vínculo existe para RESTRINGIR quem
 * quer restringir, e exigir cadastro de todo mundo transformaria uma facilidade
 * em obrigação.
 */
export function AbaDeCentros({
  clienteId,
  centros,
  padrao,
  onPadrao,
  cache,
}: {
  clienteId: number;
  centros: { id: number; descricao: string }[];
  /** O centro que vem preenchido ao lançar. `null` = o "Geral" do banco. */
  padrao: number | null;
  onPadrao: (id: number | null) => void;
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
      cache.esquecer("centros");
      void recarregar();
    }
  }

  return (
    <GrupoDeCampos
      primeiro
      titulo="Centros de custo"
      legenda="A coluna “usa” diz onde esta pessoa pode ser lançada; sem nenhuma marcada, ela fica disponível em todos. A coluna “padrão” diz qual já vem preenchido na hora do lançamento."
    >
      <TableArea minWidth={0}>
        <TableHead>
          <Th>Centro de custo</Th>
          <Th align="center" minWidth={70}>
            Usa
          </Th>
          <Th align="center" minWidth={80}>
            Padrão
          </Th>
        </TableHead>

        <tbody>
          {marcados == null ? (
            <EmptyRow colSpan={3} message="Carregando…" />
          ) : centros.length === 0 ? (
            <EmptyRow colSpan={3} message="Nenhum centro de custo de receita na empresa." />
          ) : (
            centros.map((c) => {
              const usa = marcados.includes(c.id);
              const ehPadrao = padrao === c.id;

              return (
                <Tr key={c.id}>
                  <Td>{c.descricao}</Td>

                  <Td style={{ textAlign: "center" }}>
                    <Caixa
                      marcado={usa}
                      rotulo={usa ? `Tirar ${c.descricao}` : `Usar ${c.descricao}`}
                      desabilitado={salvando}
                      onClick={() => void alternar(c.id)}
                    />
                  </Td>

                  <Td style={{ textAlign: "center" }}>
                    <MarcaDePrincipal
                      marcado={ehPadrao}
                      rotulo={ehPadrao ? "É o padrão" : `Usar ${c.descricao} como padrão`}
                      onClick={() => onPadrao(ehPadrao ? null : c.id)}
                    />
                  </Td>
                </Tr>
              );
            })
          )}
        </tbody>
      </TableArea>
    </GrupoDeCampos>
  );
}

/**
 * A caixa de "usa": marcação múltipla.
 *
 * ⚠️ Quadrada, e a do padrão é redonda. É a distinção de sempre entre escolher
 * vários e escolher um — as duas colunas ficam lado a lado, e com a mesma forma
 * ninguém saberia qual delas aceita mais de uma marca.
 */
function Caixa({
  marcado,
  rotulo,
  desabilitado,
  onClick,
}: {
  marcado: boolean;
  rotulo: string;
  desabilitado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={marcado}
      aria-label={rotulo}
      title={rotulo}
      style={{
        width: 22,
        height: 22,
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
        border: "none",
        background: "transparent",
        cursor: desabilitado ? "default" : "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 15,
          height: 15,
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
    </button>
  );
}
