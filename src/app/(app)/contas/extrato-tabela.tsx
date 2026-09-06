"use client";

import { useState } from "react";
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
  de,
  aoAbrirTitulo,
}: {
  dias: {
    data: string;
    movimentos: MovimentoDoExtrato[];
    saldoDoDia: Centavos;
  }[];
  /** O que havia na conta antes do primeiro dia do periodo. */
  saldoAnterior: Centavos;
  /** O primeiro dia consultado. E ele que da nome a linha de abertura. */
  de: DataISO;
  /**
   * Abre a conta a receber ou a pagar de onde a linha veio.
   *
   * ⚠️ Recebido de FORA. A tabela sabe qual e o titulo; quem sabe abrir drawer
   * e a tela que a contem, e embutir isso aqui amarraria a tabela aos drawers
   * de dois modulos que ela nao conhece.
   */
  aoAbrirTitulo: (documento: { tipo: "CR" | "CP"; contaId: number }) => void;
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
        <Th minWidth={80}>Data</Th>
        {/*
          ⚠️ O REGISTRO de onde a linha veio, em coluna estreita e propria.

          Ele identifica a linha quando duas do mesmo cliente caem no mesmo dia
          pelo mesmo valor, e aqui tem eixo fixo — dentro do histórico, o número
          andava com o tamanho do nome e não dava para correr o olho.

          ⚠️ A SIGLA vem junto do número, e não o id cru. "910" sozinho não diz
          se aquilo é conta a receber, conta a pagar ou movimento sem título, que
          é a primeira coisa que se quer saber ao bater o olho. "CR 180" diz.
        */}
        <Th minWidth={62}>Registro</Th>
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
          {/*
            ⚠️ A data ENTRA no rotulo. "Saldo anterior" sozinho deixa a pergunta
            no ar — anterior a que dia? —, e quem confere contra o banco precisa
            justamente desse dia para achar a linha correspondente no papel.
          */}
          <Td
            colSpan={3}
            style={{ textAlign: "right", color: "var(--text-secondary)" }}
          >
            {`Saldo antes de ${paraFormatoBR(de)}`}
          </Td>
          <Td
            style={{ ...NUM, textAlign: "right", fontWeight: "var(--fw-semi)" }}
          >
            {formatarSemSimbolo(saldoAnterior)}
          </Td>
        </tr>

        {dias.map((dia) => (
          <FragmentoDoDia
            key={dia.data}
            dia={dia}
            aoAbrirTitulo={aoAbrirTitulo}
          />
        ))}
      </tbody>
    </TableArea>
  );
}

