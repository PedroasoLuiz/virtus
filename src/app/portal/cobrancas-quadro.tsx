"use client";

import { useMemo, useState } from "react";
import { PageHeader, PageLayout, Panel, SearchInput, selectStyle } from "@/components/ui/kit";
import { Quadro, type ColunaQuadro } from "@/components/ui/quadro";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Emitente, ParcelaDoCliente } from "@/modules/portal/portal.types";

/**
 * As cobranças do cliente, em quadro.
 *
 * Quadro e não tabela porque a pergunta dele é de estado, não de linha: "tem
 * algo vencido?" se responde olhando se a primeira coluna tem cartão. Numa
 * tabela isso exige ler a coluna de situação de cima a baixo.
 *
 * Dentro de cada coluna a ordem é o VENCIMENTO, sempre — o que vence antes vem
 * antes, inclusive nas pagas, onde vira histórico do mais antigo para o mais
 * novo.
 *
 * ⚠️ Sem arrastar, de propósito: mover um cartão aqui significaria mudar o
 * estado de uma cobrança, e isso não é gesto de quem recebe a cobrança.
 */

const VENCIDAS = 1;
const A_VENCER = 2;
const PAGAS = 3;

const COLUNAS: ColunaQuadro[] = [
  { id: VENCIDAS, descricao: "Vencidas", cor: "var(--danger)", aceitaSolta: false },
  { id: A_VENCER, descricao: "A vencer", cor: "var(--info)", aceitaSolta: false },
  { id: PAGAS, descricao: "Pagas", cor: "var(--success)", aceitaSolta: false },
];

type Cartao = ParcelaDoCliente & { id: number; colunaId: number; arrastavel: false };

export function CobrancasQuadro({
  parcelas,
  emitentes,
  emAberto,
  vencido,
}: {
  parcelas: ParcelaDoCliente[];
  emitentes: Emitente[];
  emAberto: Centavos;
  vencido: Centavos;
}) {
  const [busca, setBusca] = useState("");

  // Mais de um emitente habilita a escolha: o mesmo cliente pode ser atendido
  // por mais de uma empresa da casa, e para ele são cobranças de origens
  // diferentes. Com um só, escolher seria pergunta de resposta única.
  const varios = emitentes.length > 1;
  const [emitente, setEmitente] = useState("");

  const cartoes = useMemo<Cartao[]>(() => {
    const termo = busca.trim().toLowerCase();

    return parcelas
      .filter((p) => {
        if (emitente && String(p.emitente.id) !== emitente) return false;
        if (!termo) return true;
        return (
          p.tickets.some((t) => String(t).includes(termo)) ||
          p.emitente.nome.toLowerCase().includes(termo)
        );
      })
      .map((p) => ({
        ...p,
        id: p.parcelaId,
        colunaId: p.pago ? PAGAS : p.atrasada ? VENCIDAS : A_VENCER,
        arrastavel: false as const,
      }))
      // Sem vencimento vai para o fim: não se sabe quando vence, e colocá-la
      // no topo empurraria para baixo o que tem data e cobra ação.
      .sort((a, b) => (a.vencimento ?? "9999-12-31").localeCompare(b.vencimento ?? "9999-12-31"));
  }, [parcelas, busca, emitente]);

  const totalDaColuna = (colunaId: number) =>
    cartoes
      .filter((c) => c.colunaId === colunaId)
      .reduce((s, c) => s + (c.pago ? c.total : c.emAberto), 0) as Centavos;

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Minhas cobranças">
          {varios && (
            <select
              value={emitente}
              onChange={(e) => setEmitente(e.target.value)}
              // Fora do filtro escondido: escolher de qual empresa se está
              // vendo a cobrança é a primeira decisão do cliente, não um
              // refinamento. Atrás de um botão, ele nem descobriria que existe.
              style={{ ...selectStyle, width: "auto", minWidth: 200 }}
              aria-label="Empresa que está cobrando"
            >
              <option value="">Todas as empresas</option>
              {emitentes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          )}

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
          cabecalhoExtra={(coluna) => (
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-tertiary)",
              }}
            >
              {formatarSemSimbolo(totalDaColuna(coluna.id))}
            </span>
          )}
          corpo={(c) => <CorpoDoCartao cartao={c} mostrarEmitente={varios} />}
          rodape={(c) => <RodapeDoCartao cartao={c} />}
        />
      </Panel>
    </PageLayout>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

function CorpoDoCartao({ cartao, mostrarEmitente }: { cartao: Cartao; mostrarEmitente: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums" }}>
          {cartao.tickets.length > 0
            ? `${cartao.tickets.length > 1 ? "Tickets" : "Ticket"} ${cartao.tickets.join(", ")}`
            : "Cobrança"}
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
          {formatarSemSimbolo((cartao.pago ? cartao.total : cartao.emAberto) as Centavos)}
        </span>
      </div>

      <div
        style={{
          fontSize: "var(--text-sm)",
          color: cartao.atrasada ? "var(--danger-text)" : "var(--text-tertiary)",
          fontWeight: cartao.atrasada ? "var(--fw-medium)" : 400,
        }}
      >
        {cartao.pago
          ? "Pago"
          : cartao.vencimento
            ? `${cartao.atrasada ? "Venceu" : "Vence"} em ${paraFormatoBR(cartao.vencimento as DataISO)}`
            : "Sem vencimento"}
        {cartao.totalParcelas > 1 && ` · parcela ${cartao.numero} de ${cartao.totalParcelas}`}
      </div>

      {mostrarEmitente && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={cartao.emitente.nome}
        >
          {cartao.emitente.nome}
        </div>
      )}
    </div>
  );
}

/**
 * A faixa do cartão: o caminho para o documento.
 *
 * `/p/{token}` é a MESMA página que vai no e-mail da cobrança — mostra o ticket
 * no formato impresso e serve boleto e nota. Reaproveitá-la evita uma segunda
 * tela de detalhe e uma segunda forma de errar a permissão do arquivo, já que
 * ali o token é a credencial.
 */
function RodapeDoCartao({ cartao }: { cartao: Cartao }) {
  return (
    <a
      href={`/p/${cartao.token}`}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-medium)",
        color: "var(--primary)",
        textDecoration: "none",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Bilhete com o corte lateral: é o ticket, e não uma folha, que
            significaria documento genérico. */}
        <path d="M2.2 5.4a1 1 0 0 1 1-1h9.6a1 1 0 0 1 1 1v1.2a1.4 1.4 0 0 0 0 2.8v1.2a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V9.4a1.4 1.4 0 0 0 0-2.8z" />
        <path d="M9.4 4.4v7.2" />
      </svg>
      Abrir cobrança
      {cartao.temBoleto && " · boleto"}
      {cartao.temNota && " · nota"}
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
