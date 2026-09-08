"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Badge,
  EmptyRow,
  IconeKanban,
  IconeTabela,
  FilterItem,
  PageHeader,
  PageLayout,
  Pagination,
  Panel,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
  tdNum,
  type Tom,
} from "@/components/ui/kit";
import {
  BarraDeFerramentas,
  BotaoDaBarra,
  IconeFunil,
  IconeMais,
  OpcaoDoPainel,
  TituloDoPainel,
} from "@/components/ui/barra-de-ferramentas";
import { useRegistrarBusca } from "@/components/layout/busca-da-tela";
import { NovaFaturaDrawer } from "./nova-fatura-drawer";
import { FaturaDrawer } from "./fatura-drawer";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { Quadro } from "@/components/ui/quadro";
import { Icon } from "@/components/layout/icones";
import { useAvisos } from "@/components/ui/avisos";
import { salvarVisao } from "@/modules/preferencias/preferencias.actions";
import type { Visao } from "@/modules/preferencias/preferencias.types";
import { useRouter } from "next/navigation";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import {
  STATUS_FATURA,
  type FaturaResumo,
  type SituacaoFatura,
} from "@/modules/faturas/faturas.types";

/**
 * Listagem de contas a receber.
 *
 * "Fatura" no banco, "conta a receber" na interface: ela deixou de ser o centro
 * do modelo e virou o documento de cobranca gerado a partir de tickets.
 * Ver docs/10.
 *
 * Filtro e busca acontecem em memoria sobre a pagina carregada. Quando o volume
 * exigir, sobem para a query — `listarQuerySchema` ja prevê os parametros.
 */

const PAGE_SIZE = 25;

