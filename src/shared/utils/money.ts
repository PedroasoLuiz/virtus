/**
 * Dinheiro em centavos (inteiro). Float nunca representa valor monetario.
 *
 * O banco herdado guarda `double precision` (ver docs/03). A conversao acontece
 * na FRONTEIRA do repositorio: entrou no dominio, e centavo; saiu para o banco,
 * volta a reais. Quando as colunas migrarem para bigint, apaga-se `paraBanco` e
 * `doBanco` e nada mais muda.
 */

declare const marca: unique symbol;
/** Inteiro em centavos. O tipo impede somar centavos com reais por engano. */
export type Centavos = number & { readonly [marca]: "Centavos" };

export function centavos(valor: number): Centavos {
  if (!Number.isFinite(valor)) throw new Error(`Valor monetario invalido: ${valor}`);
  if (!Number.isInteger(valor)) throw new Error(`Centavos deve ser inteiro, recebido ${valor}`);
  return valor as Centavos;
}

export const ZERO = centavos(0);

/** Reais -> centavos. Arredonda no meio para cima, como o usuario espera. */
export function deReais(reais: number): Centavos {
  if (!Number.isFinite(reais)) throw new Error(`Valor monetario invalido: ${reais}`);
  return centavos(Math.round(reais * 100));
}

export function paraReais(v: Centavos): number {
  return v / 100;
}

/** Le "1.234,56" ou "1234.56" do usuario. Retorna null se nao for numero. */
export function deTexto(entrada: string): Centavos | null {
  const limpo = entrada.trim().replace(/[R$\s]/g, "");
  if (!limpo) return null;
  // pt-BR: ponto e milhar, virgula e decimal.
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? deReais(n) : null;
}

export function somar(...valores: Centavos[]): Centavos {
  return centavos(valores.reduce((acc, v) => acc + v, 0));
}

export function subtrair(a: Centavos, b: Centavos): Centavos {
  return centavos(a - b);
}

export function multiplicar(v: Centavos, fator: number): Centavos {
  return centavos(Math.round(v * fator));
}

/**
 * Divide preservando o total: distribui o resto de 1 centavo entre as primeiras
 * parcelas. `dividir(1000, 3)` -> [334, 333, 333], soma exatamente 1000.
 *
 * O legado fazia diferente (jogava toda a diferenca na ULTIMA parcela). Mantido
 * o invariante "soma == total", mas distribuido — evita a ultima parcela sair
 * visivelmente diferente das outras. Ver docs/04 §1.
 */
export function dividir(total: Centavos, partes: number): Centavos[] {
  if (!Number.isInteger(partes) || partes < 1) {
    throw new Error(`Numero de partes invalido: ${partes}`);
  }
  const base = Math.floor(total / partes);
  const resto = total - base * partes;
  return Array.from({ length: partes }, (_, i) => centavos(base + (i < resto ? 1 : 0)));
}

const FORMATADOR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatar(v: Centavos): string {
  return FORMATADOR.format(paraReais(v));
}

/** Sem simbolo de moeda — para colunas de tabela alinhadas a direita. */
export function formatarSemSimbolo(v: Centavos): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paraReais(v));
}

// ── Fronteira com o banco herdado (colunas `double precision`) ──────────────

export function doBanco(valor: number | null | undefined): Centavos {
  if (valor == null) return ZERO;
  return deReais(valor);
}

export function paraBanco(v: Centavos): number {
  return paraReais(v);
}
