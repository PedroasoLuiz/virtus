"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Badge,
  EmptyRow,
  FilterItem,
  IconeKanban,
  IconeTabela,
  Alert,
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
import {
  estaVencida,
  situacaoDaConta,
  SITUACOES_CONTA,
  type ContaPagarResumo,
  type SituacaoConta,
} from "@/modules/contas-pagar/contas-pagar.types";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { ContaDrawer } from "./conta-drawer";
import { NovaContaDrawer } from "./nova-conta-drawer";
import { Quadro } from "@/components/ui/quadro";
import { salvarVisao } from "@/modules/preferencias/preferencias.actions";
import type { Visao } from "@/modules/preferencias/preferencias.types";

const PAGE_SIZE = 25;

const TOM: Record<SituacaoConta, Tom> = {
  ABERTA: "info",
  PARCIAL: "warning",
  PAGA: "success",
  BAIXADA: "success",
  SUSPENSA: "neutral",
};

/*
 * ⚠️ O filtro mistura SITUACAO com MARCA de proposito.
 *
 * Quem varre a lista pergunta "o que esta vencido?" e "o que foi cancelado?" com
 * a mesma naturalidade com que pergunta "o que esta em aberto?" — mesmo que, no
 * modelo, as duas primeiras cruzem com as outras em vez de excluir. Dois seletores
 * separados seriam fieis ao modelo e piores de usar.
 */
const VENCIDAS = "VENCIDAS";
const CANCELADAS = "CANCELADAS";

const OPCOES_DE_FILTRO = [...SITUACOES_CONTA, VENCIDAS, CANCELADAS];

