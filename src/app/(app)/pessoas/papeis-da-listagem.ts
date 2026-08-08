import type { PapelPessoa } from "@/modules/clientes/clientes.types";

/*
 * Os papeis, com a sigla e a cor de cada um.
 *
 * ⚠️ A cor segue o DINHEIRO, e nao um sorteio: cliente e entrada (verde),
 * fornecedor, transportadora e corretor sao saida (ambar), colaborador nao e nem
 * uma coisa nem outra (azul). Quem varre a coluna ve de que lado o dinheiro esta
 * sem ler as siglas.
 */
export type PapelVisual = {
  valor: PapelPessoa;
  /** Plural: ele nomeia o recorte do filtro, nao um registro. */
  rotulo: string;
  sigla: string;
  fundo: string;
  texto: string;
};

export const PAPEIS: PapelVisual[] = [
  {
    valor: "cliente",
    rotulo: "Clientes",
    sigla: "CLI",
    fundo: "var(--success-bg)",
    texto: "var(--success-text)",
  },
  {
    valor: "fornecedor",
    rotulo: "Fornecedores",
    sigla: "FOR",
    fundo: "var(--warning-bg)",
    texto: "var(--warning-text)",
  },
  {
    valor: "colaborador",
    rotulo: "Colaboradores",
    sigla: "COL",
    fundo: "var(--info-bg)",
    texto: "var(--info-text)",
  },
  /*
   * ⚠️ Transportadora e corretor repetem o AMBAR do fornecedor de proposito.
   *
   * A cor nao diz qual e o papel, diz de que lado o dinheiro esta: frete se paga
   * e comissao se paga. Dando uma cor propria a cada um, a coluna viraria um
   * mostruario de cinco cores e deixaria de responder "entra ou sai" numa
   * olhada. Quem precisa do papel exato le a sigla, que fica sempre no mesmo
   * lugar da linha.
   */
  {
    valor: "transportadora",
    rotulo: "Transportadoras",
    sigla: "TRA",
    fundo: "var(--warning-bg)",
    texto: "var(--warning-text)",
  },
  {
    valor: "corretor",
    rotulo: "Corretores",
    sigla: "COR",
    fundo: "var(--warning-bg)",
    texto: "var(--warning-text)",
  },
];

