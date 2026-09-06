"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CobrancaCompartilhada,
  ItemPublico,
  TicketPublico,
} from "@/modules/publico/publico.types";
import {
  formatarSemSimbolo,
  multiplicar,
  somar,
  subtrair,
  ZERO,
  type Centavos,
} from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * O ticket como o cliente o ve: uma FOLHA A4, igual a que sai na impressora.
 *
 * Nao e um cartao responsivo com os mesmos dados — e o documento. Medidas em
 * `mm` e `pt`, posicoes fixas, e nada de sombra, borda ou fundo colorido nas
 * secoes. Em tela pequena a folha inteira encolhe por `transform: scale()`, sem
 * redistribuir nada por dentro: o que muda de lugar deixa de ser o mesmo papel.
 *
 * O botao de imprimir chama `imprimirRecibo` — o MESMO gerador do botao de PDF
 * do ticket. `pdf.ts` continua no projeto por comparacao, mas quem esta no ar e
 * o recibo.
 */

const AZUL = "#0A52B9";
const TINTA = "#101012";
const CINZA = "#86868B";
const REGUA = "#E3E3E3";
const AZUL_CLARO = "#EAF0FA";

/** jsPDF pesa ~400 KB e so serve a quem clica em imprimir. */
const carregarPdf = () => import("@/app/(app)/tickets/pdf-recibo");

