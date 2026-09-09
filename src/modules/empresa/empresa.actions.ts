"use server";

import { revalidatePath } from "next/cache";
import { contextoAtual } from "@/shared/auth/contexto";
import { isAppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import * as service from "@/modules/empresa/empresa.service";
import { cadastroDaEmpresaSchema } from "@/modules/empresa/empresa.schema";
import type {
  ArmazenamentoDaEmpresa,
  CadastroDaEmpresa,
  EdicaoDaEmpresa,
} from "@/modules/empresa/empresa.types";

/**
 * Fronteira do cadastro da empresa.
 *
 * ⚠️ A empresa vem do CONTEXTO, nunca do cliente. A gaveta nao manda id nenhum:
 * ela edita a empresa em que a pessoa esta operando, e e o cookie de tenant,
 * conferido no `contextoAtual`, que diz qual e.
 */

export type RespostaDaEmpresa = { erro: string | null };

/**
 * ⚠️ Carrega SOB DEMANDA, e nao junto do layout.
 *
 * O cadastro so interessa a quem abriu a gaveta, e ela se abre uma vez por mes.
 * Passando pelo layout, toda navegacao do sistema pagaria uma leitura a mais
 * para um formulario que quase ninguem abre.
 */
export async function carregarEmpresaAction(): Promise<
  | { empresa: CadastroDaEmpresa; armazenamento: ArmazenamentoDaEmpresa | null; erro: null }
  | { empresa: null; armazenamento: null; erro: string }
> {
  try {
    const ctx = await contextoAtual({ exigirSessao: true });
    if (!ctx.empresaId) {
      return { empresa: null, armazenamento: null, erro: "Nenhuma empresa ativa." };
    }

    /* Em paralelo: sao duas perguntas independentes, e em fila a gaveta abriria
       depois da soma do bucket sem ganhar nada com isso. */
    const [empresa, armazenamento] = await Promise.all([
      service.cadastro(ctx.empresaId),
      service.armazenamento(ctx.empresaId),
    ]);

    return { empresa, armazenamento, erro: null };
  } catch (err) {
    if (isAppError(err)) return { empresa: null, armazenamento: null, erro: err.message };

    logger.error("falha ao carregar cadastro da empresa", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return {
      empresa: null,
      armazenamento: null,
      erro: "Não foi possível abrir o cadastro da empresa.",
    };
  }
}

export async function salvarEmpresaAction(dados: EdicaoDaEmpresa): Promise<RespostaDaEmpresa> {
  const entrada = cadastroDaEmpresaSchema.safeParse(dados);
  if (!entrada.success) {
    return { erro: entrada.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const ctx = await contextoAtual({ exigirSessao: true });
    if (!ctx.empresaId) return { erro: "Nenhuma empresa ativa." };

    await service.salvar(ctx.empresaId, entrada.data);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };

    logger.error("falha ao salvar cadastro da empresa", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Não foi possível salvar o cadastro." };
  }

  /* O nome e a marca da empresa aparecem no cartao do topo da barra e no
     cabecalho de todo PDF: o cache do layout inteiro cai junto. */
  revalidatePath("/", "layout");
  return { erro: null };
}

/**
 * A marca da empresa.
 *
 * ⚠️ `FormData` e nao um objeto: e por ela que o arquivo atravessa a fronteira
 * da Server Action. Um `File` solto num argumento nao sobrevive a serializacao.
 */
export async function trocarLogoAction(form: FormData): Promise<{ erro: string | null }> {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Escolha um arquivo de imagem." };
  }

  try {
    const ctx = await contextoAtual({ exigirSessao: true });
    if (!ctx.empresaId) return { erro: "Nenhuma empresa ativa." };

    await service.trocarLogo(ctx.empresaId, arquivo);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao trocar a marca da empresa", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Não foi possível enviar a marca." };
  }

  revalidatePath("/", "layout");
  return { erro: null };
}

export async function removerLogoAction(): Promise<{ erro: string | null }> {
  try {
    const ctx = await contextoAtual({ exigirSessao: true });
    if (!ctx.empresaId) return { erro: "Nenhuma empresa ativa." };

    await service.removerLogo(ctx.empresaId);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao remover a marca da empresa", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Não foi possível remover a marca." };
  }

  revalidatePath("/", "layout");
  return { erro: null };
}

export async function enviarCertificadoAction(form: FormData): Promise<{ erro: string | null }> {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Escolha o arquivo do certificado." };
  }

  try {
    const ctx = await contextoAtual({ exigirSessao: true });
    if (!ctx.empresaId) return { erro: "Nenhuma empresa ativa." };

    await service.enviarCertificado(ctx.empresaId, arquivo);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao enviar certificado", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Não foi possível enviar o certificado." };
  }

  return { erro: null };
}

export async function removerCertificadoAction(
  caminho: string,
): Promise<{ erro: string | null }> {
  try {
    const ctx = await contextoAtual({ exigirSessao: true });
    if (!ctx.empresaId) return { erro: "Nenhuma empresa ativa." };

    await service.removerCertificado(ctx.empresaId, caminho);
  } catch (err) {
    if (isAppError(err)) return { erro: err.message };
    logger.error("falha ao remover certificado", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { erro: "Não foi possível remover o certificado." };
  }

  return { erro: null };
}
