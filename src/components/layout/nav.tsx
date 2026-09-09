"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFavoritos } from "@/components/layout/favoritos";
import {
  ehSubgrupo,
  telasDoGrupo,
  VISAO_GERAL,
  TODAS_AS_ROTAS,
  type Grupo,
  type Item,
  type Subgrupo,
} from "@/components/layout/rotas";
import { Icon } from "@/components/layout/icones";

/**
 * Navegacao por NIVEIS: uma lista de cada vez, e o caminho por cima dela.
 *
 * ⚠️ Substituiu a arvore de tres niveis abertos ao mesmo tempo.
 *
 * A arvore mostrava dez linhas para oferecer duas telas, e cada linha de
 * submenu carregava quatro sinais de hierarquia ao mesmo tempo (trilho,
 * marcador, recuo e chevron) para dizer uma coisa so. O que sobrou aqui e a
 * lista do nivel em que voce esta, com o caminho ate ele em cima: quem chega ve
 * tres ou quatro nomes, e nao a estrutura inteira do sistema.
 *
 * ⚠️ O custo assumido: trocar de subgrupo passou a exigir subir e descer. Dentro
 * de um mesmo nivel a troca continua sendo um clique, que e onde o dia inteiro
 * acontece, e os FAVORITOS existem no topo justamente para os pulos longos.
 */
export function NavPorNiveis({
  grupos,
  pathname,
  trilha,
  setTrilha,
}: {
  grupos: Grupo[];
  pathname: string;
  /** Onde a pessoa desceu. Grupo `null` e a lista de assuntos. */
  trilha: Trilha;
  setTrilha: (t: Trilha) => void;
}) {
  const grupo = grupos.find((g) => g.key === trilha.grupo) ?? null;
  const subgrupo =
    grupo && trilha.sub
      ? ((grupo.items.find((f) => ehSubgrupo(f) && f.key === trilha.sub) as Subgrupo | undefined) ??
        null)
      : null;

  /* A raiz: a visao geral, e depois os assuntos do sistema. */
  if (!grupo) {
    return (
      <Coluna>
        {/*
          ⚠️ Ela vem ANTES dos grupos e nao desce nivel nenhum: e uma tela, e nao
          uma gaveta. Por isso e um `ItemNav`, com o mesmo desenho de qualquer
          tela final — e nao uma `LinhaQueDesce` com seta prometendo mais um
          passo que nao existe.
        */}
        <ItemNav item={VISAO_GERAL} ativo={ehAtivo(VISAO_GERAL.href, pathname)} />

        {grupos.map((g) => (
          <LinhaQueDesce
            key={g.key}
            rotulo={g.label}
            icone={<Icon name={g.icon} color={corDoIcone(g, pathname)} />}
            forte
            aceso={telasDoGrupo(g).some((i) => ehAtivo(i.href, pathname))}
            onClick={() => setTrilha({ grupo: g.key, sub: null })}
          />
        ))}
      </Coluna>
    );
  }

  const filhos = subgrupo ? subgrupo.items : grupo.items;

  return (
    <Coluna>
      <Caminho grupo={grupo} subgrupo={subgrupo} aoVoltar={setTrilha} />

      {filhos.map((filho) =>
        ehSubgrupo(filho) ? (
          <LinhaQueDesce
            key={filho.key}
            rotulo={filho.label}
            aceso={filho.items.some((i) => ehAtivo(i.href, pathname))}
            onClick={() => setTrilha({ grupo: grupo.key, sub: filho.key })}
          />
        ) : (
          <ItemNav key={filho.href} item={filho} ativo={ehAtivo(filho.href, pathname)} />
        ),
      )}
    </Coluna>
  );
}

/** Onde a pessoa desceu no menu. */
export type Trilha = { grupo: string | null; sub: string | null };

function Coluna({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--nav-item-gap)" }}>
      {children}
    </div>
  );
}

/**
 * De quem e a tela aberta, para a barra abrir ja no nivel dela.
 *
 * ⚠️ Devolve o SUBGRUPO quando ha um, e nao so o grupo. Chegar em Baixas pela
 * busca do topo e cair na lista de assuntos obrigaria a descer de novo ate onde
 * a pessoa acabou de chegar.
 */
export function trilhaDaRota(grupos: Grupo[], pathname: string): Trilha {
  for (const g of grupos) {
    for (const f of g.items) {
      if (ehSubgrupo(f)) {
        if (f.items.some((i) => ehAtivo(i.href, pathname))) return { grupo: g.key, sub: f.key };
      } else if (ehAtivo(f.href, pathname)) {
        return { grupo: g.key, sub: null };
      }
    }
  }
  return { grupo: null, sub: null };
}

