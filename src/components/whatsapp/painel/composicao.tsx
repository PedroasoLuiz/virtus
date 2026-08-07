"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { IconeDeDocumento, tamanhoEmTexto } from "./documento";
import { duracaoEmTexto, PlayerDeAudio } from "./audio";
import { EnvioPorModelo } from "./modelo";

/**
 * O campo de escrita: texto, anexo e voz.
 *
 * ⚠️ Escolher arquivo NAO envia. Ele fica pendente, com previa, ate a pessoa
 * confirmar: anexo que sai no clique do seletor nao tem como ser cancelado, e
 * no WhatsApp nao existe desfazer.
 */

/**
 * O "+" do campo de escrita: tudo o que não é texto livre.
 *
 * ⚠️ Um botão só, e não um clipe mais um ícone de modelo ao lado. Os dois eram
 * a mesma pergunta ("o que eu mando além de texto?") partida em duas, e o
 * segundo ícone não tinha como se explicar sozinho: ninguém reconhece "modelo
 * aprovado" numa tabelinha de dezessete pixels. Dentro do menu ele tem nome.
 *
 * Abrir o seletor do sistema direto obriga a pessoa a caçar o arquivo num
 * dialogo que mostra TUDO. Escolhendo o tipo antes, o `accept` filtra e o
 * dialogo ja abre na categoria certa.
 *
 * Os tipos espelham o que a Cloud API aceita, e nao uma lista generica: nao ha
 * "contato" nem "enquete" aqui porque nao ha como envia-los.
 */
function MenuDeAnexo({
  desabilitado,
  onEscolher,
  onModelo,
}: {
  desabilitado: boolean;
  onEscolher: (aceita: string) => void;
  /** Sai do texto livre para o modelo aprovado. */
  onModelo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };

    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const opcoes: { rotulo: string; aceita: string; cor: string; icone: React.ReactNode }[] = [
    {
      rotulo: "Documento",
      aceita: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip",
      cor: "#5157ae",
      icone: (
        <>
          <path d="M14 3v5h5" />
          <path d="M19 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h9l6 6v11a1 1 0 0 1-1 1z" />
        </>
      ),
    },
    {
      rotulo: "Fotos e vídeos",
      aceita: "image/*,video/*",
      cor: "#bf59cf",
      icone: (
        <>
          <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
          <circle cx="8.5" cy="10" r="1.6" />
          <path d="m3.5 17 4.8-4.3a2 2 0 0 1 2.7 0L20 19" />
        </>
      ),
    },
    {
      rotulo: "Áudio",
      aceita: "audio/*",
      cor: "#d3396d",
      icone: (
        <>
          <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
          <path d="M5 11.5a7 7 0 0 0 14 0" />
          <path d="M12 18.5V22" />
        </>
      ),
    },
  ];

  return (
    <div ref={caixa} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={desabilitado}
        aria-label="Anexar"
        aria-expanded={aberto}
        title="Anexar"
        style={{
          width: 34,
          height: 34,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          borderRadius: "var(--radius-md)",
          cursor: desabilitado ? "not-allowed" : "pointer",
          color: aberto ? "var(--text-primary)" : "var(--text-tertiary)",
          transform: aberto ? "rotate(45deg)" : "none",
          transition: "transform 160ms var(--ease-out)",
        }}
      >
        {/* Um "+" e nao o clipe: o menu deixou de ser so de arquivo. */}
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            minWidth: 190,
            zIndex: 3,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: 5,
            animation: "fade-in 120ms var(--ease-out)",
          }}
        >
          {opcoes.map((o) => (
            <button
              key={o.rotulo}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                onEscolher(o.aceita);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 9px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "var(--text-md)",
                color: "var(--text-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="redondo"
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--radius-full)",
                  background: o.cor,
                  color: "#fff",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  {o.icone}
                </svg>
              </span>
              {o.rotulo}
            </button>
          ))}

          {/*
            O modelo fica por ULTIMO e depois de um divisor. Documento, foto e
            audio saem do computador da pessoa; o modelo sai do catalogo
            aprovado na Meta, e enfileirado com os outros pareceria mais um
            tipo de arquivo.
          */}
          <div style={{ height: 1, background: "var(--border)", margin: "5px 4px" }} />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAberto(false);
              onModelo();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 9px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "var(--text-md)",
              color: "var(--text-primary)",
              fontFamily: "var(--font)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              className="redondo"
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--radius-full)",
                background: "var(--primary)",
                color: "var(--primary-fg)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <path d="M3 9h18M8 13h8M8 16.5h5" />
              </svg>
            </span>
            Modelo aprovado
          </button>
        </div>
      )}
    </div>
  );
}
/**
 * Gravador de mensagem de voz.
 *
 * Enquanto grava, o campo de texto some e o rodape vira so o gravador: um
 * contador, descartar e enviar. Manter o campo ao lado sugeriria que da para
 * escrever e falar na mesma mensagem, o que nao existe no WhatsApp.
 *
 * ⚠️ O microfone e liberado no `stop`, sempre. Sem isso a luz da camera/mic fica
 * acesa depois de enviar, e o navegador continua marcando a aba como "gravando".
 */