export function CobrancaPublicaView({
  cobranca,
  token,
}: {
  cobranca: CobrancaCompartilhada;
  token: string;
}) {
  const [imprimindo, setImprimindo] = useState<number | null>(null);

  async function imprimir(t: TicketPublico) {
    setImprimindo(t.numero);
    try {
      const { imprimirRecibo } = await carregarPdf();

      await imprimirRecibo(
        {
          id: t.numero,
          numero: t.numero,
          status: t.situacao,
          cancelada: false,
          clienteNome: t.cliente.nome,
          clienteDoc: t.cliente.doc,
          clienteEndereco: null,
          centroCustoNome: t.cliente.centroDeCusto,
          inicio: t.inicio,
          fim: t.fim,
          descricao: t.descricao,
          faturado: t.cobranca.reduce((s, c) => s + c.valor, 0),
          itens: t.itens.map((i) => ({
            servicoNome: i.servico,
            descricao: i.descricao ?? "",
            data: i.data,
            quantidade: i.quantidade,
            unidade: i.unidade,
            valorUnitario: i.valor,
            desconto: i.desconto,
            acrescimo: i.acrescimo,
            despesas: i.despesas.map((d) => ({ descricao: d.descricao ?? "", valor: d.valor })),
          })),
          faturas: [
            {
              faturaId: cobranca.faturaNumero,
              pago: t.cobranca.filter((c) => c.pago).reduce((s, c) => s + c.valor, 0),
              parcelas: t.cobranca.map((c) => ({
                numero: c.parcela,
                vencimento: c.vencimento,
                valor: c.valor,
                pago: c.pago,
              })),
            },
          ],
          empresa: {
            razaoSocial: cobranca.empresa.razaoSocial,
            endereco: cobranca.empresa.endereco,
            cnpj: cobranca.empresa.cnpj,
            logo: cobranca.empresa.logo,
          },
        },
        cobranca.empresa.razaoSocial ?? "",
      );
    } finally {
      setImprimindo(null);
    }
  }

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        .folha {
          width: 210mm; min-height: 297mm; background: #fff;
          box-sizing: border-box; position: relative;
          transform-origin: top left;
          font-family: Helvetica, Arial, sans-serif;
          box-shadow: 0 2px 10px rgba(0,0,0,0.10);
        }
        .folha table { border-collapse: collapse; width: 100%; }

        /* O cartao nasce do canto de baixo e da direita — de onde o botao
           esta — em vez de aparecer inteiro de uma vez. */
        .cartao-downloads {
          transform-origin: bottom right;
          animation: abre-downloads 150ms cubic-bezier(0.2, 0, 0, 1);
        }
        @keyframes abre-downloads {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .girando { animation: gira 800ms linear infinite; }
        @keyframes gira { to { transform: rotate(360deg); } }

        /* Quem pediu menos movimento nao ganha movimento nenhum: o cartao
           aparece pronto, e a espera para de girar. */
        @media (prefers-reduced-motion: reduce) {
          .cartao-downloads, .girando { animation: none; }
        }
      `}</style>

      {cobranca.tickets.map((t) => (
        <div key={t.numero} style={{ marginBottom: 20 }}>
          <FolhaAjustada>
            <Folha ticket={t} empresa={cobranca.empresa} fatura={cobranca.faturaNumero} />
          </FolhaAjustada>
        </div>
      ))}

      {/*
       * ⚠️ Os downloads sairam do fim da pagina e viraram um botao FIXO.
       *
       * Empilhados abaixo da folha, eles so existiam para quem rolava ate o
       * fim — e a folha tem 297mm, entao no celular sao varias telas de rolagem
       * antes de aparecer o boleto. O documento e para ler; baixar e para poder
       * fazer a qualquer momento.
       */}
      <BotaoDeDownloads
        token={token}
        temBoleto={cobranca.temBoleto}
        temNfs={cobranca.temNfs}
        tickets={cobranca.tickets}
        imprimir={imprimir}
        imprimindo={imprimindo}
      />
    </div>
  );
}

/** Quanto esperar entre um download e o proximo, no "baixar todos". */
const ENTRE_DOWNLOADS = 700;

/**
 * O botao flutuante de downloads, e o cartao que ele abre.
 *
 * ⚠️ Canto inferior DIREITO, e fixo. E onde o polegar alcanca sem trocar a mao
 * de posicao, e onde ele nao cobre o texto que se esta lendo — no esquerdo,
 * numa folha centralizada, ele encostaria na margem do documento.
 *
 * ⚠️ O cartao abre PARA CIMA, ancorado no proprio botao. Ele nasce do canto de
 * onde foi chamado: crescer para baixo o jogaria para fora da tela, e crescer
 * do centro faria parecer um modal, que pede uma decisao — e aqui nao ha
 * decisao, so uma lista de coisas para levar.
 */
function BotaoDeDownloads({
  token,
  temBoleto,
  temNfs,
  tickets,
  imprimir,
  imprimindo,
}: {
  token: string;
  temBoleto: boolean;
  temNfs: boolean;
  tickets: TicketPublico[];
  imprimir: (t: TicketPublico) => Promise<void>;
  imprimindo: number | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [baixandoTodos, setBaixandoTodos] = useState(false);

  /*
   * Baixar arquivo do servidor sem sair da pagina.
   *
   * A rota `/p/{token}/documento` transmite o arquivo com
   * `Content-Disposition: attachment`, e da MESMA origem — entao um `<a>`
   * clicado por codigo dispara o download e a pagina fica onde estava. Um
   * `window.open` abriria uma aba que fecha sozinha, piscando na tela.
   */
  function baixarArquivo(tipo: "boleto" | "nfs") {
    const a = document.createElement("a");
    a.href = `/p/${token}/documento?tipo=${tipo}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /*
   * ⚠️ Um de cada vez, com pausa entre eles.
   *
   * Disparados no mesmo instante, o navegador trata a rajada como popup e
   * bloqueia do segundo em diante — sem avisar ninguem, e o cliente fica
   * achando que baixou tudo. A pausa tambem deixa a barra de downloads
   * acompanhar.
   */
  async function baixarTodos() {
    setBaixandoTodos(true);
    setAberto(false);

    try {
      if (temBoleto) {
        baixarArquivo("boleto");
        await new Promise((ok) => setTimeout(ok, ENTRE_DOWNLOADS));
      }
      if (temNfs) {
        baixarArquivo("nfs");
        await new Promise((ok) => setTimeout(ok, ENTRE_DOWNLOADS));
      }
      for (const t of tickets) {
        // O PDF e gerado no navegador: aqui a espera e a propria geracao.
        await imprimir(t);
      }
    } finally {
      setBaixandoTodos(false);
    }
  }

  const quantos = (temBoleto ? 1 : 0) + (temNfs ? 1 : 0) + tickets.length;
  if (quantos === 0) return null;

  const ocupado = baixandoTodos || imprimindo != null;

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
      {aberto && (
        /* Camada que fecha ao clicar fora. Transparente: o cartao e pequeno, e
           escurecer a pagina inteira por causa dele seria peso demais. */
        <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: -1 }} />
      )}

      {aberto && (
        <div
          className="cartao-downloads"
          style={{
            position: "absolute",
            right: 0,
            bottom: 66,
            minWidth: 232,
            padding: 6,
            borderRadius: 14,
            background: "#ffffff",
            border: `1px solid ${REGUA}`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
          }}
        >
          {temBoleto && (
            <ItemDeDownload
              rotulo="Baixar boleto"
              onClick={() => {
                baixarArquivo("boleto");
                setAberto(false);
              }}
              icone={
                <>
                  <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
                  <path d="M5 6v4M7 6v4M9.5 6v4M11.5 6v4" />
                </>
              }
            />
          )}

          {temNfs && (
            <ItemDeDownload
              rotulo="Baixar nota fiscal"
              onClick={() => {
                baixarArquivo("nfs");
                setAberto(false);
              }}
              icone={
                <>
                  <path d="M3.5 2h6l3 3v9h-9z" />
                  <path d="M5.5 8h5M5.5 10.5h3" />
                </>
              }
            />
          )}

          {tickets.map((t) => (
            <ItemDeDownload
              key={t.numero}
              rotulo={
                imprimindo === t.numero
                  ? "Gerando…"
                  : tickets.length > 1
                    ? `Baixar ticket ${t.numero} em PDF`
                    : "Baixar ticket em PDF"
              }
              onClick={() => {
                void imprimir(t);
                setAberto(false);
              }}
              icone={
                <>
                  <path d="M3.5 2h6l3 3v9h-9z" />
                  <path d="M6 11.5l2 2 2-2M8 7v6.5" />
                </>
              }
            />
          ))}

          {/* "Todos" so quando ha mais de uma coisa: com uma so, ele seria o
              mesmo botao escrito de outro jeito. */}
          {quantos > 1 && (
            <>
              <div style={{ height: 1, background: REGUA, margin: "5px 8px" }} />
              <ItemDeDownload
                rotulo="Baixar todos"
                destaque
                onClick={() => void baixarTodos()}
                icone={
                  <>
                    <path d="M8 2v8M5 7.5l3 3 3-3" />
                    <path d="M3 12.5h10" />
                  </>
                }
              />
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={aberto ? "Fechar downloads" : "Baixar documentos"}
        aria-expanded={aberto}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: AZUL,
          color: "#ffffff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(10,82,185,0.38)",
          transition: "transform 160ms cubic-bezier(0.2, 0, 0, 1)",
          transform: aberto ? "rotate(90deg)" : "none",
        }}
      >
        {ocupado ? (
          <span className="girando" style={{ display: "block", width: 20, height: 20 }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M8 2a6 6 0 1 1-4.24 1.76" />
            </svg>
          </span>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {aberto ? (
              <path d="M4 4l8 8M12 4l-8 8" />
            ) : (
              <>
                <path d="M8 2.5v8M4.5 7.5l3.5 3.5 3.5-3.5" />
                <path d="M3 13h10" />
              </>
            )}
          </svg>
        )}
      </button>
    </div>
  );
}

/** Uma linha do cartao de downloads: icone a esquerda, rotulo a direita. */
function ItemDeDownload({
  rotulo,
  icone,
  destaque,
  onClick,
}: {
  rotulo: string;
  icone: React.ReactNode;
  destaque?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px",
        border: "none",
        borderRadius: 9,
        background: hover ? AZUL_CLARO : "transparent",
        color: destaque ? AZUL : TINTA,
        fontWeight: destaque ? 600 : 500,
        fontSize: 14,
        fontFamily: "Helvetica, Arial, sans-serif",
        textAlign: "left",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke={destaque ? AZUL : CINZA}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        {icone}
      </svg>
      {rotulo}
    </button>
  );
}

/** A4 em pixels de CSS, a 96 dpi. */
const LARGURA_A4 = 794;

/**
 * Encolhe a folha para caber na tela, SEM deixar buraco embaixo.
 *
 * `transform: scale()` muda o desenho e nao o espaco ocupado: a folha aparecia
 * pequena e o resto da pagina continuava a 297mm de distancia, com os botoes la
 * embaixo. Aqui a altura do invólucro e recalculada junto com a escala, entao o
 * que vem depois encosta na folha.
 *
 * A conta precisa de JS porque depende da largura disponivel — `@media` sabe o
 * tamanho da janela, nao o da coluna onde a folha caiu.
 */
function FolhaAjustada({ children }: { children: React.ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState<number | undefined>(undefined);

  useEffect(() => {
    const medir = () => {
      const disponivel = area.current?.clientWidth ?? LARGURA_A4;
      const nova = Math.min(1, disponivel / LARGURA_A4);
      setEscala(nova);
      setAltura((folha.current?.offsetHeight ?? 0) * nova);
    };

    medir();

    const observador = new ResizeObserver(medir);
    if (area.current) observador.observe(area.current);
    // A folha tambem muda de altura: fonte que carrega depois, texto que quebra.
    if (folha.current) observador.observe(folha.current);

    return () => observador.disconnect();
  }, []);

  return (
    <div ref={area} style={{ width: "100%", height: altura, overflow: "hidden" }}>
      <div
        ref={folha}
        style={{
          width: LARGURA_A4,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
          // Centraliza a folha quando ela cabe inteira; colada a esquerda quando
          // nao cabe, que e onde a leitura comeca.
          marginLeft: escala === 1 ? "auto" : undefined,
          marginRight: escala === 1 ? "auto" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Uma folha A4 do documento. */
function Folha({
  ticket,
  empresa,
  fatura,
}: {
  ticket: TicketPublico;
  empresa: CobrancaCompartilhada["empresa"];
  fatura: number;
}) {
  const apuracao = periodoEmMeses(ticket.inicio, ticket.fim);

  /*
   * Somas em CENTAVOS, pelos helpers de dinheiro.
   *
   * `somar` passa por `centavos()`, que recusa valor nao inteiro — e e essa
   * recusa que teria denunciado, na primeira execucao, o dia em que reais
   * entraram aqui achando que eram centavos.
   */
  const soma = (valores: Centavos[]) => valores.reduce<Centavos>((a, b) => somar(a, b), ZERO);

  const subtotal = soma(
    ticket.itens.map((i) =>
      somar(multiplicar(i.valor, i.quantidade), soma(i.despesas.map((d) => d.valor))),
    ),
  );
  const desconto = soma(ticket.itens.map((i) => i.desconto));
  const acrescimo = soma(ticket.itens.map((i) => i.acrescimo));
  const total = soma(ticket.itens.map((i) => i.total));

  const faturado = soma(ticket.cobranca.map((c) => c.valor));
  const pago = soma(ticket.cobranca.filter((c) => c.pago).map((c) => c.valor));

  return (
    <div className="folha">
      {/* Faixa da marca, sangrando de ponta a ponta. */}
      <div style={{ height: "2.8mm", background: AZUL }} />

      <div style={{ padding: "0 14mm", boxSizing: "border-box" }}>
        {/* ── Identificação ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            paddingTop: "8.7mm",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "20pt",
                fontWeight: 700,
                color: AZUL,
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              TICKET
            </div>

            <div style={{ marginTop: "5mm" }}>
              <Campo rotulo="Número" valor={String(ticket.numero)} />
              <Campo rotulo="Situação" valor={ticket.situacao || "—"} />
              {apuracao && <Campo rotulo="Apuração" valor={apuracao} />}
            </div>
          </div>

          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logo}
              alt=""
              style={{ width: "29mm", height: "9mm", objectFit: "contain", objectPosition: "right top" }}
            />
          )}
        </div>

        {/* ── DE / PARA ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", marginTop: "9mm" }}>
          <div style={{ width: "91mm", paddingRight: "6mm", boxSizing: "border-box" }}>
            <Secao>DE</Secao>
            <Nome>{empresa.razaoSocial ?? "—"}</Nome>
            {empresa.cnpj && <Detalhe>CNPJ {empresa.cnpj}</Detalhe>}
            {empresa.endereco && <Detalhe>{empresa.endereco}</Detalhe>}
          </div>

          <div style={{ width: "91mm", boxSizing: "border-box" }}>
            <Secao>PARA</Secao>
            <Nome>{ticket.cliente.nome ?? "—"}</Nome>
            {ticket.cliente.doc && <Detalhe>{ticket.cliente.doc}</Detalhe>}
            {ticket.cliente.endereco && <Detalhe>{ticket.cliente.endereco}</Detalhe>}
            {ticket.cliente.endereco2 && <Detalhe>{ticket.cliente.endereco2}</Detalhe>}
            {ticket.cliente.centroDeCusto && (
              <Detalhe>Centro de custo: {ticket.cliente.centroDeCusto}</Detalhe>
            )}
          </div>
        </div>

        {/* ── Serviços ──────────────────────────────────────────────────── */}
        <table style={{ marginTop: "14mm" }}>
          <thead>
            <tr>
              <Th>Serviço</Th>
              <Th direita larguraMm={20}>Data</Th>
              <Th direita larguraMm={16}>Qtd.</Th>
              <Th direita larguraMm={22}>Unitário</Th>
              {desconto > 0 && (
                <Th direita larguraMm={22}>
                  Desconto
                </Th>
              )}
              {acrescimo > 0 && (
                <Th direita larguraMm={22}>
                  Acréscimo
                </Th>
              )}
              <Th direita larguraMm={24}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {ticket.itens.map((i, n) => (
              <tr key={n}>
                <Td>
                  <div>{i.servico ?? "Serviço"}</div>
                  {i.descricao && <div style={{ color: CINZA }}>{i.descricao}</div>}
                  {i.despesas.map((d, k) => (
                    <div key={k} style={{ color: CINZA }}>
                      + {d.descricao || "Despesa"} {formatarSemSimbolo(d.valor)}
                    </div>
                  ))}
                </Td>
                <Td direita>{i.data ? paraFormatoBR(i.data as DataISO) : "—"}</Td>
                <Td direita>{quantidade(i.quantidade, i.unidade)}</Td>
                <Td direita>{formatarSemSimbolo(i.valor)}</Td>
                {desconto > 0 && (
                  <Td direita>{i.desconto ? formatarSemSimbolo(i.desconto) : "—"}</Td>
                )}
                {acrescimo > 0 && (
                  <Td direita>{i.acrescimo ? formatarSemSimbolo(i.acrescimo) : "—"}</Td>
                )}
                <Td direita>{formatarSemSimbolo(i.total)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        <Resumo
          linhas={[
            { rotulo: "Subtotal", valor: subtotal },
            ...(desconto > 0 ? [{ rotulo: "Desconto", valor: desconto }] : []),
            ...(acrescimo > 0 ? [{ rotulo: "Acréscimo", valor: acrescimo }] : []),
            { rotulo: "Total", valor: total, forte: true },
          ]}
        />

        {/* ── Cobrança ──────────────────────────────────────────────────── */}
        <div style={{ marginTop: "12mm" }}>
          <Secao>COBRANÇA</Secao>

          <table style={{ marginTop: "2mm" }}>
            <thead>
              <tr>
                <Th larguraMm={22}>Fatura</Th>
                <Th larguraMm={20}>Parcela</Th>
                <Th larguraMm={30}>Vencimento</Th>
                <Th direita larguraMm={26}>Valor</Th>
                <Th direita>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {ticket.cobranca.map((c) => (
                <tr key={c.parcela}>
                  <Td>{c.fatura}</Td>
                  <Td>{c.parcela}</Td>
                  <Td>{c.vencimento ? paraFormatoBR(c.vencimento as DataISO) : "—"}</Td>
                  <Td direita>{formatarSemSimbolo(c.valor)}</Td>
                  <Td direita>{c.pago ? "Paga" : "Em aberto"}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          <Resumo
            linhas={[
              { rotulo: "Faturado", valor: faturado, forte: true },
              { rotulo: "Valor pago", valor: pago, forte: true },
              { rotulo: "Saldo devedor", valor: subtrair(faturado, pago), forte: true },
            ]}
          />
        </div>

        {ticket.descricao && (
          <div style={{ marginTop: "12mm" }}>
            <Secao>OBSERVAÇÕES</Secao>
            <div
              style={{
                marginTop: "1.5mm",
                fontSize: "8.5pt",
                color: TINTA,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {ticket.descricao}
            </div>
          </div>
        )}
      </div>

      {/*
       * Rodape colado no pe da folha, e nao depois do conteudo.
       *
       * O branco entre as observacoes e o rodape faz parte do documento: se ele
       * subisse junto com o texto, a folha mudaria de cara conforme o numero de
       * servicos, e duas cobrancas do mesmo cliente nao pareceriam o mesmo papel.
       */}
      <div
        style={{
          position: "absolute",
          left: "14mm",
          right: "14mm",
          bottom: "7mm",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "7.5pt",
          color: CINZA,
        }}
      >
        <span>Fatura {fatura}</span>
        <span>1 / 1</span>
      </div>
    </div>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", lineHeight: 1.65, whiteSpace: "nowrap" }}>
      {/* Largura fixa alinha os tres valores na mesma coluna. `nowrap` porque
          sem ele "Apuração" quebrava e o valor caía para a linha de baixo. */}
      <span style={{ width: "18mm", flexShrink: 0, fontSize: "8.5pt", color: CINZA }}>
        {rotulo}
      </span>
      <span style={{ fontSize: "8.5pt", fontWeight: 700, color: TINTA }}>{valor}</span>
    </div>
  );
}

function Secao({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "7pt",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: CINZA,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function Nome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10pt", fontWeight: 700, color: TINTA, marginTop: "1.5mm" }}>
      {children}
    </div>
  );
}

function Detalhe({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "8.5pt", color: CINZA, lineHeight: 1.45 }}>{children}</div>;
}

function Th({
  children,
  direita,
  larguraMm,
}: {
  children: React.ReactNode;
  direita?: boolean;
  larguraMm?: number;
}) {
  return (
    <th
      style={{
        width: larguraMm ? `${larguraMm}mm` : undefined,
        padding: "0 0 1.5mm",
        textAlign: direita ? "right" : "left",
        fontSize: "7pt",
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: CINZA,
        textTransform: "uppercase",
        borderBottom: `0.3mm solid ${REGUA}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

/**
 * Celula de tabela: preta e sem negrito, sempre.
 *
 * O peso e do cabecalho, que e cinza. Negrito no corpo tira do cabecalho a unica
 * marca que ele tem, e a tabela perde a hierarquia.
 */
function Td({
  children,
  direita,
}: {
  children: React.ReactNode;
  direita?: boolean;
}) {
  return (
    <td
      style={{
        padding: "2mm 0",
        textAlign: direita ? "right" : "left",
        verticalAlign: "top",
        fontSize: "8.5pt",
        fontWeight: 400,
        color: TINTA,
        lineHeight: 1.45,
        borderBottom: `0.3mm solid ${REGUA}`,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Resumo a direita, na largura da coluna de valores.
 *
 * E o que faz o total parecer parte da tabela e nao um bloco solto embaixo dela.
 */
function Resumo({
  linhas,
}: {
  linhas: { rotulo: string; valor: Centavos; forte?: boolean }[];
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2.5mm" }}>
      <div style={{ width: "56mm" }}>
        {linhas.map((l) => (
          <div
            key={l.rotulo}
            style={{
              display: "flex",
              justifyContent: "space-between",
              lineHeight: 1.7,
              fontSize: "8.5pt",
            }}
          >
            <span style={{ color: l.forte ? TINTA : CINZA, fontWeight: l.forte ? 700 : 400 }}>
              {l.rotulo}
            </span>
            <span style={{ color: TINTA, fontWeight: l.forte ? 700 : 400 }}>
              {formatarSemSimbolo(l.valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horas saem como "12h30" — o decimal é o formato de quem calcula, não de quem lê. */
function quantidade(q: number, unidade: ItemPublico["unidade"]): string {
  if (unidade === "H") {
    const minutos = Math.round(q * 60);
    const m = minutos % 60;
    return m === 0
      ? `${minutos / 60}h`
      : `${Math.floor(minutos / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(q) ? `${q} un` : `${q.toFixed(2).replace(".", ",")} un`;
}

