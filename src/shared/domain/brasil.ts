/** As 27 unidades da federacao. */

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

/**
 * Os bancos que aparecem no dia a dia, com o codigo da Febraban.
 *
 * ⚠️ Lista FIXA, e nao tabela. Sao dados publicos que mudam de ano em ano, e uma
 * tabela por empresa faria cada cliente cadastrar o Itau de novo — e digitar
 * "Itau", "ITAU" e "341" em tres cadastros da mesma pessoa.
 *
 * ⚠️ E SUGESTAO, e nao lista fechada. O campo continua aceitando texto livre:
 * banco novo, cooperativa regional e fintech aparecem toda hora, e recusar o que
 * nao esta aqui travaria um cadastro por causa de uma lista desatualizada.
 */
export const BANCOS = [
  "001 - Banco do Brasil",
  "003 - Banco da Amazônia",
  "004 - Banco do Nordeste",
  "021 - Banestes",
  "033 - Santander",
  "037 - Banpará",
  "041 - Banrisul",
  "047 - Banese",
  "070 - BRB",
  "077 - Banco Inter",
  "084 - Uniprime Norte do Paraná",
  "085 - Ailos",
  "097 - Credisis",
  "099 - Uniprime",
  "104 - Caixa Econômica Federal",
  "133 - Cresol",
  "136 - Unicred",
  "197 - Stone",
  "208 - Banco BTG Pactual",
  "212 - Banco Original",
  "218 - Banco BS2",
  "237 - Bradesco",
  "246 - Banco ABC Brasil",
  "260 - Nu Pagamentos",
  "290 - PagBank",
  "301 - BPP",
  "323 - Mercado Pago",
  "336 - Banco C6",
  "341 - Itaú Unibanco",
  "348 - Banco XP",
  "364 - Gerencianet",
  "376 - Banco J.P. Morgan",
  "380 - PicPay",
  "389 - Banco Mercantil do Brasil",
  "403 - Cora",
  "422 - Banco Safra",
  "436 - Banco Sicoob",
  "473 - Banco Caixa Geral",
  "477 - Citibank",
  "600 - Banco Luso Brasileiro",
  "604 - Banco Industrial do Brasil",
  "611 - Banco Paulista",
  "623 - Banco PAN",
  "637 - Banco Sofisa",
  "643 - Banco Pine",
  "652 - Itaú Unibanco Holding",
  "655 - Banco Votorantim",
  "707 - Banco Daycoval",
  "745 - Citibank",
  "746 - Banco Modal",
  "748 - Sicredi",
  "756 - Sicoob",
] as const;

/**
 * So o nome do banco, sem o codigo da Febraban.
 *
 * ⚠️ O campo guarda o rotulo inteiro da lista ("756 - Sicoob"), porque ele
 * tambem aceita texto livre e separar codigo de nome em duas colunas obrigaria
 * a inventar um codigo para a cooperativa que nao tem. Quem le a tela nao
 * procura o numero: "916-393-0 | 756 - Sicoob" tem dois numeros disputando a
 * mesma leitura, e o que identifica a conta e o primeiro.
 *
 * ⚠️ Devolve NULL quando o codigo nao esta na lista, e nao o proprio codigo.
 *
 * Os oito cadastros que existem guardam so o numero em `banco` — "403", "756" —
 * e o nome mora no apelido. Devolvendo "403" como se fosse nome, a tela escrevia
 * "4923909-0 | 403": dois numeros na mesma celula, nenhum dos dois dizendo de
 * que banco e a conta. Nulo deixa quem chama cair no apelido, que ali e o nome
 * de verdade.
 */
export function nomeDoBanco(bruto: string | null | undefined): string | null {
  const texto = bruto?.trim();
  if (!texto) return null;

  const comCodigo = texto.match(/^(\d{3})\s*-\s*(.+)$/);
  if (comCodigo) return comCodigo[2].trim();

  if (/^\d{1,3}$/.test(texto)) {
    const codigo = texto.padStart(3, "0");
    const achado = BANCOS.find((b) => b.startsWith(`${codigo} - `));
    return achado ? achado.slice(codigo.length + 3) : null;
  }

  // Texto livre: e o proprio nome, digitado por quem cadastrou.
  return texto;
}
