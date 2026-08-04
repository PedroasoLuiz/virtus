"use client";

import { useMemo, useState } from "react";
import { PageHeader, PageLayout, Panel, SearchInput } from "@/components/ui/kit";
import { Quadro, type ColunaQuadro } from "@/components/ui/quadro";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { OrcamentoDoCliente, ParcelaDoCliente } from "@/modules/portal/portal.types";

/**
 * As cobranças do cliente, em quadro.
 *
 * Quadro e não tabela porque a pergunta dele é de estado, não de linha: "tem
 * algo vencido?" se responde olhando se a coluna tem cartão. Numa tabela isso
 * exige ler a coluna de situação de cima a baixo.
 *
 * Dentro de cada coluna a ordem é o VENCIMENTO, sempre — o que vence antes vem
 * antes, inclusive nas pagas, onde vira histórico do mais antigo para o mais
 * novo.
 *
 * ⚠️ Sem arrastar, de propósito: mover um cartão aqui significaria mudar o
 * estado de uma cobrança, e isso não é gesto de quem recebe a cobrança.
 */

const ORCAMENTOS = 1;
const VENCIDAS = 2;
const A_VENCER = 3;
const PAGAS = 4;

const COLUNAS: ColunaQuadro[] = [
  // Primeira porque é o que espera resposta DELE. As outras três só informam.
  { id: ORCAMENTOS, descricao: "Orçamentos", cor: "var(--text-tertiary)", aceitaSolta: false },
  { id: VENCIDAS, descricao: "Vencidas", cor: "var(--danger)", aceitaSolta: false },
  { id: A_VENCER, descricao: "A vencer", cor: "var(--info)", aceitaSolta: false },
  { id: PAGAS, descricao: "Pagas", cor: "var(--success)", aceitaSolta: false },
];

/**
 * Um cartão do quadro: proposta ou parcela.
 *
 * Os dois num tipo só porque o `Quadro` recebe uma lista — e porque, para o
 * cliente, são o mesmo assunto em momentos diferentes: o que vou pagar e o que
 * tenho a pagar.
 */
type Cartao = {
  id: number;
  colunaId: number;
  arrastavel: false;
  /** Qual empresa DELE deve. Um grupo tem mais de um CNPJ. */
  cliente: string;
  /**
   * A pílula do topo, no formato do quadro de contas a receber.
   *
   * Leva a palavra "Ticket" junto do número — no sistema o número sozinho basta,
   * porque quem olha sabe o que ele é; para o cliente, um número solto não diz
   * a que se refere.
   */
  etiqueta: string;
  /** "parcela 2 de 3". Ausente quando a cobrança é única. */
  detalhe: string;
  data: DataISO | null;
  /** O que ainda falta. Zero quando a parcela fechou. */
  valor: Centavos;
  /** Quanto já entrou. Aparece em verde, com "+", como no extrato. */
  recebido: Centavos;
  /** O que a parcela vale. Usado quando ela fechou sem dinheiro entrar. */
  total: Centavos;
  /** Nulo no orçamento: proposta ainda não é cobrança, e não tem documento. */
  token: string | null;
  atrasada: boolean;
  pago: boolean;
  orcamento: boolean;
  temBoleto: boolean;
  temNota: boolean;
};

const SEM_DATA = "9999-12-31";