export function FaturasTabela({
  faturas,
  emitidoPor,
  visaoInicial,
}: {
  faturas: FaturaResumo[];
  /** Quem assina o rodape dos documentos. */
  emitidoPor: string;
  /** Preferencia do usuario, lida no servidor para a tela ja nascer certa. */
  visaoInicial: Visao;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [criando, setCriando] = useState(false);

  /*
   * Arrastar troca a SITUACAO da conta.
   *
   * As transicoes validas sao do servidor (`podeTransicionar`): tentar uma que
   * nao existe volta com o motivo, e a tela nao repete a regra. Duplicada aqui,
   * ela divergiria da do servico no primeiro ajuste.
   */
  async function moverConta(id: number, situacao: SituacaoFatura) {
    // PUT, nao PATCH: a rota de status expoe PUT. Com o verbo errado o Next
    // devolve 405 sem corpo, e a tela mostrava um erro generico sem motivo.
    const r = await fetch(`/api/v1/faturas/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: situacao }),
    });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível mover a conta",
      );
      return;
    }
    router.refresh();
  }

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [modo, setModo] = useState<string>(visaoInicial);

  /**
   * A escolha entre tabela e kanban vira PREFERENCIA DO USUARIO.
   *
   * ⚠️ Contas a receber era a unica das tres telas com quadro que NAO guardava a
   * escolha: o modo nascia "tabela" cravado, e quem trabalha no quadro reabria
   * em tabela a cada navegacao e a cada F5.
   *
   * ⚠️ A tela troca NA HORA e a gravacao vai atras, sem esperar. Um quadro que
   * so aparece depois da ida ao servidor faz o clique parecer perdido. Se a
   * gravacao falhar, o pior caso e a proxima carga abrir na visao antiga — e
   * nao um dado errado.
   */
  function escolherModo(novo: string) {
    setModo(novo);
    void salvarVisao(novo as Visao);
  }
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<number | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return faturas.filter((f) => {
      if (status && f.situacao !== status) return false;
      if (!termo) return true;
      return (
        String(f.numero).includes(termo) ||
        (f.clienteNome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [faturas, busca, status]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  const filtrosAtivos = status ? 1 : 0;

  /* ⚠️ Sem campo proprio: a tela anuncia o filtro para a caixa do topo. Ver
     `busca-da-tela`. */
  const buscar = useCallback((v: string) => {
    setBusca(v);
    setPagina(1);
  }, []);

  useRegistrarBusca("Contas a receber", busca, buscar, filtradas.length);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contas a receber" />

        {/*
          ⚠️ O recuo da pagina mora AQUI, e a tabela entra `solto`. Com a barra
          ao lado, a margem propria do `TableFrame` viraria um vao entre o
          cartao e a barra — e os dois precisam se encostar.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            /* Sem margem a DIREITA: aquele respiro e da propria barra, que o
               carrega na largura. Ver `BarraDeFerramentas`. */
            margin: "0 0 16px 16px",
          }}
        >
          {modo === "tabela" ? (
            <TableFrame solto>
              <TableArea minWidth={900}>
                <TableHead>
                  <Th minWidth={70}>Nº</Th>
                  <Th>Cliente</Th>
                  <Th minWidth={150}>Apuração</Th>
                  <Th minWidth={100}>Vencimento</Th>
                  <Th align="center" minWidth={70}>
                    Parcelas
                  </Th>
                  <Th align="center" minWidth={100}>
                    Situação
                  </Th>
                  <Th align="right" minWidth={110}>
                    Valor
                  </Th>
                </TableHead>
                <tbody>
                  {visiveis.length === 0 && <EmptyRow colSpan={7} />}
                  {visiveis.map((f, i) => (
                    <Tr
                      key={f.id}
                      delay={Math.min(i * 20, 150)}
                      dimmed={f.cancelada}
                      onClick={() => setDetalhe(f.id)}
                    >
                      <Td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {f.numero}
                      </Td>
                      <Td style={{ maxWidth: 260 }}>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: "var(--fw-medium)",
                          }}
                        >
                          {f.clienteNome ?? "—"}
                        </span>
                      </Td>
                      <Td
                        style={{
                          whiteSpace: "nowrap",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {periodo(f.apuracaoInicio, f.apuracaoFim)}
                      </Td>
                      <Td style={{ whiteSpace: "nowrap" }}>
                        <Vencimento
                          data={f.proximoVencimento}
                          situacao={f.situacao}
                        />
                      </Td>
                      <Td
                        style={{
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {f.qtdParcelas}
                      </Td>
                      <Td style={{ textAlign: "center" }}>
                        <Badge tom={TOM[f.situacao]}>{f.situacao}</Badge>
                      </Td>
                      <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)" }}>
                        {formatarSemSimbolo(f.total)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
              <Pagination
                page={paginaAtual}
                totalPages={totalPaginas}
                total={filtradas.length}
                pageSize={PAGE_SIZE}
                onPage={setPagina}
              />
            </TableFrame>
          ) : (
            <QuadroDeContas
              faturas={filtradas}
              aoAbrir={setDetalhe}
              aoMover={moverConta}
            />
          )}

            <BarraDeFerramentas>
              <BotaoDaBarra
                rotulo="Nova conta a receber"
                legenda="Nova"
                destaque
                icone={<IconeMais />}
                onClick={() => setCriando(true)}
              />

              {/* O modo de exibicao e ferramenta, e nao identidade da tela: e a
                  mesma listagem, muda so por onde se olha. */}
              <BotaoDaBarra
                rotulo={`Exibição: ${modo === "kanban" ? "Kanban" : "Tabela"}`}
                legenda="Exibir"
                icone={modo === "kanban" ? <IconeKanban /> : <IconeTabela />}
                painel={(fechar) => (
                  <>
                    <TituloDoPainel>Exibição</TituloDoPainel>
                    {[
                      { valor: "tabela", rotulo: "Tabela", icone: <IconeTabela /> },
                      { valor: "kanban", rotulo: "Kanban", icone: <IconeKanban /> },
                    ].map((o) => (
                      <OpcaoDoPainel
                        key={o.valor}
                        icone={o.icone}
                        rotulo={o.rotulo}
                        marcada={modo === o.valor}
                        onClick={() => {
                          escolherModo(o.valor);
                          fechar();
                        }}
                      />
                    ))}
                  </>
                )}
              />

              {/* Os mesmos campos do antigo botao de filtro, agora no painel da
                  barra. Aceso enquanto algum vale: filtro escondido atras de
                  icone vira lista curta sem explicacao. */}
              <BotaoDaBarra
                rotulo={filtrosAtivos > 0 ? `Filtros (${filtrosAtivos} em uso)` : "Filtrar as contas"}
                legenda="Filtros"
                aceso={filtrosAtivos > 0}
                icone={<IconeFunil ativo={filtrosAtivos > 0} />}
                painel={() => (
                  <>
                    <TituloDoPainel>Filtros</TituloDoPainel>
                <FilterItem label="Situação">
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPagina(1);
                    }}
                    style={selectStyle}
                  >
                    <option value="">Todas</option>
                    {STATUS_FATURA.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="CANCELADA">CANCELADA</option>
                  </select>
                </FilterItem>

                    {filtrosAtivos > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStatus("");
                          setPagina(1);
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </>
                )}
              />
            </BarraDeFerramentas>
        </div>
      </Panel>

      <FaturaDrawer
        emitidoPor={emitidoPor}
        faturaId={detalhe}
        onClose={() => setDetalhe(null)}
      />
      {criando && <NovaFaturaDrawer onClose={() => setCriando(false)} />}
    </PageLayout>
  );
}

/** Vencimento atrasado ganha cor — e a informacao que dispara acao. */
/**
 * O vencimento, vermelho so quando ainda nao entrou nada.
 *
 * Assim que ha baixa — parcial ou total — o atraso deixa de ser o assunto: o
 * dinheiro comecou a entrar, e a data virou historico. Vermelho ali continuaria
 * pedindo uma acao que ja foi tomada.
 */
function Vencimento({
  data,
  situacao,
}: {
  data: DataISO | null;
  situacao: SituacaoFatura;
}) {
  if (!data) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

  const semPagamento = situacao === "ABERTA" || situacao === "FATURADA";
  const atrasado = semPagamento && data < hoje();
  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        color: atrasado ? "var(--danger-text)" : "var(--text-primary)",
        fontWeight: atrasado ? "var(--fw-medium)" : 400,
      }}
    >
      {paraFormatoBR(data)}
    </span>
  );
}

/**
 * A data do cartao do quadro, com o rotulo dizendo o que ela e.
 *
 * ⚠️ Uma data sozinha nao diz nada. "12/09" num cartao de conta a receber tanto
 * pode ser quando ela vence quanto quando ela foi paga, e as duas pedem coisas
 * opostas de quem le. O rotulo troca junto com a situacao: enquanto ha o que
 * receber e "Vence em", e depois da baixa vira "Pago em".
 *
 * ⚠️ Fonte MENOR que o resto do cartao. Ela e referencia, e nao o assunto — o
 * assunto e o cliente, logo abaixo, e no mesmo corpo as duas competiam.
 *
 * ⚠️ Quitada sem data de pagamento, mostra o vencimento e continua dizendo
 * "Vence em". E o caso das baixas antigas sem rateio: inventar "Pago em" com a
 * data de vencimento seria afirmar um dia em que o dinheiro pode nao ter
 * entrado.
 *
 * ⚠️ E o rotulo conjuga no PASSADO quando a data ja passou: "Venceu em". Dizer
 * "vence" sobre um dia que ficou para tras faz a linha ler como previsao, e
 * quem passa o olho no quadro nao registra que aquilo ja e atraso. O vermelho
 * sozinho nao dava conta — ele grita, mas nao explica.
 *
 * ⚠️ Parcialmente paga atrasada e AMARELA, e nao vermelha. O atraso continua
 * existindo — antes ele sumia aqui, sob a ideia de que baixa parcial encerrava
 * o assunto —, mas nao e o mesmo atraso de quem nao pagou nada: alguem ja
 * pagou parte e a conversa esta em andamento. E a mesma escala da etiqueta de
 * situacao ao lado, e as duas leem juntas em vez de se contradizer.
 */
function DataDoCartao({
  vencimento,
  recebimento,
  situacao,
}: {
  vencimento: DataISO | null;
  recebimento: DataISO | null;
  situacao: SituacaoFatura;
}) {
  const quitada = situacao === "PAGA" || situacao === "BAIXADA";
  const mostraPagamento = quitada && recebimento != null;
  const data = mostraPagamento ? recebimento : vencimento;

  if (!data) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

  const atrasado = !quitada && data < hoje();
  const corDoAtraso =
    situacao === "PARC. PAGA" ? "var(--warning)" : "var(--danger-text)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        fontSize: "var(--text-xs)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ color: atrasado ? corDoAtraso : "var(--text-tertiary)" }}>
        {mostraPagamento ? "Pago em:" : atrasado ? "Venceu em:" : "Vence em:"}
      </span>
      <span
        style={{
          color: atrasado ? corDoAtraso : "var(--text-secondary)",
          fontWeight: atrasado ? "var(--fw-medium)" : 400,
        }}
      >
        {paraFormatoBR(data)}
      </span>
    </span>
  );
}

function periodo(de: DataISO | null, ate: DataISO | null): string {
  if (!de) return "—";
  return ate && ate !== de
    ? `${paraFormatoBR(de)} — ${paraFormatoBR(ate)}`
    : paraFormatoBR(de);
}

const TOM: Record<SituacaoFatura, Tom> = {
  ABERTA: "info",
  FATURADA: "info",
  "PARC. PAGA": "warning",
  PAGA: "success",
  BAIXADA: "success",
  CANCELADA: "danger",
};

/** Cor do ponto no cabecalho de cada coluna do kanban. */
const COR_COLUNA: Record<SituacaoFatura, string> = {
  ABERTA: "var(--info)",
  FATURADA: "var(--info)",
  "PARC. PAGA": "var(--warning)",
  PAGA: "var(--success)",
  BAIXADA: "var(--primary)",
  CANCELADA: "var(--danger)",
};

/**
 * Quadro de contas a receber.
 *
 * Usa o `Quadro` compartilhado, o mesmo de tickets e de projetos. Esta tela
 * tinha um kanban proprio, escrito antes do componente existir: mesma ideia,
 * medidas diferentes, e cada ajuste de espacamento precisava ser feito duas
 * vezes.
 *
 * As colunas sao as SITUACOES, um conjunto fixo, entao dividem a largura. A
 * cancelada fica de fora de proposito: ela nao e uma etapa do caminho, e uma
 * coluna morta no fim rouba largura das cinco que importam.
 */
function QuadroDeContas({
  faturas,
  aoAbrir,
  aoMover,
}: {
  faturas: FaturaResumo[];
  aoAbrir: (id: number) => void;
  aoMover: (id: number, situacao: SituacaoFatura) => void;
}) {
  const colunas: SituacaoFatura[] = [
    "ABERTA",
    "FATURADA",
    "PARC. PAGA",
    "PAGA",
    "BAIXADA",
  ];

  return (
    <Quadro
      solto
      colunas={colunas.map((c, i) => ({
        id: i,
        descricao: c,
        cor: COR_COLUNA[c],
      }))}
      cartoes={faturas
        .filter((f) => !f.cancelada)
        .map((f) => ({
          ...f,
          colunaId: colunas.indexOf(f.situacao),
          /*
           * Conta paga nao volta arrastando.
           *
           * O que a tirou de "aberta" foi uma BAIXA, com valor e data. Desfazer
           * isso e estornar um recebimento, nao mover um cartao.
           */
          /*
           * PARC. PAGA nao arrasta: o que a tirou de aberta foi uma BAIXA
           * parcial, com valor e data, e desfazer isso e estornar.
           *
           * PAGA arrasta, mas so para BAIXADA — quem impede o resto e o
           * servidor, com `podeTransicionar`. Conciliar E um gesto de arrastar:
           * o dinheiro apareceu no extrato e alguem conferiu.
           */
          arrastavel: f.situacao !== "PARC. PAGA" && f.situacao !== "BAIXADA",
        }))}
      aoMover={(id, coluna) => aoMover(id, colunas[coluna])}
      aoAbrir={(f) => aoAbrir(f.id)}
      vazio="Nenhuma conta"
      corpo={(f) => (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-sm)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 17,
                padding: "0 6px",
                borderRadius: "var(--radius-xs)",
                background: "var(--primary-subtle)",
                color: "var(--primary)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--fw-semi)",
              }}
            >
              {f.numero}
            </span>
            {/* Vencimento no topo, onde antes ficava o periodo: o que decide o
                que fazer com a conta hoje e a data em que ela vence, nao a
                competencia que ela apura. */}
            <DataDoCartao
              vencimento={f.proximoVencimento}
              recebimento={f.ultimoRecebimento}
              situacao={f.situacao}
            />
          </div>

          <div
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-medium)",
              lineHeight: 1.32,
              letterSpacing: "var(--tracking-normal)",
              marginTop: 7,
            }}
          >
            {f.clienteNome ?? "—"}
          </div>
        </>
      )}
      rodape={(f) => (
        <>
          {/* Quantos tickets a conta juntou. Uma conta de oito tickets se le
              diferente de uma de um so, e o numero e o unico jeito de saber sem
              abrir. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Icon name="ticket" size={13} />
            {f.qtdTickets}
          </span>
          <span style={{ flex: 1 }} />

          <ValorDaConta pago={f.pago} total={f.total} saldo={f.saldo} />
        </>
      )}
    />
  );
}

/**
 * Quanto entrou e quanto era.
 *
 * Quitada, o total sozinho em verde ja diz tudo: repetir o mesmo numero duas
 * vezes, um verde e um preto, so faz procurar a diferenca que nao existe.
 *
 * Parcial, os dois numeros sao a informacao: o que entrou e o que falta chegar.
 */
function ValorDaConta({
  pago,
  total,
  saldo,
}: {
  pago: Centavos;
  total: Centavos;
  saldo: Centavos;
}) {
  /*
   * ⚠️ Quitada e SALDO ZERO, e nao "recebeu tudo".
   *
   * Uma conta de 1.500 baixada com 500 de desconto recebeu 1.000: comparando o
   * recebido com o total, ela aparecia eternamente como parcial, com um "+1.000"
   * verde ao lado de 1.500, e quem varria a lista via dinheiro a cobrar que nao
   * existia.
   */
  const quitada = saldo === 0 && total > 0;

  return (
    <>
      {pago > 0 && !quitada && (
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semi)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--credito)",
          }}
        >
          +{formatarSemSimbolo(pago)}
        </span>
      )}

      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: quitada ? "var(--credito)" : undefined,
        }}
      >
        {formatarSemSimbolo(total)}
      </span>
    </>
  );
}
