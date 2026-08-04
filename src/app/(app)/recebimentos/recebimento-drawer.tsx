"use client";

import { useEffect, useState } from "react";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import { CampoBloqueado, Field } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Recebimento } from "@/modules/recebimentos/recebimentos.types";

/**
 * Detalhe de um recebimento: o lancamento em cima, o rateio embaixo.
 *
 * A pergunta que esta tela responde e "este dinheiro do extrato pagou o que?".
 * Por isso o destaque vai para a lista de parcelas, e nao para os dados do
 * lancamento, que a listagem ja mostrou.
 *
 * Somente leitura de proposito: mexer num recebimento ja gravado mexe no saldo
 * de contas que talvez ja tenham recibo emitido. Correcao vira estorno, que e
 * gesto proprio e ainda nao existe.
 */

export function RecebimentoDrawer({
  recebimentoId,
  aoEstornar,
  onClose,
}: {
  recebimentoId: number | null;
  aoEstornar?: () => void;
  onClose: () => void;
}) {
  // `key` remonta a cada recebimento: o estado nasce vazio sozinho, sem limpar a
  // mao num efeito, e sem mostrar o registro anterior enquanto carrega.
  return recebimentoId == null ? null : (
    <Conteudo
      key={recebimentoId}
      recebimentoId={recebimentoId}
      aoEstornar={aoEstornar}
      onClose={onClose}
    />
  );
}

