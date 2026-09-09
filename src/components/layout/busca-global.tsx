"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * ⚠️ Sem tela anunciada — um painel, um grafico — ela e so navegacao, como
 * sempre foi. A secao da tela simplesmente nao aparece.
 *
 * ⚠️ As rotas CHEGAM DE FORA, e o portal manda uma lista vazia.
 *
 * A casca do portal e a mesma do sistema, e por isso esta caixa vivia lendo
 * `TODAS_AS_ROTAS` tambem la — quer dizer, oferecendo "Contas a pagar", "DRE" e
 * "Conciliacao" a quem e CLIENTE da empresa. Nenhum daqueles caminhos abriria
 * para ele, mas a lista sozinha ja conta como o sistema por dentro se organiza,
 * e isso nao e assunto de quem so vem ver a propria cobranca.
 *
 * Com a lista vazia a secao inteira desaparece e a caixa vira o que ela precisa
 * ser la: o filtro da tela aberta, e mais nada.
 */
export function BuscaGlobal({ rotas = TODAS_AS_ROTAS }: { rotas?: Item[] }) {
  const router = useRouter();
  const tela = useBuscaDaTela();
  const [aberta, setAberta] = useState(false);
  /* So vale quando nao ha tela: com tela, a dona do texto e ela. */
  const [rascunho, setRascunho] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  /* O painel vive fora desta arvore (portal): sem uma referencia propria, o
     clique DENTRO dele contaria como clique fora e o fecharia antes de o botao
     receber o clique — o resultado escolhido nunca navegaria. */
  const painel = useRef<HTMLDivElement>(null);
  /* Onde o painel de resultados nasce, em coordenada de TELA. Ver o portal. */
  const [onde, setOnde] = useState<{ top: number; left: number; width: number } | null>(null);

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
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo)) return;
      if (painel.current?.contains(alvo)) return;
      setAberta(false);
    };

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicarFora);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicarFora);
    };
  }, []);

  /*
   * ⚠️ O painel sai por PORTAL, preso na tela.
   *
   * A caixa deixou de morar numa faixa propria e passou a se desenhar dentro do
   * cabecalho da tela, que fica dentro de um `main` com `overflow: hidden` — e
   * ali um painel absoluto e CORTADO na borda de baixo. Mesma mecanica dos
   * menus da barra de ferramentas e do cartao do usuario.
   *
   * ⚠️ `useLayoutEffect` e nao `useEffect`: com o segundo, o painel aparecia por
   * um quadro no canto da tela antes de pular para debaixo da caixa.
   */
  useLayoutEffect(() => {
    if (!aberta || !caixa.current) return setOnde(null);

    const r = caixa.current.getBoundingClientRect();
    setOnde({ top: r.bottom + 6, left: r.left, width: r.width });
  }, [aberta]);

  const busca = termo.trim().toLowerCase();
  const resultados = busca ? rotas.filter((i) => i.label.toLowerCase().includes(busca)) : rotas;
  /* Sem rotas para oferecer, a caixa e so o filtro da tela — e ate o painel
     perde a razao de abrir quando nao ha tela anunciada. */
  const soFiltra = rotas.length === 0;

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
    /*
      ⚠️ SEM corpo proprio: nem fundo, nem sombra, nem canto.

      A caixa e o sino passaram a morar dentro da MESMA pilula branca, no topo
      (ver `Topbar`). Duas superficies brancas encostadas, cada uma com a sua
      sombra, desenhavam uma emenda no meio de uma peca so.

      ⚠️ E mais estreita do que era. Com o sino ao lado dentro da mesma pilula, os
      340 de antes empurravam o conjunto para cima do titulo da tela.
    */
    <div ref={caixa} style={{ position: "relative", width: 236, height: "100%" }}>
      <div
        onClick={() => {
          setAberta(true);
          campo.current?.focus();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          height: "100%",
          padding: "0 4px 0 13px",
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
          placeholder={
            tela
              ? `Pesquisar em ${tela.rotulo}...`
              : soFiltra
                ? "Pesquisar..."
                : "Buscar módulos e funções..."
          }
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
                  padding: "2px 5px",
                  borderRadius: 5,
                  /* ⚠️ SEM contorno: a tecla ja e um cinza sobre o branco do
                     campo, e a borda por cima disso desenhava uma caixinha
                     dentro de outra caixinha, a nove pixels de altura. */
                  background: "var(--kbd-bg)",
                  color: "var(--kbd-color)",
                  fontFamily: "inherit",
                }}
              >
                {k}
              </kbd>
            ))}
          </div>
        )}
      </div>

      {aberta &&
        !(soFiltra && !tela) &&
        createPortal(
          <div
            ref={painel}
            style={{
            position: "fixed",
            top: onde?.top ?? 0,
            left: onde?.left ?? 0,
            width: onde?.width ?? 340,
            /* Enquanto nao mediu, ocupa espaco e nao aparece: e assim que a
               posicao fica conhecida antes do primeiro quadro pintado. */
            visibility: onde ? "visible" : "hidden",
            zIndex: 200,
            background: "var(--surface)",
            /* ⚠️ SEM borda: a sombra ja separa o cartao do que esta atras.
            Contorno mais sombra e a mesma coisa dita duas vezes. Ver
            `07-DESIGN-TOKENS`, cartao flutuante. */
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

            {/* A secao de navegacao so existe quando ha para onde navegar. */}
            {!soFiltra && (
              <div className="rotulo" style={{ padding: "2px 6px 6px" }}>
                {busca ? "Ir para" : "Módulos"}
              </div>
            )}

            {soFiltra ? null : resultados.length === 0 ? (
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
          </div>,
          document.body,
        )}
    </div>
  );
}
