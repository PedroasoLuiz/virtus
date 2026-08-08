import { analisarTelefone } from "@/shared/domain/telefone";

/**
 * O que a Receita ja sabe sobre um CNPJ.
 *
 * ⚠️ A consulta e do NAVEGADOR, direto na BrasilAPI, e nao passa pela nossa API.
 * E dado publico do cadastro nacional: um proxy nosso no meio so somaria uma ida
 * a nossa maquina, e ainda faria o nosso servidor de fila para um servico de
 * terceiro.
 *
 * ⚠️ Falha em silencio, como o CEP. A busca e atalho: com a BrasilAPI fora do ar,
 * quem cadastra digita como sempre fez, e um erro vermelho ali culparia a pessoa
 * por um servico que caiu.
 */

export type EnderecoDoCnpj = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type DadosDoCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
  /** `aaaa-mm-dd`, do jeito que o campo de data espera. */
  dataAbertura: string;
  /** Ja formatado pela nossa regra, ou vazio se a Receita nao tiver um valido. */
  telefone: string;
  email: string;
  /** O regime da nossa lista, quando da para saber. */
  regime: string;
  endereco: EnderecoDoCnpj;
};

/**
 * A mascara do documento, enquanto se digita.
 *
 * ⚠️ Troca de forma no decimo segundo digito: ate onze e CPF, dali em diante e
 * CNPJ. E a mesma leitura que o resto do formulario faz, entao o campo nunca fica
 * com a pontuacao de um e o tamanho do outro.
 */
export function mascararDocumento(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 14);

  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export async function buscarCnpj(bruto: string): Promise<DadosDoCnpj | null> {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length !== 14) return null;

  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
    if (!r.ok) return null;

    const c = await r.json();

    /*
     * ⚠️ O telefone da Receita passa pela NOSSA regra antes de entrar.
     *
     * Ele vem como "3599845671", sem pontuacao, e ha cadastro com numero velho de
     * oito digitos la. Sem a leitura, um numero que a Receita guarda desde 2005
     * entraria no campo e so seria recusado no salvar, sem ninguem entender por
     * que o proprio sistema preencheu algo invalido.
     */
    const analise = analisarTelefone(c.ddd_telefone_1 ?? "");

    return {
      razaoSocial: c.razao_social ?? "",
      nomeFantasia: c.nome_fantasia ?? "",
      dataAbertura: c.data_inicio_atividade ?? "",
      telefone: analise.erro ? "" : analise.formatado,
      email: (c.email ?? "").toLowerCase(),
      regime: c.opcao_pelo_mei ? "MEI" : c.opcao_pelo_simples ? "Simples Nacional" : "",
      endereco: {
        cep: c.cep ? String(c.cep).replace(/(\d{5})(\d{3})/, "$1-$2") : "",
        logradouro: [c.descricao_tipo_de_logradouro, c.logradouro]
          .filter(Boolean)
          .join(" ")
          .trim(),
        numero: c.numero ?? "",
        complemento: c.complemento ?? "",
        bairro: c.bairro ?? "",
        cidade: c.municipio ?? "",
        uf: c.uf ?? "",
      },
    };
  } catch {
    return null;
  }
}
