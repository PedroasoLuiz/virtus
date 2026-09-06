import { sessaoUI } from "@/shared/auth/sessao-ui";
import { listarFaturas } from "@/modules/faturas/faturas.service";
import { SemEmpresa } from "../sem-empresa";
import { FaturasTabela } from "./faturas-tabela";

/**
 * Server Component: chama o SERVICO do modulo direto, sem passar por HTTP.
 * A rota /api/v1/faturas existe para consumidores externos, nao para a tela.
 */
export default async function FaturasPage() {
  const { ctx, usuarioNome, visao } = await sessaoUI();
  if (ctx.empresaId == null) return <SemEmpresa />;

  /*
   * ⚠️ A pagina NAO carrega mais os clientes.
   *
   * Ela trazia a arvore inteira para preencher um `<select>` no drawer de nova
   * conta: numa base com vinte mil clientes ativos, sao vinte mil linhas no HTML
   * para escolher uma. O drawer passou a perguntar ao servidor conforme se
   * digita, como o da baixa ja fazia.
   */
  const { itens } = await listarFaturas(
    ctx.empresaId,
    {},
    { page: 1, perPage: 100 },
  );

  return (
    <FaturasTabela
      faturas={itens}
      emitidoPor={usuarioNome ?? ""}
      visaoInicial={visao}
    />
  );
}