export function CobrancasQuadro({
  parcelas,
  orcamentos,
  emAberto,
  vencido,
}: {
  parcelas: ParcelaDoCliente[];
  orcamentos: OrcamentoDoCliente[];
  emAberto: Centavos;
  vencido: Centavos;
}) {
  const [busca, setBusca] = useState("");

  const cartoes = useMemo<Cartao[]>(() => {
    const termo = busca.trim().toLowerCase();

    const deOrcamento: Cartao[] = orcamentos.map((o) => ({
      id: -o.ticketId, // Negativo: o id do quadro é único entre as duas origens.
      colunaId: ORCAMENTOS,
      arrastavel: false as const,
      cliente: o.cliente.nome,
      // Orçamento É um ticket: a pílula fala a mesma língua das outras colunas,
      // e o que diz que ainda é proposta é a coluna em que ele está.
      etiqueta: `Ticket ${o.numero}`,
      detalhe: o.titulo,
      data: o.emitidoEm,
      valor: o.total,
      recebido: 0 as Centavos,
      total: o.total,
      token: null,
      atrasada: false,
      pago: false,
      orcamento: true,
      temBoleto: false,
      temNota: false,
    }));

    const deParcela: Cartao[] = parcelas.map((p) => ({
      id: p.parcelaId,
      colunaId: p.pago ? PAGAS : p.atrasada ? VENCIDAS : A_VENCER,
      arrastavel: false as const,
      cliente: p.cliente.nome,
      // Conta antiga pode não ter ticket de origem; aí a pílula some em vez de
      // dizer "Cobrança", que repete o que o quadro já é.
      etiqueta:
        p.tickets.length > 0
          ? `${p.tickets.length > 1 ? "Tickets" : "Ticket"} ${p.tickets.join(", ")}`
          : "",
      detalhe: p.totalParcelas > 1 ? `parcela ${p.numero} de ${p.totalParcelas}` : "",
      data: p.vencimento,
      valor: p.emAberto,
      recebido: p.recebido,
      total: p.total,
      token: p.token,
      atrasada: p.atrasada,
      pago: p.pago,
      orcamento: false,
      temBoleto: p.temBoleto,
      temNota: p.temNota,
    }));

    return [...deOrcamento, ...deParcela]
      .filter(
        (c) =>
          !termo ||
          c.etiqueta.toLowerCase().includes(termo) ||
          c.cliente.toLowerCase().includes(termo),
      )
      // Sem data vai para o fim: não se sabe quando vence, e no topo empurraria
      // para baixo o que tem data e cobra ação.
      .sort((a, b) => (a.data ?? SEM_DATA).localeCompare(b.data ?? SEM_DATA));
  }, [parcelas, orcamentos, busca]);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Minhas cobranças">
          <SearchInput value={busca} onSearch={setBusca} />
        </PageHeader>

        {/* Vencido só aparece quando existe: um "R$ 0,00 vencido" permanente
            ensina a ignorar o número justamente quando ele passa a importar.

            `0 16px` é o mesmo recuo lateral do quadro logo abaixo: com 4px, os
            totais começavam antes da primeira coluna e nada alinhava. */}
        <div style={{ display: "flex", gap: 24, padding: "0 16px 14px" }}>
          <Total rotulo="Em aberto" valor={emAberto} />
          {vencido > 0 && <Total rotulo="Vencido" valor={vencido} alerta />}
        </div>

        <Quadro
          colunas={COLUNAS}
          cartoes={cartoes}
          aoMover={() => {}}
          vazio="Nenhuma cobrança aqui"
          /*
           * O cartão inteiro abre a cobrança.
           *
           * `/p/{token}` é a MESMA página que vai no e-mail — mostra o ticket no
           * formato impresso e serve boleto e nota. Reaproveitá-la evita uma
           * segunda tela de detalhe e uma segunda forma de errar a permissão do
           * arquivo, já que ali o token é a credencial.
           */
          aoAbrir={(c) => {
            if (c.token) window.open(`/p/${c.token}`, "_blank", "noopener");
          }}
          corpo={(c) => <CorpoDoCartao cartao={c} />}
          rodape={(c) => <RodapeDoCartao cartao={c} />}
        />
      </Panel>
    </PageLayout>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

/**
 * O cartão branco: de quem é a dívida e quando ela vence.
 *
 * O valor NÃO está aqui — ele vive na faixa da moldura, fora do branco. Dentro,
 * ele disputava com a data, e as duas perguntas do cartão são "de qual das
 * minhas empresas" e "para quando".
 */
function CorpoDoCartao({ cartao }: { cartao: Cartao }) {
  return (
    <>
      {/* Mesma anatomia do cartão de contas a receber: pílula do número à
          esquerda, data à direita, nome em duas linhas embaixo. O cliente e a
          casa olham quadros diferentes do mesmo assunto, e o desenho igual é o
          que faz um explicar o outro numa conversa por telefone. */}
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
        {cartao.etiqueta ? (
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
              whiteSpace: "nowrap",
            }}
          >
            {cartao.etiqueta}
          </span>
        ) : (
          <span />
        )}

        <span
          style={{
            whiteSpace: "nowrap",
            color: cartao.atrasada ? "var(--danger-text)" : "var(--text-tertiary)",
            fontWeight: cartao.atrasada ? "var(--fw-medium)" : 400,
          }}
        >
          {cartao.data ? paraFormatoBR(cartao.data as DataISO) : "—"}
        </span>
      </div>

      {/* Até duas linhas: a razão social inteira não cabe numa só, e cortada em
          "RION LED INDUSTRIA COMERCIO E SERVI..." some justamente a parte que
          distingue um CNPJ do grupo do outro. */}
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
        title={cartao.cliente}
      >
        {cartao.cliente}
      </div>

      {cartao.detalhe && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={cartao.detalhe}
        >
          {cartao.detalhe}
        </div>
      )}
    </>
  );
}

