import { notFound } from "next/navigation";
import { parcelaPorToken } from "@/modules/publico/publico.repository";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses } from "@/shared/utils/datas";

/**
 * A página que o cliente abre pelo link do e-mail.
 *
 * Fora de `(app)`: não tem menu, não tem sessão, não tem empresa ativa. Quem
 * chega aqui não é usuário do VPay — é quem recebeu uma cobrança.
 *
 * Mostra o mínimo que identifica a parcela e os botões de download. Nada de
 * cliente, CNPJ ou histórico: um link que vaza não pode virar um raio-x.
 */

export const metadata = { title: "Seus documentos" };

/** Nunca em cache: o link é revogável, e cache serviria a página depois disso. */
export const dynamic = "force-dynamic";

const VERDE = "#006A28";

export default async function DocumentosPublicosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parcela = await parcelaPorToken(token).catch(() => null);

  // 404 e não uma tela de erro: quem tem link inválido não precisa saber se o
  // token existiu um dia.
  if (!parcela) notFound();

  const competencia = periodoEmMeses(parcela.competenciaDe, parcela.competenciaAte);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f7f6",
        padding: "40px 16px",
        fontFamily: "var(--font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        color: "#1a1a1a",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            padding: "32px 24px",
          }}
        >
          <h1
            style={{
              color: VERDE,
              fontSize: 20,
              fontWeight: 700,
              textAlign: "center",
              margin: "0 0 8px",
            }}
          >
            Seus documentos estão aqui
          </h1>

          {competencia && (
            <p style={{ textAlign: "center", color: "#6b6b6b", fontSize: 15, margin: "0 0 4px" }}>
              Referente ao fechamento: <strong style={{ color: "#1f1f1f" }}>{competencia}</strong>
            </p>
          )}
          <p
            style={{
              textAlign: "center",
              color: VERDE,
              fontSize: 15,
              fontWeight: 600,
              margin: "0 0 24px",
            }}
          >
            {parcela.empresaNome}
          </p>

          <Linha rotulo="Fatura" valor={String(parcela.faturaNumero)} />
          <Linha rotulo="Parcela" valor={String(parcela.parcelaNumero)} />
          <Linha
            rotulo="Vencimento"
            valor={parcela.vencimento ? paraFormatoBR(parcela.vencimento) : "—"}
          />
          <Linha rotulo="Valor" valor={formatarSemSimbolo(parcela.total)} destaque />

          {parcela.pago && (
            <p
              style={{
                margin: "20px 0 0",
                padding: "10px 14px",
                borderRadius: 8,
                background: "#eef7f0",
                color: VERDE,
                fontSize: 14,
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              Esta parcela já consta como paga.
            </p>
          )}

          <div style={{ margin: "28px 0 0" }}>
            {parcela.temNfs && <Botao href={`/p/${token}/documento?tipo=nfs`}>Baixar nota fiscal</Botao>}
            {parcela.temBoleto && <Botao href={`/p/${token}/documento?tipo=boleto`}>Baixar boleto</Botao>}
            {!parcela.temNfs && !parcela.temBoleto && (
              <p style={{ textAlign: "center", color: "#6b6b6b", fontSize: 14 }}>
                Nenhum documento disponível no momento.
              </p>
            )}
          </div>

          {!parcela.pago && (
            <p
              style={{
                margin: "24px 0 0",
                color: "#444444",
                fontSize: 14,
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              Pedimos a gentileza de efetuar o pagamento até a data de vencimento.
              <br />
              Caso já tenha pago, favor desconsiderar.
            </p>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#7a7a7a",
            fontSize: 13,
            lineHeight: 1.6,
            marginTop: 24,
          }}
        >
          <strong>V-Pay</strong>, o seu gerenciador financeiro
        </p>
      </div>
    </main>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "9px 0",
        borderTop: "1px solid #f0f0f0",
      }}
    >
      <span style={{ color: "#6b6b6b", fontSize: 14 }}>{rotulo}</span>
      <span
        style={{
          fontSize: destaque ? 18 : 14,
          fontWeight: destaque ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </div>
  );
}

function Botao({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 300,
        margin: "10px auto",
        background: VERDE,
        color: "#ffffff",
        textDecoration: "none",
        padding: "14px 28px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        textAlign: "center",
      }}
    >
      {children}
    </a>
  );
}