function Gravador({
  formato,
  onGravado,
  onEstadoMudou,
}: {
  formato: { mime: string; extensao: string };
  onGravado: (arquivo: File) => void;
  onEstadoMudou: (gravando: boolean) => void;
}) {
  const { avisar } = useAvisos();
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const sinal = useRef<MediaStream | null>(null);
  /** Ref e nao estado: o `onstop` dispara depois do render e leria valor velho. */
  const descartar = useRef(false);

  useEffect(() => {
    if (!gravando) return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [gravando]);

  // Sair do painel no meio da gravacao nao pode deixar o microfone aberto.
  useEffect(() => {
    return () => {
      if (gravador.current?.state === "recording") gravador.current.stop();
      sinal.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function iniciar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: formato.mime });

      sinal.current = stream;
      gravador.current = mr;
      pedacos.current = [];
      descartar.current = false;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) pedacos.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        sinal.current = null;

        const partes = pedacos.current;
        pedacos.current = [];

        if (descartar.current || partes.length === 0) return;

        const blob = new Blob(partes, { type: formato.mime });
        const nome = `audio-${new Date().toISOString().slice(0, 19).replace(/\D/g, "")}.${formato.extensao}`;

        onGravado(new File([blob], nome, { type: formato.mime }));
      };

      mr.start();
      setSegundos(0);
      setGravando(true);
      onEstadoMudou(true);
    } catch {
      // Recusar o microfone e uma escolha legitima; nao vira erro de sistema.
      avisar("atencao", "Não foi possível usar o microfone. Verifique a permissão do navegador.");
    }
  }

  function parar(enviar: boolean) {
    descartar.current = !enviar;
    if (gravador.current?.state === "recording") gravador.current.stop();
    setGravando(false);
    onEstadoMudou(false);
  }

  if (!gravando) {
    return (
      <button
        type="button"
        onClick={() => void iniciar()}
        aria-label="Gravar áudio"
        title="Gravar áudio"
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          color: "var(--text-tertiary)",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
          <path d="M5 11.5a7 7 0 0 0 14 0" />
          <path d="M12 18.5V22" />
        </svg>
      </button>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 36,
        padding: "0 12px",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="redondo"
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-full)",
          background: "var(--danger)",
          animation: "fade-in 900ms var(--ease) infinite alternate",
        }}
      />

      <span
        style={{
          flex: 1,
          fontSize: "var(--text-md)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--text-secondary)",
        }}
      >
        Gravando… {duracaoEmTexto(segundos)}
      </span>

      <button
        type="button"
        onClick={() => parar(false)}
        aria-label="Descartar gravação"
        title="Descartar"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--text-tertiary)",
          display: "grid",
          placeItems: "center",
          padding: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5h16" />
          <path d="M9.5 6.5V4.5h5v2" />
          <path d="M6.5 6.5 7.5 20h9l1-13.5" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => parar(true)}
        aria-label="Enviar áudio"
        title="Enviar"
        className="redondo"
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          borderRadius: "var(--radius-full)",
          background: "var(--primary)",
          color: "var(--primary-fg)",
          cursor: "pointer",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
/**
 * Formatos de audio que a Cloud API aceita, em ordem de preferencia.
 *
 * ⚠️ `audio/webm` NAO esta na lista, e e justamente o que o Chrome grava por
 * padrao. Gravar em webm e mandar assim produz recusa da Meta depois do upload,
 * entao o formato e escolhido ANTES de gravar: se o navegador nao souber
 * produzir nenhum destes, o botao nem aparece habilitado.
 */
