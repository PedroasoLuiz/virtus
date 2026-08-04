"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { CampoBloqueado, Field, inputStyle } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { ehDataISO, hoje, paraFormatoBR, somarDias, type DataISO } from "@/shared/utils/datas";
import { IconeDoPagamento } from "./icones-pagamento";
import type { ContaBancaria, Extrato, MovimentoDoExtrato } from "@/modules/contas/contas.types";

/**
 * O extrato de uma conta.
 *
 * Aberto a partir da conta, e nao de um item de menu: extrato sem conta
 * escolhida e uma pergunta pela metade, e o saldo de abertura so existe em
 * relacao a uma delas.
 *
 * ⚠️ Esta tabela FOGE do padrao das outras telas de proposito.
 *
 * Ela nao e uma listagem de registros: e um documento que a pessoa confere linha
 * a linha contra o papel do banco. O desenho e o do quadro kanban — fundo verde
 * acinzentado servindo de trilho, cartoes brancos correndo por cima — porque ali
 * o branco ja significa "o dado" e o fundo significa "a casca". Aqui vale a
 * mesma leitura: o dia e casca, o lancamento e dado.
 */

/** Primeiro dia do mes corrente. E onde quase toda conferencia comeca. */
function inicioDoMes(): string {
  return `${hoje().slice(0, 7)}-01`;
}

/**
 * Teto do periodo. Espelha o `MAXIMO_DE_DIAS` do servico.
 *
 * Duplicado de proposito, e nao importado: o servico e quem RECUSA, e continua
 * recusando se alguem chamar a rota direto. Aqui o numero so serve para o
 * seletor de data nao oferecer um periodo que vai voltar com erro.
 */
const MAXIMO_DE_DIAS = 186;

/**
 * Limite de data para o seletor. `undefined` quando a outra ponta esta vazia.
 *
 * ⚠️ Passa por `ehDataISO` antes de calcular. O campo `<input type="date">` pode
 * ficar VAZIO — basta o usuario apagar o conteudo —, e ai a conta de calendario
 * recebe string vazia. Sem esta guarda, `Date` invalido derruba a tela inteira
 * no meio do render, com um "Invalid time value" que nao diz de onde veio.
 */
function limite(data: string, dias: number): string | undefined {
  return ehDataISO(data) ? somarDias(data, dias) : undefined;
}

/** Um dia do extrato, com o que fechou nele. */
type Dia = {
  data: string;
  movimentos: MovimentoDoExtrato[];
  /** Saldo depois do ULTIMO movimento do dia. E o numero que o banco imprime. */
  saldoDoDia: Centavos;
};

/**
 * Agrupa por dia, em ordem cronologica.
 *
 * Crescente porque a coluna que importa e o SALDO, e saldo e uma soma que so faz
 * sentido lida para frente: o fecho de cada dia e o do dia anterior mais o que
 * passou. De tras para frente os numeros continuam certos, mas a conta que liga
 * um dia ao outro deixa de ser visivel.
 */
function porDia(movimentos: MovimentoDoExtrato[]): Dia[] {
  const dias = new Map<string, Dia>();

  for (const m of movimentos) {
    const chave = m.data ?? "";
    const dia = dias.get(chave) ?? { data: chave, movimentos: [], saldoDoDia: m.saldoApos };

    dia.movimentos.push(m);
    // O ultimo a passar por aqui e o ultimo do dia, porque a lista chega em
    // ordem cronologica.
    dia.saldoDoDia = m.saldoApos;
    dias.set(chave, dia);
  }

  return [...dias.values()];
}

