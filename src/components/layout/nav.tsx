"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFavoritos } from "@/components/layout/favoritos";
import { ehSubgrupo, telasDoGrupo, type Grupo, type Item, type Subgrupo } from "@/components/layout/rotas";
import { Icon } from "@/components/layout/icones";

/**
 * Arvore de navegacao.
 *
 * Hierarquia se le por tres coisas, nesta ordem: o trilho vertical de 1px que
 * liga os itens de um grupo, o marcador circular no centro de cada item, e o
 * recuo do texto. Todos os valores vem de token (`--nav-*`), para que item de
 * menu novo caia exatamente sobre a mesma linha.
 *
 * Nivel 1 (grupo) tem icone; o trilho dos filhos desce do centro desse icone.
 * O texto do filho comeca na mesma coluna do rotulo do grupo — sem isso o
 * subitem parece estar mais a esquerda que o pai.
 */

export function ArvoreNav({
  grupos,
  pathname,
  abertoManual,
  setAbertoManual,
}: {
  grupos: Grupo[];
  pathname: string;
  abertoManual: string | null;
  setAbertoManual: (k: string | null) => void;
}) {
  return (
    <>
      {grupos.map((g) => (
        <GrupoNav
          key={g.key}
          grupo={g}
          pathname={pathname}
          abertoManual={abertoManual}
          setAbertoManual={setAbertoManual}
        />
      ))}
    </>
  );
}

function GrupoNav({
  grupo,
  pathname,
  abertoManual,
  setAbertoManual,
}: {
  grupo: Grupo;
  pathname: string;
  abertoManual: string | null;
  setAbertoManual: (k: string | null) => void;
}) {
  // Considera as telas dentro de subgrupos: estar em "Extrato" tem de acender
  // "Financeiro", nao so "Caixas e Bancos".
  const grupoAtivo = telasDoGrupo(grupo).some((i) => ehAtivo(i.href, pathname));
  const aberto = abertoManual === null ? grupoAtivo : abertoManual === grupo.key;

  return (
    <div style={{ marginBottom: "var(--nav-item-gap)" }}>
      <button
        onClick={() => setAbertoManual(aberto ? "" : grupo.key)}
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
          fontWeight: grupoAtivo ? 650 : 550,
          color: "var(--sidebar-item-color)",
          textAlign: "left",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Icon name={grupo.icon} color={grupoAtivo ? "var(--primary)" : "var(--sidebar-item-sub)"} />
        <span style={{ flex: 1 }}>{grupo.label}</span>
        <Chevron aberto={aberto} tamanho={12} />
      </button>

      {aberto && (
        <Trilho nivel={1}>
          {grupo.items.map((filho) =>
            ehSubgrupo(filho) ? (
              <SubgrupoNav key={filho.key} subgrupo={filho} pathname={pathname} />
            ) : (
              <ItemNav key={filho.href} item={filho} ativo={ehAtivo(filho.href, pathname)} nivel={1} />
            ),
          )}
        </Trilho>
      )}
    </div>
  );
}

/**
 * Segundo nivel.
 *
 * Sem icone e sem negrito: a hierarquia vem da indentacao e do chevron, nao de
 * peso de fonte competindo com o titulo do grupo. Abre sozinho quando a tela
 * atual esta dentro dele.
 */
function SubgrupoNav({ subgrupo, pathname }: { subgrupo: Subgrupo; pathname: string }) {
  const contemAtiva = subgrupo.items.some((i) => ehAtivo(i.href, pathname));
  const [aberto, setAberto] = useState(contemAtiva);

  return (
    <div>
      {/* Marcador fora do botao: assim o realce do hover comeca depois da
          bolinha, sem cobrir o trilho — mesma regra do item selecionado. */}
      <div style={{ position: "relative" }}>
        <Marcador x="var(--nav-trilho-x1)" aceso={contemAtiva} />

        <button
          onClick={() => setAberto((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "calc(100% - var(--nav-trilho-x1) - var(--nav-card-gap))",
            marginLeft: "calc(var(--nav-trilho-x1) + var(--nav-card-gap))",
            height: "var(--nav-item-h)",
            padding:
              "0 8px 0 calc(var(--nav-texto-x1) - var(--nav-trilho-x1) - var(--nav-card-gap))",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            fontWeight: 400,
            color: contemAtiva ? "var(--sidebar-item-color)" : "var(--sidebar-item-sub)",
            textAlign: "left",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ flex: 1 }}>{subgrupo.label}</span>
          <Chevron aberto={aberto} tamanho={11} />
        </button>
      </div>

      {aberto && (
        <Trilho nivel={2}>
          {subgrupo.items.map((item) => (
            <ItemNav key={item.href} item={item} ativo={ehAtivo(item.href, pathname)} nivel={2} />
          ))}
        </Trilho>
      )}
    </div>
  );
}

/**
 * Linha vertical que liga os itens de um mesmo nivel.
 *
 * Comeca e termina no centro do primeiro e do ultimo marcador: descer do topo
 * do bloco ou ate o fim deixaria pontas de linha sobrando fora da sequencia.
 */
function Trilho({ nivel, children }: { nivel: 1 | 2; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        marginTop: "var(--nav-item-gap)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--nav-item-gap)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: nivel === 1 ? "var(--nav-trilho-x1)" : "var(--nav-trilho-x2)",
          top: "calc(var(--nav-item-h) / 2)",
          bottom: "calc(var(--nav-item-h) / 2)",
          width: "var(--nav-trilho-largura)",
          background: "var(--nav-trilho-cor)",
        }}
      />
      {children}
    </div>
  );
}

