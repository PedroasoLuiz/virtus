/**
 * O resultado de bater na porta de um servico de fora antes de gravar.
 *
 * Vive em `shared/domain` porque a Meta e os provedores de IA nao tem nada em
 * comum alem disto: a tela faz a MESMA pergunta nos dois casos ("da para
 * salvar?") e merece a mesma resposta, com o mesmo desenho.
 */

/**
 * Um pedaco do que o servico respondeu.
 *
 * ⚠️ Nunca a credencial, nem parte dela. E o que a resposta REVELOU: qual numero
 * o ID aponta, quanto tempo levou, que status voltou. Sao esses detalhes que
 * transformam "deu erro" em algo que da para agir, e "deu certo" em algo que da
 * para conferir.
 */
export type InfoDoTeste = { rotulo: string; valor: string };

export type ResultadoDoTeste = {
  ok: boolean;
  /** Frase pronta para a tela, em portugues, sem jargao do provedor. */
  mensagem: string;
  /**
   * ⚠️ A distincao que faz a coisa toda funcionar: "esta errado" nao e a mesma
   * coisa que "nao deu para saber".
   *
   * Chave recusada e modelo inexistente sao definitivos — salvar aquilo cria um
   * cadastro que nunca vai funcionar, e barrar e um favor. Ja provedor fora do
   * ar, timeout e queda de rede nao dizem nada sobre o que foi digitado, e
   * barrar ai seria impedir a pessoa de arrumar a propria configuracao
   * justamente no dia em que ela precisa. Nesses casos o aviso aparece e o
   * salvar continua liberado.
   */
  definitivo: boolean;
  /** O que o provedor respondeu, quando ajuda a entender. Nunca a credencial. */
  detalhe?: string | null;
  /** O que a resposta revelou, em pares para a tela listar. */
  infos?: InfoDoTeste[];
};

/** Deu certo. */
export function testeOk(mensagem: string, infos?: InfoDoTeste[]): ResultadoDoTeste {
  return { ok: true, mensagem, definitivo: true, detalhe: null, infos };
}

/** Esta errado, e salvar assim nao vai funcionar. */
export function testeFalhou(
  mensagem: string,
  detalhe?: string | null,
  infos?: InfoDoTeste[],
): ResultadoDoTeste {
  return { ok: false, mensagem, definitivo: true, detalhe: detalhe ?? null, infos };
}

/** Nao deu para saber. O salvar continua liberado. */
export function testeInconclusivo(
  mensagem: string,
  detalhe?: string | null,
  infos?: InfoDoTeste[],
): ResultadoDoTeste {
  return { ok: false, mensagem, definitivo: false, detalhe: detalhe ?? null, infos };
}

/** Quanto a chamada levou, arredondado para o que a pessoa consegue comparar. */
export function tempoDaChamada(inicioMs: number): InfoDoTeste {
  const ms = Math.round(performance.now() - inicioMs);

  return { rotulo: "Tempo", valor: ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms` };
}

/**
 * O que uma falha de rede vira.
 *
 * ⚠️ Sempre inconclusiva. Timeout e DNS falando do NOSSO lado nao provam nada
 * sobre a chave que a pessoa digitou.
 */
export function testeDeErroDeRede(err: unknown): ResultadoDoTeste {
  if (err instanceof Error && err.name === "AbortError") {
    return testeInconclusivo(
      "O serviço demorou demais para responder. Dá para salvar assim mesmo e tentar de novo depois.",
    );
  }

  return testeInconclusivo(
    "Não foi possível falar com o serviço agora. Dá para salvar assim mesmo e tentar de novo depois.",
    err instanceof Error ? err.message : null,
  );
}
