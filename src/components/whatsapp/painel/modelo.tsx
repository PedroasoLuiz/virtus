"use client";

import { useEffect, useState } from "react";
import type { Modelo } from "@/modules/whatsapp/whatsapp.types";

/**
 * Envio de modelo aprovado.
 *
 * ⚠️ Existe por causa da janela de 24 horas: passada ela, a Meta recusa texto
 * livre e so aceita modelo. Mas nao serve so para isso — modelo tambem e como
 * se manda cobranca com texto ja aprovado, com a conversa quente.
 */

/**
 * Envio por modelo, para quem esta FORA da janela de 24 horas.
 *
 * Substitui a barra de escrita em vez de conviver com ela: ali texto livre nao
 * passa, e deixar o campo visivel so produziria erro no clique.
 *
 * ⚠️ Diferente do texto livre, isto CUSTA — template fora da janela e cobrado
 * por mensagem. Por isso o rodape avisa antes, e nao depois.
 */
export function EnvioPorModelo({
  conversaId,
  onEnviar,
  onFechar,
}: {
  /**
   * A conversa, e não a conta.
   *
   * ⚠️ O painel mandava o id da CONTA, que ele tirava do objeto da conversa. Um
   * campo esquecido no schema da resposta fazia esse id chegar `undefined`, a
   * rota recusava e a tela dizia "nenhum modelo aprovado" — culpando a Meta por
   * um erro nosso. Quem sabe de que número é uma conversa é o servidor.
   */
  conversaId: number;
  onEnviar: (nome: string, parametros: string[]) => Promise<void>;
  /**
   * Volta para a escrita livre. `undefined` com a janela fechada, onde nao ha
   * para onde voltar: ali o modelo e a unica saida.
   */
  onFechar?: () => void;
}) {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  /*
   * ⚠️ Falha e lista vazia sao coisas DIFERENTES, e mostrar as duas como
   * "nenhum modelo aprovado" custou caro: com a chamada quebrada, a tela dizia
   * que o problema estava na Meta e a busca ia para o lugar errado.
   */
  const [falhou, setFalhou] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<string>("");
  const [valores, setValores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [abertoParaEnvio, setAbertoParaEnvio] = useState(onFechar != null);

  useEffect(() => {
    if (!abertoParaEnvio) return;
    const controle = new AbortController();

    fetch(`/api/v1/whatsapp/conversas/${conversaId}/modelo`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null);

        if (!r.ok) {
          /*
           * ⚠️ Os `details` entram na mensagem. Um 422 diz "dados invalidos" e
           * para por ai; e o campo que ele lista que diz onde procurar, e sem
           * isso a unica saida e adivinhar de fora.
           */
          const campos = (corpo?.error?.details ?? [])
            .map((d: { campo?: string; mensagem?: string }) =>
              [d.campo, d.mensagem].filter(Boolean).join(": "),
            )
            .filter(Boolean)
            .join("; ");

          throw new Error(
            [corpo?.error?.message, campos].filter(Boolean).join(". ") || "",
          );
        }

        setFalhou(null);
        setModelos(corpo.data ?? []);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setFalhou(e.message || "Não foi possível falar com a Meta agora.");
        setModelos([]);
      });

    return () => controle.abort();
  }, [abertoParaEnvio, conversaId]);

  const modelo = modelos?.find((m) => m.nome === escolhido) ?? null;
  const faltaPreencher = modelo != null && valores.filter((v) => v?.trim()).length < modelo.parametros;

  async function enviar() {
    if (!modelo || faltaPreencher || enviando) return;

    setEnviando(true);
    await onEnviar(modelo.nome, valores.slice(0, modelo.parametros));
    setEnviando(false);
    setEscolhido("");
    setValores([]);
    setAbertoParaEnvio(false);
    onFechar?.();
  }

  if (!abertoParaEnvio) {
    return (
      <footer
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px 12px",
          background: "transparent",
        }}
      >
        <p
          style={{
            flex: 1,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Passaram-se mais de 24 horas desde a última mensagem deste contato.
          Só um modelo aprovado pode ser enviado agora.
        </p>

        <button
          type="button"
          onClick={() => setAbertoParaEnvio(true)}
          style={{
            flexShrink: 0,
            height: 30,
            padding: "0 12px",
            border: "1px solid var(--primary-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semi)",
            cursor: "pointer",
          }}
        >
          Enviar modelo
        </button>
      </footer>
    );
  }

  /*
   * Escolhido, a barra vira a CAIXA DE ENVIO daquele modelo.
   *
   * ⚠️ Não é uma tela de configuração com um botão "enviar" no fim. É a mesma
   * barra de escrita de sempre, com o texto já pronto no lugar do campo e o
   * mesmo botão redondo à direita: quem chegou aqui ia mandar uma mensagem, e
   * um formulário no meio do caminho faz parecer que virou outra tarefa.
   */
  if (modelo) {
    return (
      <footer
        style={{
          flexShrink: 0,
          maxHeight: 340,
          overflowY: "auto",
          padding: "8px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setEscolhido("");
              setValores([]);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              color: "var(--text-tertiary)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Outro modelo
          </button>

          <span style={{ flex: 1 }} />

          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {modelo.nome}
          </span>
        </div>

        {/*
          A prévia com a cara de BOLHA ENVIADA, e não de caixa de formulário.
          É literalmente o que o cliente vai ver daqui a um segundo, e desenhar
          isso como campo de configuração pede uma tradução mental que ninguém
          precisa fazer.
        */}
        <div
          style={{
            alignSelf: "flex-end",
            maxWidth: "88%",
            padding: "8px 11px",
            borderRadius: "var(--radius-lg)",
            borderBottomRightRadius: "var(--radius-xs)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            fontSize: "var(--text-sm)",
            lineHeight: "var(--lh-normal)",
            whiteSpace: "pre-wrap",
            color: "var(--text-primary)",
          }}
        >
          {modelo.cabecalho && (
            <div style={{ fontWeight: "var(--fw-semi)", marginBottom: 3 }}>
              {modelo.cabecalho}
            </div>
          )}

          {preencher(modelo.corpo, valores)}

          {modelo.rodape && (
            <div style={{ marginTop: 5, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              {modelo.rodape}
            </div>
          )}

          {modelo.botao && (
            <div
              style={{
                marginTop: 7,
                paddingTop: 6,
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-semi)",
                color: "var(--info-text)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              {modelo.botao.texto}
            </div>
          )}
        </div>

        {/*
          ⚠️ Cada campo mostra ONDE ele cai no texto.

          "Campo 1", "Campo 2" não dizem nada, e a ordem dos marcadores no corpo
          não é a ordem em que se lê: num modelo de cobrança o `{{2}}` é o ticket
          e aparece depois do nome. Já saiu para um cliente uma mensagem com o
          valor no lugar do nome por causa disso. O trecho em volta do marcador
          resolve sem depender de cadastro nenhum.
        */}
        {Array.from({ length: modelo.parametros }, (_, i) => (
          <div key={i}>
            <div
              style={{
                marginBottom: 3,
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {ondeEntra(modelo.corpo, i + 1)}
            </div>

            <input
              value={valores[i] ?? ""}
              onChange={(e) =>
                setValores((atuais) => {
                  const copia = [...atuais];
                  copia[i] = e.target.value;
                  return copia;
                })
              }
              placeholder={`Campo ${i + 1}`}
              style={{
                width: "100%",
                height: 32,
                padding: "0 10px",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font)",
                border: "1px solid var(--input-border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        ))}

        {/* A mesma linha de sempre: o que sai à esquerda, o botão redondo à
            direita. É o gesto que a mão já conhece deste rodapé. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <p
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {faltaPreencher
              ? "Preencha os campos acima para enviar."
              : "O cliente recebe exatamente o texto acima."}
          </p>

          <button
            type="button"
            onClick={() => void enviar()}
            disabled={faltaPreencher || enviando}
            aria-label="Enviar"
            title="Enviar"
            className="redondo"
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              border: "none",
              borderRadius: "var(--radius-full)",
              background: faltaPreencher || enviando ? "var(--surface-3)" : "var(--primary)",
              color: faltaPreencher || enviando ? "var(--text-disabled)" : "var(--primary-fg)",
              cursor: faltaPreencher || enviando ? "not-allowed" : "pointer",
              transition: "background 120ms var(--ease)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </footer>
    );
  }

  return (
    <footer
      style={{
        flexShrink: 0,
        padding: "8px 14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="rotulo" style={{ flex: 1 }}>
          Enviar modelo aprovado
        </span>
        <button
          type="button"
          onClick={() => {
            setAbertoParaEnvio(false);
            // Dentro da janela, cancelar devolve a escrita livre; fora dela,
            // volta ao aviso das 24 horas, que e o unico estado possivel.
            onFechar?.();
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>

      {modelos == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Carregando modelos…
        </p>
      ) : falhou ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--danger-text)" }}>
          Não foi possível carregar os modelos. {falhou}
        </p>
      ) : modelos.length === 0 ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Nenhum modelo aprovado. Modelo em revisão ou reprovado não pode ser
          enviado. Confira o status no painel da Meta.
        </p>
      ) : (
        /*
          Os modelos correm NUMA LINHA, como bolhas de mensagem.

          ⚠️ Empilhados numa coluna, três modelos já tomavam metade da conversa,
          e o rodapé nunca pode crescer tanto: é ali embaixo que está a última
          mensagem que a pessoa acabou de ler. Deitados, eles ocupam uma faixa
          só e a fileira rola quando não cabem.
        */
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
            scrollbarWidth: "none",
          }}
        >
          {modelos.map((m) => (
            <button
              key={`${m.nome}-${m.idioma}`}
              type="button"
              onClick={() => {
                setEscolhido(m.nome);
                setValores([]);
              }}
              style={{
                flexShrink: 0,
                width: 208,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                padding: "8px 11px",
                borderRadius: "var(--radius-lg)",
                borderBottomLeftRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font)",
                transition: "border-color var(--dur-fast) var(--ease)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  color: "var(--text-primary)",
                }}
              >
                <span
                  style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {m.nome}
                </span>

                {/* Marketing e utility custam DIFERENTE, e até 30/09/2026 o
                    utility dentro da janela é gratuito. Quem escolhe precisa
                    ver isso antes de clicar, não na fatura. */}
                <span
                  style={{
                    flexShrink: 0,
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--neutral-bg)",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--text-2xs)",
                    fontWeight: "var(--fw-semi)",
                  }}
                >
                  {m.categoria.toLowerCase()}
                </span>
              </span>

              {/*
                O começo do TEXTO, e não só o nome. Nome de modelo é
                `disparoticket_2`: sozinho, ele obriga a abrir um por um até
                achar o certo, e cada abertura é uma chance de mandar o errado.
              */}
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                  lineHeight: "var(--lh-snug)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {m.corpo.replace(/\s*\n\s*/g, " ") || "Sem corpo de texto"}
              </span>
            </button>
          ))}
        </div>
      )}
    </footer>
  );
}

/**
 * O trecho do texto em volta de um marcador.
 *
 * ⚠️ Existe porque a POSIÇÃO do `{{n}}` não se adivinha pelo número dele: um
 * modelo pode citar o `{{4}}` antes do `{{2}}`, e a Meta aceita. Sem ver onde
 * cai, quem preenche vai pela ordem em que lê a frase — e foi assim que saiu
 * uma cobrança com o valor no lugar do nome do cliente.
 *
 * Corta em 24 caracteres de cada lado: o suficiente para reconhecer o lugar sem
 * a linha virar um parágrafo.
 */
function ondeEntra(corpo: string, numero: number): string {
  const marcador = new RegExp(`\\{\\{\\s*${numero}\\s*\\}\\}`);
  const achado = corpo.match(marcador);

  if (!achado || achado.index == null) return `Campo ${numero}`;

  const antes = corpo.slice(Math.max(0, achado.index - 24), achado.index);
  const depois = corpo.slice(achado.index + achado[0].length).slice(0, 24);

  // A quebra de linha vira espaco: numa linha so, ela nao separa nada e ainda
  // corta a frase no meio sem motivo visivel.
  const limpo = (t: string) => t.replace(/\s*\n\s*/g, " ");

  return `${limpo(antes)}[ ]${limpo(depois)}`.trim();
}

/** Troca `{{1}}`, `{{2}}`… pelos valores digitados, para a prévia. */
function preencher(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (marcador, n: string) => {
    const v = valores[Number(n) - 1];
    return v?.trim() ? v : marcador;
  });
}

// ── Formatacao ──────────────────────────────────────────────────
