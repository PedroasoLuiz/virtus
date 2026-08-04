import { redirect } from "next/navigation";
import { PageHeader, PageLayout, Panel } from "@/components/ui/kit";
import { carteira } from "@/modules/portal/portal.service";
import { emitenteEscolhido, escolherEmitente } from "../emitente";

/**
 * De qual empresa o cliente quer ver a cobrança.
 *
 * Espelha o "trocar de empresa" do sistema, e chega pelo mesmo lugar: o menu do
 * usuário, no rodapé da barra lateral. A diferença é o que se escolhe — lá é o
 * tenant que se administra, aqui é quem está cobrando.
 *
 * Uma por vez, e não "todas": cobrança da Virtus e cobrança da PMX são acordos
 * separados, com documento e conta bancária próprios. Somadas num quadro só, o
 * total não corresponde a nada que ele possa pagar de uma vez.
 */
export default async function EscolherEmpresaPage() {
  const { emitentes } = await carteira(await emitenteEscolhido());

  // Com um emitente só não há decisão a tomar, e a tela seria um beco.
  if (emitentes.length <= 1) redirect("/portal");

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Escolher empresa" />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
          <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: 0 }}>
            Você é atendido por mais de uma empresa. Escolha de qual quer ver as cobranças.
          </p>

          {emitentes.map((e) => (
            <form key={e.id} action={escolherEmitente}>
              <input type="hidden" name="emitenteId" value={e.id} />
              <button
                type="submit"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-base)",
                  fontFamily: "var(--font)",
                  fontWeight: "var(--fw-medium)",
                  cursor: "pointer",
                }}
              >
                {e.nome}
              </button>
            </form>
          ))}
        </div>
      </Panel>
    </PageLayout>
  );
}
