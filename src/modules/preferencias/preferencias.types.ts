/**
 * Preferencias de interface do usuario.
 *
 * ⚠️ Sao do USUARIO e nao da empresa: quem trabalha em kanban continua em kanban
 * ao trocar de empresa. Por isso elas nao passam por `fkEmpresa` em lugar nenhum.
 */

export const VISOES = ["tabela", "kanban"] as const;

/**
 * Como as telas com quadro abrem.
 *
 * ⚠️ Uma escolha SO, para todas as telas. Havia um cookie por tela, com a ideia
 * de que o kanban de tickets e o de faturas eram decisoes diferentes. Na pratica
 * nao sao: quem trabalha olhando quadro quer quadro em tudo, e escolher de novo
 * em cada tela era o trabalho que a preferencia existe para poupar.
 */
export type Visao = (typeof VISOES)[number];

export function ehVisao(valor: unknown): valor is Visao {
  return typeof valor === "string" && (VISOES as readonly string[]).includes(valor);
}

export const VISAO_PADRAO: Visao = "tabela";