function corDoIcone(grupo: Grupo, pathname: string): string {
  return telasDoGrupo(grupo).some((i) => ehAtivo(i.href, pathname))
    ? "var(--primary)"
    : "var(--sidebar-item-sub)";
}

/**
 * O caminho ate o nivel aberto, e a saida dele.
 *
 * ⚠️ Cada degrau anterior e um BOTAO, e o ultimo nao. Voltar e o que este menu
 * cobra em troca de mostrar pouco, entao precisa estar sempre a vista; o degrau
 * em que voce ja esta nao leva a lugar nenhum, e clicavel prometeria uma tela
 * que nao existe.
 */
function Caminho({
  grupo,
  subgrupo,
  aoVoltar,
}: {
  grupo: Grupo;
  subgrupo: Subgrupo | null;
  aoVoltar: (t: Trilha) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        /*
          ⚠️ O recuo do caminho e o do rotulo das opcoes, menos o respiro que os
          degraus tem por dentro. Os dois precisam nascer na mesma coluna: com o
          caminho quatro pixels a direita, a lista abaixo dele parecia recuada
          para tras e a barra inteira lia torta.
        */
        padding: "2px 8px 6px 4px",
        fontSize: "var(--text-sm)",
        color: "var(--sidebar-item-sub)",
      }}
    >
      <Degrau rotulo="Início" onClick={() => aoVoltar({ grupo: null, sub: null })} />
      <Seta />

      {subgrupo ? (
        <>
          <Degrau rotulo={grupo.label} onClick={() => aoVoltar({ grupo: grupo.key, sub: null })} />
          <Seta />
          <Aqui rotulo={subgrupo.label} />
        </>
      ) : (
        <Aqui rotulo={grupo.label} />
      )}
    </div>
  );
}

function Aqui({ rotulo }: { rotulo: string }) {
  return (
    <span
      style={{
        padding: "2px 4px",
        fontWeight: "var(--fw-semi)",
        color: "var(--sidebar-item-color)",
      }}
    >
      {rotulo}
    </span>
  );
}

function Degrau({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 4px",
        border: "none",
        borderRadius: "var(--radius-xs)",
        background: "transparent",
        fontFamily: "var(--font)",
        fontSize: "var(--text-sm)",
        color: "var(--sidebar-item-sub)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--sidebar-item-bg-hover)";
        e.currentTarget.style.color = "var(--sidebar-item-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--sidebar-item-sub)";
      }}
    >
      {rotulo}
    </button>
  );
}

function Seta() {
  return (
    <span aria-hidden style={{ color: "var(--nav-marcador-cor)" }}>
      ›
    </span>
  );
}

/**
 * Linha que leva a outro NIVEL, e nao a uma tela.
 *
 * ⚠️ A seta aponta para a direita, e nao para baixo. Chevron para baixo promete
 * que a lista abre ali mesmo, empurrando o resto para baixo; aqui a lista
 * SUBSTITUI esta, e a seta lateral e o que diz isso antes do clique.
 */
