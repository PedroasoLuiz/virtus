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
  titulo: string;
  data: DataISO | null;
  valor: Centavos;
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
      titulo: `Orçamento ${o.numero}`,
      data: o.emitidoEm,
      valor: o.total,
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
      titulo:
        (p.tickets.length > 0
          ? `${p.tickets.length > 1 ? "Tickets" : "Ticket"} ${p.tickets.join(", ")}`
          : "Cobrança") +
        (p.totalParcelas > 1 ? ` · parcela ${p.numero} de ${p.totalParcelas}` : ""),
      data: p.vencimento,
      valor: (p.pago ? p.total : p.emAberto) as Centavos,
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
          c.titulo.toLowerCase().includes(termo) ||
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
            ensina a ignorar o número justamente quando ele passa a importar. */}
        <div style={{ display: "flex", gap: 24, padding: "0 4px 14px" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: "var(--fw-medium)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={cartao.cliente}
        >
          {cartao.cliente}
        </span>

        <span
          style={{
            fontSize: "var(--text-sm)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            color: cartao.atrasada ? "var(--danger-text)" : "var(--text-tertiary)",
            fontWeight: cartao.atrasada ? "var(--fw-medium)" : 400,
          }}
        >
          {cartao.data ? paraFormatoBR(cartao.data as DataISO) : "—"}
        </span>
      </div>

      <div
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={cartao.titulo}
      >
        {cartao.titulo}
      </div>
    </div>
  );
}

/** A faixa da moldura: o valor, fora do branco. */
function RodapeDoCartao({ cartao }: { cartao: Cartao }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
        }}
      >
        {cartao.orcamento
          ? "proposta"
          : [cartao.temBoleto && "boleto", cartao.temNota && "nota"]
              .filter(Boolean)
              .join(" · ") || (cartao.pago ? "pago" : "em aberto")}
      </span>

      <span style={{ flex: 1 }} />

      <span
        style={{
          fontSize: "var(--text-md)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: cartao.pago ? "var(--text-tertiary)" : "var(--text-primary)",
        }}
      >
        {formatarSemSimbolo(cartao.valor)}
      </span>
    </div>
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
