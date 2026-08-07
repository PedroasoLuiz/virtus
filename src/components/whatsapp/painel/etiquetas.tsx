"use client";

import { useEffect, useRef, useState } from "react";
import { Button, inputStyle } from "@/components/ui/kit";
import { CORES_DE_ETIQUETA } from "@/modules/whatsapp/whatsapp.schema";
import type { CorDeEtiqueta, Etiqueta } from "@/modules/whatsapp/whatsapp.types";

/**
 * Etiquetas de conversa: o chip e o menu de marcar.
 *
 * Fora do `painel.tsx` porque aquele arquivo ja passa de duas mil linhas, e
 * etiqueta e um assunto fechado: nada aqui precisa saber de mensagem, janela de
 * 24h ou envio.
 */

/**
 * A paleta, presa aos tokens de status.
 *
 * ⚠️ Nao ha cor livre. Um seletor de hex parece generosidade e cobra caro
 * depois: o tom que a pessoa escolheu no tema claro some no escuro, e nao ha
 * ninguem para consertar conversa por conversa.
 */
export const PALETA: Record<CorDeEtiqueta, { fundo: string; borda: string; texto: string }> = {
  verde: { fundo: "var(--success-bg)", borda: "var(--success-border)", texto: "var(--success-text)" },
  azul: { fundo: "var(--info-bg)", borda: "var(--info-border)", texto: "var(--info-text)" },
  ambar: { fundo: "var(--warning-bg)", borda: "var(--warning-border)", texto: "var(--warning-text)" },
  vermelho: { fundo: "var(--danger-bg)", borda: "var(--danger-border)", texto: "var(--danger-text)" },
  roxo: { fundo: "var(--roxo-bg)", borda: "var(--roxo-border)", texto: "var(--roxo-text)" },
  cinza: { fundo: "var(--neutral-bg)", borda: "var(--neutral-border)", texto: "var(--text-secondary)" },
};

const NOME_DA_COR: Record<CorDeEtiqueta, string> = {
  verde: "Verde",
  azul: "Azul",
  ambar: "Âmbar",
  vermelho: "Vermelho",
  roxo: "Roxo",
  cinza: "Cinza",
};

/**
 * Chip de etiqueta. Serve de filtro e de exibição.
 *
 * ⚠️ Quando é filtro, o estado APAGADO é o cinza e não a cor: com todos os chips
 * coloridos o tempo todo, a fileira vira um arco-íris e ninguém enxerga quais
 * estão ligados.
 */
