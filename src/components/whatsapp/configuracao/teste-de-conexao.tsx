"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/kit";
import type { ResultadoDoTeste } from "@/shared/domain/teste-conexao";

/**
 * Bate na porta do serviço antes de salvar, e mostra o que aconteceu.
 *
 * ⚠️ Existe porque nenhum dos campos que ele testa dá para validar por formato.
 * Chave de API é uma sequência qualquer, e nome de modelo é texto livre de
 * propósito, para modelo novo não exigir deploy. Sem esta chamada, o erro de
 * digitação só aparecia no primeiro atendimento de verdade, como silêncio: o
 * provedor devolvia 404, o bot não respondia, e o cliente ficava sem resposta
 * sem nada acusar na tela.
 *
 * ⚠️ Só falha DEFINITIVA impede salvar. Chave recusada e modelo inexistente não
 * vão funcionar nunca, e barrar é um favor. Já provedor fora do ar e queda de
 * rede não dizem nada sobre o que foi digitado, e barrar aí seria impedir a
 * pessoa de arrumar a própria configuração justamente no dia em que ela precisa.
 */

/** Enquanto espera. Ver `Barra` para o porquê de ela nunca chegar ao fim. */
const DURACAO_ESPERADA_MS = 3500;

export function TesteDeConexao({
  titulo,
  legenda,
  assinatura,
  bloqueio,
  aoTestar,
  onResultado,
}: {
  titulo: string;
  legenda: string;
  /**
   * Um resumo dos campos que o teste usa.
   *
   * ⚠️ Mudou a assinatura, o resultado antigo some. Um "tudo certo" verde
   * embaixo de uma chave que acabou de ser trocada é pior que resultado nenhum:
   * ele afirma sobre um valor que nunca foi testado.
   */
  assinatura: string;
  /** O que ainda falta preencher para dar para testar. Nulo quando dá. */
  bloqueio: string | null;
  aoTestar: () => Promise<ResultadoDoTeste>;
  onResultado: (r: ResultadoDoTeste | null) => void;
}) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDoTeste | null>(null);
  const [demonstracao, setDemonstracao] = useState(false);

  const anterior = useRef(assinatura);

  useEffect(() => {
    if (anterior.current === assinatura) return;

    anterior.current = assinatura;
    setResultado(null);
    setDemonstracao(false);
    onResultado(null);
  }, [assinatura, onResultado]);

  async function testar() {
    if (testando) return;

    setTestando(true);
    setDemonstracao(false);
    setResultado(null);
    onResultado(null);

    const r = await aoTestar();

    setTestando(false);
    setResultado(r);
    onResultado(r);
  }

  /*
   * A demonstração percorre os três desfechos, um por clique.
   *
   * ⚠️ O resultado sai marcado como demonstração, e não conta para o salvar:
   * um "tudo certo" de mentira que liberasse o cadastro seria pior que não ter
   * botão nenhum.
   */
  async function demonstrar() {
    if (testando) return;

    const proximo = (DEMONSTRACOES.findIndex((d) => d.mensagem === resultado?.mensagem) + 1) %
      DEMONSTRACOES.length;

    setTestando(true);
    setResultado(null);
    setDemonstracao(true);

    await new Promise((r) => setTimeout(r, 2200));

    setTestando(false);
    setResultado(DEMONSTRACOES[proximo]);
  }

  return (
    <section>
      {/*
        A MESMA anatomia de `CabecalhoDeSecao`, e nao um cabecalho proprio.

        Esta secao vive ao lado da URL de callback, no mesmo nivel, e antes ela
        tinha titulo menor e legenda maior que a vizinha — duas secoes irmas com
        duas escalas diferentes. Os tamanhos vem de la; o que muda e so o respiro
        embaixo, porque ali o cabecalho abre uma tabela e aqui abre um botao
        logo em seguida.
      */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: "calc(var(--text-lg) + 2px)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {titulo}
        </div>
        <p
          style={{
            marginTop: 6,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          {legenda}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void testar()}
          disabled={testando || bloqueio != null}
          title={bloqueio ?? undefined}
        >
          {testando ? "Testando…" : "Testar conexão"}
        </Button>

        {/*
          Escapa a demonstração para quem não tem credencial em mãos.
          Deliberadamente discreta: é uma amostra da interface, não uma ação da
          tela. Uma linha para remover quando não fizer mais falta.
        */}
        <button
          type="button"
          onClick={() => void demonstrar()}
          disabled={testando}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            textDecoration: "underline",
            cursor: testando ? "default" : "pointer",
          }}
        >
          ver demonstração
        </button>

        {bloqueio != null && !testando && resultado == null && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {bloqueio}
          </span>
        )}
      </div>

      {testando && (
        <div style={{ marginTop: 10 }}>
          <Barra />
        </div>
      )}

      {/*
        Respiro maior que o do resto: colado no botao, o veredito parecia parte
        dele, e nao a resposta que veio depois de uma ida ate o provedor.
      */}
      {resultado && !testando && (
        <div style={{ marginTop: 18 }}>
          <Veredito resultado={resultado} demonstracao={demonstracao} />
        </div>
      )}
    </section>
  );
}

