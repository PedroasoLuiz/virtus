import { BusinessRuleError } from "@/shared/errors/app-error";
import { logger } from "@/shared/utils/logger";
import * as repo from "@/modules/atendimento/personas.repository";
import * as iaRepo from "@/modules/ia/ia.repository";
import { responderEmJson } from "@/modules/ia/ia.cloud";
import { PERMISSOES, problemasDasPermissoes } from "@/modules/atendimento/permissoes";
import type { Persona } from "@/modules/atendimento/personas.types";

/** Regra de negocio das personas. */

export async function listar(empresaId: number): Promise<Persona[]> {
  return repo.listar(empresaId);
}

export async function salvar(
  empresaId: number,
  usuarioId: string,
  entrada: Parameters<typeof repo.salvar>[2],
): Promise<Persona> {
  /*
   * ⚠️ A geral nao pode consultar dado de cliente.
   *
   * Ela e quem atende quem chegou agora, antes de qualquer identificacao: dar a
   * ela uma consulta de saldo seria oferecer o dado a quem ainda nao provou ser
   * o dono dele. A tela ja esconde essas opcoes, mas a tela nao pode ser a
   * unica trava — um POST direto passaria por cima.
   */
  const problemas = problemasDasPermissoes(entrada.setorId, entrada.permissoes);
  if (problemas.length > 0) throw new BusinessRuleError(problemas[0]);

  try {
    return await repo.salvar(empresaId, usuarioId, entrada);
  } catch (err) {
    /*
     * ⚠️ A UNICIDADE da geral e do banco, e a mensagem dela e ilegivel.
     *
     * Deixar o indice falhar sozinho entregaria "duplicate key value violates
     * unique constraint" na tela. A regra e o indice porque duas abas abertas
     * salvando ao mesmo tempo furariam qualquer checagem feita antes.
     */
    if (String((err as { code?: string }).code) === "23505") {
      throw new BusinessRuleError(
        "Já existe uma persona geral para este número. A geral é uma só: dê um setor a esta, ou edite a que já existe.",
      );
    }

    throw err;
  }
}

export async function excluir(empresaId: number, id: number): Promise<void> {
  await repo.excluir(empresaId, id);
}

/** O que a persona sugerida devolve. Ver `pedirSugestao`. */
const ESQUEMA_DA_SUGESTAO = {
  type: "object",
  properties: {
    descricao: { type: "string" },
    permissoes: { type: "array", items: { type: "string" } },
  },
  required: ["descricao", "permissoes"],
};

/**
 * Pede a IA um rascunho de persona.
 *
 * ⚠️ Gasta a chave da EMPRESA, a mesma do atendimento. Por isso a credencial vem
 * escolhida: numa conta com uma chave por setor, o rascunho tem de sair na conta
 * de quem pediu, e nao na primeira que aparecer.
 *
 * ⚠️ O que volta e RASCUNHO, e nao cadastro. Nada e gravado aqui: o texto cai
 * nos campos e a pessoa revisa antes de salvar. Modelo escrevendo direto no
 * banco seria autorizar a IA a definir o que ela mesma pode fazer.
 */
export async function pedirSugestao(
  empresaId: number,
  credencialId: number,
  entrada: { setorNome: string | null; contexto: string },
): Promise<{ descricao: string; permissoes: string[] }> {
  const cred = await iaRepo.chaveParaTeste(credencialId);

  if (!cred) throw new BusinessRuleError("Chave de IA não encontrada nesta empresa.");

  const geral = entrada.setorNome == null;

  /*
   * As permissoes OFERECIDAS ao modelo ja vem filtradas pelo tipo de persona.
   * Mandar a lista inteira e depois recusar o que ele escolheu produziria um
   * rascunho que a tela recusa, sem a pessoa entender por que.
   */
  const oferecidas = PERMISSOES.filter((p) => !geral || !p.exigeIdentificacao);

  const instrucao = [
    "Você ajuda a escrever a configuração de um atendente virtual de WhatsApp de uma empresa brasileira.",
    "Devolva JSON com dois campos:",
    '- "descricao": como o atendente fala. Duas a quatro frases, em português do Brasil, na terceira pessoa. Descreve tom e postura, não o que ele resolve: o que ele resolve são as permissões.',
    '- "permissoes": os identificadores das consultas que fazem sentido, escolhidos SÓ da lista abaixo. Pode vir vazio.',
    "",
    "Consultas disponíveis:",
    ...oferecidas.map((p) => `- ${p.id}: ${p.rotulo}. ${p.descricao}`),
    "",
    geral
      ? "Esta é a persona GERAL, que atende quem acabou de chegar e ainda não se identificou. Ela nunca fala de valor, vencimento, boleto ou dado de cliente: acolhe, entende o assunto e encaminha."
      : `Esta persona é do setor "${entrada.setorNome}".`,
    "Nunca autorize falar de valor, vencimento, boleto ou dados bancários fora das consultas listadas.",
  ].join("\n");

  const resposta = await responderEmJson<{
    descricao: string;
    permissoes: string[];
  }>(
    {
      provedor: cred.provedor as "gemini" | "openai" | "anthropic" | "deepseek",
      modelo: cred.modelo,
      chave: cred.chave,
    },
    instrucao,
    entrada.contexto.trim(),
    ESQUEMA_DA_SUGESTAO,
  );

  if (!resposta) {
    throw new BusinessRuleError(
      "A IA não respondeu agora. Tente de novo, ou escreva a persona à mão.",
    );
  }

  logger.info("sugestao de persona gerada", { empresaId, credencialId });

  /*
   * ⚠️ Filtra o que voltou, mesmo tendo pedido so o permitido.
   *
   * Modelo inventa identificador, e uma permissao que nao existe viraria erro
   * na hora de salvar — depois de a pessoa ter revisado o texto e achado que
   * estava tudo certo.
   */
  const validas = new Set(oferecidas.map((p) => p.id));

  return {
    descricao: resposta.descricao ?? "",
    permissoes: (resposta.permissoes ?? []).filter((id) => validas.has(id)),
  };
}
