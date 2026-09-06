import Link from "next/link";

/**
 * A pagina de endereco que nao existe.
 *
 * ⚠️ Ela e a resposta para DOIS caminhos diferentes: o endereco digitado errado
 * e o `notFound()` disparado de dentro de uma pagina — um projeto que sumiu, um
 * link de cobranca cancelado. Por isso o texto nao afirma o motivo: dizer
 * "endereco errado" para quem clicou num link legitimo que caducou joga a culpa
 * na pessoa errada.
 *
 * ⚠️ Sem `"use client"`. Ela nao tem estado nem evento: a arte se repete
 * sozinha e o botao e um link. 404 e a pagina que menos pode depender de
 * JavaScript ter carregado.
 *
 * ⚠️ E sem a marca no topo. Quem cai aqui ja esta dentro do sistema e acabou de
 * ver o logotipo na barra lateral; repeti-lo transformava um aviso curto em
 * pagina de apresentacao.
 */

export const metadata = { title: "Página não encontrada · Vope" };

/**
 * Onde a borda de cima do circulo cruza a arte.
 *
 * ⚠️ E menos que a altura do desenho, e e isso que faz o notebook ficar entre o
 * azul e o branco. Subindo o valor, o desenho afunda no circulo; descendo, ele
 * descola e o circulo vira uma bolha solta atras do texto.
 */
const DESCIDA_DO_CIRCULO = 96;

export default function NaoEncontrada() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg)",
        textAlign: "center",
      }}
    >
      {/*
        ⚠️ O circulo e FUNDO, e nao caixa.

        Ele ja foi um container com `aspect-ratio: 1` em volta do conteudo, e
        quebrou os dois: a altura fixa apertava a coluna, o `<img>` era o unico
        item encolhivel e desabava para zero — o desenho sumia —, e o texto
        transbordava pelas curvas. Caixa redonda obriga o conteudo a caber num
        formato que ele nao tem.

        ⚠️ E ele comeca ABAIXO do topo, de proposito. O notebook precisa cruzar
        a borda: metade sobre o azul, metade sobre o fundo da pagina. E o que
        tira o desenho de dentro de uma moldura e o poe na frente dela — a arte
        deixa de ser conteudo do circulo e passa a ser o assunto, com o circulo
        atras. Por isso o topo do circulo cai no MEIO da altura da arte.
      */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 360,
          maxWidth: "100%",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: DESCIDA_DO_CIRCULO,
            transform: "translateX(-50%)",
            width: 330,
            aspectRatio: "1",
            borderRadius: "50%",
            background: "var(--primary-subtle)",
            zIndex: 0,
          }}
        />

        <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
          {/*
            ⚠️ WebP animado num `<img>`, e nao um `<video>`.

            A arte tem CANAL ALFA de verdade — conferido no fonte: ProRes 4444,
            com a mascara desenhando so o notebook. Ela precisa flutuar sobre o
            fundo, que muda entre claro e escuro. MP4 nao carrega alfa, e WebM
            com alfa o Safari nao le: os dois entregariam um retangulo branco no
            modo escuro. WebP animado carrega alfa e roda em todos.

            De quebra, `<img>` nao esbarra em politica de autoplay, nao precisa
            de `muted` nem de `playsInline`, e repete sozinho — numa pagina de
            erro, que e onde menos se pode contar com o JavaScript ter subido,
            isso vale mais do que os 200 KB que um WebM economizaria.

            ⚠️ `alt` vazio: e enfeite. O recado inteiro esta no texto abaixo, e
            descrever o desenho so faria o leitor de tela repetir a mesma coisa.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/404.webp"
            alt=""
            width={640}
            height={360}
            style={{
              width: "100%",
              maxWidth: 300,
              height: "auto",
              display: "block",
              margin: "0 auto",
            }}
          />

          <h1
            style={{
              /* Colado na arte: as duas dizem a mesma coisa, uma em desenho e
                 outra em palavra, e separadas pareciam dois assuntos. */
              margin: "2px 0 0",
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--text-primary)",
            }}
          >
            Esta página não existe
          </h1>

          <p
            style={{
              margin: "8px auto 0",
              maxWidth: 300,
              fontSize: "var(--text-md)",
              lineHeight: "var(--lh-relaxed)",
              color: "var(--text-tertiary)",
            }}
          >
            O endereço pode ter mudado de lugar, ou o que estava aqui foi
            removido.
          </p>

          {/*
            ⚠️ Um LINK vestido de botao, e nao o `Button` do kit.

            O kit renderiza `<button>` com `onClick`, e isto aqui e navegacao:
            precisa funcionar sem JavaScript, abrir em nova aba pelo botao do
            meio e aparecer no menu do botao direito. Um `<button>` que navega
            perde as tres — e numa pagina de erro, contar com o JavaScript e o
            pior lugar para apostar.

            As medidas sao as do `IncluirButton` — o "Incluir" das listagens —,
            que e `Button variant="primary" size="sm"` com recuo de 16: altura
            `--h-btn-sm`, corpo `--text-base`, peso `--fw-medium`, raio
            `--radius-md`. Nenhum numero inventado: um botao PARECIDO com o do
            sistema e pior que um igual, porque a diferenca aparece sem que
            ninguem saiba nomear.
          */}
          <Link
            href="/"
            style={{
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: "var(--h-btn-sm)",
              padding: "0 16px",
              borderRadius: "var(--radius-md)",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "1px solid transparent",
              fontSize: "var(--text-base)",
              fontWeight: "var(--fw-medium)",
              fontFamily: "var(--font)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
