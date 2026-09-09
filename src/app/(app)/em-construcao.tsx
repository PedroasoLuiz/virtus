import { PageHeader, PageLayout, Panel } from "@/components/ui/kit";

/**
 * Tela ainda nao implementada.
 *
 * Existe para que o item do menu leve a algum lugar honesto em vez de 404 — e
 * para deixar visivel o que falta, em vez de esconder atras de um link morto.
 * Nao inventa dado: diz o que a tela vai mostrar e o que falta para isso.
 */
export function EmConstrucao({
  titulo,
  descricao,
  pendencias,
}: {
  titulo: string;
  descricao: string;
  pendencias: string[];
}) {
  return (
    <PageLayout>
      <Panel>
        <PageHeader title={titulo} />
        <div style={{ padding: 16 }}>
          {/* ⚠️ A descricao mora AQUI, e nao no cabecalho: la ela empurrava o
              cartao branco para baixo e desalinhava a tela com a barra lateral.
              Dentro do quadro tracejado ela ainda e a primeira coisa que se le, e
              agora fica junto do que falta, que e o assunto dela. */}
          <div
            style={{
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              background: "var(--surface-2)",
            }}
          >
            <div className="rotulo" style={{ marginBottom: 6 }}>
              Ainda não implementado
            </div>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: "var(--text-md)",
                color: "var(--text-primary)",
                lineHeight: "var(--lh-snug)",
              }}
            >
              {descricao}
            </p>
            <ul
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: "var(--text-base)",
                color: "var(--text-secondary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              {pendencias.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </PageLayout>
  );
}
