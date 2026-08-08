/**
 * O CEP: mascara, e a consulta que preenche o resto do endereco.
 *
 * ⚠️ A consulta e do NAVEGADOR, direto no ViaCEP, e nao passa pela nossa API.
 * Nao ha nada de nosso na resposta: e dado publico dos Correios, e um proxy no
 * meio so somaria uma ida a nossa maquina para repetir o que o navegador ja
 * conseguiria sozinho.
 *
 * ⚠️ Falha em silencio. CEP e atalho, nao regra: com o ViaCEP fora do ar, quem
 * cadastra digita os campos como sempre fez, e um erro vermelho ali culparia a
 * pessoa por um servico de terceiro que caiu.
 */

export type EnderecoDoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** 00000-000, formatando so o que ja foi digitado. */
export function mascararCep(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function cepCompleto(bruto: string): boolean {
  return bruto.replace(/\D/g, "").length === 8;
}

export async function buscarCep(bruto: string): Promise<EnderecoDoCep | null> {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!r.ok) return null;

    const corpo = await r.json();

    // O ViaCEP responde 200 com `{ erro: true }` para CEP que nao existe.
    if (corpo?.erro) return null;

    return {
      logradouro: corpo.logradouro ?? "",
      bairro: corpo.bairro ?? "",
      cidade: corpo.localidade ?? "",
      uf: corpo.uf ?? "",
    };
  } catch {
    return null;
  }
}
