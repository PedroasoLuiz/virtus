/**
 * A marca da empresa: o logotipo cadastrado, ou as iniciais dela.
 *
 * ⚠️ Um desenho so para os QUATRO lugares onde a empresa aparece como item de
 * lista: o cartao no topo da barra, a lista de troca que abre dele, a tabela de
 * empresas do perfil e a tela de escolher empresa depois do login. Ate aqui
 * cada um desenhava o seu, e eles ja tinham divergido: dois faziam as iniciais
 * com as duas primeiras LETRAS do nome ("Virtus Tecnologias" virava "VI") e o
 * da tela de escolha com a primeira letra de cada PALAVRA ("VT"). A mesma
 * empresa aparecia com dois rotulos diferentes conforme a tela.
 *
 * ⚠️ Nenhum deles mostrava o logotipo na tela de escolha, que e onde ele mais
 * ajuda: e a unica tela em que a pessoa nao sabe ainda em qual empresa esta, e
 * a marca e o que ela reconhece antes de ler o nome.
 *
 * Sem `"use client"`: nao ha estado nem evento aqui, entao a tela de escolha
 * (server) e a barra lateral (client) usam a mesma peca.
 */
export function MarcaDaEmpresa({
  nome,
  logo,
  tamanho = 26,
}: {
  nome: string;
  logo: string | null;
  tamanho?: number;
}) {
  const molde: React.CSSProperties = {
    width: tamanho,
    height: tamanho,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
  };

  if (logo) {
    return (
      /*
        `img` e nao `next/image`: a URL vem do storage e muda por empresa, e o
        otimizador exigiria cadastrar cada host. A marca ja e pequena, entao nao
        ha o que otimizar.
      */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" style={{ ...molde, objectFit: "contain" }} />
    );
  }

  /* Sem marca cadastrada, as iniciais: um quadrado vazio faria parecer que a
     imagem falhou ao carregar. */
  return (
    <span
      aria-hidden
      style={{
        ...molde,
        background: "var(--primary-subtle)",
        color: "var(--primary)",
        fontSize: Math.round(tamanho * 0.38),
        fontWeight: "var(--fw-bold)",
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * As duas letras do quadrado.
 *
 * ⚠️ A primeira de cada PALAVRA, e palavras curtas nao contam: "Virtus
 * Tecnologias de Sao Paulo" precisa dar "VT", e nao "VTDS". Nome de uma palavra
 * so nao tem segunda inicial para pegar, e ai valem as duas primeiras letras
 * dele — melhor que uma letra sozinha perdida no meio do quadrado.
 */
function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((p) => p.length > 2);

  if (palavras.length >= 2) {
    return (palavras[0][0] + palavras[1][0]).toUpperCase();
  }

  return nome.trim().slice(0, 2).toUpperCase();
}
