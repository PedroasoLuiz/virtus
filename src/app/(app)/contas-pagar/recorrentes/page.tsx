import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarContratos } from "@/modules/contratos/contratos.service";
import { arvoreDeClientes } from "@/modules/clientes/clientes.repository";
import { SemEmpresa } from "../../sem-empresa";
import { ContratosTela } from "../../contratos/contratos-tela";

/**
 * As despesas que se repetem: aluguel, contador, energia, licenca de software.
 *
 * ⚠️ Reusa `contratos` e a tela dele, e nao um modelo proprio. A tabela ja tem
 * `periodicidade`, `dia_vencimento` e `proxima_competencia`, mais o historico em
 * `contratoscompetencias` — o motor de recorrencia esta escrito e rodando. O que
 * faltava era dizer de que lado o dinheiro corre, e isso agora e `natureza`.
 *
 * Uma tabela propria duplicaria esse motor, e a segunda copia divergiria da
 * primeira no primeiro ajuste de virada de mes.
 */
export default async function RecorrentesPage() {
  const { ctx } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  // Inativos vem na consulta: a lista e curta, e o que ja encerrou continua
  // sendo consultado para explicar despesa antiga.
  const [contratos, pessoas] = await Promise.all([
    listarContratos(ctx.empresaId, true, "DESPESA"),
    arvoreDeClientes(ctx.empresaId),
  ]);

  return (
    <ContratosTela
      contratos={contratos}
      clientes={pessoas.map((c) => ({ id: c.id, nome: c.nome }))}
      natureza="DESPESA"
    />
  );
}