/**
 * A barra de espera.
 *
 * ⚠️ Ela avança rápido no começo e vai desacelerando, e NUNCA chega ao fim
 * sozinha: só a resposta a completa. Uma barra que enche até 100% e fica lá
 * parada afirma que terminou quando não terminou, e a partir daí a pessoa passa
 * a achar que a tela travou. Desacelerando, ela diz a verdade: está indo, e não
 * sabemos quanto falta.
 */
function Barra() {
  const [fracao, setFracao] = useState(0.04);

  useEffect(() => {
    const inicio = performance.now();
    let vivo = true;

    function passo(agora: number) {
      if (!vivo) return;

      // Assintótica: 1 - e^(-t/τ), com teto em 92%.
      const decorrido = agora - inicio;
      setFracao(Math.min(0.92, 1 - Math.exp(-decorrido / DURACAO_ESPERADA_MS)));
      requestAnimationFrame(passo);
    }

    const id = requestAnimationFrame(passo);

    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Testando a conexão"
      style={{
        height: 4,
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: "var(--border)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${fracao * 100}%`,
          borderRadius: 999,
          backgroundColor: "var(--primary)",
          transition: "width 120ms linear",
        }}
      />
    </div>
  );
}

/**
 * O desfecho.
 *
 * ⚠️ Sem fundo e sem borda, ao contrário dos avisos da listagem. Lá o cartão
 * separa uma exceção do resto da tela; aqui a resposta é o resultado do botão
 * logo acima, e não precisa de moldura para se ligar a ele. Uma caixa tingida
 * dentro de um formulário já cheio de campos vira mais uma parede.
 *
 * Aqui a cor VAI para o texto, e não para o fundo: sem a caixa, o ícone sozinho
 * ficaria pequeno demais para dizer o desfecho a quem só bate o olho.
 */
function Veredito({
  resultado,
  demonstracao,
}: {
  resultado: ResultadoDoTeste;
  demonstracao: boolean;
}) {
  /*
   * ⚠️ O verde do acerto e o `--primary`, o verde da marca, e nao o
   * `--success-text`. Este e o mesmo lugar onde a URL de callback aparece em
   * verde logo acima: dois verdes diferentes na mesma tela leem como dois
   * significados diferentes, quando os dois querem dizer a mesma coisa.
   */
  const cor = resultado.ok
    ? "var(--primary)"
    : resultado.definitivo
      ? "var(--danger-text)"
      : "var(--warning-text)";

  return (
    <div style={{ display: "flex", gap: 8, color: cor }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="10" cy="10" r="7.4" />
          {resultado.ok ? (
            <path d="M6.6 10.2l2.3 2.3 4.5-4.8" />
          ) : (
            <>
              <path d="M10 6.2v4.6" />
              <path d="M10 13.4v.1" />
            </>
          )}
        </svg>
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-base)" }}>{resultado.mensagem}</div>

        {/*
          O que a chamada respondeu.

          ⚠️ Aparece também na FALHA, e é ali que serve mais: o status e o tempo
          são o que separa "a chave está errada" de "a rede está ruim". Em cinza
          neutro de propósito — é apoio para quem for investigar, não parte do
          veredito.
        */}
        {resultado.infos && resultado.infos.length > 0 && (
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "2px 10px",
              margin: "6px 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            {resultado.infos.map((i) => (
              <Fragment key={i.rotulo}>
                <dt>{i.rotulo}</dt>
                <dd style={{ margin: 0, color: "var(--text-secondary)", wordBreak: "break-word" }}>
                  {i.valor}
                </dd>
              </Fragment>
            ))}
          </dl>
        )}

        {resultado.detalhe && (
          <div
            style={{
              marginTop: 6,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              wordBreak: "break-word",
            }}
          >
            {resultado.detalhe}
          </div>
        )}

        {demonstracao && (
          <div style={{ marginTop: 6, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            Demonstração: nenhuma chamada foi feita. Clique de novo para ver o próximo caso.
          </div>
        )}
      </div>
    </div>
  );
}

/** Os três desfechos possíveis, para a demonstração percorrer. */
const DEMONSTRACOES: ResultadoDoTeste[] = [
  {
    ok: true,
    definitivo: true,
    mensagem: "Chave e modelo confirmados. O provedor respondeu.",
    detalhe: null,
    infos: [
      { rotulo: "Provedor", valor: "gemini" },
      { rotulo: "Modelo", valor: "gemini-3.5-flash-lite" },
      { rotulo: "Resposta", valor: "HTTP 200" },
      { rotulo: "Tempo", valor: "412 ms" },
    ],
  },
  {
    ok: false,
    definitivo: true,
    mensagem: 'O provedor não conhece o modelo "gemini-3.5-flash-lte". Confira o nome exato.',
    detalhe: "models/gemini-3.5-flash-lte is not found for API version v1beta",
    infos: [
      { rotulo: "Provedor", valor: "gemini" },
      { rotulo: "Modelo", valor: "gemini-3.5-flash-lte" },
      { rotulo: "Resposta", valor: "HTTP 404" },
      { rotulo: "Tempo", valor: "287 ms" },
    ],
  },
  {
    ok: false,
    definitivo: false,
    mensagem:
      "Não foi possível falar com o serviço agora. Dá para salvar assim mesmo e tentar de novo depois.",
    detalhe: null,
    infos: [{ rotulo: "Tempo", valor: "12.0 s" }],
  },
];
