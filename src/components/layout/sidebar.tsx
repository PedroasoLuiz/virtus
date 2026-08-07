"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Modulo } from "@/modules/plataforma/plataforma.types";
import {
  gruposDosModulos,
  telasDoGrupo,
  TODAS_AS_ROTAS,
  type Grupo,
  type Item,
} from "@/components/layout/rotas";
import { useFavoritos } from "@/components/layout/favoritos";
import { ArvoreNav, GrupoFlutuante, ItemNav, ehAtivo } from "@/components/layout/nav";
import { Icon } from "@/components/layout/icones";
import { MenuUsuario } from "@/components/layout/menu-usuario";
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
  recolhidaInicial,
  email,
  usuarioNome,
  podeTrocarEmpresa,
  grupos: gruposFixos,
  inicio = "/dashboard",
  hrefTrocarEmpresa,
  whatsapp = false,
}: {
  modulos: Modulo[];
  empresa: string | null;
  recolhidaInicial: boolean;
  email: string;
  usuarioNome: string | null;
  podeTrocarEmpresa: boolean;
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
  /** Destino do "Trocar de empresa". O portal escolhe entre EMISSORES. */
  hrefTrocarEmpresa?: string;
  /**
   * O acesso ao WhatsApp, acima da identidade do usuario.
   *
   * ⚠️ Nao vem ligado. O portal do cliente usa esta mesma barra, e la nao ha
   * caixa de entrada nenhuma para abrir.
   */
  whatsapp?: boolean;
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

  const grupos = gruposFixos ?? gruposDosModulos(modulos);

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
          <Link
            href={inicio}
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "var(--primary)" }}>V</span>Pay
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
            {telasFavoritas.length > 0 && <Favoritos telas={telasFavoritas} pathname={pathname} />}

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

      {/* Rodape: WhatsApp, empresa ativa e identidade do usuario. */}
      <div style={{ flexShrink: 0, padding: recolhida ? "10px 6px" : "10px 12px" }}>
        {whatsapp && (
          <div style={{ marginBottom: 8 }}>
            <BotaoLateralDoWhatsapp recolhida={recolhida} />
          </div>
        )}

        {!recolhida && empresa && (
          /*
           * A empresa ativa e o alvo da troca, quando ha mais de uma.
           *
           * Antes era texto morto e a troca so existia dentro do menu do
           * usuario — dois cliques e um lugar que ninguem abre para trocar de
           * empresa. Clicando no proprio nome, o gesto fica onde a informacao
           * esta.
           */
          <EmpresaAtiva
            empresa={empresa}
            href={podeTrocarEmpresa ? hrefTrocarEmpresa : undefined}
          />
        )}
        <MenuUsuario
          email={email}
          nome={usuarioNome}
          trocarEmpresa={podeTrocarEmpresa}
          hrefTrocarEmpresa={hrefTrocarEmpresa}
          compacto={recolhida}
          acimaDoBotao
        />
      </div>
    </aside>
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
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 32,
          padding: "0 8px",
          fontSize: "var(--text-base)",
          fontWeight: 550,
          color: "var(--sidebar-item-color)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ display: "flex", color: "var(--primary)" }}>
          <EstrelaCheia />
        </span>
        <span style={{ flex: 1 }}>Favoritos</span>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--nav-item-gap)" }}
      >
        {telas.map((t) => (
          <ItemNav key={t.href} item={t} ativo={ehAtivo(t.href, pathname)} nivel={0} />
        ))}
      </div>
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
 * A empresa ativa no rodape da barra.
 *
 * Vira link so quando ha para onde ir: com uma empresa so, um alvo de clique que
 * leva a uma tela sem decisao e pior que texto.
 */
function EmpresaAtiva({ empresa, href }: { empresa: string; href?: string }) {
  /*
   * Flex, e nao texto com icone dentro.
   *
   * Com o SVG inline, o nome longo consumia a largura toda e a seta caia para a
   * linha de baixo. Aqui o nome encolhe com reticencias (`minWidth: 0` e o que
   * permite isso dentro de um flex) e a seta fica fixa ao lado.
   */
  const estilo: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: "var(--text-xs)",
    color: "var(--sidebar-item-sub)",
    padding: "0 4px 6px",
    textDecoration: "none",
  };

  const nome = (
    <span
      style={{
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {empresa}
    </span>
  );

  if (!href) {
    return (
      <div title={empresa} style={estilo}>
        {nome}
      </div>
    );
  }

  return (
    <Link href={href} title={`${empresa} — trocar de empresa`} style={estilo}>
      {nome}
      {/* Chevron: o texto sozinho nao se anuncia como clicavel, e sublinhado
          brigaria com o resto do rodape, que nao tem nenhum. */}
      <svg
        width="9"
        height="9"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M6 4l4 4-4 4" />
      </svg>
    </Link>
  );
}