function LinhaQueDesce({
  rotulo,
  icone,
  aceso,
  forte = false,
  onClick,
}: {
  rotulo: string;
  icone?: React.ReactNode;
  aceso: boolean;
  /** Assunto de primeiro nivel: pesa mais que subgrupo. */
  forte?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: "var(--nav-item-h)",
        padding: "0 8px",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
        cursor: "pointer",
        fontFamily: "var(--font)",
        fontSize: "var(--text-base)",
        fontWeight: forte ? (aceso ? 650 : 550) : aceso ? 590 : 500,
        /*
          ⚠️ Tinta de TEXTO, e nao de legenda.

          Em `--sidebar-item-sub` a opcao ficava do mesmo cinza dos rotulos
          secundarios da casa, e cinza fraco o olho le como coisa desligada: a
          lista parecia uma legenda de tres linhas, e nao tres alvos de clique.
          O tom cheio e o que separa o que se clica do que so se le.
        */
        color: aceso ? "var(--primary)" : "var(--sidebar-item-color)",
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icone && <span style={{ display: "flex", flexShrink: 0 }}>{icone}</span>}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{rotulo}</span>
      <span aria-hidden style={{ display: "flex", flexShrink: 0, color: "var(--nav-marcador-cor)" }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

export function Chevron({ aberto, tamanho }: { aberto: boolean; tamanho: number }) {
  return (
    <span
      style={{
        display: "flex",
        color: "var(--sidebar-item-sub)",
        transform: aberto ? "rotate(180deg)" : "none",
        transition: "transform var(--dur-fast) var(--ease)",
      }}
    >
      <Icon name="chevron" size={tamanho} />
    </span>
  );
}

/**
 * Item de tela.
 *
 * ⚠️ Sem marcador e sem recuo por nivel. Os dois existiam para desenhar a
 * profundidade dentro da arvore; com uma lista por vez, a profundidade esta no
 * caminho acima dela, e repeti-la em cada linha so gastava a coluna.
 *
 * Ao passar o mouse, a estrela aparece na ponta direita: so telas finais podem
 * ser favoritadas — favoritar um grupo nao levaria a lugar nenhum.
 */
export function ItemNav({
  item,
  ativo,
  recuo = 8,
}: {
  item: Item;
  ativo: boolean;
  /** Recuo do texto. So os favoritos usam outro, para caberem sob o nome do pai. */
  recuo?: number;
}) {
  const [sobre, setSobre] = useState(false);
  const favoritos = useFavoritos((s) => s.rotas);
  const alternar = useFavoritos((s) => s.alternar);

  const favoritado = favoritos.includes(item.href);

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: "var(--nav-item-h)",
        padding: `0 4px 0 ${recuo}px`,
        borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
        fontSize: "var(--text-base)",
        fontWeight: ativo ? 590 : 500,
        /* Mesma tinta cheia da `LinhaQueDesce`: as duas sao coisas que se
           clicam, e uma mais apagada que a outra faria a lista parecer ter
           opcoes ligadas e desligadas misturadas. */
        color: ativo ? "var(--primary)" : "var(--sidebar-item-color)",
        /* ⚠️ O item aceso NAO tem fundo: ele ja esta azul e em negrito, e o
           retangulo tingido era a mesma frase pela terceira vez. Sem ele, fundo
           na barra volta a significar so "o mouse esta aqui". */
        background: "transparent",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>

      <button
        onClick={(e) => {
          // Sem isto, favoritar tambem navegaria para a tela.
          e.preventDefault();
          e.stopPropagation();
          alternar(item.href);
        }}
        aria-label={favoritado ? `Desfavoritar ${item.label}` : `Favoritar ${item.label}`}
        title={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        tabIndex={sobre || favoritado ? 0 : -1}
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          borderRadius: "var(--radius-xs)",
          cursor: "pointer",
          color: favoritado ? "var(--primary)" : "var(--sidebar-item-sub)",
          // Favoritado fica sempre visivel; o resto so no hover. Esconder com
          // `display: none` mudaria a largura do item a cada passagem do mouse.
          opacity: favoritado || sobre ? 1 : 0,
          pointerEvents: sobre || favoritado ? "auto" : "none",
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <Estrela preenchida={favoritado} />
      </button>
    </Link>
  );
}

function Estrela({ preenchida }: { preenchida: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={preenchida ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.9L12 2.5z" />
    </svg>
  );
}

/**
 * Qual item do menu esta aceso.
 *
 * O casamento por PREFIXO existe para a tela de detalhe: em `/projetos/5` quem
 * fica aceso e "Projetos", que e o item mais proximo que existe no menu.
 *
 * ⚠️ Mas prefixo sozinho acende DOIS itens quando uma tela mora dentro de
 * outra. `/contas-pagar/baixas` casava com "Contas a pagar" e com "Baixas" ao
 * mesmo tempo, e o menu apontava para Titulos enquanto a tela aberta era a de
 * Baixas. Por isso o prefixo so vale quando nenhuma rota MAIS ESPECIFICA
 * tambem casa: a mais especifica ganha, e o item generico apaga.
 */
export function ehAtivo(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;

  return !TODAS_AS_ROTAS.some(
    (r) =>
      r.href !== href &&
      r.href.startsWith(href + "/") &&
      (pathname === r.href || pathname.startsWith(r.href + "/")),
  );
}

/**
 * Menu flutuante da barra recolhida.
 *
 * Passar o mouse no icone abre um cartao com as opcoes daquele grupo, com os
 * subgrupos ainda expansiveis — recolher a barra nao pode custar o acesso ao
 * terceiro nivel.
 *
 * O cartao nasce colado no icone (`left: 100%` com o respiro vindo do padding,
 * nao de margem) para o mouse nao atravessar um vao e fechar o menu no caminho.
 * Ainda assim ha um atraso curto no fechamento: sem ele, um tremor da mao entre
 * icone e cartao ja apagaria o menu.
 */
export function GrupoFlutuante({
  grupo,
  pathname,
  ativo,
  aoFixar,
}: {
  grupo: Grupo;
  pathname: string;
  ativo: boolean;
  /** Clique no icone expande a barra e abre este grupo. */
  aoFixar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const fechamento = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mostrar() {
    if (fechamento.current) clearTimeout(fechamento.current);
    setAberto(true);
  }

  function esconder() {
    fechamento.current = setTimeout(() => setAberto(false), 120);
  }

  return (
    <div
      onMouseEnter={mostrar}
      onMouseLeave={esconder}
      style={{ position: "relative", marginBottom: "var(--nav-item-gap)" }}
    >
      <button
        onClick={aoFixar}
        title={grupo.label}
        aria-label={grupo.label}
        aria-expanded={aberto}
        style={{
          /*
            ⚠️ QUADRADO, e com o canto dos controles da casa.

            Recolhida, o item deixa de ser uma linha de lista e vira um alvo de
            icone — a mesma coisa que os discos da barra de ferramentas sao. O
            retangulo de 36 com canto pequeno era o desenho de quando isto era
            uma lista espremida; quadrado, na medida da barra (`--h-controle`) e
            com `--radius-full` — que a superelipse da casa transforma naquele
            canto muito mole —, ele passa a pertencer a familia certa.
          */
          width: "var(--h-controle)",
          height: "var(--h-controle)",
          display: "grid",
          placeItems: "center",
          border: "none",
          background: ativo || aberto ? "var(--primary-subtle)" : "transparent",
          borderRadius: "var(--radius-full)",
          cursor: "pointer",
        }}
      >
        <Icon
          name={grupo.icon}
          size={17}
          color={ativo ? "var(--primary)" : "var(--sidebar-item-sub)"}
        />
      </button>

      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            left: "100%",
            top: -4,
            zIndex: 300,
            // O respiro vem do padding: com margem, o mouse cruzaria um vao
            // sem elemento e o menu fecharia no meio do caminho.
            paddingLeft: 6,
          }}
        >
          <div
            style={
              {
                minWidth: 216,
                background: "var(--surface)",
                /* ⚠️ SEM borda: a sombra ja separa o cartao do que esta atras.
                Contorno mais sombra e a mesma coisa dita duas vezes. Ver
                `07-DESIGN-TOKENS`, cartao flutuante. */
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-md)",
                padding: "4px 4px 8px",
                // O anel do marcador e o hover leem `--sidebar-bg`. Redefinir a
                // variavel aqui faz os dois acompanharem o branco do cartao sem
                // duplicar componente.
                "--sidebar-bg": "var(--surface)",
                "--sidebar-item-sub": "var(--text-secondary)",
                "--sidebar-item-color": "var(--text-primary)",
                "--sidebar-item-bg-hover": "var(--surface-hover)",
              } as React.CSSProperties
            }
          >
            <div
              className="rotulo"
              style={{ padding: "6px 8px 2px", color: "var(--text-tertiary)" }}
            >
              {grupo.label}
            </div>

            {/*
              ⚠️ O grupo INTEIRO, aberto, e nao um nivel por vez.

              Expandida a barra pede o caminho de volta para trocar de subgrupo;
              aqui nao ha barra nenhuma, e o cartao existe por um instante sob o
              mouse. Fazer descer e subir dentro de algo que fecha quando o mouse
              escorrega seria cobrar duas vezes. Aqui o subgrupo vira TITULO de
              bloco, e todas as telas do assunto ficam a um clique.
            */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--nav-item-gap)" }}>
              {grupo.items.map((filho) =>
                ehSubgrupo(filho) ? (
                  <div key={filho.key}>
                    <div
                      style={{
                        padding: "6px 8px 2px",
                        fontSize: "var(--text-sm)",
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {filho.label}
                    </div>
                    {filho.items.map((it) => (
                      <ItemNav
                        key={it.href}
                        item={it}
                        ativo={ehAtivo(it.href, pathname)}
                        recuo={18}
                      />
                    ))}
                  </div>
                ) : (
                  <ItemNav
                    key={filho.href}
                    item={filho}
                    ativo={ehAtivo(filho.href, pathname)}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


