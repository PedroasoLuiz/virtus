import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarPlanos } from "@/modules/plataforma/plataforma.service";
import { Alert, Badge, PageHeader, PageLayout, Panel } from "@/components/ui/kit";
import { MODULOS, ROTULO_DO_MODULO } from "@/modules/plataforma/plataforma.types";

/**
 * Plano e modulos.
 *
 * Substitui a tela de "produtos" que eu havia inventado: o que a empresa
 * contrata e um PLANO, e sao as flags `modulo_*` do plano que liberam cada
 * area do sistema.
 */
export default async function PlanoPage() {
  const { entitlements } = await sessaoUI();
  const planos = await listarPlanos();
  const ativos = new Set(entitlements.modulos);

  return (
    <PageLayout>
      <Panel>
        <PageHeader
        title="Plano e módulos"
        description={
          entitlements.plano ? `Plano atual: ${entitlements.plano.nome}` : "Nenhum plano identificado"
        }
        />

        <div style={{ padding: 16, overflowY: "auto" }}>
        {entitlements.usandoPadrao && (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="warning" title="Empresa sem assinatura cadastrada">
              A tabela <code>assinaturas</code> não tem registro para esta empresa. Enquanto isso,
              o acesso segue o plano de entrada ({entitlements.plano?.nome ?? "nenhum"}). Cadastre a
              assinatura para o plano real valer.
            </Alert>
          </div>
        )}

        <section style={{ marginBottom: 24 }}>
          <div className="rotulo" style={{ marginBottom: 10 }}>
            Módulos liberados
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MODULOS.map((m) => (
              <Badge key={m} tom={ativos.has(m) ? "success" : "neutral"}>
                {ROTULO_DO_MODULO[m]}
              </Badge>
            ))}
          </div>
        </section>

        <div className="rotulo" style={{ marginBottom: 10 }}>
          Planos disponíveis
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 12,
          }}
        >
          {planos.map((p) => {
            const atual = entitlements.plano?.id === p.id;

            return (
              <div
                key={p.id}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${atual ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <h2
                    style={{
                      fontSize: "var(--text-xl)",
                      fontWeight: "var(--fw-semi)",
                      letterSpacing: "var(--tracking-snug)",
                    }}
                  >
                    {p.nome}
                  </h2>
                  {atual && <Badge tom="success">Atual</Badge>}
                </div>

                <div
                  style={{
                    fontSize: "var(--text-2xl)",
                    fontWeight: "var(--fw-semi)",
                    fontVariantNumeric: "tabular-nums",
                    marginBottom: 12,
                  }}
                >
                  {preco(p.precoMensal)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.modulos.map((m) => (
                    <span
                      key={m}
                      style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)" }}
                    >
                      • {ROTULO_DO_MODULO[m]}
                    </span>
                  ))}
                </div>

                {p.limites.usuarios != null && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                      fontSize: "var(--text-sm)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Até {p.limites.usuarios} usuários
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </Panel>
    </PageLayout>
  );
}

function preco(mensal: number | null): string {
  if (mensal == null) return "—";
  // Enterprise vem com 0 no banco por ser negociado, mas "Grátis" e o rotulo
  // certo apenas para o Free. Aqui o 0 significa "sob consulta" no Enterprise —
  // decidir com o comercial; por ora o texto e neutro.
  if (mensal === 0) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(mensal);
}
