import { z } from "zod";
import type { Entrada } from "@/shared/http/handler";
import { created, ok } from "@/shared/http/response";
import { empresaObrigatoria } from "@/shared/auth/contexto";
import * as service from "@/modules/insights/insights.service";
import { chaveDeTexto } from "@/shared/domain/insights";
import { BusinessRuleError } from "@/shared/errors/app-error";
import {
  acessoSchema,
  conexaoSchema,
  contasDisponiveisSchema,
  paginaSchema,
  paginasDisponiveisSchema,
  painelDoClienteSchema,
  type AtualizarConexaoBody,
  type ConectarContasBody,
  type ContasDisponiveisBody,
  type LigarPaginasBody,
  type PaginasDisponiveisBody,
  type IdParam,
  type PainelQuery,
  type RenovarAcessoBody,
} from "@/modules/insights/insights.schema";

/** Traduz HTTP <-> servico. Nenhuma decisao de negocio aqui. */

export async function listar({ ctx }: Entrada<undefined, undefined, unknown>) {
  const conexoes = await service.listarConexoes(empresaObrigatoria(ctx));
  return ok(conexoes.map((c) => conexaoSchema.parse(c)));
}

export async function listarAcessos({ ctx }: Entrada<undefined, undefined, unknown>) {
  const acessos = await service.listarAcessos(empresaObrigatoria(ctx));
  return ok(acessos.map((a) => acessoSchema.parse(a)));
}

/**
 * O que o acesso enxerga na Meta.
 *
 * ⚠️ E POST, e nao GET, porque o token pode vir no corpo. Numa query ele
 * apareceria no historico do navegador e no log de qualquer proxy no caminho —
 * credencial nao viaja em URL, nem em consulta.
 */
export async function contasDisponiveis({
  body,
  ctx,
}: Entrada<ContasDisponiveisBody, undefined, unknown>) {
  const dados = await service.contasDisponiveis(empresaObrigatoria(ctx), {
    token: body.token ?? null,
    acessoId: body.acessoId ?? null,
  });

  return ok(contasDisponiveisSchema.parse(dados));
}

export async function conectarContas({
  body,
  ctx,
}: Entrada<ConectarContasBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.conectarContas(
    empresaId,
    { token: body.token ?? null, acessoId: body.acessoId ?? null },
    body.contas.map((c) => ({
      adAccountId: c.adAccountId,
      nome: c.nome ?? null,
      clienteId: c.clienteId ?? null,
    })),
  );

  /*
   * ⚠️ Devolve a LISTA, e nao o que acabou de ser gravado. Nada aqui carrega o
   * token, e responder com o objeto recem-criado seria mais um lugar por onde
   * ele poderia escapar se alguem acrescentasse o campo no tipo um dia.
   */
  const conexoes = await service.listarConexoes(empresaId);
  return created(conexoes.map((c) => conexaoSchema.parse(c)));
}

export async function renovarAcesso({
  params,
  body,
  ctx,
}: Entrada<RenovarAcessoBody, undefined, IdParam>) {
  const acesso = await service.renovarAcesso(
    empresaObrigatoria(ctx),
    params.id,
    body.token,
  );

  return ok(acessoSchema.parse(acesso));
}

export async function atualizar({
  params,
  body,
  ctx,
}: Entrada<AtualizarConexaoBody, undefined, IdParam>) {
  const empresaId = empresaObrigatoria(ctx);

  /*
   * ⚠️ Repassa so o que veio no corpo, e nao um objeto completo com `undefined`
   * nos ausentes. O repositorio decide o `patch` por presenca de chave: montar o
   * objeto inteiro aqui faria uma mudanca de situacao apagar o cliente.
   */
  const mudancas: { clienteId?: number | null; ativo?: boolean } = {};
  if ("clienteId" in body) mudancas.clienteId = body.clienteId ?? null;
  if ("ativo" in body) mudancas.ativo = body.ativo;

  const conexao = await service.atualizarConexao(empresaId, params.id, mudancas);
  return ok(conexaoSchema.parse(conexao));
}

export async function painel({ query, ctx }: Entrada<undefined, PainelQuery, unknown>) {
  /*
   * ⚠️ A chave volta a ser tipo pela funcao de dominio, e nao por um `Number()`
   * aqui. O schema garante o FORMATO; quem sabe que `"sem"` e um alvo legitimo e
   * o dominio, e a tela usa a mesma funcao para ler a URL dela.
   */
  const chave = chaveDeTexto(query.cliente);
  if (chave == null) throw new BusinessRuleError("Cliente inválido");

  const dados = await service.painelDoCliente(empresaObrigatoria(ctx), chave, {
    de: query.de,
    ate: query.ate,
  });

  /*
   * ⚠️ O tipo passa pela ENTRADA do schema antes do `parse`, e isto e o que
   * impede o erro voltar.
   *
   * `parse` recebe `unknown`, entao um campo a mais ou a menos no schema nao e
   * erro de compilacao: ele so aparece em producao como "Dados invalidos", sem
   * dizer qual campo. Foi assim duas vezes seguidas. Amarrando o objeto ao tipo
   * de entrada do Zod, a divergencia vira erro do `tsc` antes de existir.
   */
  const saida: z.input<typeof painelDoClienteSchema> = dados;

  return ok(painelDoClienteSchema.parse(saida));
}

export async function listarPaginas({ ctx }: Entrada<undefined, undefined, unknown>) {
  const paginas = await service.listarPaginas(empresaObrigatoria(ctx));
  return ok(paginas.map((p) => paginaSchema.parse(p)));
}

export async function paginasDisponiveis({
  body,
  ctx,
}: Entrada<PaginasDisponiveisBody, undefined, unknown>) {
  const dados = await service.paginasDisponiveis(empresaObrigatoria(ctx), {
    token: body.token ?? null,
    acessoId: body.acessoId ?? null,
  });

  return ok(paginasDisponiveisSchema.parse(dados));
}

export async function ligarPaginas({ body, ctx }: Entrada<LigarPaginasBody, undefined, unknown>) {
  const empresaId = empresaObrigatoria(ctx);

  await service.ligarPaginas(
    empresaId,
    body.acessoId,
    body.paginas.map((p) => ({
      pageId: p.pageId,
      nome: p.nome ?? null,
      igUserId: p.igUserId ?? null,
      igUsername: p.igUsername ?? null,
      clienteId: p.clienteId ?? null,
    })),
  );

  const paginas = await service.listarPaginas(empresaId);
  return created(paginas.map((p) => paginaSchema.parse(p)));
}