export function ContasTabela({
  contas,
  totalNoBanco,
  visaoInicial,
}: {
  contas: ContaPagarResumo[];
  /** Quantas existem de verdade. Maior que `contas.length` = a carga cortou. */
  totalNoBanco?: number;
  visaoInicial: Visao;
}) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [nova, setNova] = useState(false);
  const [modo, setModo] = useState<string>(visaoInicial);

  /**
   * A escolha entre tabela e quadro e PREFERENCIA DO USUARIO, e vale para todas
   * as telas com quadro — nao e um estado desta tela.
   *
   * ⚠️ A tela troca NA HORA e a gravacao vai atras, sem esperar. Um quadro que
   * so aparece depois da ida ao servidor faz o clique parecer perdido. Se a
   * gravacao falhar, o pior caso e a proxima carga abrir na visao antiga — e nao
   * um dado errado.
   */
  function escolherModo(novo: string) {
    setModo(novo);
    void salvarVisao(novo as Visao);
  }

  // Situacao e vencimento sao derivados, entao saem uma vez so e sao
  // reaproveitados no filtro, na tabela e no quadro — recalcular por linha
  // renderizada seria trabalho repetido.
  const comSituacao = useMemo(
    () =>
      contas.map((c) => ({
        conta: c,
        situacao: situacaoDaConta(c),
        vencida: estaVencida(c),
      })),
    [contas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return comSituacao.filter(({ conta, situacao: s, vencida }) => {
      if (situacao === VENCIDAS) {
        if (!vencida) return false;
      } else if (situacao === CANCELADAS) {
        if (!conta.cancelada) return false;
      } else if (situacao) {
        if (s !== situacao) return false;
        /*
         * ⚠️ Cancelada some das situacoes, e so aparece no filtro dela.
         *
         * Ela continua tendo uma situacao por baixo — uma conta cancelada pela
         * metade ainda e PARCIAL —, e sem este corte ela apareceria misturada
         * com as vivas em toda coluna.
         */
        if (conta.cancelada) return false;
      }

      if (!termo) return true;

      /*
       * ⚠️ Codigo e VALOR entram na busca, junto de descricao e fornecedor.
       *
       * Procurava-se por "26" e por "1.402,50" e a lista voltava vazia — dois
       * dos tres jeitos naturais de achar uma conta nao funcionavam, e nada na
       * tela dizia que a busca so olhava texto.
       *
       * O valor e comparado nos DOIS formatos: como a tela mostra ("1.402,50") e
       * cru ("1402.5"). Quem le a linha digita o primeiro; quem copiou de um
       * extrato ou de um e-mail traz o segundo.
       */
      const numero = conta.numero == null ? "" : String(conta.numero);
      const valor = formatarSemSimbolo(conta.total as Centavos);
      const valorCru = (conta.total / 100).toFixed(2);

      return (
        conta.descricao.toLowerCase().includes(termo) ||
        (conta.fornecedorNome ?? "").toLowerCase().includes(termo) ||
        numero === termo ||
        valor.includes(termo) ||
        valorCru.includes(termo)
      );
    });
  }, [comSituacao, busca, situacao]);

  /*
   * ⚠️ A carga cortou, e a tela precisa dizer.
   *
   * Filtro e paginacao acontecem no navegador: o que nao veio do servidor nao
   * existe para esta tela. Sem este aviso, uma conta fora do corte sumia da
   * lista E da busca sem nada explicando, e quem procurava concluia que ela
   * nunca tinha sido lancada.
   */
  const cortadas = Math.max(0, (totalNoBanco ?? contas.length) - contas.length);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  const filtrosAtivos = situacao ? 1 : 0;

  /* ⚠️ Sem campo proprio: a tela anuncia o filtro para a caixa do topo, a unica
     do sistema. Voltar para a primeira pagina e parte do gesto — filtrado, o
     resultado quase nunca tem a pagina em que se estava. Ver `busca-da-tela`. */
  const buscar = useCallback((v: string) => {
    setBusca(v);
    setPagina(1);
  }, []);

  useRegistrarBusca("Contas a pagar", busca, buscar, filtradas.length);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Contas a pagar" />

        {cortadas > 0 && (
          <div style={{ marginBottom: 10 }}>
            <Alert
              variant="warning"
              title={`${cortadas} conta${cortadas > 1 ? "s" : ""} não carregada${cortadas > 1 ? "s" : ""}`}
            >
              A tela busca e filtra sobre o que já veio do servidor, e a carga tem
              limite. As mais antigas ficaram de fora.
            </Alert>
          </div>
        )}

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
            margin: "0 0 var(--vao-da-pagina) var(--vao-da-pagina)",
          }}
        >
          {modo === "kanban" ? (
            <QuadroDeContas itens={filtradas} aoAbrir={setDetalhe} />
          ) : (
            <TableFrame solto>
              <TableArea minWidth={880}>
                <TableHead>
                  <Th minWidth={60}>Nº</Th>
                  <Th>Descrição</Th>
                  <Th minWidth={180}>Fornecedor</Th>
                  <Th minWidth={100}>Vencimento</Th>
                  {/*
                  ⚠️ Tudo a esquerda, inclusive numero e dinheiro. Havia
                  "Parcelas" e "Situacao" centralizadas e "Valor" a direita: tres
                  eixos diferentes na mesma tabela, e o olho refazia a mira em
                  cada coluna.
                */}
                  <Th minWidth={80}>Parcelas</Th>
                  <Th minWidth={100}>Situação</Th>
                  <Th minWidth={110}>Valor</Th>
                </TableHead>
                <tbody>
                  {visiveis.length === 0 && <EmptyRow colSpan={7} />}
                  {visiveis.map(({ conta, situacao: s, vencida }, i) => (
                    <Tr
                      key={conta.id}
                      delay={Math.min(i * 20, 150)}
                      dimmed={conta.cancelada}
                      onClick={() => setDetalhe(conta.id)}
                    >
                      <Td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {conta.numero ?? conta.id}
                      </Td>
                      <Td style={{ maxWidth: 280 }}>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: "var(--fw-medium)",
                          }}
                        >
                          {conta.descricao || "—"}
                        </span>
                      </Td>
                      <Td
                        style={{ maxWidth: 200, color: "var(--text-secondary)" }}
                      >
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {conta.fornecedorNome ?? "—"}
                        </span>
                      </Td>
                      {/*
                      ⚠️ VENCIDA vive AQUI, na data, e nao na coluna de situacao.
                      Ela e um fato sobre o calendario, e o lugar de um fato sobre
                      o calendario e do lado da data que o produziu.
                    */}
                      <Td
                        style={{
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                          color: vencida ? "var(--danger-text)" : undefined,
                          fontWeight: vencida ? "var(--fw-medium)" : undefined,
                        }}
                      >
                        {conta.proximoVencimento
                          ? paraFormatoBR(conta.proximoVencimento as DataISO)
                          : "—"}
                      </Td>
                      <Td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {conta.qtdParcelas > 0
                          ? `${conta.parcelasPagas}/${conta.qtdParcelas}`
                          : "—"}
                      </Td>
                      <Td>
                        {/* Cancelada ganha a propria pastilha: ela nao esta num
                          ponto do caminho, saiu do caminho. */}
                        {conta.cancelada ? (
                          <Badge tom="danger">CANCELADA</Badge>
                        ) : (
                          <Badge tom={TOM[s]}>{s}</Badge>
                        )}
                      </Td>
                      <Td
                        style={{
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: "var(--fw-medium)",
                          color: "var(--debito)",
                        }}
                      >
                        {formatarSemSimbolo(conta.total)}
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
          )}

            <BarraDeFerramentas>
              <BotaoDaBarra
                rotulo="Nova conta a pagar"
                destaque
                icone={<IconeMais />}
                onClick={() => setNova(true)}
              />

              {/* O modo de exibicao e ferramenta, e nao identidade da tela: e a
                  mesma listagem, muda so por onde se olha. */}
              <BotaoDaBarra
                rotulo={`Exibição: ${modo === "kanban" ? "Kanban" : "Tabela"}`}
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
                aceso={filtrosAtivos > 0}
                icone={<IconeFunil ativo={filtrosAtivos > 0} />}
                painel={() => (
                  <>
                    <TituloDoPainel>Filtros</TituloDoPainel>
                <FilterItem label="Situação">
                  <select
                    value={situacao}
                    onChange={(e) => {
                      setSituacao(e.target.value);
                      setPagina(1);
                    }}
                    style={selectStyle}
                  >
                    <option value="">Todas</option>
                    {OPCOES_DE_FILTRO.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FilterItem>

                    {filtrosAtivos > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSituacao("");
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

      <ContaDrawer contaId={detalhe} onClose={() => setDetalhe(null)} />
      {nova && <NovaContaDrawer onClose={() => setNova(false)} />}
    </PageLayout>
  );
}

/** Cor do ponto no cabecalho de cada coluna do quadro. */
const COR_COLUNA: Record<SituacaoConta, string> = {
  ABERTA: "var(--info)",
  PARCIAL: "var(--warning)",
  PAGA: "var(--success)",
  BAIXADA: "var(--primary)",
  SUSPENSA: "var(--text-tertiary)",
};

/**
 * Quadro de contas a pagar.
 *
 * Usa o `Quadro` compartilhado, o mesmo de contas a receber, tickets e projetos.
 *
 * ⚠️ NENHUM cartao arrasta, e isso nao e uma pendencia.
 *
 * Do lado que recebe, a fatura tem uma coluna `status` de verdade e mover o
 * cartao e uma transicao real. Aqui a situacao e DERIVADA: `situacaoDaConta` a
 * calcula de `pago`, `cancelada` e das parcelas. Nao ha o que gravar ao soltar o
 * cartao noutra coluna — o que tira uma conta de ABERTA e uma BAIXA, com valor e
 * data, e o que a leva a VENCIDA e o calendario. Deixar arrastar prometeria um
 * gesto que o sistema nao tem como cumprir, e o cartao voltaria sozinho para o
 * lugar sem explicar por que.
 *
 * ⚠️ CANCELADA nao e coluna: ela nao e etapa do caminho, e sim conta que saiu do
 * caminho. Uma coluna morta no fim rouba largura das que importam, e o cartao
 * cancelado nao tem para onde ir depois.
 *
 * ⚠️ VENCIDA tambem nao e coluna, e essa e a mudanca que fez o quadro parar de
 * mentir. Ela e tempo, nao progresso: como coluna, engolia PARCIAL inteira — no
 * dado real, as 9 contas parciais eram todas tambem vencidas, e a coluna PARCIAL
 * ficava vazia. Agora vencida e a data em vermelho no cartao, e a conta aparece
 * na coluna que diz quanto dela ja foi pago.
 */
function QuadroDeContas({
  itens,
  aoAbrir,
}: {
  itens: {
    conta: ContaPagarResumo;
    situacao: SituacaoConta;
    vencida: boolean;
  }[];
  aoAbrir: (id: number) => void;
}) {
  const colunas: SituacaoConta[] = [
    "ABERTA",
    "PARCIAL",
    "PAGA",
    "BAIXADA",
    "SUSPENSA",
  ];

  return (
    <Quadro
      solto
      colunas={colunas.map((c, i) => ({
        id: i,
        descricao: c,
        cor: COR_COLUNA[c],
      }))}
      cartoes={itens
        .filter(({ conta }) => !conta.cancelada)
        .map(({ conta, situacao, vencida }) => ({
          ...conta,
          colunaId: colunas.indexOf(situacao),
          situacao,
          vencida,
          arrastavel: false,
        }))}
      // Nada arrasta, entao nada chega aqui. O `Quadro` exige a funcao.
      aoMover={() => {}}
      aoAbrir={(c) => aoAbrir(c.id)}
      vazio="Nenhuma conta"
      corpo={(c) => (
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
              {c.numero ?? c.id}
            </span>
            <Vencimento data={c.proximoVencimento} vencida={c.vencida} />
          </div>

          {/*
            O FORNECEDOR e a linha forte, e a descricao vem abaixo em tom menor.
            Num quadro de despesa a primeira pergunta e "para quem", e a segunda
            "do que se trata".
          */}
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
            {c.fornecedorNome ?? "—"}
          </div>

          <div
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 1,
              overflow: "hidden",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: 1.32,
              marginTop: 2,
            }}
          >
            {c.descricao || "—"}
          </div>
        </>
      )}
      rodape={(c) => (
        <>
          {/*
            ⚠️ A palavra "parcelas" fica JUNTO do numero.

            Sozinho, "1/1" nao diz o que conta: podia ser progresso, nota, ou
            qualquer outra razao. Duas palavras resolvem uma duvida que o cartao
            nao tem como responder de outro jeito.
          */}
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {c.qtdParcelas > 0
              ? `${c.parcelasPagas}/${c.qtdParcelas} ${c.qtdParcelas === 1 ? "parcela" : "parcelas"}`
              : "Sem parcelas"}
          </span>
          <span style={{ flex: 1 }} />
          <ValorDaConta
            pago={c.valorPago}
            total={c.total}
            quitada={c.situacao === "PAGA"}
          />
        </>
      )}
    />
  );
}

/**
 * Quanto ja saiu e quanto era.
 *
 * Espelho do `ValorDaConta` da conta a receber, com a cor trocada: la o pago e
 * `--credito`, aqui e `--debito`, porque este dinheiro saiu.
 *
 * ⚠️ Quitada, o total sozinho em vermelho ja diz tudo. Repetir o mesmo numero
 * duas vezes, um vermelho e um preto, so faz procurar a diferenca que nao
 * existe.
 *
 * ⚠️ E "quitada" vem da SITUACAO, e nao de comparar pago com total. Uma conta de
 * 1.500 baixada com 500 de desconto pagou 1.000 e esta quitada: pela comparacao
 * ela apareceria como parcial para sempre, com um "-1.000" ao lado de 1.500, e
 * quem varre o quadro veria divida que nao existe mais.
 */
function ValorDaConta({
  pago,
  total,
  quitada,
}: {
  pago: Centavos;
  total: Centavos;
  quitada: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {pago > 0 && !quitada && (
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semi)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--debito)",
          }}
        >
          -{formatarSemSimbolo(pago)}
        </span>
      )}

      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: quitada ? "var(--debito)" : undefined,
        }}
      >
        {formatarSemSimbolo(total)}
      </span>
    </span>
  );
}

/**
 * O vencimento, vermelho quando ja passou.
 *
 * ⚠️ Quem decide o vermelho e `estaVencida`, no dominio, e nao uma comparacao
 * escrita aqui. Ela ja sabe que conta paga, cancelada ou suspensa nao vence, e
 * duas implementacoes divergiriam no primeiro caso de borda — a tela pintaria de
 * vermelho uma conta que o filtro "Vencidas" nao traz.
 */
function Vencimento({
  data,
  vencida,
}: {
  data: DataISO | null;
  vencida: boolean;
}) {
  if (!data) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

  const atrasado = vencida;

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