export function ExtratoDrawer({ conta, onClose }: { conta: ContaBancaria; onClose: () => void }) {
  const { avisar } = useAvisos();

  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hoje());
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Campo de data pela metade nao vira consulta: enquanto a pessoa digita
    // "2026-0", o valor ja chega aqui e voltaria 422 a cada tecla.
    if (!ehDataISO(de) || !ehDataISO(ate)) return;

    const controle = new AbortController();

    fetch(`/api/v1/contas/${conta.id}/extrato?de=${de}&ate=${ate}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o extrato");
        setExtrato(corpo.data);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          setErro(e.message);
          setExtrato(null);
        }
      });

    return () => controle.abort();
  }, [conta.id, de, ate]);

  /**
   * Marcar como conferido.
   *
   * O estado da tela muda ANTES da resposta: conciliar e conferencia em lote, e
   * esperar meio segundo por linha faria a pessoa perder o lugar na lista. Se a
   * gravacao falhar, o visto volta atras — mentir sobre o que foi salvo seria
   * pior que a espera.
   */
  async function conciliar(movimento: MovimentoDoExtrato) {
    const novo = !movimento.conciliado;
    aplicar(movimento.id, novo);

    const r = await fetch(`/api/v1/contas/${conta.id}/extrato/${movimento.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conciliado: novo }),
    });

    if (!r.ok) {
      aplicar(movimento.id, movimento.conciliado);
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível marcar a conferência");
    }
  }

  function aplicar(id: number, conciliado: boolean) {
    setExtrato((atual) =>
      atual
        ? {
            ...atual,
            movimentos: atual.movimentos.map((m) => (m.id === id ? { ...m, conciliado } : m)),
          }
        : atual,
    );
  }

  const dias = extrato ? porDia(extrato.movimentos) : [];
  const pendentes = extrato?.movimentos.filter((m) => !m.conciliado).length ?? 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Extrato bancário"
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Os totais fecham à direita, no mesmo eixo da coluna de saldo. */}
          <span style={{ flex: 1 }} />
          {extrato && (
            <>
              <Totalizador rotulo="Entradas" valor={extrato.entradas} cor="var(--credito)" />
              <Totalizador rotulo="Saídas" valor={extrato.saidas} cor="var(--debito)" />
            </>
          )}
          <Totalizador
            rotulo="Saldo do período"
            valor={extrato?.saldoFinal ?? conta.saldo}
            destaque
          />
        </div>
      }
    >
      {/* Os dados da conta no padrão dos campos das outras telas: cadastro se lê
          igual em todo lugar do sistema. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 18 }}>
        <Field label="Conta">
          <CampoBloqueado valor={conta.apelido?.trim() || conta.nome} />
        </Field>
        <Field label="Banco">
          <CampoBloqueado valor={conta.banco?.trim() || "—"} />
        </Field>
        <Field label="Agência / conta">
          <CampoBloqueado valor={[conta.agencia, conta.conta].filter(Boolean).join(" / ") || "—"} />
        </Field>
        <Field label="Saldo atual">
          <CampoBloqueado
            valor={formatarSemSimbolo(conta.saldo)}
            titulo="Saldo de hoje, somando todo o histórico. Não depende do período consultado abaixo."
          />
        </Field>

        <Field label="Período" hint="Até seis meses por consulta.">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* O próprio seletor já não oferece período maior que o teto. */}
            <input
              type="date"
              value={de}
              min={limite(ate, -MAXIMO_DE_DIAS)}
              max={ate || undefined}
              onChange={(e) => setDe(e.target.value)}
              style={{ ...inputStyle, width: 150 }}
            />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>até</span>
            <input
              type="date"
              value={ate}
              min={de || undefined}
              max={limite(de, MAXIMO_DE_DIAS)}
              onChange={(e) => setAte(e.target.value)}
              style={{ ...inputStyle, width: 150 }}
            />
          </div>
        </Field>
      </div>

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

      {extrato && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 8,
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-medium)",
              color: "var(--text-tertiary)",
            }}
          >
            <span>Lançamentos</span>
            <span style={{ flex: 1 }} />
            {pendentes > 0 && (
              <span style={{ fontSize: "var(--text-xs)" }}>
                {pendentes} por conferir
              </span>
            )}
          </div>

          {/*
           * O trilho: fundo verde acinzentado, 4px de respiro, sem borda.
           *
           * A borda saiu porque o próprio fundo já delimita o bloco, e as duas
           * coisas juntas davam contorno dentro de contorno.
           */}
          <div
            style={{
              background: "var(--kanban-coluna-bg)",
              borderRadius: "var(--radius-lg)",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Abertura data={extrato.de} valor={extrato.saldoInicial} />

            {dias.length === 0 && (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface)",
                  color: "var(--text-tertiary)",
                  fontSize: "var(--text-base)",
                }}
              >
                Nenhum movimento neste período.
              </div>
            )}

            {/* Data em cima, lançamentos no meio, saldo embaixo — a ordem do
                extrato de banco. O saldo fecha o dia: ele é o resultado do que
                passou acima, e no topo ele apareceria antes das linhas que o
                explicam. */}
            {dias.map((dia) => (
              <div key={dia.data} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <DataDoDia data={dia.data} />

                {dia.movimentos.map((m) => (
                  <Linha key={m.id} movimento={m} aoConciliar={() => conciliar(m)} />
                ))}

                <FechoDoDia saldo={dia.saldoDoDia} />
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

/**
 * O ponto de partida, abrindo a lista.
 *
 * Fica no trilho e não num cartão branco: não é um lançamento, é a régua de onde
 * o primeiro saldo do período sai.
 */
function Abertura({ data, valor }: { data: string; valor: Centavos }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 10px",
        fontSize: "var(--text-xs)",
        color: "var(--text-tertiary)",
      }}
    >
      <span>Saldo anterior a {paraFormatoBR(data as DataISO)}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: valor < 0 ? "var(--debito)" : "var(--text-secondary)" }}>
        {formatarSemSimbolo(valor)}
      </span>
    </div>
  );
}

