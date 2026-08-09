"use client";

import { TableArea, TableHead, Td, Th, Tr } from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { IconeDoPagamento } from "./icones-pagamento";
import { VistoDeConferencia } from "./visto-conferencia";
import type { MovimentoDoExtrato } from "@/modules/contas/contas.types";

/**
 * Modelo 2 do extrato: a TABELA do sistema, com o dia fechando cada bloco.
 *
 * Convive com o modelo 1 — o trilho de cartões — atrás de duas abas. Nenhum dos
 * dois substitui o outro por enquanto: com os dois no ar dá para abrir a mesma
 * conta e comparar, que é a única forma honesta de decidir qual fica. Foi assim
 * que o recibo em PDF conviveu com o layout antigo até a decisão.
 *
 * O que ele aposta, em relação ao trilho:
 *
 * - **Densidade.** Conciliar é varrer muitas linhas procurando o que ainda não
 *   bate. Cartão empilhado mostra oito lançamentos onde a tabela mostra vinte, e
 *   a rolagem é justamente o que cansa nessa tarefa.
 * - **A mesma anatomia do resto da casa.** É a tabela de faturas, de baixas e de
 *   pessoas: quem aprendeu a ler uma, leu todas. O trilho é um desenho que só
 *   existe aqui.
 * - **A mesma forma do papel.** O PDF do extrato saiu tabela, com fecho por dia.
 *   Na tela igual, conferir não muda de formato entre o monitor e a folha.
 *
 * O que ele perde: o cartão branco sobre o trilho verde dizia "cada linha é um
 * documento" sem precisar de palavra nenhuma. A tabela é mais fria.
 */
export function ExtratoTabela({
  dias,
  saldoAnterior,
}: {
  dias: { data: string; movimentos: MovimentoDoExtrato[]; saldoDoDia: Centavos }[];
  /** O que havia na conta antes do primeiro dia do periodo. */
  saldoAnterior: Centavos;
}) {
  return (
    <TableArea minWidth={0}>
      <TableHead>
        {/*
          ⚠️ TRES colunas, e a forma dentro do historico.

          Forma em coluna propria gastava 110px fixos para uma palavra de tres
          letras que se repete em toda linha. Embaixo do nome, ela le como
          legenda dele — "quem" na primeira linha, "como" na segunda — e sobra
          largura para o nome, que e o que varia e o que se procura.
        */}
        <Th minWidth={92}>Data</Th>
        <Th>Histórico</Th>
        <Th align="right" minWidth={120}>
          Valor
        </Th>
      </TableHead>

      <tbody>
        {/*
          ⚠️ A abertura abre a tabela, e nao o cabecalho.

          Sem ela, o primeiro "Saldo em ..." aparece sem a conta que levou ate
          ele: quem confere ve um numero que nao sai da soma das linhas acima.
          Ela e o unico saldo que vem de antes do recorte, e por isso e a unica
          linha da tabela que nao tem lancamento nenhum.
        */}
        <tr style={{ height: 30, background: "var(--surface-2)" }}>
          <Td colSpan={2} style={{ textAlign: "right", color: "var(--text-secondary)" }}>
            Saldo anterior
          </Td>
          <Td style={{ ...NUM, textAlign: "right", fontWeight: "var(--fw-semi)" }}>
            {formatarSemSimbolo(saldoAnterior)}
          </Td>
        </tr>

        {dias.map((dia) => (
          <FragmentoDoDia key={dia.data} dia={dia} />
        ))}
      </tbody>
    </TableArea>
  );
}

function FragmentoDoDia({
  dia,
}: {
  dia: { data: string; movimentos: MovimentoDoExtrato[]; saldoDoDia: Centavos };
}) {
  return (
    <>
      {dia.movimentos.map((m) => {
        const entrada = m.tipo === "ENTRADA";

        return (
          <Tr key={m.id}>
            <Td style={NUM}>{m.data ? paraFormatoBR(m.data as DataISO) : "—"}</Td>

            <Td style={{ maxWidth: 300 }}>
              {/*
                ⚠️ O visto vem DEPOIS do nome, e nao em coluna propria.

                Conciliar ainda nao tem gesto nesta tela, e uma coluna clicavel
                prometeria uma acao que nao existe. Como marca colada no nome,
                ele responde "esta linha ja bate com o banco?" sem convidar ao
                clique.

                ⚠️ Depois e nao antes: a linha comeca pelo QUE e o lancamento, e
                o visto e um estado dele. Aberto pelo visto, todas as linhas
                comecavam iguais e o nome — que e o que se procura — passava a
                comecar num eixo deslocado do da segunda linha.
              */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.nome?.trim() || m.descricao?.trim() || "—"}
                </span>
                <VistoDeConferencia conciliado={m.conciliado} />
              </span>

              {/*
                A forma, como legenda do nome. Sem recuo: com o visto no fim da
                linha de cima, as duas comecam no mesmo eixo sozinhas.
              */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 1,
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                }}
              >
                <IconeDoPagamento forma={m.formaPagamento} origem={m.origem} />
                {m.formaPagamento?.trim() || "—"}
              </span>
            </Td>

            {/*
              ⚠️ A cor fica SO no valor, e o sinal vem junto.

              E a unica coluna em que direcao importa, e pintar a linha inteira
              faria vinte linhas coloridas competindo entre si. O sinal continua
              porque a cor sozinha nao serve a quem imprime a tela nem a quem nao
              distingue verde de vermelho.
            */}
            <Td
              style={{
                ...NUM,
                textAlign: "right",
                fontWeight: "var(--fw-medium)",
                color: entrada ? "var(--credito)" : "var(--debito)",
              }}
            >
              {entrada ? "" : "-"}
              {formatarSemSimbolo(m.valor)}
            </Td>
          </Tr>
        );
      })}

      {/*
        ⚠️ O fecho do dia e uma LINHA da tabela, e nao um cabecalho acima dele.

        O saldo e conclusao do que veio antes, e nao anuncio do que vem depois:
        posto em cima, ele obriga a ler o dia inteiro e voltar. Aqui ele fecha
        onde a leitura ja esta, com o fio por cima marcando o corte.
      */}
      <tr
        style={{
          height: 30,
          borderTop: "1px solid var(--border-strong)",
          background: "var(--surface-2)",
        }}
      >
        <Td colSpan={2} style={{ textAlign: "right", color: "var(--text-secondary)" }}>
          Saldo em {paraFormatoBR(dia.data as DataISO)}
        </Td>
        <Td style={{ ...NUM, textAlign: "right", fontWeight: "var(--fw-semi)" }}>
          {formatarSemSimbolo(dia.saldoDoDia)}
        </Td>
      </tr>
    </>
  );
}

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
