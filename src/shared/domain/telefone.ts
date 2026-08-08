/**
 * Leitura e formatacao de telefone.
 *
 * ⚠️ Existe porque o cadastro estava aceitando qualquer coisa. "3599845" entrava
 * como telefone, ia para a coluna do principal e sumia na hora de mandar a
 * cobranca — o WhatsApp recusava o numero e o erro aparecia dias depois, longe
 * de quem digitou.
 *
 * ⚠️ Numero de FORA do Brasil continua passando. Recusar tudo que nao e brasileiro
 * seria inventar uma regra que o cadastro nunca teve, e ha cliente e fornecedor
 * fora daqui. O que se exige de um numero internacional e o "+" e o pais: sem
 * eles nao da para saber se "5551234" e uma linha da Suica ou meio telefone.
 */

/*
 * ⚠️ Os DDD que a Anatel realmente usa, e nao "de 11 a 99".
 *
 * 36, 39, 52 e 70 nao existem, e sao justamente os erros de digitacao mais comuns
 * de 31, 38, 51 e 71. Aceitando a faixa inteira, o cadastro guardava numero que
 * nunca completa a ligacao.
 */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type AnaliseDeTelefone = {
  /** Como o numero deve ser guardado e exibido. */
  formatado: string;
  /** So os digitos, com o 55 na frente quando e brasileiro. */
  e164: string;
  brasileiro: boolean;
  /** `null` quando passa. Quando nao, e a frase que a tela mostra. */
  erro: string | null;
};

export function analisarTelefone(bruto: string): AnaliseDeTelefone {
  const texto = bruto.trim();
  const digitos = texto.replace(/\D/g, "");

  if (digitos.length === 0) {
    return { formatado: "", e164: "", brasileiro: false, erro: "Informe o número" };
  }

  /*
   * ⚠️ O "+" e quem decide se e estrangeiro, e nao o tamanho.
   *
   * Um numero brasileiro escrito com DDI ("+55 35 9...") tem treze digitos, e um
   * numero portugues tem doze: separando por tamanho, um viraria o outro. Quem
   * escreve "+" esta dizendo o pais, e e so isso que se le aqui.
   */
  const temMais = texto.startsWith("+");
  const brasileiroComDDI = temMais && digitos.startsWith("55") && digitos.length >= 12;

  if (temMais && !brasileiroComDDI) {
    if (digitos.length < 8 || digitos.length > 15) {
      return {
        formatado: texto,
        e164: digitos,
        brasileiro: false,
        erro: "Número internacional deve ter de 8 a 15 dígitos",
      };
    }

    // Sem separar DDI de assinante: cada pais parte o numero de um jeito, e
    // chutar o corte deixaria o numero bonito e errado.
    return { formatado: `+${digitos}`, e164: digitos, brasileiro: false, erro: null };
  }

  const nacionais = brasileiroComDDI ? digitos.slice(2) : digitos;

  if (nacionais.length !== 10 && nacionais.length !== 11) {
    return {
      formatado: texto,
      e164: digitos,
      brasileiro: true,
      erro:
        nacionais.length < 10
          ? "Faltam dígitos. Com DDD são 10 (fixo) ou 11 (celular)"
          : "Dígitos demais. Para número de fora, comece com + e o código do país",
    };
  }

  const ddd = Number(nacionais.slice(0, 2));
  if (!DDDS.has(ddd)) {
    return { formatado: texto, e164: digitos, brasileiro: true, erro: `DDD ${ddd} não existe` };
  }

  /*
   * ⚠️ Celular com onze digitos comeca com 9, e fixo com dez comeca de 2 a 5.
   *
   * E o plano de numeracao da Anatel. Sem isso, "(35) 99845-671" com um digito a
   * menos virava um fixo valido e ninguem percebia ate a ligacao nao completar.
   */
  const assinante = nacionais.slice(2);
  if (nacionais.length === 11 && assinante[0] !== "9") {
    return {
      formatado: texto,
      e164: digitos,
      brasileiro: true,
      erro: "Celular com 11 dígitos começa com 9 depois do DDD",
    };
  }
  if (nacionais.length === 10 && !"2345".includes(assinante[0])) {
    return {
      formatado: texto,
      e164: digitos,
      brasileiro: true,
      erro: "Fixo com 10 dígitos começa de 2 a 5 depois do DDD. Celular tem 11",
    };
  }

  return {
    formatado: formatarBrasileiro(nacionais),
    e164: `55${nacionais}`,
    brasileiro: true,
    erro: null,
  };
}

/** (35) 99845-6712 e (35) 3421-1234. */
function formatarBrasileiro(nacionais: string): string {
  const ddd = nacionais.slice(0, 2);
  const assinante = nacionais.slice(2);
  const corte = assinante.length === 9 ? 5 : 4;

  return `(${ddd}) ${assinante.slice(0, corte)}-${assinante.slice(corte)}`;
}

/**
 * A mascara enquanto se digita.
 *
 * ⚠️ Formata so o que ja foi digitado, e nunca completa nada. Uma mascara que
 * insere o que falta empurra o cursor e briga com quem esta apagando um digito no
 * meio.
 */
export function mascararTelefone(bruto: string): string {
  if (bruto.trim().startsWith("+")) return `+${bruto.replace(/\D/g, "")}`;

  const d = bruto.replace(/\D/g, "").slice(0, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;

  const corte = d.length > 10 ? 7 : 6;

  /*
   * ⚠️ Nunca termina em separador. Com seis digitos, o traco final ficava
   * sozinho: o backspace tirava, a mascara devolvia, e o cursor nao passava dali.
   */
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`.replace(/[^0-9]+$/, "");
}
