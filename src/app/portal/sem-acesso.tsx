import { PageHeader, PageLayout, Panel } from "@/components/ui/kit";

/**
 * Login válido, sem cliente vinculado.
 *
 * Acontece de propósito: `usuariosxclientes` nasce vazia, então quem não foi
 * liberado não vê nada. A tela diz isso em vez de mostrar uma lista vazia, que
 * pareceria "você não tem cobrança nenhuma" — o oposto da verdade.
 */
export function SemAcesso() {
  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Minhas cobranças" />
        <div
          style={{
            padding: "40px 16px",
            textAlign: "center",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-base)",
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: "var(--fw-medium)", color: "var(--text-secondary)" }}>
            Seu acesso ainda não foi liberado
          </div>
          Nenhuma empresa está vinculada a este login. Fale com o financeiro para liberar.
        </div>
      </Panel>
    </PageLayout>
  );
}
