"use client";

import { useEffect, useState } from "react";
import { AZUL, ItemDeMenu, REGUA } from "./pecas";

/**
 * Quanto o endereco do blob sobrevive depois do clique.
 *
 * Revogado na hora, o download morre antes de comecar em parte dos
 * navegadores; um minuto e folga de sobra e nao vaza memoria de verdade,
 * porque a pagina toda tem vida curta.
 */
const LIMPEZA_DO_BLOB = 60_000;

/**
 * O nome com que o arquivo e salvo.
 *
 * ⚠️ Vem do `Content-Disposition` que o servidor mandou, que ja traduz o UUID
 * interno para "nota-fiscal.pdf". Sem ele o navegador salvaria com o nome do
 * blob, que e um identificador aleatorio sem extensao — e o cliente ficaria com
 * um arquivo que nem abre com dois cliques.
 */
function nomeDoArquivo(resposta: Response, tipo: "boleto" | "nfs"): string {
  const cabecalho = resposta.headers.get("content-disposition") ?? "";
  const achado = cabecalho.match(/filename="?([^";]+)"?/i);
  return achado?.[1] ?? (tipo === "nfs" ? "nota-fiscal.pdf" : "boleto.pdf");
}

/**
 * O botao flutuante de downloads, e o cartao que ele abre.
 *
 * ⚠️ Canto inferior DIREITO, e fixo. E onde o polegar alcanca sem trocar a mao
 * de posicao, e onde ele nao cobre o texto que se esta lendo — no esquerdo,
 * numa folha centralizada, ele encostaria na margem do documento.
 *
 * ⚠️ O DOCUMENTO e um so, e quem chama diz qual. Antes era uma linha por
 * ticket: a pagina abria uma folha por ticket, e cada uma virava um PDF. Como a
 * pagina agora mostra a CONTA, o documento dela e a conta — e a folha do ticket,
 * que virou destino de link, leva o botao dela na propria pagina.
 */
