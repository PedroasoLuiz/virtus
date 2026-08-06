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
  contaId,
  onEnviar,
  onFechar,
}: {
  contaId: number;
  onEnviar: (nome: string, parametros: string[]) => Promise<void>;
  /**
   * Volta para a escrita livre. `undefined` com a janela fechada, onde nao ha
   * para onde voltar: ali o modelo e a unica saida.
   */
  onFechar?: () => void;
}) {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [escolhido, setEscolhido] = useState<string>("");
  const [valores, setValores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [abertoParaEnvio, setAbertoParaEnvio] = useState(onFechar != null);

  useEffect(() => {
    if (!abertoParaEnvio) return;
    const controle = new AbortController();

    fetch(`/api/v1/whatsapp/modelos?contaId=${contaId}`, { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const corpo = await r.json();
        setModelos(corpo.data ?? []);
      })
      .catch(() => setModelos([]));

    return () => controle.abort();
  }, [abertoParaEnvio, contaId]);

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

  return (
    <footer
      style={{
        flexShrink: 0,
        maxHeight: 300,
        overflowY: "auto",
        padding: "10px 14px 12px",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: 10,
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
      ) : modelos.length === 0 ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Nenhum modelo aprovado. Modelo em revisão ou reprovado não pode ser
          enviado. Confira o status no painel da Meta.
        </p>
      ) : (
        <>
          <select
            value={escolhido}
            onChange={(e) => {
              setEscolhido(e.target.value);
              setValores([]);
            }}
            style={{
              height: 32,
              padding: "0 8px",
              fontSize: "var(--text-sm)",
              border: "1px solid var(--input-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Escolha um modelo…</option>
            {modelos.map((m) => (
              <option key={`${m.nome}-${m.idioma}`} value={m.nome}>
                {m.nome} · {m.categoria.toLowerCase()}
              </option>
            ))}
          </select>

          {modelo && (
            <>
              {/*
                Previa com os valores JA aplicados: os `{{1}}` crus nao dizem
                nada, e quem envia precisa ler a frase que o cliente vai receber
                antes de gastar uma mensagem cobrada.
              */}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--lh-snug)",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)",
                }}
              >
                {modelo.cabecalho && (
                  <div style={{ fontWeight: "var(--fw-semi)", color: "var(--text-primary)" }}>
                    {modelo.cabecalho}
                  </div>
                )}
                {preencher(modelo.corpo, valores)}
                {modelo.rodape && (
                  <div style={{ marginTop: 4, color: "var(--text-tertiary)" }}>
                    {modelo.rodape}
                  </div>
                )}
              </div>

              {Array.from({ length: modelo.parametros }, (_, i) => (
                <input
                  key={i}
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
                    height: 32,
                    padding: "0 10px",
                    fontSize: "var(--text-sm)",
                    border: "1px solid var(--input-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              ))}

              <button
                type="button"
                onClick={() => void enviar()}
                disabled={faltaPreencher || enviando}
                style={{
                  height: 32,
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  background:
                    faltaPreencher || enviando ? "var(--surface-3)" : "var(--primary)",
                  color:
                    faltaPreencher || enviando ? "var(--text-disabled)" : "var(--primary-fg)",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  cursor: faltaPreencher || enviando ? "not-allowed" : "pointer",
                }}
              >
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </>
          )}
        </>
      )}
    </footer>
  );
}
/** Troca `{{1}}`, `{{2}}`… pelos valores digitados, para a prévia. */
function preencher(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (marcador, n: string) => {
    const v = valores[Number(n) - 1];
    return v?.trim() ? v : marcador;
  });
}

// ── Formatacao ──────────────────────────────────────────────────
