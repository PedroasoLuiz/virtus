"use client";

import { useState } from "react";
import { Alert, Button, MarcaDeUso, inputStyle } from "@/components/ui/kit";
import { Drawer } from "@/components/ui/drawer";
import { formatarSemSimbolo } from "@/shared/utils/money";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";

/**
 * O que entra no PDF, escolhido ANTES de gerar.
 *
 * ⚠️ Drawer, e nao um punhado de filtros no cabecalho da tela.
 *
 * Estas opcoes valem para o PAPEL, e nao para o que esta na tela: quem imprime
 * quer um recorte — so a Cresol, sem o vencido — sem perder de vista a projecao
 * inteira que estava olhando. No cabecalho, elas mudariam a tela junto e as duas
 * coisas passariam a ser a mesma.
 *
 * ⚠️ O PDF sai de uma consulta NOVA, com os parametros escolhidos, e nao dos
 * dados que a tela ja tem. Recortar em memoria daria certo para as contas e
 * erraria no resto: tirar o vencido muda o mes em que a serie comeca e todo o
 * saldo acumulado depois dele — e o acumulado e a coluna que se veio ler.
 */
export function OpcoesDoFluxo({
  contas,
  ateInicial,
  aoGerar,
  onClose,
}: {
  contas: ProjecaoDeCaixa["contas"];
  /**
   * Ate quando projetar, no primeiro desenho.
   *
   * ⚠️ O campo mora AQUI agora. Ele era do cabecalho da tela de fluxo, que
   * deixou de existir quando o fluxo virou um documento da pasta de relatorios:
   * sem ele, o horizonte ficaria cravado em um ano e a projecao de dois anos —
   * que e o caso do consorcio — nao teria como ser pedida.
   */
  ateInicial: string;
  /** Recebe a projecao ja recortada, pronta para virar papel. */
  aoGerar: (projecao: ProjecaoDeCaixa) => Promise<void>;
  onClose: () => void;
}) {
  /*
    ⚠️ Comeca com TODAS marcadas, e nao com nenhuma.

    O padrao do relatorio e a empresa inteira; abrir vazio obrigaria a marcar
    quatro contas para obter o documento que se pede em nove de cada dez vezes.
  */
  const [ate, setAte] = useState(ateInicial);
  const [marcadas, setMarcadas] = useState<number[]>(contas.map((c) => c.id));
  const [comVencidos, setComVencidos] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todas = marcadas.length === contas.length;
  const nenhuma = marcadas.length === 0;

  function alternar(id: number) {
    setMarcadas((atual) =>
      atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id],
    );
  }

  const saldoEscolhido = contas
    .filter((c) => marcadas.includes(c.id))
    .reduce((t, c) => t + c.saldo, 0);

  async function gerar() {
    setGerando(true);
    setErro(null);

    try {
      /*
        ⚠️ Marcadas TODAS não viaja como lista: o servidor lê ausência como
        "todas", e assim uma conta cadastrada depois entra sozinha em vez de
        ficar de fora até alguém lembrar de marcá-la.
      */
      const params = new URLSearchParams({ ate });
      if (!todas && !nenhuma) params.set("contas", marcadas.join(","));
      if (!comVencidos) params.set("incluirVencidos", "false");

      const r = await fetch(`/api/v1/relatorios/fluxo-caixa?${params}`);
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(dados?.error?.message ?? "Não foi possível gerar o PDF");
        return;
      }

      await aoGerar(dados.data as ProjecaoDeCaixa);
      onClose();
    } finally {
      setGerando(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Fluxo de caixa"
      footer={
        <Button variant="primary" disabled={gerando} onClick={() => void gerar()}>
          {gerando ? "Emitindo…" : "Emitir PDF"}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {erro && <Alert variant="warning">{erro}</Alert>}

        <section>
          <Titulo
            texto="Horizonte"
            legenda="Até quando a projeção vai. O saldo acumulado é somado mês a mês até esta data."
          />
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            style={{ ...inputStyle, width: 170 }}
          />
        </section>

        <section>
          <Titulo
            texto="Contas"
            legenda="Elas definem o saldo de onde a projeção parte, e a fatura de cartão pago por elas."
          />

          {/*
            ⚠️ O aviso é permanente, e não um caso de erro.

            Parcela a receber e a pagar NÃO têm conta bancária: um título só sabe
            de que conta saiu o dinheiro depois de pago. Sem dizer isso, marcar
            uma conta só e ver as mesmas entradas de antes pareceria defeito — e
            a pessoa desconfiaria do relatório inteiro.
          */}
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            As entradas e saídas de títulos não mudam com esta escolha: uma
            parcela em aberto é dívida da empresa, e só sabe de que conta saiu
            depois de paga.
          </p>

          <Linha
            marcado={todas}
            rotulo="Todas as contas"
            onClick={() =>
              setMarcadas(todas ? [] : contas.map((c) => c.id))
            }
            forte
          />

          {contas.map((c) => (
            <Linha
              key={c.id}
              marcado={marcadas.includes(c.id)}
              rotulo={c.apelido ?? `Conta ${c.id}`}
              detalhe={[c.banco, c.conta].filter(Boolean).join(" · ")}
              valor={formatarSemSimbolo(c.saldo)}
              onClick={() => alternar(c.id)}
            />
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
            }}
          >
            <span>Saldo de partida</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatarSemSimbolo(
                (nenhuma
                  ? contas.reduce((t, c) => t + c.saldo, 0)
                  : saldoEscolhido) as never,
              )}
            </span>
          </div>

          {/*
            ⚠️ Desmarcar tudo NÃO gera um relatório de saldo zero.

            Um documento afirmando que a empresa não tem dinheiro seria pior que
            um erro. Sem escolha, a resposta certa é a projeção inteira — e a
            tela diz isso antes de a pessoa clicar em gerar.
          */}
          {nenhuma && (
            <p
              style={{
                marginTop: 8,
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
              }}
            >
              Nenhuma conta marcada: o PDF sai com todas.
            </p>
          )}
        </section>

        <section>
          <Titulo
            texto="Meses vencidos"
            legenda="Parcelas que já venceram e continuam em aberto."
          />

          <Linha
            marcado={comVencidos}
            rotulo="Incluir os meses vencidos"
            detalhe={
              comVencidos
                ? "A tabela começa no vencimento mais antigo em aberto"
                : "A tabela começa no mês corrente"
            }
            onClick={() => setComVencidos((v) => !v)}
          />

          {/*
            ⚠️ O que acontece com o vencido quando ele sai precisa estar escrito.

            Ele NÃO é empurrado para o mês corrente — some inteiro. Somá-lo ao mês
            que corre faria a projeção prometer um dinheiro parado há meses, e é
            justamente disso que quem desmarca está querendo escapar.
          */}
          {!comVencidos && (
            <p
              style={{
                marginTop: 8,
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              O que venceu sai da conta por completo — não é somado ao mês
              corrente. O saldo acumulado passa a valer só para o que ainda vence.
            </p>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function Titulo({ texto, legenda }: { texto: string; legenda: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
        }}
      >
        {texto}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        {legenda}
      </div>
    </div>
  );
}

/**
 * Uma opção da lista.
 *
 * ⚠️ A linha INTEIRA é o alvo do clique, e não só a marca de 22 pixels. Numa
 * lista de contas, mirar a caixinha a cada item é trabalho que o rótulo ao lado
 * poderia absorver.
 */
function Linha({
  marcado,
  rotulo,
  detalhe,
  valor,
  forte,
  onClick,
}: {
  marcado: boolean;
  rotulo: string;
  detalhe?: string;
  valor?: string;
  forte?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 0",
        border: "none",
        background: "none",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      {/* A marca não recebe o clique: quem recebe é a linha, e dois alvos
          empilhados fariam o gesto disparar duas vezes. */}
      <span style={{ pointerEvents: "none" }}>
        <MarcaDeUso marcado={marcado} rotulo={rotulo} onClick={() => {}} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-sm)",
            fontWeight: forte ? "var(--fw-semi)" : undefined,
            color: "var(--text-primary)",
          }}
        >
          {rotulo}
        </span>
        {detalhe && (
          <span
            style={{
              display: "block",
              marginTop: 1,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            {detalhe}
          </span>
        )}
      </span>

      {valor && (
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {valor}
        </span>
      )}
    </button>
  );
}