function FragmentoDoDia({
  dia,
  aoAbrirTitulo,
}: {
  dia: { data: string; movimentos: MovimentoDoExtrato[]; saldoDoDia: Centavos };
  aoAbrirTitulo: (documento: { tipo: "CR" | "CP"; contaId: number }) => void;
}) {
  return (
    <>
      {dia.movimentos.map((m) => {
        const entrada = m.tipo === "ENTRADA";

        return (
          <Tr key={m.id}>
            <Td style={NUM}>
              {m.data ? paraFormatoBR(m.data as DataISO) : "—"}
            </Td>

            <Td style={NUM}>
              <RegistroDaLinha
                documento={m.documento}
                aoAbrir={aoAbrirTitulo}
              />
            </Td>

            {/*
              ⚠️ `maxWidth` pequeno de propósito: é esta célula que CEDE espaço.

              As outras três têm largura de conteúdo (data, registro e valor não
              encolhem sem quebrar o número). Sem um teto aqui, um histórico
              comprido esticava a tabela além do drawer e a linha inteira passava
              a rolar de lado — numa tela que precisa caber de uma vez.
            */}
            <Td style={{ maxWidth: 220, overflow: "hidden" }}>
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
              {/*
                ⚠️ O visto (ou o relógio) fica COLADO no nome, e não numa coluna.

                Eu o tinha empurrado para o fim da célula, atrás de um eixo fixo
                para varrer na vertical. O Pedro pediu de volta, e o argumento
                dele fecha: a marca fala DAQUELE lançamento, e longe do nome ela
                lê como uma coluna de estado que ninguém liga à linha. O eixo
                fixo, que era o ganho, agora vem da coluna do número ao lado.
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
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.nome?.trim() || m.descricao?.trim() || "—"}
                </span>
                <VistoDeConferencia conciliado={m.conciliado} />
              </span>

              {/* A forma de pagamento, como legenda do nome. O título saiu
                  daqui: ele virou a coluna "Registro", que tem eixo fixo e abre
                  o documento — aqui ele começava num x diferente por linha. */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 2,
                  minWidth: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
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
        <Td
          colSpan={3}
          style={{ textAlign: "right", color: "var(--text-secondary)" }}
        >
          Saldo em {paraFormatoBR(dia.data as DataISO)}
        </Td>
        <Td
          style={{ ...NUM, textAlign: "right", fontWeight: "var(--fw-semi)" }}
        >
          {formatarSemSimbolo(dia.saldoDoDia)}
        </Td>
      </tr>
    </>
  );
}

/**
 * O registro de onde a linha veio: "CR 180", "CP 149" ou "MOV 910".
 *
 * ⚠️ CLICÁVEL quando há título, e texto puro quando não há. O `MOV` não abre
 * nada porque não há nada para abrir — e um alvo que parece botão e não responde
 * é pior que um texto que nunca prometeu nada. É a mesma regra do visto de
 * conferência nesta tela.
 *
 * ⚠️ A PARCELA fica na dica, e não no rótulo. "CR 180 P 2" não cabe na coluna
 * sem empurrar o histórico, e o que se procura primeiro é a conta; a parcela
 * responde a segunda pergunta, de quem já achou a conta.
 */
function RegistroDaLinha({
  documento,
  aoAbrir,
}: {
  documento: MovimentoDoExtrato["documento"];
  aoAbrir: (documento: { tipo: "CR" | "CP"; contaId: number }) => void;
}) {
  const [hover, setHover] = useState(false);

  if (!documento)
    return <span style={{ color: "var(--text-disabled)" }}>—</span>;

  const curto = documento.rotulo.replace(/ P \d+$/, "");
  const dica =
    documento.tipo === "MOV"
      ? "Movimento sem título por trás: tarifa, rendimento ou baixa antiga"
      : `${documento.tipo === "CR" ? "Conta a receber" : "Conta a pagar"} ${documento.contaId}` +
        (documento.parcela != null ? ` · parcela ${documento.parcela}` : "");

  if (documento.tipo === "MOV" || documento.contaId == null) {
    return (
      <span title={dica} style={{ color: "var(--text-disabled)" }}>
        {curto}
      </span>
    );
  }

  const tipo = documento.tipo;
  const contaId = documento.contaId;

  return (
    <button
      type="button"
      title={dica}
      onClick={() => aoAbrir({ tipo, contaId })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        /*
          ⚠️ Em repouso ele é TEXTO, e a cor só entra no hover.

          Sublinhado e azul em toda linha punham trinta links coloridos numa
          coluna que se lê de cima a baixo, e a cor deixava de dizer "isto abre"
          para virar o fundo da coluna. Assim, quem varre lê números; quem
          procura o caminho encontra ao passar o mouse.
        */
        color: hover ? "var(--primary)" : "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      {curto}
      {/*
        ⚠️ O ícone OCUPA o lugar dele sempre, e só aparece no hover. Surgindo do
        nada, ele empurraria o número a cada passada de mouse e a coluna inteira
        tremeria. Invisível, o espaço já está reservado.
      */}
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          opacity: hover ? 1 : 0,
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Seta saindo da caixa: abre em outro lugar, sem sair daqui. */}
          <path d="M9.5 3h3.5v3.5" />
          <path d="M13 3L8.2 7.8" />
          <path d="M12 9.6V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.4" />
        </svg>
      </span>
    </button>
  );
}

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