function Conteudo({
  recebimentoId,
  aoEstornar,
  onClose,
}: {
  recebimentoId: number;
  aoEstornar?: () => void;
  onClose: () => void;
}) {
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { avisar, confirmar } = useAvisos();

  async function estornar() {
    const r = await fetch(`/api/v1/recebimentos/${recebimentoId}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível estornar");
      return;
    }

    avisar("sucesso", "Recebimento estornado", "As parcelas voltaram a ficar em aberto.");
    aoEstornar?.();
    onClose();
  }

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/recebimentos/${recebimentoId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o recebimento");
        setRecebimento(corpo.data);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [recebimentoId]);

  return (
    <Drawer
      open
      onClose={onClose}
      title={recebimento ? `Recebimento ${recebimento.id}` : "Recebimento"}
      headerExtra={
        recebimento ? (
          /*
           * Estornar so aparece enquanto a linha nao foi conciliada.
           *
           * Conciliar e "conferi no extrato e bate"; apagar depois disso desfaz
           * uma conferencia que alguem assinou. Desabilitado com o motivo, e nao
           * escondido: sumir faria parecer que o sistema nao sabe estornar.
           */
          <BotaoDeCabecalho
            rotulo={
              recebimento.conciliado
                ? "Recebimento conciliado não é estornado"
                : "Estornar este recebimento"
            }
            perigo
            desabilitado={recebimento.conciliado}
            onClick={() =>
              confirmar(
                `Estornar o recebimento ${recebimento.id}?`,
                "Estornar",
                estornar,
                "O lançamento é apagado e as parcelas voltam a ficar em aberto. O desconto dado na baixa volta a ser devido.",
              )
            }
          >
            {/* Seta circular anti-horária: desfazer. Um arco quase fechado, com
                a ponta abrindo em cima à esquerda, que é de onde a seta sai.
                Desenhada na grade de 24, que é o `viewBox` do botão de cabeçalho. */}
            <path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.7" />
            <path d="M4 4v5h5" />
          </BotaoDeCabecalho>
        ) : null
      }
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {recebimento && (
            <div>
              <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
                Entrou no banco
              </div>
              <div
                style={{
                  fontSize: "var(--text-md)",
                  fontWeight: "var(--fw-semi)",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--credito)",
                }}
              >
                {formatarSemSimbolo(recebimento.valor)}
              </div>
            </div>
          )}
          <span style={{ flex: 1 }} />
        </div>
      }
    >
      {erro && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger-text)",
            fontSize: "var(--text-base)",
          }}
        >
          {erro}
        </div>
      )}

      {recebimento && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 18 }}>
            {/* Antes do cliente: baixa é ato de alguém, e a primeira pergunta de
                quem confere um lançamento estranho é quem lançou. */}
            <Field label="Baixado por">
              <CampoBloqueado
                valor={recebimento.registradoPor ?? "—"}
                titulo={
                  recebimento.registradoEm
                    ? `Lançado em ${paraFormatoBR(recebimento.registradoEm.slice(0, 10) as DataISO)}`
                    : undefined
                }
              />
            </Field>

            <Field label="Cliente">
              <CampoBloqueado valor={recebimento.clienteNome ?? "—"} />
            </Field>
            <Field label="Data">
              <CampoBloqueado
                valor={recebimento.data ? paraFormatoBR(recebimento.data as DataISO) : "—"}
              />
            </Field>
            <Field label="Forma">
              <CampoBloqueado valor={recebimento.tipo ?? "—"} />
            </Field>
            <Field label="Conta">
              <CampoBloqueado valor={recebimento.contaNome ?? "—"} />
            </Field>
            <Field label="Conciliado">
              <CampoBloqueado
                valor={recebimento.conciliado ? "Sim" : "Ainda não"}
                titulo="Conciliar é conferir no extrato do banco. É gesto humano, e nada no sistema marca sozinho."
              />
            </Field>
            {recebimento.observacoes && (
              <Field label="Observações">
                <CampoBloqueado valor={recebimento.observacoes} multilinha />
              </Field>
            )}
          </div>

          {/* Mesmo tratamento do rótulo dos campos acima, e não o `.rotulo` em
              caixa alta: é a mesma hierarquia, e dois estilos de título dentro
              do mesmo drawer fazem parecer que um vale mais que o outro. */}
          <div style={ROTULO_DE_SECAO}>Parcelas quitadas</div>

          <Tabela
            cabecalho={["Conta", "Parcela", "Vencimento", "Abatido", "Juros", "Multa"]}
            linhas={recebimento.destinos.map((d) => [
              String(d.faturaNumero),
              String(d.numero),
              d.vencimento ? paraFormatoBR(d.vencimento as DataISO) : "—",
              formatarSemSimbolo(d.valor as Centavos),
              // Zero, e não travessão: a coluna é de dinheiro, e "0,00" diz que
              // não houve juros. O travessão diz "não se aplica", que é outra
              // coisa, e aqui sempre se aplica.
              formatarSemSimbolo(d.juros as Centavos),
              formatarSemSimbolo(d.multa as Centavos),
            ])}
          />
        </>
      )}
    </Drawer>
  );
}

/** O mesmo tratamento do rotulo de um campo, para titular uma secao. */
const ROTULO_DE_SECAO: React.CSSProperties = {
  marginBottom: 8,
  fontSize: "var(--text-sm)",
  fontWeight: "var(--fw-medium)",
  color: "var(--text-tertiary)",
};

/**
 * Tabela do drawer. Tudo alinhado a ESQUERDA, inclusive numero — a mesma regra
 * da conta a receber, para que o olho nao refaca o percurso a cada tela.
 */
function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            {cabecalho.map((c, ci) => (
              <th
                key={c}
                className="rotulo"
                style={{
                  height: 32,
                  padding: "0 12px",
                  // `th` centraliza por padrao no navegador e `td` nao: sem esta
                  // linha o cabecalho fica deslocado da coluna que ele nomeia.
                  textAlign: "left",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  borderTopLeftRadius: ci === 0 ? "var(--radius-lg)" : undefined,
                  borderTopRightRadius: ci === cabecalho.length - 1 ? "var(--radius-lg)" : undefined,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((celulas, li) => (
            <tr key={li} style={{ borderTop: li === 0 ? undefined : "1px solid var(--border)" }}>
              {celulas.map((c, ci) => (
                <td
                  key={ci}
                  style={{ height: 34, padding: "0 12px", fontVariantNumeric: "tabular-nums" }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
