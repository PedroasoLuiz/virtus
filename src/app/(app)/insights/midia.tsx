"use client";

import { Alert } from "@/components/ui/kit";
import { formatar, type Centavos } from "@/shared/utils/money";
import type { AnuncioDoPeriodo, Publicacao } from "@/modules/insights/insights.types";
import {
  CORTADO,
  Grade,
  IconeBalao,
  IconeCoracao,
  IconeOlho,
  IconeSeta,
  Previa,
  Subtitulo,
  compacto,
  dataBR,
  inteiro,
  plural,
} from "./pecas";

/**
 * As duas grades de peca: publicacao do organico e criativo do pago.
 *
 * ⚠️ No mesmo arquivo de proposito. Elas tem o mesmo desenho porque respondem a
 * mesma pergunta em lados diferentes ("o que funcionou"), e separadas iam
 * divergir na primeira mexida em uma das duas.
 */

/**
 * As publicações do período, das mais reagidas para as menos.
 *
 * ⚠️ Ordenadas por reação, e não por data. A pergunta desta grade é "o que
 * funcionou": a ordem cronológica já está na própria rede, e repeti-la aqui não
 * acrescentaria nada.
 *
 * ⚠️ A MESMA grade serve Instagram e Facebook, e é isso que permite comparar os
 * dois trocando de item no menu. Duas grades divergiriam em recorte e em ordem,
 * e a comparação passaria a depender de reparar na diferença.
 */
export function Publicacoes({ lista, vazio }: { lista: Publicacao[]; vazio: string }) {
  return (
    <section>
      <Subtitulo>Publicações que mais renderam</Subtitulo>

      {lista.length === 0 ? (
        <Alert variant="info" title={vazio} />
      ) : (
        <Grade>
          {lista.map((p) => (
            <CartaoDePublicacao key={p.id} publicacao={p} />
          ))}
        </Grade>
      )}
    </section>
  );
}


function CartaoDePublicacao({ publicacao: p }: { publicacao: Publicacao }) {
  return (
    <a
      href={p.link}
      target="_blank"
      // ⚠️ `noreferrer` junto do `noopener`: sem ele, o Instagram recebe a URL
      // interna do sistema no cabeçalho de origem.
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
        overflow: "hidden",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <Previa imagem={p.imagem}>
        {p.tipo !== "IMAGEM" && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "2px 7px",
              borderRadius: "var(--radius-full)",
              background: "rgba(0, 0, 0, 0.62)",
              color: "#fff",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-medium)",
            }}
          >
            {p.tipo === "VIDEO" ? "Vídeo" : "Carrossel"}
          </span>
        )}
      </Previa>

      <div style={{ padding: 12 }}>
        {/*
          ⚠️ Duas linhas de legenda, cortadas. Legenda de Instagram passa de dois
          mil caracteres, e um cartão que cresce com o texto quebra a grade toda:
          seis cartões de alturas diferentes deixam de se comparar de relance.
        */}
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: "var(--lh-normal)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.6em",
          }}
        >
          {p.legenda ?? "Sem legenda"}
        </p>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {/*
            ⚠️ Número curto, com o exato no `title`. Três ou quatro contadores
            dividem a largura de um cartão de 180: "50.732" empurra os outros
            para fora e a grade deixa de se ler de relance. Quem precisa do
            número cheio passa o mouse.
          */}
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            title={`${inteiro(p.curtidas)} curtidas`}
          >
            <IconeCoracao pequeno />
            {compacto(p.curtidas)}
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            title={`${inteiro(p.comentarios)} comentários`}
          >
            <IconeBalao />
            {compacto(p.comentarios)}
          </span>
          {/*
            ⚠️ Compartilhamento só aparece quando EXISTE. O Instagram não expõe
            esse número por publicação, e um zero ali diria "ninguém
            compartilhou" onde a verdade é "a API não conta".
          */}
          {p.compartilhamentos != null && (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              title={`${inteiro(p.compartilhamentos)} compartilhamentos`}
            >
              <IconeSeta />
              {compacto(p.compartilhamentos)}
            </span>
          )}
          {/*
            ⚠️ Visualizações só aparecem quando a Meta respondeu. Nulo é "não
            consegui perguntar", e um zero ali diria "ninguém viu".
          */}
          {p.visualizacoes != null && (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              title={`${inteiro(p.visualizacoes)} visualizações`}
            >
              <IconeOlho pequeno />
              {compacto(p.visualizacoes)}
            </span>
          )}

          {/* A data cede o lugar quando os contadores enchem a linha. */}
          <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{dataBR(p.data)}</span>
        </div>
      </div>
    </a>
  );
}

// ── Página do Facebook ──────────────────────────────────────────────────────


/**
 * Os anúncios que mais consumiram, com a arte de cada um.
 *
 * ⚠️ É o equivalente pago da grade de publicações, e de propósito com o mesmo
 * desenho. Campanha é orçamento; o anúncio é o que a pessoa viu, e "qual peça
 * funcionou" é a pergunta que a tabela de campanhas não responde.
 */
export function Criativos({ lista }: { lista: AnuncioDoPeriodo[] }) {
  return (
    <section>
      {/* Sem subtítulo: a aba acima já diz o que esta grade é, e repetir o nome
          logo abaixo dele gasta uma linha para não dizer nada. */}
      {lista.length === 0 ? (
        <Alert variant="info" title="Nenhum anúncio com veiculação neste período" />
      ) : (
        <>
          {/*
            ⚠️ Sem palpite de causa aqui. Quando nenhuma arte vem, o servidor põe
            em `falhas` o que a Meta respondeu, e é isso que a tela mostra: um
            aviso escrito de antemão erraria o motivo na primeira vez que a causa
            fosse outra, e mandaria mexer na permissão errada.
          */}
          <Grade>
            {lista.map((a) => (
              <CartaoDeCriativo key={a.id} anuncio={a} />
            ))}
          </Grade>
        </>
      )}
    </section>
  );
}


function CartaoDeCriativo({ anuncio: a }: { anuncio: AnuncioDoPeriodo }) {
  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
        overflow: "hidden",
      }}
    >
      <Previa imagem={a.imagem} />

      <div style={{ padding: 12 }}>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", ...CORTADO }} title={a.nome}>
          {a.nome}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            ...CORTADO,
          }}
          title={a.campanha}
        >
          {a.campanha}
        </p>

        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-semi)" }}>
            {formatar(a.investido as Centavos)}
          </span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            {plural(a.resultados, "resultado", "resultados")}
          </span>
        </div>
      </div>
    </article>
  );
}
