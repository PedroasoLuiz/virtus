import { carteira } from "@/modules/portal/portal.service";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";

/**
 * O que o cliente deve, e onde ele pega o documento.
 *
 * Server Component chamando o serviço direto. Não há rota de API para o portal:
 * ela seria uma segunda porta para o mesmo dado, e cada porta é uma superfície a
 * mais para conferir.
 *
 * ⚠️ Nenhum número de conta a receber aparece aqui. A conta é controle interno;
 * o que o cliente conhece é o ticket e o vencimento (ver docs/10).
 */
export default async function PortalPage() {
  const { clientes, parcelas, emAberto, vencido } = await carteira();

  if (clientes.length === 0) {
    return (
      <Aviso titulo="Seu acesso ainda não foi liberado">
        Nenhum cliente está vinculado a este login. Fale com o financeiro da Virtus
        para liberar.
      </Aviso>
    );
  }

  const abertas = parcelas.filter((p) => !p.pago);
  const pagas = parcelas.filter((p) => p.pago);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Cartao rotulo="Em aberto" valor={emAberto} />
        {/* Vencido só aparece quando existe: um "R$ 0,00 vencido" permanente
            ensina a ignorar o cartão justamente quando ele passa a importar. */}
        {vencido > 0 && <Cartao rotulo="Vencido" valor={vencido} alerta />}
      </div>

      <Secao titulo="Em aberto" vazio="Nada em aberto por aqui.">
        {abertas.map((p) => (
          <Linha key={p.parcelaId} parcela={p} />
        ))}
      </Secao>

      {pagas.length > 0 && (
        <Secao titulo="Já pagas" vazio="">
          {pagas.map((p) => (
            <Linha key={p.parcelaId} parcela={p} />
          ))}
        </Secao>
      )}

      {clientes.length > 1 && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Mostrando as cobranças de {clientes.map((c) => c.nome).join(", ")}.
        </p>
      )}
    </div>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

type Parcela = Awaited<ReturnType<typeof carteira>>["parcelas"][number];

/**
 * Uma cobrança.
 *
 * O clique inteiro leva à página pública `/p/{token}`, que já existe, já mostra
 * o documento no formato impresso e já serve boleto e nota. Reaproveitá-la evita
 * uma segunda tela de detalhe — e uma segunda forma de errar a permissão do
 * arquivo, já que lá o token é a credencial.
 */
function Linha({ parcela }: { parcela: Parcela }) {
  const conteudo = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: "var(--fw-medium)" }}>
          {parcela.tickets.length > 0
            ? `Ticket ${parcela.tickets.join(", ")}`
            : "Cobrança"}
          {parcela.totalParcelas > 1 && (
            <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
              {" "}
              · parcela {parcela.numero} de {parcela.totalParcelas}
            </span>
          )}
        </span>

        <span
          style={{
            fontSize: "var(--text-sm)",
            color: parcela.atrasada ? "var(--danger-text)" : "var(--text-tertiary)",
            fontWeight: parcela.atrasada ? "var(--fw-medium)" : 400,
          }}
        >
          {parcela.pago
            ? "Pago"
            : parcela.vencimento
              ? `${parcela.atrasada ? "Venceu" : "Vence"} em ${paraFormatoBR(parcela.vencimento as DataISO)}`
              : "Sem vencimento"}
          {parcela.temBoleto && " · boleto disponível"}
          {parcela.temNota && " · nota fiscal"}
        </span>
      </span>

      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: "var(--fw-semi)",
          whiteSpace: "nowrap",
          color: parcela.pago ? "var(--text-tertiary)" : "var(--text-primary)",
        }}
      >
        {formatarSemSimbolo(parcela.pago ? parcela.total : parcela.emAberto)}
      </span>
    </>
  );

  const estilo: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: "var(--radius-md)",
    background: "var(--surface)",
    border: `1px solid ${parcela.atrasada ? "var(--danger-border)" : "var(--border)"}`,
    color: "var(--text-primary)",
    textDecoration: "none",
  };

  // Sem token não há para onde ir: registro antigo pode não ter. A linha
  // continua informando, só não clica.
  return parcela.token ? (
    <a href={`/p/${parcela.token}`} style={estilo}>
      {conteudo}
    </a>
  ) : (
    <div style={estilo}>{conteudo}</div>
  );
}

function Secao({
  titulo,
  vazio,
  children,
}: {
  titulo: string;
  vazio: string;
  children: React.ReactNode[];
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-medium)",
          color: "var(--text-tertiary)",
          margin: 0,
        }}
      >
        {titulo}
      </h2>

      {children.length === 0 && vazio ? (
        <Aviso titulo="">{vazio}</Aviso>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
      )}
    </section>
  );
}

function Cartao({ rotulo, valor, alerta }: { rotulo: string; valor: Centavos; alerta?: boolean }) {
  return (
    <div
      style={{
        minWidth: 180,
        padding: "12px 16px",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        border: `1px solid ${alerta ? "var(--danger-border)" : "var(--border)"}`,
      }}
    >
      <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
        {rotulo}
      </div>
      <div
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--fw-semi)",
          fontVariantNumeric: "tabular-nums",
          color: alerta ? "var(--danger-text)" : "var(--text-primary)",
        }}
      >
        {formatarSemSimbolo(valor)}
      </div>
    </div>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        color: "var(--text-tertiary)",
        fontSize: "var(--text-base)",
        lineHeight: 1.6,
      }}
    >
      {titulo && (
        <div style={{ fontWeight: "var(--fw-medium)", color: "var(--text-secondary)" }}>
          {titulo}
        </div>
      )}
      {children}
    </div>
  );
}
