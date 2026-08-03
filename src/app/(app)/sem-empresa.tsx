import { Alert, PageHeader, PageLayout, Panel } from "@/components/ui/kit";

/**
 * Estado de "nenhuma empresa ativa".
 *
 * Existe porque `ctx.empresaId!` mentia: sem empresa, a consulta ia ao banco
 * com `fkEmpresa=eq.null` e o Postgres devolvia `22P02 invalid input syntax for
 * type bigint` cru na tela do usuario.
 */
export function SemEmpresa() {
  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Nenhuma empresa selecionada" />
        <div style={{ padding: 16 }}>
        <Alert variant="warning" title="Escolha uma empresa para continuar">
          <a href="/selecionar-empresa" style={{ color: "var(--primary)", fontWeight: 500 }}>
            Selecionar empresa
          </a>
        </Alert>
        </div>
      </Panel>
    </PageLayout>
  );
}
