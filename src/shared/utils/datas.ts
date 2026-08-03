/**
 * Datas e dias uteis.
 *
 * Substitui a lista de feriados de 2025 hardcoded em dois arquivos do legado
 * (docs/04 §1) — que quebraria sozinha na virada do ano. Aqui os moveis sao
 * calculados a partir da Pascoa, entao vale para qualquer ano.
 *
 * Todas as datas do dominio circulam como `YYYY-MM-DD` (string), nunca como
 * `Date`: fuso horario em data de vencimento so causa bug.
 */

export type DataISO = string; // YYYY-MM-DD

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function ehDataISO(v: string): v is DataISO {
  return ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export function hoje(): DataISO {
  return paraISO(new Date());
}

export function paraISO(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

/** Trabalha em UTC de proposito: aritmetica de calendario sem horario de verao. */
function paraUTC(data: DataISO): Date {
  return new Date(`${data}T00:00:00Z`);
}

export function somarDias(data: DataISO, dias: number): DataISO {
  const d = paraUTC(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

export function somarMeses(data: DataISO, meses: number): DataISO {
  const d = paraUTC(data);
  const diaOriginal = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  // 31/01 + 1 mes = 28/02, nao 03/03.
  const ultimoDia = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(diaOriginal, ultimoDia));
  return paraISO(d);
}

export function diffEmDias(de: DataISO, ate: DataISO): number {
  return Math.round((paraUTC(ate).getTime() - paraUTC(de).getTime()) / 86_400_000);
}

export function primeiroDiaDoMes(data: DataISO): DataISO {
  return `${data.slice(0, 7)}-01`;
}

/** dd/MM/yyyy -> YYYY-MM-DD. Retorna null se nao for data valida. */
export function deFormatoBR(entrada: string): DataISO | null {
  const m = entrada.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const iso = `${ano}-${mes}-${dia}`;
  const d = paraUTC(iso);
  // Rejeita 31/02: o Date normaliza em silencio, a comparacao pega.
  if (paraISO(d) !== iso) return null;
  return iso;
}

export function paraFormatoBR(data: DataISO): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ── Periodo em meses ────────────────────────────────────────────────────────

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Indice 0-11 a partir do ISO. Sem `new Date`: o fuso deslocaria o dia 1. */
function mesDe(data: DataISO): number {
  return Number(data.slice(5, 7)) - 1;
}

function anoDe(data: DataISO): string {
  return data.slice(0, 4);
}

/**
 * Periodo com granularidade de mes: "julho de 2026", "ago~nov de 2026",
 * "nov de 2025 ~ fev de 2026".
 *
 * O dia nao entra. Num card de quadro ele nao muda decisao nenhuma — ninguem
 * planeja pelo dia 3 ou 5 —, e "01/07/2026 a 30/11/2026" gasta a linha inteira
 * para dizer "segundo semestre".
 *
 * Mes unico sai por extenso porque cabe e le melhor; intervalo abrevia, senao
 * "novembro de 2025 a fevereiro de 2026" estoura a largura da coluna.
 *
 * O ano so aparece duas vezes quando os dois lados divergem — repetir "de 2026"
 * nas duas pontas e ruido.
 */
export function periodoEmMeses(inicio: DataISO | null, fim: DataISO | null): string | null {
  const de = inicio ?? fim;
  const ate = fim ?? inicio;
  if (!de || !ate) return null;

  const [mesDe_, mesAte] = [mesDe(de), mesDe(ate)];
  const [anoDe_, anoAte] = [anoDe(de), anoDe(ate)];

  if (anoDe_ === anoAte && mesDe_ === mesAte) {
    return `${MESES[mesDe_]} de ${anoDe_}`;
  }

  const abrev = (m: number) => MESES[m].slice(0, 3);

  if (anoDe_ === anoAte) {
    return `${abrev(mesDe_)}~${abrev(mesAte)} de ${anoDe_}`;
  }

  return `${abrev(mesDe_)} de ${anoDe_} ~ ${abrev(mesAte)} de ${anoAte}`;
}

// ── Feriados ────────────────────────────────────────────────────────────────

/** Domingo de Pascoa pelo algoritmo de Meeus/Jones/Butcher. */
function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const cacheFeriados = new Map<number, Set<DataISO>>();

/**
 * Feriados nacionais brasileiros. Nao inclui estaduais nem municipais — se o
 * negocio precisar, isso vira tabela no banco por empresa, nao constante aqui.
 */
export function feriadosNacionais(ano: number): Set<DataISO> {
  const cache = cacheFeriados.get(ano);
  if (cache) return cache;

  const p = pascoa(ano);
  const set = new Set<DataISO>([
    `${ano}-01-01`, // Confraternizacao Universal
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independencia
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamacao da Republica
    `${ano}-11-20`, // Consciencia Negra (nacional desde 2024, Lei 14.759/2023)
    `${ano}-12-25`, // Natal
    somarDias(p, -48), // Carnaval (segunda)
    somarDias(p, -47), // Carnaval (terca)
    somarDias(p, -2), // Sexta-feira Santa
    somarDias(p, 60), // Corpus Christi
  ]);

  cacheFeriados.set(ano, set);
  return set;
}

export function ehFeriado(data: DataISO): boolean {
  return feriadosNacionais(Number(data.slice(0, 4))).has(data);
}

export function ehFimDeSemana(data: DataISO): boolean {
  const dia = paraUTC(data).getUTCDay();
  return dia === 0 || dia === 6;
}

export function ehDiaUtil(data: DataISO): boolean {
  return !ehFimDeSemana(data) && !ehFeriado(data);
}

/**
 * Empurra para o proximo dia util. Mesma intencao do legado, mas em laco unico
 * — la, feriado seguido de fim de semana entrava em sequencia de ifs que podia
 * devolver um sabado.
 */
export function proximoDiaUtil(data: DataISO): DataISO {
  let d = data;
  // Teto de 30 evita laco infinito se a tabela de feriados vier corrompida.
  for (let i = 0; i < 30 && !ehDiaUtil(d); i++) {
    d = somarDias(d, 1);
  }
  return d;
}