export function BotaoDeDownloads({
  token,
  temBoleto,
  temNfs,
  documento,
  gerando,
}: {
  token: string;
  temBoleto: boolean;
  temNfs: boolean;
  /** O PDF desta página: o rótulo do item e o que ele faz. */
  documento: { rotulo: string; baixar: () => Promise<void> };
  gerando: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [baixandoTodos, setBaixandoTodos] = useState(false);

  /*
   * ⚠️ Ctrl+P e DESVIADO para esta lista, e nao bloqueado.
   *
   * Bloquear impressao nao existe: o menu do navegador, o botao direito e o
   * atalho do sistema continuam la, e pagina nenhuma tira isso de quem esta
   * lendo. O que da para fazer e responder ao gesto — quem apertou Ctrl+P quer
   * o documento no papel, e o caminho para isso e o PDF, que sai em A4 de
   * verdade em vez da folha encolhida da tela.
   *
   * O ouvinte mora AQUI, e nao na pagina, porque e este componente que sabe
   * abrir a lista: la em cima ele teria de avisar por estado, e sincronizar
   * estado dentro de efeito e o que a regra do projeto proibe.
   */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setAberto(true);
      }
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  /*
   * Baixar o arquivo de verdade, e nao abrir o visualizador.
   *
   * ⚠️ BUSCA o arquivo e salva o blob, em vez de apontar um `<a>` para a rota.
   *
   * A rota ja manda `Content-Disposition: attachment`, e mesmo assim apontar um
   * link para ela nao bastava: o navegador decide sozinho abrir PDF no
   * visualizador dele, e o que o cliente via era a nota na tela, para salvar na
   * mao. Com o conteudo em maos e um `download` com nome, nao ha decisao a
   * tomar — o arquivo vai para a pasta de downloads.
   *
   * ⚠️ E devolve uma PROMESSA que termina quando o arquivo chegou. E o que
   * torna o "baixar todos" confiavel: cada um espera o anterior de verdade, em
   * vez de um intervalo chutado que ora sobra ora falta.
   */
  async function baixarArquivo(tipo: "boleto" | "nfs") {
    const resposta = await fetch(`/p/${token}/documento?tipo=${tipo}`);
    if (!resposta.ok) return;

    const blob = await resposta.blob();
    const endereco = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = endereco;
    a.download = nomeDoArquivo(resposta, tipo);
    document.body.appendChild(a);
    a.click();

    /*
     * ⚠️ A limpeza espera um pouco. Tirar o `<a>` e revogar o endereco no
     * mesmo instante do clique cancela o download em alguns navegadores, que
     * ainda nao terminaram de ler o blob quando ele deixa de existir.
     */
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(endereco);
    }, LIMPEZA_DO_BLOB);
  }

  /* Baixa tudo, um de cada vez, esperando cada arquivo chegar. */
  async function baixarTodos() {
    setBaixandoTodos(true);
    setAberto(false);

    try {
      if (temBoleto) await baixarArquivo("boleto");
      if (temNfs) await baixarArquivo("nfs");
      // O PDF e gerado no navegador: aqui a espera e a propria geracao.
      await documento.baixar();
    } finally {
      setBaixandoTodos(false);
    }
  }

  const quantos = (temBoleto ? 1 : 0) + (temNfs ? 1 : 0) + 1;
  const ocupado = baixandoTodos || gerando;

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
      {aberto && (
        /* Camada que fecha ao clicar fora. Transparente: o cartao e pequeno, e
           escurecer a pagina inteira por causa dele seria peso demais. */
        <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: -1 }} />
      )}

      {aberto && (
        <div
          className="cartao-downloads"
          style={{
            position: "absolute",
            right: 0,
            bottom: 66,
            minWidth: 232,
            padding: 6,
            borderRadius: 14,
            background: "#ffffff",
            border: `1px solid ${REGUA}`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
          }}
        >
          {temBoleto && (
            <ItemDeMenu
              rotulo="Baixar boleto"
              onClick={() => {
                void baixarArquivo("boleto");
                setAberto(false);
              }}
              icone={
                <>
                  <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
                  <path d="M5 6v4M7 6v4M9.5 6v4M11.5 6v4" />
                </>
              }
            />
          )}

          {temNfs && (
            <ItemDeMenu
              rotulo="Baixar nota fiscal"
              onClick={() => {
                void baixarArquivo("nfs");
                setAberto(false);
              }}
              icone={
                <>
                  <path d="M3.5 2h6l3 3v9h-9z" />
                  <path d="M5.5 8h5M5.5 10.5h3" />
                </>
              }
            />
          )}

          <ItemDeMenu
            rotulo={gerando ? "Gerando…" : documento.rotulo}
            onClick={() => {
              void documento.baixar();
              setAberto(false);
            }}
            icone={
              <>
                <path d="M3.5 2h6l3 3v9h-9z" />
                <path d="M6 11.5l2 2 2-2M8 7v6.5" />
              </>
            }
          />

          {/* "Todos" so quando ha mais de uma coisa: com uma so, ele seria o
              mesmo botao escrito de outro jeito. */}
          {quantos > 1 && (
            <>
              <div style={{ height: 1, background: REGUA, margin: "5px 8px" }} />
              <ItemDeMenu
                rotulo="Baixar todos"
                destaque
                onClick={() => void baixarTodos()}
                icone={
                  <>
                    <path d="M8 2v8M5 7.5l3 3 3-3" />
                    <path d="M3 12.5h10" />
                  </>
                }
              />
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={aberto ? "Fechar downloads" : "Baixar documentos"}
        aria-expanded={aberto}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: AZUL,
          color: "#ffffff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(10,82,185,0.38)",
          transition: "transform 160ms cubic-bezier(0.2, 0, 0, 1)",
          transform: aberto ? "rotate(90deg)" : "none",
        }}
      >
        {ocupado ? (
          <span className="girando" style={{ display: "block", width: 20, height: 20 }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M8 2a6 6 0 1 1-4.24 1.76" />
            </svg>
          </span>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {aberto ? (
              <path d="M4 4l8 8M12 4l-8 8" />
            ) : (
              <>
                <path d="M8 2.5v8M4.5 7.5l3.5 3.5 3.5-3.5" />
                <path d="M3 13h10" />
              </>
            )}
          </svg>
        )}
      </button>
    </div>
  );
}
