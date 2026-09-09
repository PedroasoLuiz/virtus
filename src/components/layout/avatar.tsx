"use client";

/**
 * O avatar do usuario: foto se houver, iniciais se nao.
 *
 * ⚠️ TUDO redondo de verdade, e nao "canto bem arredondado".
 *
 * A casa aplica `corner-shape: superellipse(2)` em tudo — o squircle da marca.
 * Num raio circular ele achata as laterais e o circulo vira um quadrado
 * arredondado, que e exatamente o defeito que se via. A classe `.redondo`
 * devolve o arco puro, e ela precisa estar em CADA camada: o anel, o respiro e a
 * foto. Faltando numa, aquela camada volta a ser squircle e aparece como um
 * contorno torto por baixo das outras.
 *
 * ⚠️ O anel de degrade nao e enfeite.
 *
 * Sem ele, um circulo chapado no canto de cima se le como mais um botao da
 * barra. Com o anel, ele se le como "voce". O respiro de 1px existe porque anel
 * colado na foto vira borda, e borda faz o avatar parecer um campo de
 * formulario. As duas pontas do degrade sao tokens da casa (`--chart-2` e
 * `--primary`): nenhum azul novo entra por aqui.
 */
export function AvatarDoUsuario({
  nome,
  email,
  foto,
  tamanho,
  /**
   * A cor por baixo do avatar, que e a do respiro de 1px.
   *
   * ⚠️ Ela tem de ser a do FUNDO onde o avatar esta pousado, e nao um cinza
   * qualquer: o respiro so parece vao se for da cor do que esta atras. No topo
   * da casca e `--sidebar-bg`; dentro de um cartao branco e `--surface`.
   */
  fundo = "var(--sidebar-bg)",
  anel = true,
  forma = "circulo",
}: {
  nome: string | null;
  email: string;
  foto: string | null;
  tamanho: number;
  fundo?: string;
  anel?: boolean;
  /**
   * Redondo, ou de cantos moles.
   *
   * ⚠️ Existe por causa do TOPO, onde o avatar divide a fileira com os controles
   * e precisa ter a forma deles.
   *
   * Nos outros lugares — a gaveta do perfil, a tabela de pessoas — ele segue
   * redondo: la nao ha botao nenhum ao lado para acompanhar, e o retrato redondo
   * e o que se reconhece como "pessoa" em qualquer sistema.
   */
  forma?: "circulo" | "arredondado";
}) {
  const rotulo = nome ?? email;

  const redondo = forma === "circulo";

  /*
   * ⚠️ O raio e `--radius-full` NAS DUAS formas. A diferenca esta so na classe.
   *
   * Este e exatamente o desenho dos discos da barra de ferramentas, e vale a
   * pena entender por que: a casa aplica `corner-shape: superellipse(2)` no
   * seletor universal, e num raio circular a superelipse ACHATA as laterais — o
   * circulo perfeito vira aquele quadrado de cantos muito moles. E ele que se ve
   * na barra, e e ele que o avatar do topo precisava copiar.
   *
   * ⚠️ Tentar chegar la com `--radius-md` nao funciona, e foi o erro anterior:
   * um raio de doze pixels desenha um canto de arco comum, com o cotovelo no
   * ponto em que a curva comeca. Ao lado da superelipse dos botoes, as duas
   * curvas nao combinam — sao formas diferentes, e nao dois tamanhos da mesma.
   *
   * A classe `.redondo` DESLIGA a superelipse e devolve o arco puro. Ela e o que
   * separa as duas formas aqui: mesma medida, mesmo raio, curva diferente.
   */
  const raio = "var(--radius-full)";
  const classe = redondo ? "redondo" : undefined;

  const miolo = (
    <span
      className={classe}
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: raio,
        background: "var(--primary-subtle)",
        color: "var(--primary)",
        /* A letra acompanha o circulo: fixa, ela sumiria no avatar de 64 e
           estouraria no de 28. */
        fontSize: Math.round(tamanho * 0.36),
        fontWeight: "var(--fw-bold)",
        lineHeight: 1,
      }}
    >
      {foto ? (
        /*
          `img` e nao `next/image`: a URL vem do storage com um `?v=` que muda a
          cada troca, e o otimizador exigiria cadastrar o host e ainda guardaria
          a versao antiga. A imagem ja e de 256px, entao nao ha o que otimizar.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        iniciais(rotulo)
      )}
    </span>
  );

  if (!anel) {
    return (
      <span
        aria-hidden
        className={classe}
        style={{
          width: tamanho,
          height: tamanho,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: raio,
        }}
      >
        {miolo}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={classe}
      style={{
        width: tamanho,
        height: tamanho,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: raio,
        /* O anel cresce com o avatar: 2px num circulo de 64 seria um fio. */
        padding: Math.max(2, Math.round(tamanho * 0.055)),
        background: "linear-gradient(135deg, var(--chart-2), var(--primary))",
      }}
    >
      <span
        className={classe}
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          borderRadius: raio,
          padding: 1,
          background: fundo,
        }}
      >
        {miolo}
      </span>
    </span>
  );
}

/**
 * Duas letras, tiradas do nome ou do proprio e-mail.
 *
 * ⚠️ Quebra tambem em `@` e `.` porque quem ainda nao preencheu o nome cai no
 * e-mail: "pedro.luiz@vope.com" precisa virar "PL", e nao "PE".
 *
 * ⚠️ Descarta pedacos de uma letra so: iniciais de "Maria E. Silva" seriam
 * "ME" — a inicial do meio, que nao identifica ninguem.
 */
export function iniciais(texto: string): string {
  const partes = texto.split(/[\s@.]+/).filter((p) => p.length > 1);
  return partes
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
