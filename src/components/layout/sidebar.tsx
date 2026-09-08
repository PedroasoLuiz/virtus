"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Modulo } from "@/modules/plataforma/plataforma.types";
import {
  gruposDosModulos,
  telasDoGrupo,
  TODAS_AS_ROTAS,
  type Grupo,
  type Item,
  paiDaRota,
} from "@/components/layout/rotas";
import { useFavoritos } from "@/components/layout/favoritos";
import { ArvoreNav, Chevron, GrupoFlutuante, ItemNav, ehAtivo } from "@/components/layout/nav";
import { Icon } from "@/components/layout/icones";
import { Marca } from "@/components/layout/marca";
import { BotaoLateralDoWhatsapp } from "@/components/whatsapp/botao-lateral";
import { COOKIE_SIDEBAR } from "@/components/layout/cookies";

/**
 * Navegacao lateral, recolhivel.
 *
 * Fundo proprio e divisoria a direita: e ela que separa a navegacao da area de
 * trabalho. O rodape segue sem linha — o espaco ja resolve.
 *
 * Recolhida, sobram so os icones dos grupos; clicar num icone expande a barra e
 * abre aquele grupo — assim o clique nunca e um beco sem saida.
 */

export function Sidebar({
  modulos,
  empresa,
  empresaLogo,
  recolhidaInicial,
  grupos: gruposFixos,
  inicio = "/dashboard",
  podeTrocarEmpresa = false,
  hrefTrocarEmpresa = "/selecionar-empresa",
  whatsapp = false,
  interno = false,
}: {
  modulos: Modulo[];
  empresa: string | null;
  /**
   * A marca da empresa ativa, no cartao do topo.
   *
   * ⚠️ Nula e estado legitimo, e nao falha: empresa sem logo cadastrado cai nas
   * iniciais. O cartao nao pode depender de uma imagem que talvez nao exista.
   */
  empresaLogo?: string | null;
  recolhidaInicial: boolean;
  /**
   * Se ha mais de uma empresa para escolher.
   *
   * ⚠️ Isto e do CARTAO DA EMPRESA, e nao do menu do usuario. Trocar de empresa
   * responde "com qual empresa estou trabalhando?", que e a pergunta que o
   * cartao do topo ja faz — e nao "quem sou eu?", que e a do avatar. Enquanto
   * moravam juntas no perfil, a troca ficava escondida atras da identidade.
   */
  podeTrocarEmpresa?: boolean;
  /** Destino da troca. O portal escolhe entre EMISSORES, nao entre tenants. */
  hrefTrocarEmpresa?: string;
  /**
   * Menu pronto, no lugar do derivado dos modulos do plano.
   *
   * Existe para o portal do cliente: o menu dele nao vem do plano da empresa —
   * ele nao administra empresa nenhuma — e sim do que um cliente pode fazer.
   * Duplicar a barra inteira faria as duas divergirem no primeiro ajuste de
   * espacamento.
   */
  grupos?: Grupo[];
  /** Para onde a marca leva. O portal nao tem dashboard. */
  inicio?: string;
  /**
   * O acesso ao WhatsApp, no rodape.
   *
   * ⚠️ Nao vem ligado. O portal do cliente usa esta mesma barra, e la nao ha
   * caixa de entrada nenhuma para abrir.
   */
  whatsapp?: boolean;
  /**
   * Ve as areas ainda em desenvolvimento, e a lista de favoritos.
   *
   * ⚠️ Chega de fora e nao e lido aqui de proposito: a barra e componente de
   * apresentacao, e quem sabe quem e a pessoa e a sessao. O portal passa falso
   * porque la nao ha area em obra nenhuma para mostrar.
   */
  interno?: boolean;
}) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(recolhidaInicial);
  const [abertoManual, setAbertoManual] = useState<string | null>(null);
  const favoritos = useFavoritos((s) => s.rotas);

  function gravar(valor: boolean) {
    setRecolhida(valor);
    // 1 ano: e preferencia de interface, nao dado de sessao.
    document.cookie = `${COOKIE_SIDEBAR}=${valor ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  const grupos = gruposFixos ?? gruposDosModulos(modulos, interno);

  // So telas que o plano libera entram nos favoritos: perder o modulo nao pode
  // deixar um atalho morto no topo do menu.
  const disponiveis = new Set(grupos.flatMap((g) => telasDoGrupo(g).map((i) => i.href)));
  const telasFavoritas = favoritos
    .filter((href) => disponiveis.has(href))
    .map((href) => TODAS_AS_ROTAS.find((i) => i.href === href))
    .filter((i): i is Item => i !== undefined);

  return (
    <aside
      style={{
        width: recolhida ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        flexShrink: 0,
        backgroundColor: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        // `sticky` cria contexto de empilhamento proprio. Sem z-index, a area
        // de trabalho — irma seguinte no DOM — pinta por cima, e o menu
        // flutuante da barra recolhida sumia atras da tabela.
        zIndex: 60,
        height: "100dvh",
        transition: "width var(--dur) var(--ease)",
        // Recolhida precisa deixar o menu flutuante escapar; expandida corta o
        // conteudo para a animacao de largura nao mostrar texto vazando.
        overflow: recolhida ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          height: "var(--h-topbar)",
          display: "flex",
          alignItems: "center",
          justifyContent: recolhida ? "center" : "space-between",
          padding: recolhida ? 0 : "0 8px 0 16px",
          flexShrink: 0,
        }}
      >
        {!recolhida && (
          <Link href={inicio}>
            <Marca />
          </Link>
        )}

        <button
          onClick={() => gravar(!recolhida)}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          style={{
            width: 28,
            height: 28,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: "var(--sidebar-item-sub)",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name={recolhida ? "expandir" : "recolher"} size={16} />
        </button>
      </div>

      {/*
        `overflow-x: visible` com `overflow-y: auto` nao existe em CSS: um lado
        nao-visivel forca o outro a rolar. Recolhida sao poucos icones e nao ha
        o que rolar, entao os dois ficam visiveis e o flutuante passa.
      */}
      <nav
        style={{
          flex: 1,
          overflowY: recolhida ? "visible" : "auto",
          overflowX: recolhida ? "visible" : "hidden",
          padding: "4px 8px",
        }}
      >
        {recolhida ? (
          <MenuRecolhido
            grupos={grupos}
            pathname={pathname}
            expandir={(chave) => {
              gravar(false);
              setAbertoManual(chave);
            }}
          />
        ) : (
          <>
            {/*
              ⚠️ A empresa ativa abre a barra, acima do primeiro grupo.

              Ela morava dentro do cartão do perfil, no rodapé — e ali respondia
              "em qual empresa eu estou?" só para quem já tinha aberto o menu do
              usuário para perguntar outra coisa. É a primeira pergunta de quem
              trabalha em mais de uma empresa, e no topo ela se responde sem
              clique nenhum.
            */}
            {empresa && (
              <CartaoDaEmpresa
                nome={empresa}
                logo={empresaLogo ?? null}
                podeTrocar={podeTrocarEmpresa}
                hrefTrocar={hrefTrocarEmpresa}
              />
            )}

            {/*
              ⚠️ Os favoritos tambem estao em obra, e por isso seguem `interno`.

              Marcar e desmarcar funciona; o que falta e a tela de gerir a lista.
              Mostrar o bloco a quem nao pode ainda organiza-lo seria oferecer
              meio recurso.
            */}
            {interno && telasFavoritas.length > 0 && (
              <Favoritos telas={telasFavoritas} pathname={pathname} />
            )}

            {!gruposFixos && grupos.length === 1 && (
              <p
                style={{
                  padding: 12,
                  fontSize: "var(--text-sm)",
                  color: "var(--sidebar-item-sub)",
                }}
              >
                Nenhum módulo liberado no plano.
              </p>
            )}

            <ArvoreNav
              grupos={grupos}
              pathname={pathname}
              abertoManual={abertoManual}
              setAbertoManual={setAbertoManual}
            />
          </>
        )}
      </nav>

      {/*
        Rodape: WhatsApp e configuracoes.

        ⚠️ A IDENTIDADE saiu daqui e foi para o canto superior direito, redonda.
        No rodape ela dividia espaco com navegacao, e quem procurava "sair" ou
        "tema" varria a lista de modulos antes de achar. Ver `Topbar`.

        ⚠️ O recuo e o MESMO da `nav` (8px), e nao 12. Com 12, os icones do
        rodape comecavam quatro pixels a direita dos icones dos grupos — pouco
        para nomear e o bastante para a coluna parecer torta.
      */}
      <div style={{ flexShrink: 0, padding: recolhida ? "10px 6px" : "10px 8px" }}>
        {whatsapp && (
          <div style={{ marginBottom: 2 }}>
            <BotaoLateralDoWhatsapp recolhida={recolhida} />
          </div>
        )}

        {/*
          ⚠️ Configuracoes fica no RODAPE, e nao no meio dos modulos.

          Ela nao e um assunto do negocio como Financeiro ou Projetos: e o ajuste
          da propria casa, e a pessoa vai ali de vez em quando. Na lista, ocupava
          o mesmo peso de um modulo que se usa todo dia; embaixo, do lado do
          WhatsApp, ela e o que sempre foi — a ultima parada da barra.

          ⚠️ MESMA forma do botao do WhatsApp: caixa de 15px para o glifo, altura
          de item de menu, rotulo na coluna de texto dos demais. Dois desenhos
          diferentes lado a lado fariam o rodape parecer remendo.
        */}
        <ItemDoRodape rotulo="Configurações" recolhida={recolhida} icone={<IconeEngrenagem />} />
      </div>
    </aside>
  );
}

/**
 * A empresa ativa, em cartao branco no topo da barra.
 *
 * ⚠️ Branco sobre o cinza da barra, e sem titulo. O contraste do cartao ja diz
 * que aquilo nao e item de menu; uma palavra "Empresa" em cima gastaria uma
 * linha para nomear o que a marca e o nome ja nomeiam.
 *
 * ⚠️ DUAS LINHAS no maximo, e nao reticencias na primeira.
 *
 * Razao social e comprida por natureza — "VIRTUS SERVICOS DE TECNOLOGIA LTDA"
 * nao cabe em 220px de barra. Cortada na primeira linha, sobrariam duas
 * palavras; em duas, o nome se le quase sempre inteiro. Passando disso, aí sim
 * corta, senão um nome enorme empurraria o menu para baixo da dobra.
 */
function CartaoDaEmpresa({
  nome,
  logo,
  podeTrocar,
  hrefTrocar,
}: {
  nome: string;
  logo: string | null;
  podeTrocar: boolean;
  hrefTrocar: string;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const conteudo = (
    <>
      {logo ? (
        /*
          `img` e nao `next/image`: a URL vem do storage e muda por empresa, e o
          otimizador exigiria cadastrar cada host. A marca ja e pequena, entao
          nao ha o que otimizar.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            objectFit: "contain",
            borderRadius: "var(--radius-sm)",
          }}
        />
      ) : (
        /* Sem marca cadastrada, as iniciais: um quadrado vazio faria parecer
           que a imagem falhou ao carregar. */
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--radius-sm)",
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            fontSize: 10,
            fontWeight: "var(--fw-bold)",
          }}
        >
          {nome.trim().slice(0, 2).toUpperCase()}
        </span>
      )}

      <span
        style={{
          minWidth: 0,
          textAlign: "left",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
          lineHeight: 1.25,
          /* Duas linhas e entao reticencias. `-webkit-` porque `line-clamp` sem
             prefixo ainda nao vale em todos os navegadores que o app suporta. */
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {nome}
      </span>
    </>
  );

  const molde: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: 8,
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    fontFamily: "var(--font)",
  };

  /* Com uma empresa so, o cartao nao e botao: nao ha para onde ir, e um alvo de
     clique que nao faz nada ensina a nao clicar nele. */
  if (!podeTrocar) {
    return (
      <div title={nome} style={{ ...molde, marginBottom: 10 }}>
        {conteudo}
      </div>
    );
  }

  return (
    <div ref={caixa} style={{ position: "relative", marginBottom: 10 }}>
      <button
        type="button"
        title={nome}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        style={{ ...molde, cursor: "pointer" }}
      >
        {conteudo}

        {/* A seta so existe quando ha escolha: ela e a promessa de que algo abre. */}
        <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--text-tertiary)" }}>
          <Chevron aberto={aberto} tamanho={12} />
        </span>
      </button>

      {/*
        ⚠️ ABSOLUTO e nao por portal, ao contrario do menu do usuario.

        Este cartao mora no TOPO da barra, dentro da area que nao rola e sobra
        altura de sobra abaixo dele — nada a cortar. O do usuario precisava de
        portal porque abria para cima, no rodape, contra a borda da tela.
      */}
      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 60,
            padding: 4,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-strong)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Link
            href={hrefTrocar}
            onClick={() => setAberto(false)}
            style={{
              display: "block",
              padding: "7px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-base)",
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            Trocar de empresa
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Atalhos no topo do menu.
 *
 * Sem trilho: favorito e lista solta, nao tem hierarquia para desenhar. O recuo
 * do texto acompanha o dos itens de grupo, para as duas listas lerem na mesma
 * coluna.
 */
function Favoritos({ telas, pathname }: { telas: Item[]; pathname: string }) {
  /*
   * ⚠️ Recolhivel, e comeca ABERTO.
   *
   * Favorito e atalho: escondido por padrao, ele deixa de ser atalho e vira mais
   * um clique. Recolher existe para quem tem quinze e quer ver os grupos sem
   * rolar — e quem recolhe faz isso uma vez.
   */
  const [aberto, setAberto] = useState(true);

  /*
   * ⚠️ Agrupado pelo PAI, e nao uma lista corrida.
   *
   * "Titulos" existe em contas a receber e em contas a pagar. Favoritando os
   * dois, a lista mostrava "Titulos" duas vezes sem dizer qual era qual — e o
   * atalho que deveria poupar tempo virava um chute entre dois iguais.
   */
  const porPai = new Map<string, Item[]>();
  for (const t of telas) {
    const pai = paiDaRota(t.href) ?? "Outros";
    porPai.set(pai, [...(porPai.get(pai) ?? []), t]);
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setAberto((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 32,
          padding: "0 8px",
          border: "none",
          background: "transparent",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          fontFamily: "var(--font)",
          fontSize: "var(--text-base)",
          fontWeight: 550,
          color: "var(--sidebar-item-color)",
          textAlign: "left",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ display: "flex", color: "var(--primary)" }}>
          <EstrelaCheia />
        </span>
        <span style={{ flex: 1 }}>Favoritos</span>
        <Chevron aberto={aberto} tamanho={12} />
      </button>

      {aberto && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--nav-item-gap)" }}>
          {[...porPai.entries()].map(([pai, itens]) => (
            <div key={pai}>
              {/*
                O nome do pai NAO e clicavel: ele nao leva a lugar nenhum, e um
                grupo aqui e so contexto para distinguir dois filhos de mesmo
                nome. Clicavel, prometeria uma tela que nao existe.
              */}
              <div
                style={{
                  padding: "0 8px 0 var(--nav-texto-x1)",
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  fontSize: "var(--text-sm)",
                  color: "var(--sidebar-item-sub)",
                  whiteSpace: "nowrap",
                }}
              >
                {pai}
              </div>

              {itens.map((t) => (
                <ItemNav key={t.href} item={t} ativo={ehAtivo(t.href, pathname)} nivel={2} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EstrelaCheia() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.9L12 2.5z" />
    </svg>
  );
}

/**
 * Barra recolhida: icones dos grupos, com o menu completo no hover.
 *
 * Clicar no icone expande a barra e abre o grupo; passar o mouse mostra as
 * opcoes num cartao flutuante, sem precisar expandir.
 */
function MenuRecolhido({
  grupos,
  pathname,
  expandir,
}: {
  grupos: Grupo[];
  pathname: string;
  expandir: (chave: string) => void;
}) {
  return (
    <>
      {grupos.map((grupo) => (
        <GrupoFlutuante
          key={grupo.key}
          grupo={grupo}
          pathname={pathname}
          ativo={telasDoGrupo(grupo).some((i) => ehAtivo(i.href, pathname))}
          aoFixar={() => expandir(grupo.key)}
        />
      ))}
    </>
  );
}


/**
 * Um item do rodape da barra — hoje, Configuracoes.
 *
 * ⚠️ E o mesmo desenho do botao do WhatsApp, de proposito: caixa de 15px para o
 * glifo, altura de item de menu, rotulo comecando na coluna de texto de todos os
 * outros. O rodape tem dois moradores e eles precisam parecer da mesma casa.
 *
 * ⚠️ Recolhida, sobra so o icone e o nome vai para a dica do mouse — como os
 * grupos fazem.
 */
function ItemDoRodape({
  href,
  rotulo,
  icone,
  recolhida,
  ativo = false,
}: {
  /**
   * Para onde leva. SEM ele, o item aparece mas nao clica.
   *
   * ⚠️ Existe assim de proposito: Configuracoes esta reservado e vai deixar de
   * apontar para `/configuracoes` — o destino dele sera outro. Enquanto o
   * destino nao existe, levar a pessoa a uma tela que nao e aquela ensina o
   * caminho errado, e tirar o item do rodape faria a pessoa reaprender o lugar
   * quando ele voltasse.
   */
  href?: string;
  rotulo: string;
  icone: React.ReactNode;
  recolhida: boolean;
  ativo?: boolean;
}) {
  const estilo: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: recolhida ? "center" : "flex-start",
    gap: 8,
    height: "var(--nav-item-h)",
    padding: recolhida ? 0 : "0 8px",
    borderRadius: "var(--radius-sm)",
    background: ativo ? "var(--primary-subtle)" : "transparent",
    color: ativo ? "var(--primary)" : "var(--sidebar-item-sub)",
    fontSize: "var(--text-base)",
    fontWeight: ativo ? 600 : 450,
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "background var(--dur-fast) var(--ease)",
  };

  const dentro = (
    <>
      <span style={{ width: 15, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {icone}
      </span>
      {!recolhida && rotulo}
    </>
  );

  /* Sem destino, e so a marca do lugar: nao acende ao passar o mouse, para nao
     prometer um clique que nao acontece. */
  if (!href) {
    return (
      <div title={recolhida ? rotulo : undefined} style={{ ...estilo, opacity: 0.55 }}>
        {dentro}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={recolhida ? rotulo : undefined}
      aria-label={rotulo}
      style={estilo}
      onMouseOver={(e) => {
        if (!ativo) e.currentTarget.style.background = "var(--sidebar-item-bg-hover)";
      }}
      onMouseOut={(e) => {
        if (!ativo) e.currentTarget.style.background = "transparent";
      }}
    >
      {dentro}
    </Link>
  );
}

/** Engrenagem: os ajustes da casa. */
function IconeEngrenagem() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.5A1.7 1.7 0 0 0 10.5 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.04z" />
    </svg>
  );
}
