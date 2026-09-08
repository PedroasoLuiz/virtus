"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TODAS_AS_ROTAS, type Item } from "@/components/layout/rotas";
import { useBuscaDaTela } from "@/components/layout/busca-da-tela";

/**
 * A busca do sistema — a unica caixa de procura que existe.
 *
 * Centralizada no topo, 340px, atalho Ctrl+K. Ela faz duas coisas de uma vez:
 *
 *   1. FILTRA A TELA ABERTA, ao vivo, enquanto se digita. A tela se anuncia em
 *      `busca-da-tela`; aqui so se chama a funcao que ela deixou.
 *   2. Sugere MODULOS com aquele nome, embaixo.
 *
 * ⚠️ A tela vem PRIMEIRO, e nao os modulos. Quem digita "cresol" com uma
 * listagem aberta quer achar registro em nove de cada dez vezes; a navegacao e
 * o caso raro, e caso raro fica embaixo.
 *
 * ⚠️ O filtro NAO se desfaz quando a caixa fecha. Ele continua valendo, e quem
 * o mostra e a etiqueta no cabecalho da tela (`PageHeader`). Sem essa etiqueta
 * a caixa nao poderia filtrar coisa nenhuma: numa tela de dinheiro, uma lista
 * curta filtrada em silencio se le como "nao ha nada a pagar".
 *
 * ⚠️ Sem tela anunciada — painel, DRE, um grafico — ela e so navegacao, como
 * sempre foi. A secao da tela simplesmente nao aparece.
 */
export function BuscaGlobal() {
  const router = useRouter();
  const tela = useBuscaDaTela();
  const [aberta, setAberta] = useState(false);
  /* So vale quando nao ha tela: com tela, a dona do texto e ela. */
  const [rascunho, setRascunho] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const termo = tela ? tela.termo : rascunho;

  function escrever(valor: string) {
    if (tela) tela.buscar(valor);
    else setRascunho(valor);
  }

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta(true);
        campo.current?.focus();
      }
      if (e.key === "Escape") setAberta(false);
    };

    const aoClicarFora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberta(false);
    };

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicarFora);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicarFora);
    };
  }, []);

  const busca = termo.trim().toLowerCase();
  const resultados = busca
    ? TODAS_AS_ROTAS.filter((i) => i.label.toLowerCase().includes(busca))
    : TODAS_AS_ROTAS;

  function ir(item: Item) {
    setAberta(false);
    /*
     * ⚠️ Sair da tela LIMPA o filtro dela. O termo era daquela listagem; levado
     * para a proxima, a pessoa chegaria numa tabela ja filtrada por uma palavra
     * que ela digitou para outra coisa.
     */
    escrever("");
    setRascunho("");
    router.push(item.href);
  }

  return (
    <div ref={caixa} style={{ position: "relative", width: 340 }}>
      <div
        onClick={() => {
          setAberta(true);
          campo.current?.focus();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          height: 28,
          padding: "0 10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          cursor: "text",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>

        <input
          ref={campo}
          value={termo}
          onChange={(e) => escrever(e.target.value)}
          onFocus={() => setAberta(true)}
          onKeyDown={(e) => {
            /*
             * Com tela aberta, Enter nao navega: o filtro ja esta aplicado a
             * cada tecla, e o gesto seguinte e olhar a tabela. Navegar aqui
             * tiraria a pessoa da tela que ela acabou de filtrar.
             */
            if (e.key !== "Enter") return;
            if (tela && busca) return setAberta(false);
            if (resultados[0]) ir(resultados[0]);
          }}
          placeholder={tela ? `Pesquisar em ${tela.rotulo}...` : "Buscar módulos e funções..."}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "var(--text-base)",
            fontFamily: "inherit",
            color: "var(--text-primary)",
          }}
        />

        {!aberta && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {["Ctrl", "K"].map((k) => (
              <kbd
                key={k}
                style={{
                  fontSize: 9,
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "var(--kbd-bg)",
                  color: "var(--kbd-color)",
                  border: "1px solid var(--kbd-border)",
                  fontFamily: "inherit",
                }}
              >
                {k}
              </kbd>
            ))}
          </div>
        )}
      </div>

      {aberta && (
        <div
          style={{
            position: "absolute",
            top: 35,
            left: 0,
            right: 0,
            zIndex: 200,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
            maxHeight: 380,
            overflowY: "auto",
          }}
        >
          <div style={{ padding: 8 }}>
            {/*
              A secao da tela. Ela NAO e clicavel: o filtro ja aconteceu a cada
              tecla, e um botao aqui prometeria um segundo passo que nao existe.
              O que ela faz e contar quantas linhas sobraram — a resposta que a
              tabela atras do painel esta escondendo neste instante.
            */}
            {tela && busca && (
              <>
                <div className="rotulo" style={{ padding: "2px 6px 6px" }}>
                  Nesta tela
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 6px",
                    fontSize: "var(--text-md)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{tela.rotulo}</span>
                  <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>
                    {tela.resultados === undefined
                      ? "filtrando"
                      : tela.resultados === 1
                        ? "1 resultado"
                        : `${tela.resultados} resultados`}
                  </span>
                </div>
              </>
            )}

            <div className="rotulo" style={{ padding: "2px 6px 6px" }}>
              {busca ? "Ir para" : "Módulos"}
            </div>

            {resultados.length === 0 ? (
              <div
                style={{
                  padding: "10px 6px",
                  fontSize: "var(--text-base)",
                  color: "var(--text-tertiary)",
                }}
              >
                Nenhum módulo com esse nome.
              </div>
            ) : (
              resultados.map((item) => (
                <button
                  key={item.href}
                  onClick={() => ir(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "7px 6px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    style={{
                      fontSize: "var(--text-md)",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {item.href}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