export function ChipDeEtiqueta({
  etiqueta,
  ativa = true,
  miudo = false,
  onClick,
  onRemover,
}: {
  etiqueta: Etiqueta;
  ativa?: boolean;
  /**
   * Versao MARCA: menor, fundo neutro e a cor so na bolinha da esquerda.
   *
   * ⚠️ E o que aparece grudado num nome de cliente e dentro do menu de escolha.
   * Ali o chip nao esta dizendo "isto esta ligado" — esta dizendo "esta conversa
   * e isto". Pintar o balao inteiro dava a mesma voz de um estado de alerta, e
   * duas etiquetas coloridas ao lado de um nome roubavam o proprio nome.
   */
  miudo?: boolean;
  onClick?: () => void;
  onRemover?: () => void;
}) {
  const cor = PALETA[etiqueta.cor] ?? PALETA.cinza;

  const conteudo = (
    <>
      {/*
        A bolinha some na versão miúda: ali o chip inteiro já é da cor da
        etiqueta, e um ponto da mesma cor dentro dele repete a informação em três
        pixels de largura, numa linha que divide espaço com o nome do cliente.
      */}
      {!miudo && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            flexShrink: 0,
            borderRadius: "var(--radius-full)",
            background: ativa ? cor.texto : "var(--text-disabled)",
          }}
        />
      )}
      {etiqueta.nome}
      {onRemover && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Tirar ${etiqueta.nome}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemover();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onRemover();
          }}
          style={{ marginLeft: 1, marginRight: -2, cursor: "pointer", opacity: 0.65 }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      )}
    </>
  );

  /*
   * As duas versões usam a COR DA ETIQUETA tingida: fundo claro, texto escuro.
   *
   * ⚠️ Tingido e não preenchido. É a regra do sistema — cor cheia é exclusiva de
   * ação, e uma etiqueta preenchida no meio da lista competiria com os botões. O
   * par `fundo`/`texto` de cada cor já vem calibrado para contrastar nos dois
   * temas, então o texto nunca fica ilegível sobre o próprio fundo.
   *
   * A miúda ainda perde a borda: com o fundo já colorido, ela era mais um
   * contorno numa linha que já tem o nome do cliente e a hora.
   */
  const estilo = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: miudo ? 18 : 22,
    padding: miudo ? "0 8px" : "0 9px",
    borderRadius: "var(--radius-full)",
    border: miudo ? "1px solid transparent" : `1px solid ${ativa ? cor.borda : "var(--border)"}`,
    background: miudo || ativa ? cor.fundo : "var(--surface)",
    color: miudo || ativa ? cor.texto : "var(--text-secondary)",
    fontSize: miudo ? "var(--text-2xs)" : "var(--text-xs)",
    fontWeight: "var(--fw-semi)" as const,
    fontFamily: "var(--font)",
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
  };

  if (!onClick) return <span style={estilo}>{conteudo}</span>;

  return (
    <button type="button" onClick={onClick} aria-pressed={ativa} style={{ ...estilo, cursor: "pointer" }}>
      {conteudo}
    </button>
  );
}

/**
 * Botão de etiquetar, com o menu preso a ele.
 *
 * ⚠️ Marca e desmarca gravando na hora, uma etiqueta por clique. Um "salvar" no
 * pé do menu daria a chance de fechar sem querer e perder o que foi marcado, e
 * classificar é justamente o gesto rápido de quem está no meio de outra coisa.
 */
