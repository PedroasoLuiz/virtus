"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Alert,
  CampoBloqueado,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { BaixaPagar } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Detalhe de uma baixa: o lancamento em cima, o rateio embaixo.
 *
 * A pergunta que esta tela responde e "este dinheiro que saiu do extrato pagou o
 * que?". Por isso o destaque vai para a lista de parcelas, e nao para os dados
 * do lancamento, que a listagem ja mostrou.
 *
 * Somente leitura de proposito: mexer numa baixa ja gravada mexe no saldo de
 * contas que talvez ja tenham comprovante emitido. Correcao vira estorno, que e
 * gesto proprio e ainda nao existe deste lado.
 */
export function BaixaDrawer({
  baixaId,
  onClose,
}: {
  baixaId: number | null;
  onClose: () => void;
}) {
  // `key` remonta a cada baixa: o estado nasce vazio sozinho, sem limpar a mao
  // num efeito, e sem mostrar o registro anterior enquanto carrega.
  return baixaId == null ? null : (
    <Conteudo key={baixaId} baixaId={baixaId} onClose={onClose} />
  );
}

function Conteudo({ baixaId, onClose }: { baixaId: number; onClose: () => void }) {
  const [baixa, setBaixa] = useState<BaixaPagar | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/contas-pagar/baixas/${baixaId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar a baixa");
        setBaixa(corpo.data as BaixaPagar);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [baixaId]);

  return (
    <Drawer
      open
      onClose={onClose}
      /*
        ⚠️ SEM marca no cabecalho. Aquele espaco e de ACAO, e nao de estado: um
        icone ali disputa lugar com os botoes e ensina que aquela area as vezes
        clica e as vezes so informa. A conciliacao ja e campo na ficha, com
        rotulo e texto — que se le melhor que um relogio.
      */
      title="Baixa"
    >
      {erro && <Alert variant="danger" title={erro} />}

      {!baixa && !erro && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[70, 90, 55, 100].map((l, i) => (
            <div
              key={i}
              className="sk"
              style={{
                height: 14,
                width: `${l}%`,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-3)",
              }}
            />
          ))}
        </div>
      )}

      {baixa && (
        <Formulario>
          <GrupoDeCampos
            primeiro
            titulo="O que saiu do banco"
            legenda="É esta linha que aparece no extrato. Uma só, mesmo quando ela fecha parcelas de contas diferentes."
          >
            <Field label="Código">
              <CampoBloqueado valor={String(baixa.id)} />
            </Field>

            <Field label="Data">
              <CampoBloqueado
                valor={baixa.data ? paraFormatoBR(baixa.data as DataISO) : "—"}
              />
            </Field>

            <Field label="Fornecedor">
              <CampoBloqueado valor={baixa.fornecedorNome ?? "—"} />
            </Field>

            <Field label="Forma">
              <CampoBloqueado valor={baixa.tipo ?? "—"} />
            </Field>

            <Field label="Conta">
              <CampoBloqueado valor={baixa.contaNome ?? "—"} />
            </Field>

            <Field label="Valor">
              <CampoBloqueado valor={formatarSemSimbolo(baixa.valor as Centavos)} />
            </Field>

            <Field
              label="Conciliado"
              hint="Conferir no extrato é gesto humano: nada no sistema marca sozinho."
            >
              <CampoBloqueado valor={baixa.conciliado ? "Sim" : "Ainda não"} />
            </Field>

            {baixa.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={baixa.observacoes} multilinha />
              </Field>
            )}
          </GrupoDeCampos>

          {/*
            ⚠️ O titulo nao repete "Baixa", que e o nome do drawer. Ele diz o que
            aquela lista E para este lancamento.
          */}
          <GrupoDeCampos
            titulo="O que este dinheiro quitou"
            legenda="Cada linha é uma parcela abatida. O valor da parcela não muda quando ela é paga: o que a baixa aplicou vem ao lado."
          >
            <TableArea minWidth={0}>
              <TableHead>
                <Th minWidth={64}>Conta</Th>
                <Th minWidth={44}>#</Th>
                <Th minWidth={104}>Vencimento</Th>
                <Th minWidth={100}>Parcela</Th>
                <Th minWidth={100}>Aplicado</Th>
              </TableHead>

              <tbody>
                {baixa.destinos.length === 0 && (
                  <EmptyRow colSpan={5} message="Esta baixa não aponta para nenhuma parcela." />
                )}

                {baixa.destinos.map((d, i) => (
                  <Tr key={d.parcelaId} delay={i * 12}>
                    <Td style={NUM}>
                      {/* A descricao da conta na dica: ela nao cabe numa coluna
                          dentro do drawer, e o numero sozinho nao diz do que a
                          divida se trata. */}
                      <span title={d.contaDescricao ?? undefined}>
                        {d.contaNumero ?? d.contaId}
                      </span>
                    </Td>
                    <Td style={NUM}>{d.numero}</Td>
                    <Td style={NUM}>
                      {d.vencimento ? paraFormatoBR(d.vencimento as DataISO) : "—"}
                    </Td>
                    <Td style={NUM}>{formatarSemSimbolo(d.total as Centavos)}</Td>
                    <Td style={NUM}>{formatarSemSimbolo(d.valor as Centavos)}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableArea>
          </GrupoDeCampos>
        </Formulario>
      )}
    </Drawer>
  );
}

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
