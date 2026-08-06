"use client";

import { useEffect, useRef, useState } from "react";
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
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
          }}
        >
          {titulo}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          {legenda}
        </div>
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

      {resultado && !testando && (
        <div style={{ marginTop: 10 }}>
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

/** O desfecho, com o mesmo desenho dos avisos do resto da tela. */
function Veredito({
  resultado,
  demonstracao,
}: {
  resultado: ResultadoDoTeste;
  demonstracao: boolean;
}) {
  const tom = resultado.ok ? "success" : resultado.definitivo ? "danger" : "warning";

  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        padding: "10px 12px",
        borderRadius: "var(--radius-lg)",
        backgroundColor: `var(--${tom}-bg)`,
        border: `1px solid var(--${tom}-border)`,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, color: `var(--${tom}-text)` }}>
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
        <div style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
          {resultado.mensagem}
        </div>

        {resultado.detalhe && (
          <div
            style={{
              marginTop: 3,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              wordBreak: "break-word",
            }}
          >
            {resultado.detalhe}
          </div>
        )}

        {demonstracao && (
          <div style={{ marginTop: 3, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
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
  },
  {
    ok: false,
    definitivo: true,
    mensagem: 'O provedor não conhece o modelo "gemini-3.5-flash-lte". Confira o nome exato.',
    detalhe: "models/gemini-3.5-flash-lte is not found for API version v1beta",
  },
  {
    ok: false,
    definitivo: false,
    mensagem:
      "Não foi possível falar com o serviço agora. Dá para salvar assim mesmo e tentar de novo depois.",
    detalhe: null,
  },
];