const AUDIO_ACEITO: { mime: string; extensao: string }[] = [
  { mime: "audio/ogg;codecs=opus", extensao: "ogg" },
  { mime: "audio/mpeg", extensao: "mp3" },
  { mime: "audio/aac", extensao: "aac" },

  /*
   * WebM e o que o CHROME grava, e a Meta nao aceita. Vai por ultimo porque o
   * servidor precisa trocar a caixa antes de subir, reembrulhando o Opus de
   * dentro dele em Ogg — ver `whatsapp.audio.ts`. Funciona, mas havendo um
   * formato ja pronto e melhor usar o pronto.
   */
  { mime: "audio/webm;codecs=opus", extensao: "webm" },

  /*
   * ⚠️ `audio/mp4` NAO entra, embora a Meta o liste como aceito.
   *
   * Testado em 04/08/2026, quatro vezes: o upload passa, a Meta devolve o
   * `wamid`, e o processamento falha depois com "Media upload error" — a
   * mensagem nunca e entregue. O Chrome grava MP4 FRAGMENTADO, que a Meta
   * aparentemente nao decodifica.
   *
   * Ficar na lista era pior que nao ter o botao: gravava, parecia enviar, e
   * sumia sem o cliente receber.
   */
];
function formatoDeGravacao(): { mime: string; extensao: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  return AUDIO_ACEITO.find((f) => MediaRecorder.isTypeSupported(f.mime)) ?? null;
}
export function Composicao({
  onEnviar,
  onEnviarAnexo,
  conversaId,
  onEnviarModelo,
}: {
  onEnviar: (texto: string) => Promise<void>;
  onEnviarAnexo: (arquivo: File, legenda: string) => Promise<void>;
  /** A conversa. Quem resolve de que numero ela e, e o servidor. */
  conversaId: number;
  onEnviarModelo: (nome: string, parametros: string[]) => Promise<void>;
}) {
  const [modeloAberto, setModeloAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);

  /*
   * Descoberto UMA vez, na montagem. `MediaRecorder` nao existe no servidor, e
   * perguntar a cada render nao mudaria a resposta.
   */
  const [formatoDeAudio] = useState(formatoDeGravacao);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [pendente, setPendente] = useState<File | null>(null);

  // Audio nao aceita legenda na Cloud API: a mensagem inteira e recusada se ela
  // for junto. Entao com voz pendente o campo de texto da lugar ao player.
  const pendenteEhAudio = pendente?.type.startsWith("audio/") ?? false;

  /*
   * Escolher o arquivo NAO envia: ele fica pendente, com previa, ate a pessoa
   * confirmar. Enviar no ato nao deixa conferir se pegou a foto certa nem
   * escrever a legenda, e no WhatsApp nao ha como voltar atras.
   */
  function prepararAnexo(arquivo: File) {
    setPendente(arquivo);
    campo.current?.focus();
  }

  // O campo cresce com o conteudo: uma mensagem de tres linhas nao pode ser
  // escrita numa fresta de uma linha.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texto]);

  async function enviar() {
    const limpo = texto.trim();
    if (enviando) return;
    if (!pendente && !limpo) return;

    setEnviando(true);
    // Limpa antes da resposta: quem apertou Enter ja seguiu para a proxima
    // frase, e o campo cheio faz duvidar se foi.
    setTexto("");

    if (pendente) {
      const arquivo = pendente;
      setPendente(null);
      // O texto do campo vira LEGENDA: quem escreveu e depois clipou esperava
      // mandar as duas coisas juntas, nao duas mensagens.
      await onEnviarAnexo(arquivo, pendenteEhAudio ? "" : limpo);
    } else {
      await onEnviar(limpo);
    }

    setEnviando(false);
    campo.current?.focus();
  }

  const podeEnviar = (pendente != null || texto.trim().length > 0) && !enviando;
  const mostraEnviar = !gravandoAudio && (pendente != null || texto.trim().length > 0);

  /*
   * Aberto, o seletor de modelo OCUPA o lugar da escrita livre em vez de
   * conviver com ela. Duas caixas de envio na tela deixariam ambiguo o que o
   * botao de enviar manda.
   */
  if (modeloAberto) {
    return (
      <EnvioPorModelo
        conversaId={conversaId}
        onEnviar={onEnviarModelo}
        onFechar={() => setModeloAberto(false)}
      />
    );
  }

  return (
    <footer
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "6px 12px 10px",
        background: "transparent",
      }}
    >
      {/*
        Voz pendente NAO usa a barra de previa: ela e uma linha propria acima, e
        empurraria o enviar para baixo. O player entra na propria linha de
        escrita, no lugar do campo de texto que ali nao serve.
      */}
      {pendente && !pendenteEhAudio && (
        <PreviaDoAnexo arquivo={pendente} onDescartar={() => setPendente(null)} />
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <input
          ref={seletor}
          type="file"
          hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            // Zera o valor: escolher o MESMO arquivo duas vezes seguidas nao
            // dispara `change`, e o segundo clique pareceria ignorado.
            e.target.value = "";
            if (arquivo) prepararAnexo(arquivo);
          }}
        />

        {/* O "+" fica SEMPRE, inclusive gravando: nada impede anexar depois. */}
        <MenuDeAnexo
          desabilitado={enviando}
          onModelo={() => setModeloAberto(true)}
          onEscolher={(aceita) => {
            const alvo = seletor.current;
            if (!alvo) return;
            // Muda o filtro do seletor no DOM e abre no mesmo gesto: passar por
            // estado adiaria a mudanca para depois do clique.
            alvo.accept = aceita;
            alvo.click();
          }}
        />

        {pendenteEhAudio ? (
          <PreviaDeVoz arquivo={pendente!} onDescartar={() => setPendente(null)} />
        ) : (
          !gravandoAudio && (
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter envia, Shift+Enter quebra linha — o mesmo do WhatsApp.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={1}
              placeholder="Escreva uma mensagem"
              style={{
                flex: 1,
                minHeight: 36,
                maxHeight: 120,
                padding: "9px 14px",
                fontSize: "var(--text-md)",
                fontFamily: "inherit",
                lineHeight: "var(--lh-snug)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                resize: "none",
                outline: "none",
                overflowY: "auto",
              }}
            />
          )
        )}

        {/*
          Microfone quando nao ha nada escrito nem anexado; aviao quando ha. Sao
          acoes excludentes, e mostrar as duas faria escolher entre botoes que so
          servem um de cada vez.
        */}
        {formatoDeAudio && !texto.trim() && pendente == null && (
          <Gravador
            formato={formatoDeAudio}
            onGravado={prepararAnexo}
            onEstadoMudou={setGravandoAudio}
          />
        )}

        {mostraEnviar && (
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!podeEnviar}
            aria-label="Enviar"
            title="Enviar"
            className="redondo"
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              border: "none",
              borderRadius: "var(--radius-full)",
              background: podeEnviar ? "var(--primary)" : "var(--surface-3)",
              color: podeEnviar ? "var(--primary-fg)" : "var(--text-disabled)",
              cursor: podeEnviar ? "pointer" : "not-allowed",
              transition: "background 120ms var(--ease)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
    </footer>
  );
}
/**
 * A voz gravada, esperando confirmacao, dentro da propria linha de escrita.
 *
 * Ocupa o lugar do campo de texto porque audio nao leva legenda: o campo ali
 * seria um convite a escrever algo que a Meta recusaria junto.
 */