/** Bolinha do item sobre o trilho. */
function Marcador({ x, aceso }: { x: string; aceso: boolean }) {
  return (
    <span
      aria-hidden
      className="redondo"
      style={{
        position: "absolute",
        left: x,
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "var(--nav-marcador)",
        height: "var(--nav-marcador)",
        borderRadius: "var(--radius-full)",
        background: aceso ? "var(--primary)" : "var(--nav-marcador-cor)",
        // O anel na cor do fundo abre um respiro entre a bolinha e a linha.
        boxShadow: "0 0 0 2px var(--sidebar-bg)",
      }}
    />
  );
}

function Chevron({ aberto, tamanho }: { aberto: boolean; tamanho: number }) {
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
 * Ao passar o mouse, a estrela aparece na ponta direita: so telas finais podem
 * ser favoritadas — favoritar um grupo nao levaria a lugar nenhum.
 */
export function ItemNav({
  item,
  ativo,
  nivel,
}: {
  item: Item;
  ativo: boolean;
  /** 1 = filho de grupo, 2 = filho de subgrupo, 0 = lista de favoritos. */
  nivel: 0 | 1 | 2;
}) {
  const [sobre, setSobre] = useState(false);
  const favoritos = useFavoritos((s) => s.rotas);
  const alternar = useFavoritos((s) => s.alternar);

  const favoritado = favoritos.includes(item.href);
  const trilhoX = nivel === 2 ? "var(--nav-trilho-x2)" : "var(--nav-trilho-x1)";
  const textoX = nivel === 2 ? "var(--nav-texto-x2)" : "var(--nav-texto-x1)";

  // O marcador fica FORA do link: assim o fundo do item selecionado comeca
  // depois da bolinha, em vez de engolir o trilho.
  const recuoDoCard = nivel === 0 ? "0px" : `calc(${trilhoX} + var(--nav-card-gap))`;

  return (
    <div style={{ position: "relative" }}>
      {nivel > 0 && <Marcador x={trilhoX} aceso={ativo} />}

      <Link
        href={item.href}
        onMouseEnter={() => setSobre(true)}
        onMouseLeave={() => setSobre(false)}
        style={{
          display: "flex",
          alignItems: "center",
          height: "var(--nav-item-h)",
          marginLeft: recuoDoCard,
          padding: `0 4px 0 calc(${textoX} - ${recuoDoCard})`,
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-base)",
          fontWeight: ativo ? 600 : 450,
          color: ativo ? "var(--primary)" : "var(--sidebar-item-sub)",
          background: ativo ? "var(--primary-subtle)" : "transparent",
          whiteSpace: "nowrap",
          transition: "background var(--dur-fast) var(--ease)",
        }}
        onMouseOver={(e) => {
          if (!ativo) e.currentTarget.style.background = "var(--sidebar-item-bg-hover)";
        }}
        onMouseOut={(e) => {
          if (!ativo) e.currentTarget.style.background = "transparent";
        }}
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
    </div>
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

export function ehAtivo(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
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
          width: "100%",
          height: 36,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: ativo || aberto ? "var(--primary-subtle)" : "transparent",
          borderRadius: "var(--radius-sm)",
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
                border: "1px solid var(--border-strong)",
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

            {/* Mesmo trilho e mesmos itens da barra expandida — nao ha por que
                o cartao ter uma segunda linguagem de hierarquia. */}
            <Trilho nivel={1}>
              {grupo.items.map((filho) =>
                ehSubgrupo(filho) ? (
                  <SubgrupoNav key={filho.key} subgrupo={filho} pathname={pathname} />
                ) : (
                  <ItemNav
                    key={filho.href}
                    item={filho}
                    ativo={ehAtivo(filho.href, pathname)}
                    nivel={1}
                  />
                ),
              )}
            </Trilho>
          </div>
        </div>
      )}
    </div>
  );
}


