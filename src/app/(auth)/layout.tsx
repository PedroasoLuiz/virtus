/**
 * Casca das telas de autenticacao.
 *
 * Duas colunas no desktop: formulario a esquerda, painel de marca a direita.
 * No mobile o painel some — ele e ambientacao, nao conteudo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--surface)" }}>
      <section
        style={{
          flex: "1 1 480px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 340 }}>{children}</div>
      </section>

      <PainelMarca />
    </div>
  );
}

function PainelMarca() {
  return (
    <aside
      className="painel-marca"
      style={{
        flex: "1 1 50%",
        position: "relative",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#fff",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/*
        A foto da ambientacao.

        ⚠️ `background-image` e nao `next/image`: ela nao e conteudo, e o fundo
        do painel. Como elemento, ela entraria na arvore com tamanho proprio e a
        frase por cima precisaria de empilhamento so para voltar a ficar em cima.

        ⚠️ Ancorada a DIREITA. A imagem e deitada (16:9) e o painel e uma coluna
        em pe: cortar pelo centro comeria as pessoas, que moram na metade
        direita dela. O lado esquerdo e escritorio escuro, e e ele que sai.
      */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/marca/login.png')",
          backgroundSize: "cover",
          backgroundPosition: "right center",
          pointerEvents: "none",
        }}
      />

      {/*
        Luz difusa no canto — o "glow" da identidade Virtus, no azul do Vope.

        ⚠️ Os valores sao literais, e nao `var(--primary)`. O painel tem fundo
        preto proprio, fora do tema: puxar o token faria a luz clarear junto com
        o modo claro do sistema e sumir contra o preto que fica.

        ⚠️ O terceiro gradiente e um veu de baixo para cima, e nao enfeite: a
        frase mora no pe do painel, e sobre a foto crua ela cairia em cima da
        mesa e do laptop, que sao claros o bastante para comer o texto branco.
      */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 75% 15%, rgba(56,141,255,0.28), transparent 70%)," +
            "radial-gradient(45% 40% at 25% 85%, rgba(10,82,185,0.22), transparent 75%)," +
            "linear-gradient(to top, rgba(5,8,16,0.92) 0%, rgba(5,8,16,0.55) 40%, rgba(5,8,16,0.18) 75%)",
          pointerEvents: "none",
        }}
      />

      {/*
        ⚠️ Duas frases, e so.

        O rodape com a assinatura da fabricante saiu: quem esta nesta tela e
        cliente entrando no proprio financeiro, e nao alguem a quem se apresenta
        quem fez o software. Ele tambem ficava logo abaixo do texto que vende o
        produto, e as duas coisas juntas faziam a tela parecer um folheto.
      */}
      <div style={{ position: "relative", maxWidth: 460 }}>
        <p
          style={{
            fontSize: "var(--text-4xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          Do orçamento ao extrato, sem trocar de sistema.
        </p>
        {/*
          A frase de apoio nomeia MODULOS, e nao virtudes. "Controle total" e
          "gestao inteligente" cabem em qualquer software; a lista diz o que a
          pessoa vai encontrar depois de entrar, e e por ela que ela reconhece
          se este e o sistema dela.
        */}
        <p style={{ fontSize: "var(--text-md)", color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
          Tickets e contratos, contas a pagar e a receber, conciliação bancária e DRE. Cada
          recebimento no lugar certo, e o caixa fechando junto.
        </p>
      </div>
    </aside>
  );
}
