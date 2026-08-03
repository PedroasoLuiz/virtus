/**
 * Plataforma SaaS multiproduto.
 *
 * O modelo NAO e "produto por slug" — e plano com flags de modulo, e ja existe
 * no banco:
 *
 *     empresas  ->  assinaturas  ->  planos  ->  modulo_*
 *
 * `planos` tem Free / Starter / Pro / Enterprise, cada um habilitando um
 * conjunto de modulos. O VPay ocupa o modulo `financeiro`; SIC ocupa `os`,
 * `estoque` e `manutencao`. Uma empresa "assina varios produtos" subindo de
 * plano, nao acumulando assinaturas.
 *
 * ⚠️ A tabela `produtos` deste banco e produto de ESTOQUE (NCM, codigo de
 * barras, preco de custo). Nada a ver com produto SaaS.
 */

export const MODULOS = [
  "financeiro",
  "os",
  "manutencao",
  "estoque",
  "crm",
  "contratos",
  "chat",
] as const;

export type Modulo = (typeof MODULOS)[number];

/** Coluna de `planos` que habilita cada modulo. */
export const COLUNA_DO_MODULO: Record<Modulo, string> = {
  financeiro: "modulo_financeiro",
  os: "modulo_os",
  manutencao: "modulo_manutencao",
  estoque: "modulo_estoque",
  crm: "modulo_crm",
  contratos: "modulo_contratos",
  chat: "modulo_chat",
};

export const ROTULO_DO_MODULO: Record<Modulo, string> = {
  financeiro: "Financeiro",
  os: "Ordens de serviço",
  manutencao: "Manutenção",
  estoque: "Estoque",
  crm: "CRM",
  contratos: "Contratos",
  chat: "Chat",
};

export type Plano = {
  id: number;
  nome: string;
  descricao: string | null;
  precoMensal: number | null;
  precoAnual: number | null;
  destaque: boolean;
  ordem: number;
  modulos: Modulo[];
  limites: {
    usuarios: number | null;
    empresas: number | null;
    clientes: number | null;
    faturasMes: number | null;
    osMes: number | null;
    storageMb: number | null;
  };
};

export type StatusAssinatura = "trial" | "ativa" | "suspensa" | "cancelada";

export type Assinatura = {
  id: number;
  empresaId: number;
  plano: Plano;
  status: StatusAssinatura;
  periodicidade: string | null;
  inicio: string;
  fim: string | null;
  trialFim: string | null;
  canceladaEm: string | null;
};

/** O que a empresa tem hoje: plano vigente e modulos liberados. */
export type Entitlements = {
  plano: Plano | null;
  modulos: Modulo[];
  assinatura: Assinatura | null;
  /** Ligado quando nao ha assinatura e caiu no plano padrao. Ver o servico. */
  usandoPadrao: boolean;
};

/** Transicoes validas. Transicao fora deste mapa e erro, nao update silencioso. */
export const TRANSICOES: Record<StatusAssinatura, StatusAssinatura[]> = {
  trial: ["ativa", "cancelada"],
  ativa: ["suspensa", "cancelada"],
  suspensa: ["ativa", "cancelada"],
  cancelada: [],
};

export function podeTransicionar(de: StatusAssinatura, para: StatusAssinatura): boolean {
  return TRANSICOES[de].includes(para);
}