/** Abre o dia. Só a data: o que aconteceu vem nas linhas logo abaixo. */
function DataDoDia({ data }: { data: string }) {
  return (
    <div
      style={{
        // Respiro igual em cima e embaixo, para a faixa não colar no primeiro
        // cartão do dia e parecer pertencer a ele.
        padding: "6px 10px",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        letterSpacing: "var(--tracking-wide)",
        color: "var(--text-secondary)",
      }}
    >
      {data ? paraFormatoBR(data as DataISO) : "—"}
    </div>
  );
}

/**
 * Fecha o dia com o saldo dele.
 *
 * Só o saldo: entradas e saídas do dia saíram porque a pergunta desta linha é
 * "quanto tinha na conta no fim deste dia", e três números competindo faziam
 * procurar qual era o certo. A soma do período continua no rodapé.
 */
function FechoDoDia({ saldo }: { saldo: Centavos }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "flex-end",
        gap: 8,
        padding: "6px 10px",
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
        saldo do dia
      </span>
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          color: saldo < 0 ? "var(--debito)" : "var(--text-primary)",
        }}
      >
        {formatarSemSimbolo(saldo)}
      </span>
    </div>
  );
}

/**
 * Um lançamento: cartão branco correndo por cima do trilho.
 *
 * Sem saldo acumulado na linha. O saldo é pergunta do DIA, e repetido em toda
 * linha ele virava uma coluna de números parecidos que ninguém lê — e ainda
 * disputava atenção com o valor, que é o que a linha tem de dizer.
 */
function Linha({
  movimento,
  aoConciliar,
}: {
  movimento: MovimentoDoExtrato;
  aoConciliar: () => void;
}) {
  const [hover, setHover] = useState(false);
  const entrada = movimento.tipo === "ENTRADA";
  const historico = movimento.nome?.trim() || movimento.descricao?.trim() || "—";

  /*
   * A segunda linha é a FORMA, e não a descrição.
   *
   * A descrição do legado é "Baixa referente a parcela 2": ela repete o que a
   * própria tela já é, e some com o espaço que a forma precisa. Num extrato, o
   * que se procura ao lado do nome é como o dinheiro veio — e é isso que casa
   * com a linha do banco.
   */
  const forma = movimento.formaPagamento?.trim() || null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 42,
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      <IconeDoPagamento forma={movimento.formaPagamento} origem={movimento.origem} />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-medium)",
            }}
            title={historico}
          >
            {historico}
          </span>

          <VistoDeConferencia
            conciliado={movimento.conciliado}
            visivel={movimento.conciliado || hover}
            onClick={aoConciliar}
          />
        </span>

        {forma && (
          <span
            style={{
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            {forma}
          </span>
        )}
      </span>

      {/* Entrada em verde, saída em vermelho, e nunca o contrário.
          No mesmo corpo do nome: a cor e a posição já dão o destaque, e maior
          que o nome o valor virava o assunto da linha em vez do lançamento. */}
      <span
        style={{
          textAlign: "right",
          whiteSpace: "nowrap",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          color: entrada ? "var(--credito)" : "var(--debito)",
        }}
      >
        {entrada ? "+" : "-"}
        {formatarSemSimbolo(movimento.valor)}
      </span>
    </div>
  );
}

/**
 * O visto de conferido, à direita do nome.
 *
 * Só aparece quando a linha FOI conferida: em repouso, o extrato mostra o que
 * está resolvido, e uma caixa vazia em cada uma das trinta linhas transformava a
 * lista num formulário.
 *
 * Com o ponteiro em cima da linha ele surge apagado, e é assim que o gesto se
 * descobre — inclusive o de desmarcar, porque conciliar é afirmar "eu vi isso na
 * conta", e ver errado acontece.
 */
function VistoDeConferencia({
  conciliado,
  visivel,
  onClick,
}: {
  conciliado: boolean;
  visivel: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={conciliado ? "Conferido no extrato do banco" : "Marcar como conferido"}
      aria-label={conciliado ? "Conferido" : "Marcar como conferido"}
      aria-pressed={conciliado}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 14,
        height: 14,
        flexShrink: 0,
        padding: 0,
        border: "none",
        background: "none",
        color: conciliado ? "var(--success)" : "var(--text-disabled)",
        opacity: visivel ? 1 : 0,
        cursor: "pointer",
        transition: "opacity var(--dur) var(--ease)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.4" fill={conciliado ? "currentColor" : "none"} />
        <path
          d="M5.2 8.2l1.9 1.9 3.7-3.9"
          stroke={conciliado ? "var(--surface)" : "currentColor"}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function Totalizador({
  rotulo,
  valor,
  cor,
  destaque,
}: {
  rotulo: string;
  valor: Centavos;
  cor?: string;
  destaque?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
        {rotulo}
      </div>
      <div
        style={{
          fontSize: destaque ? "var(--text-md)" : "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: cor ?? (valor < 0 ? "var(--debito)" : "var(--text-primary)"),
        }}
      >
        {formatarSemSimbolo(valor)}
      </div>
    </div>
  );
}