function PreviaDeVoz({ arquivo, onDescartar }: { arquivo: File; onDescartar: () => void }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 6px 0 12px",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <PlayerDeAudio url={url} />
      </div>

      <button
        type="button"
        onClick={onDescartar}
        aria-label="Descartar gravação"
        title="Descartar"
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          color: "var(--text-tertiary)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5h16" />
          <path d="M9.5 6.5V4.5h5v2" />
          <path d="M6.5 6.5 7.5 20h9l1-13.5" />
        </svg>
      </button>
    </div>
  );
}
/**
 * O que vai ser enviado, antes de ir.
 *
 * Imagem mostra a propria imagem: conferir "e esta mesmo a foto certa?" exige
 * VER a foto, e um nome de arquivo nao responde isso. Documento fica no icone,
 * no nome e no tamanho, que e o que se confere nele.
 */
function PreviaDoAnexo({
  arquivo,
  onDescartar,
}: {
  arquivo: File;
  onDescartar: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);

  // Object URL segura o arquivo na memoria ate ser revogado. Sem isto, trocar
  // de anexo varias vezes acumula tudo o que ja foi escolhido.
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const ehImagem = arquivo.type.startsWith("image/");
  const ehVideo = arquivo.type.startsWith("video/");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {ehImagem && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={arquivo.name}
          style={{
            width: 44,
            height: 44,
            objectFit: "cover",
            borderRadius: "var(--radius-sm)",
            flexShrink: 0,
          }}
        />
      )}

      {ehVideo && (
        <video
          src={url}
          style={{
            width: 44,
            height: 44,
            objectFit: "cover",
            borderRadius: "var(--radius-sm)",
            flexShrink: 0,
            background: "#000",
          }}
        />
      )}

      {!ehImagem && !ehVideo && (
        <IconeDeDocumento nome={arquivo.name} mime={arquivo.type} tamanho={30} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {arquivo.name}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 1 }}>
          {tamanhoEmTexto(arquivo.size)}
        </div>
      </div>

      <button
        type="button"
        onClick={onDescartar}
        aria-label="Descartar anexo"
        title="Descartar"
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          color: "var(--text-tertiary)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