/**
 * A faixa da moldura: os documentos à esquerda, o dinheiro à direita.
 *
 * O que já entrou aparece em verde com "+", a mesma convenção do extrato. Quando
 * a parcela fechou, sobra só o verde: repetir um "0,00" em aberto ao lado diria
 * que ainda falta algo.
 */
function RodapeDoCartao({ cartao }: { cartao: Cartao }) {
  /*
   * O cartão nunca fica sem valor.
   *
   * Três casos, e o terceiro só apareceu com dado real: parcela quitada em que
   * nada entrou — a que foi PERDOADA. Sem esta linha ela mostrava a faixa vazia,
   * porque o em aberto é zero e o recebido também.
   */
  const emAberto = cartao.valor > 0 ? cartao.valor : null;
  const recebido = cartao.recebido > 0 ? cartao.recebido : null;
  const encerrada = !emAberto && !recebido ? cartao.total : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {cartao.token && cartao.temBoleto && (
          <BaixarDocumento tipo="boleto" token={cartao.token} />
        )}
        {cartao.token && cartao.temNota && <BaixarDocumento tipo="nfs" token={cartao.token} />}
        {cartao.orcamento && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            proposta
          </span>
        )}
      </span>

      <span style={{ flex: 1 }} />

      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {emAberto !== null && (
          <span style={{ color: "var(--text-primary)" }}>{formatarSemSimbolo(emAberto)}</span>
        )}

        {recebido !== null && (
          <span style={{ color: "var(--credito)" }} title="Já recebido">
            +{formatarSemSimbolo(recebido)}
          </span>
        )}

        {encerrada !== null && (
          <span style={{ color: "var(--text-tertiary)" }} title="Encerrada sem recebimento">
            {formatarSemSimbolo(encerrada)}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * O documento, dentro da própria moldura. Clicar baixa.
 *
 * Moldura e não ícone solto: solto, o alvo de clique vira o desenho, que tem
 * buracos, e a mira falha na borda. É a mesma decisão do `BotaoDeAcao` do
 * sistema.
 *
 * `/p/{token}/documento` transmite o arquivo em vez de redirecionar para o
 * Storage, então o caminho interno nunca chega ao navegador.
 *
 * ⚠️ `stopPropagation`: o cartão inteiro abre a cobrança, e sem isto baixar o
 * boleto abriria a página junto.
 */
function BaixarDocumento({ tipo, token }: { tipo: "boleto" | "nfs"; token: string }) {
  const boleto = tipo === "boleto";

  return (
    <a
      href={`/p/${token}/documento?tipo=${tipo}`}
      download
      onClick={(e) => e.stopPropagation()}
      title={boleto ? "Baixar boleto" : "Baixar nota fiscal"}
      aria-label={boleto ? "Baixar boleto" : "Baixar nota fiscal"}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 22,
        height: 22,
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--primary-border)",
        background: "var(--primary-subtle)",
        color: "var(--primary)",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {boleto ? (
          // Código de barras: é o que se olha num boleto.
          <path d="M2.6 3.4v9.2M5 3.4v9.2M7.4 3.4v9.2M10.4 3.4v9.2M13.4 3.4v9.2" />
        ) : (
          <>
            <path d="M9 1.8H4.2a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V5.8z" />
            <path d="M9 1.8v4h4" />
            <path d="M5.8 9.2h4.4M5.8 11.4h3" />
          </>
        )}
      </svg>
    </a>
  );
}

function Total({ rotulo, valor, alerta }: { rotulo: string; valor: Centavos; alerta?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
        {rotulo}
      </span>
      <span
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: alerta ? "var(--danger-text)" : "var(--text-primary)",
        }}
      >
        {formatarSemSimbolo(valor)}
      </span>
    </div>
  );
}