export function BotaoDeEtiquetas({
  etiquetas,
  marcadas,
  onAlternar,
  onCriar,
}: {
  etiquetas: Etiqueta[];
  marcadas: number[];
  onAlternar: (id: number) => void;
  /** Devolve o id da etiqueta criada, para ela ja entrar marcada. */
  onCriar: (nome: string, cor: CorDeEtiqueta) => Promise<number | null>;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Clique fora fecha. Sem isso o menu ficaria aberto por cima da conversa,
  // tapando justamente o que a pessoa quer ler para decidir a etiqueta.
  useEffect(() => {
    if (!aberto) return;

    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };

    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div ref={caixa} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Etiquetar conversa"
        title="Etiquetar"
        aria-expanded={aberto}
        style={{
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--border)",
          background: aberto ? "var(--surface-2)" : "var(--surface)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          color: marcadas.length > 0 ? "var(--primary)" : "var(--text-secondary)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" />
          <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" />
        </svg>
      </button>

      {aberto && (
        <MenuDeEtiquetas
          etiquetas={etiquetas}
          marcadas={marcadas}
          onAlternar={onAlternar}
          onCriar={onCriar}
        />
      )}
    </div>
  );
}

/**
 * O menu de marcar, no desenho do resto do sistema.
 *
 * ⚠️ Mesma anatomia do seletor de número logo acima dele: `--border-strong`,
 * `--shadow-md`, itens de 7 por 9 e o visto em verde à direita. Um menu com
 * regras próprias, a dois centímetros de um que já existe, faz a tela parecer
 * montada por duas pessoas que não conversaram.
 */
function MenuDeEtiquetas({
  etiquetas,
  marcadas,
  onAlternar,
  onCriar,
}: {
  etiquetas: Etiqueta[];
  marcadas: number[];
  onAlternar: (id: number) => void;
  onCriar: (nome: string, cor: CorDeEtiqueta) => Promise<number | null>;
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorDeEtiqueta>("verde");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    const limpo = nome.trim();
    if (!limpo || salvando) return;

    setSalvando(true);
    const id = await onCriar(limpo, cor);
    setSalvando(false);
    setNome("");
    setCriando(false);

    /*
     * ⚠️ Criada JA MARCADA nesta conversa.
     *
     * Ninguem abre o menu de uma conversa para cadastrar etiqueta: cria porque
     * quer classificar ESTA. Deixar a criacao sem efeito obrigava a um segundo
     * clique para fazer o que o primeiro parecia ter feito.
     */
    if (id) onAlternar(id);
  };

  const divisor = <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />;

  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        width: 236,
        zIndex: 5,
        padding: 4,
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        animation: "pop-in 140ms var(--ease-out)",
      }}
    >
      {etiquetas.length === 0 && !criando && (
        <p
          style={{
            padding: "10px 9px",
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Nenhuma etiqueta ainda. Crie a primeira para começar a classificar.
        </p>
      )}

      {etiquetas.length > 0 && (
        <div style={{ maxHeight: 232, overflowY: "auto" }}>
          {etiquetas.map((e) => {
            const marcada = marcadas.includes(e.id);

            return (
              <button
                key={e.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={marcada}
                onClick={() => onAlternar(e.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 9px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: marcada ? "var(--surface-active)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-md)",
                  fontWeight: "var(--fw-semi)",
                  color: "var(--text-primary)",
                  textAlign: "left",
                }}
              >
                {/*
                  A escolha mostra a MARCA, e nao o nome solto.
                  
                  ⚠️ Quem escolhe aqui precisa reconhecer depois o que vai
                  aparecer grudado no nome do cliente. Nome cru na lista e balao
                  cinza na conversa sao dois desenhos para a mesma coisa.
                */}
                <span style={{ flex: 1, minWidth: 0, display: "flex" }}>
                  <ChipDeEtiqueta etiqueta={e} miudo />
                </span>

                {/*
                  O visto entra no lugar da caixa de seleção: é o que o seletor
                  de número faz, e uma caixa aqui somaria uma terceira forma de
                  dizer "escolhido" na mesma coluna da tela.
                */}
                {marcada && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {criando ? (
        <>
          {etiquetas.length > 0 && divisor}

          <div style={{ padding: "5px 5px 4px" }}>
            <input
              autoFocus
              value={nome}
              onChange={(ev) => setNome(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") void criar();
                if (ev.key === "Escape") setCriando(false);
              }}
              placeholder="Nome da etiqueta"
              maxLength={24}
              style={inputStyle}
            />

            {/*
              As cores em bolinha e não em quadrado: é a mesma marca que vai
              aparecer no avatar da conversa, e mostrar um quadrado aqui para
              virar círculo lá é uma promessa que a tela não cumpre.
            */}
            <div style={{ display: "flex", gap: 7, marginTop: 9, paddingLeft: 1 }}>
              {CORES_DE_ETIQUETA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-label={NOME_DA_COR[c]}
                  aria-pressed={cor === c}
                  title={NOME_DA_COR[c]}
                  style={{
                    width: 16,
                    height: 16,
                    padding: 0,
                    borderRadius: "var(--radius-full)",
                    border: "none",
                    background: PALETA[c].texto,
                    cursor: "pointer",
                    /* Anel por FORA, e nao borda por dentro: borda comeria a
                       propria cor que a pessoa esta tentando comparar. */
                    boxShadow:
                      cor === c
                        ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--text-primary)"
                        : "none",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 11 }}>
              <Button size="sm" variant="ghost" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!nome.trim() || salvando}
                onClick={() => void criar()}
              >
                Criar
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          {etiquetas.length > 0 && divisor}

          <button
            type="button"
            onClick={() => setCriando(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 9px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font)",
              fontSize: "var(--text-md)",
              color: "var(--text-secondary)",
              textAlign: "left",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova etiqueta
          </button>
        </>
      )}
    </div>
  );
}
