"use client";

import { useState } from "react";
import { type Mensagem } from "@/modules/whatsapp/whatsapp.types";
import { documentoDe, IconeDeDocumento } from "./documento";
import { PlayerDeAudio } from "./audio";
import { rotuloDaMidia } from "./datas";

/**
 * O anexo dentro da bolha.
 *
 * ⚠️ Nada e guardado por nos: a midia e baixada da Meta a cada abertura, pelo
 * nosso servidor, porque o download dela exige o token. Ela vive 7 dias la, e
 * depois disso a bolha mostra o aviso de expirado em vez de um quadro quebrado.
 */

/**
 * Largura unica de toda midia na conversa.
 *
 * Foto, video, audio e documento saem do mesmo tamanho de proposito: sem isso
 * cada bolha se ajusta ao proprio conteudo e a coluna vira uma escada de
 * larguras diferentes, que e o que mais suja uma conversa longa.
 */
export const LARGURA_MIDIA = 240;
/**
 * Anexo recebido, mostrado no que ele e.
 *
 * A rota `/midia/{id}` devolve os BYTES com o `Content-Type` certo, entao a
 * mesma URL serve `<img>`, `<audio>` e `<video>` — nao ha download para fazer
 * antes. Ela exige sessao e passa pelo servidor porque o download na Meta pede
 * o Bearer, e o token nao pode ir para o navegador.
 *
 * Documento continua como link: PDF embutido numa bolha de 70% de largura nao
 * se le, e o navegador ja abre em aba com o visualizador dele.
 */
/**
 * Anexo da mensagem.
 *
 * ⚠️ O arquivo NAO e guardado por nos. Ficam so o id e o nome; os bytes vivem na
 * Meta e sao buscados na hora. Foi decisao consciente: guardar midia de todos os
 * tenants seria custo recorrente por algo que a Meta ja hospeda.
 *
 * O preco dessa escolha e o PRAZO — 7 dias para o que chega, 30 para o que sai.
 * Por isso duas coisas existem aqui: o botao de baixar, para quem quiser ficar
 * com o arquivo, e o estado de expirado, para o painel dizer o que aconteceu em
 * vez de mostrar uma imagem quebrada.
 */
export function Midia({ mensagem: m, conversaId }: { mensagem: Mensagem; conversaId: number }) {
  // A conversa vai na URL porque o download na Meta usa o token da CONTA que
  // recebeu o arquivo, e e a conversa que diz qual conta e.
  const url = `/api/v1/whatsapp/midia/${m.midiaId}?conversaId=${conversaId}`;
  const mime = m.midiaMime ?? "";
  const [expirado, setExpirado] = useState(false);

  const nome = m.midiaNome ?? `${rotuloDaMidia(m).toLowerCase()}-${m.id}`;

  if (expirado) return <Expirado mensagem={m} />;

  const ehImagem = m.tipo === "image" || mime.startsWith("image/");
  const ehAudio = m.tipo === "audio" || m.tipo === "voice" || mime.startsWith("audio/");
  const ehVideo = m.tipo === "video" || mime.startsWith("video/");

  if (m.tipo === "sticker") {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
        {/*
          `contain` e nao `cover`: figurinha tem fundo transparente e proporcao
          propria, e recortar comeria o desenho. 130px e a medida do WhatsApp,
          grande o bastante para ler a expressao e pequena o bastante para nao
          dominar a conversa.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Figurinha"
          onError={() => setExpirado(true)}
          style={{ width: 130, height: 130, objectFit: "contain", display: "block" }}
        />
      </a>
    );
  }

  if (ehImagem) {
    return (
      <div style={{ position: "relative", width: LARGURA_MIDIA }}>
        <a href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
          {/*
            `<img>` cru e nao `next/image`: o tamanho e desconhecido antes de
            baixar, a URL e privada e autenticada por sessao, e a otimizacao do
            Next nao alcanca rota de API.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={m.midiaNome ?? "Imagem recebida"}
            onError={() => setExpirado(true)}
            style={{
              width: "100%",
              maxHeight: 260,
              objectFit: "cover",
              borderRadius: "var(--radius-sm)",
              display: "block",
            }}
          />
        </a>
        <BotaoBaixar url={url} nome={nome} sobreposto />
      </div>
    );
  }

  if (ehAudio) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: LARGURA_MIDIA,
          maxWidth: "100%",
        }}
      >
        <PlayerDeAudio url={url} onFalha={() => setExpirado(true)} />
        <BotaoBaixar url={url} nome={nome} />
      </div>
    );
  }

  if (ehVideo) {
    return (
      <div style={{ position: "relative", width: LARGURA_MIDIA }}>
        <video
          controls
          preload="none"
          src={url}
          onError={() => setExpirado(true)}
          style={{
            width: "100%",
            maxHeight: 260,
            borderRadius: "var(--radius-sm)",
            display: "block",
          }}
        />
        <BotaoBaixar url={url} nome={nome} sobreposto />
      </div>
    );
  }

  return (
    <a
      href={url}
      download={nome}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: LARGURA_MIDIA,
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <IconeDeDocumento nome={m.midiaNome} mime={m.midiaMime} tamanho={30} />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-sm)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.midiaNome ?? rotuloDaMidia(m)}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            marginTop: 1,
          }}
        >
          {documentoDe(m.midiaNome, m.midiaMime).rotulo}
        </span>
      </span>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M12 3.5v11" />
        <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
        <path d="M4.5 19.5h15" />
      </svg>
    </a>
  );
}
/** Baixar o arquivo enquanto ele existe. Ver o comentario de `Midia`. */
function BotaoBaixar({
  url,
  nome,
  sobreposto,
}: {
  url: string;
  nome: string;
  sobreposto?: boolean;
}) {
  return (
    <a
      href={url}
      download={nome}
      title="Baixar"
      aria-label="Baixar arquivo"
      onClick={(e) => e.stopPropagation()}
      className={sobreposto ? "redondo" : undefined}
      style={{
        display: "grid",
        placeItems: "center",
        width: 26,
        height: 26,
        flexShrink: 0,
        borderRadius: sobreposto ? "var(--radius-full)" : "var(--radius-sm)",
        color: sobreposto ? "#fff" : "var(--text-tertiary)",
        textDecoration: "none",
        ...(sobreposto
          ? ({
              position: "absolute",
              top: 6,
              right: 6,
              // Fundo escuro proprio: sobre foto clara um icone cinza some.
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(2px)",
            } as const)
          : {}),
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5v11" />
        <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
        <path d="M4.5 19.5h15" />
      </svg>
    </a>
  );
}
/**
 * O anexo nao existe mais na Meta.
 *
 * Diz o que aconteceu e por quanto tempo o arquivo esteve disponivel, em vez de
 * deixar uma imagem quebrada. O texto da mensagem continua no historico: some o
 * arquivo, nao a conversa.
 */
function Expirado({ mensagem: m }: { mensagem: Mensagem }) {
  const dias = m.direcao === "entrada" ? 7 : 30;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: LARGURA_MIDIA,
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-2)",
        border: "1px dashed var(--border-strong)",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 1.8" />
      </svg>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "var(--text-sm)" }}>
          {m.midiaNome ?? rotuloDaMidia(m)}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
            marginTop: 1,
          }}
        >
          Não está mais disponível. A Meta guarda o arquivo por {dias} dias.
        </span>
      </span>
    </div>
  );
}
