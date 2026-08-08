/**
 * CPF e CNPJ: limpeza, mascara, formato e digito verificador.
 *
 * ⚠️ O CNPJ passou a ser ALFANUMERICO em 31 de julho de 2026. Ele continua com
 * catorze posicoes, mas as doze primeiras aceitam letra alem de numero; so os
 * dois digitos verificadores do fim continuam numericos. Cadastro novo pode
 * chegar como "12.ABC.345/01DE-35", e todo lugar que fazia `replace(/\D/g, "")`
 * apagava metade do documento em silencio.
 *
 * ⚠️ O CPF NAO mudou: onze digitos, sempre. E o que separa um do outro aqui.
 *
 * ⚠️ Um arquivo so para os dois. A regra vivia espalhada entre o validador, a
 * mascara da tela e a formatacao da listagem, e cada copia entendia "documento"
 * de um jeito: bastava uma esquecer a letra para o mesmo cadastro ser valido numa
 * tela e invalido na outra.
 */

/** So o que e documento: letra maiuscula e numero, ate catorze posicoes. */
export function limparDocumento(bruto: string): string {
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

export function ehCpf(limpo: string): boolean {
  return limpo.length === 11 && /^\d{11}$/.test(limpo);
}

export function ehCnpj(limpo: string): boolean {
  // Doze posicoes alfanumericas e dois digitos: o formato novo aceita o antigo,
  // que e o mesmo desenho sem letra nenhuma.
  return limpo.length === 14 && /^[A-Z0-9]{12}\d{2}$/.test(limpo);
}

export function documentoValido(bruto: string | null): boolean {
  const limpo = limparDocumento(bruto ?? "");

  if (ehCpf(limpo)) return cpfValido(limpo);
  if (ehCnpj(limpo)) return cnpjValido(limpo);

  return false;
}

/**
 * A mascara enquanto se digita.
 *
 * ⚠️ NUNCA termina em separador. Terminando, apagar com o backspace virava um
 * lacinho: o navegador tirava o ponto, a mascara punha de volta, e o cursor
 * ficava preso ali sem nunca chegar no digito. Vale para os catorze e os oito
 * caracteres, que sao onde o separador cai.
 */
export function mascararDocumento(bruto: string): string {
  const d = limparDocumento(bruto);

  // Ate onze, e CPF em potencial; dali em diante, CNPJ. A troca acontece no
  // decimo segundo caractere, e nao antes: quem digita um CNPJ passa pelo
  // tamanho de um CPF no caminho.
  const texto =
    d.length <= 11
      ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
      : `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

  return semSeparadorNoFim(texto);
}

/** O documento pronto, para leitura. Devolve o que veio quando nao reconhece. */
export function formatarDocumento(bruto: string): string {
  const d = limparDocumento(bruto);

  if (ehCpf(d)) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (ehCnpj(d))
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

  return bruto;
}

/**
 * ⚠️ Corta o que sobrou de pontuacao no fim, e nada mais.
 *
 * "12.345.678/" e "12.345.678/0001-" sao os dois estados em que a mascara termina
 * num separador. Sem este corte, o backspace apagava o separador e a mascara o
 * devolvia no mesmo instante: a impressao e de campo travado.
 */
function semSeparadorNoFim(texto: string): string {
  return texto.replace(/[^A-Z0-9]+$/, "");
}

/**
 * Os digitos verificadores do CPF.
 *
 * Os nove primeiros digitos geram o decimo, e os dez geram o decimo primeiro.
 */
function cpfValido(cpf: string): boolean {
  // Todos iguais fecha a formula e nao existe: 111.111.111-11 passaria.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/**
 * Os digitos verificadores do CNPJ, alfanumerico ou nao.
 *
 * ⚠️ Cada caractere vale o CODIGO ASCII menos 48. Para numero isso da o proprio
 * valor ("0" = 0, "9" = 9), e e por isso que a conta continua valendo para os
 * CNPJ antigos: a regra nova nao substituiu a velha, ela a generalizou. Letra
 * segue a mesma tabela ("A" = 17), que e o que a Receita publicou.
 */
function cnpjValido(cnpj: string): boolean {
  if (/^(.)\1{13}$/.test(cnpj)) return false;

  const valor = (char: string): number => char.charCodeAt(0) - 48;

  const digito = (base: string, pesoInicial: number): number => {
    let peso = pesoInicial;
    let soma = 0;

    for (const char of base) {
      soma += valor(char) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    digito(cnpj.slice(0, 12), 5) === Number(cnpj[12]) &&
    digito(cnpj.slice(0, 13), 6) === Number(cnpj[13])
  );
}
