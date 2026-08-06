"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { browserSupabase } from "@/infra/supabase/browser";
import { useAvisos } from "@/components/ui/avisos";
import { ConfiguracaoDeContas } from "@/components/whatsapp/configuracao";
import {
  botRespondendo,
  formatarTelefone,
  janelaAberta,
  previaDoTexto,
  rotuloDaConta,
  rotuloDoTipo,
  type AtendimentoDaConversa,
  type ClienteCandidato,
  type ContaWhatsapp,
  type Conversa,
  type Mensagem,
  type Modelo,
} from "@/modules/whatsapp/whatsapp.types";

/**
 * Caixa de entrada do WhatsApp, na lateral.
 *
 * Fica sobre a tela e nao numa rota propria de proposito: responder cliente e
 * interrupcao de outra tarefa — quem esta conferindo uma fatura responde e volta
 * para a fatura. Uma pagina faria perder o lugar.
 *
 * ⚠️ O painel NAO consulta tabela direto. O Realtime so avisa "mudou"; quem
 * responde o que mudou e a API, para a regra da janela de 24h ter uma
 * implementacao so.
 *
 * O desenho segue a mesma leitura do quadro kanban e do extrato: o fundo da
 * conversa e casca (cinza), a mensagem e dado (branco). Por isso as bolhas sao
 * `--surface` sobre `--surface-2`, e nao o contrario.
 */

const LARGURA = 900;
const LARGURA_LISTA = 300;

/** Mensagens do mesmo lado dentro desta janela viram um bloco so. */
const AGRUPA_ATE_MS = 5 * 60 * 1000;

/**
 * Largura unica de toda midia na conversa.
 *
 * Foto, video, audio e documento saem do mesmo tamanho de proposito: sem isso
 * cada bolha se ajusta ao proprio conteudo e a coluna vira uma escada de
 * larguras diferentes, que e o que mais suja uma conversa longa.
 */
const LARGURA_MIDIA = 240;

/*
 * Abaixo disto as duas colunas nao cabem: a lista ocupa 300 fixos, e num
 * celular sobrariam menos de 60 para a conversa. O corte e 720 e nao um valor
 * de dispositivo porque o que decide e a largura da JANELA, e meia tela num
 * monitor sofre o mesmo problema que um telefone.
 */
const CORTE_ESTREITO = 720;

/**
 * A janela e estreita demais para as duas colunas.
 *
 * ⚠️ Comeca `false` e so muda depois de montar. O servidor nao sabe a largura da
 * tela, entao qualquer outro valor inicial daria divergencia de hidratacao.
 */
function useEstreito(): boolean {
  const [estreito, setEstreito] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${CORTE_ESTREITO}px)`);
    const aplicar = () => setEstreito(mq.matches);

    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  return estreito;
}

export function PainelWhatsapp() {
  const { avisar } = useAvisos();

  const estreito = useEstreito();
  const [aberto, setAberto] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [atendimento, setAtendimento] = useState<AtendimentoDaConversa | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [contas, setContas] = useState<ContaWhatsapp[]>([]);
  const [contaId, setContaId] = useState<number | null>(null);
  const [configAberta, setConfigAberta] = useState(false);

  const contasAtivas = useMemo(() => contas.filter((c) => c.ativo), [contas]);
  const contaAtual = contasAtivas.find((c) => c.id === contaId) ?? contasAtivas[0] ?? null;

  const carregarContas = useCallback(async () => {
    const r = await fetch("/api/v1/whatsapp/contas");
    if (!r.ok) return;

    const corpo = await r.json();
    const lista: ContaWhatsapp[] = corpo.data ?? [];
    setContas(lista);

    // Escolhe a primeira ativa quando ainda nao ha escolha, ou quando a que
    // estava escolhida foi desligada.
    setContaId((atual) => {
      const ativas = lista.filter((c) => c.ativo);
      if (atual != null && ativas.some((c) => c.id === atual)) return atual;
      return ativas[0]?.id ?? null;
    });
  }, []);

  const naoLidas = conversas.reduce((soma, c) => soma + c.naoLidas, 0);

  const carregarConversas = useCallback(async (conta: number | null, termo?: string) => {
    const parametros = new URLSearchParams();
    if (conta != null) parametros.set("contaId", String(conta));
    if (termo) parametros.set("busca", termo);

    const consulta = parametros.toString();
    const url = `/api/v1/whatsapp/conversas${consulta ? `?${consulta}` : ""}`;

    const r = await fetch(url);
    if (!r.ok) return;

    const corpo = await r.json();
    setConversas(corpo.data ?? []);
  }, []);

  const abrirConversa = useCallback(async (conversa: Conversa) => {
    setSelecionada(conversa);
    setMensagens([]);
    setAtendimento(null);
    setCarregando(true);

    const r = await fetch(`/api/v1/whatsapp/conversas/${conversa.id}/mensagens`);
    setCarregando(false);
    if (!r.ok) return;

    const corpo = await r.json();
    setSelecionada(corpo.data.conversa);
    setMensagens(corpo.data.mensagens);
    setAtendimento(corpo.data.atendimento ?? null);

    setConversas((atuais) =>
      atuais.map((c) => (c.id === conversa.id ? { ...c, naoLidas: 0 } : c)),
    );
  }, []);

  /*
   * Carga da lista, com espera entre teclas.
   *
   * Roda tambem na montagem, com a busca vazia — de proposito: o contador de
   * nao lidas precisa estar certo com o painel FECHADO, porque e ele que avisa
   * que ha cliente esperando. Carregar so na abertura deixaria o botao mudo.
   */
  useEffect(() => {
    const t = setTimeout(() => void carregarContas(), 0);
    return () => clearTimeout(t);
  }, [carregarContas]);

  /*
   * ⚠️ `aberto` esta nas dependencias de proposito, e nao e sobra.
   *
   * O painel vive na casca e nunca desmonta, entao o estado sobrevive a ele
   * fechado. Uma cobranca disparada da tela de contas a receber escreve no
   * banco sem passar por aqui: sem recarregar na abertura, o painel reabria
   * com a lista de quando a aba foi carregada, parada numa mensagem de horas
   * atras.
   */
  useEffect(() => {
    const t = setTimeout(
      () => void carregarConversas(contaAtual?.id ?? null, busca.trim() || undefined),
      250,
    );
    return () => clearTimeout(t);
  }, [busca, contaAtual?.id, carregarConversas, aberto]);


  /*
   * O que o Realtime precisa saber, sem virar dependencia do efeito.
   *
   * ⚠️ Com `busca` e `contaAtual` nas dependencias, o canal era DERRUBADO E
   * RECRIADO a cada tecla digitada na busca: um `removeChannel` e um `subscribe`
   * por caractere, cada um com ida e volta ao servidor. Guardar em ref deixa o
   * efeito rodar uma vez so e ainda assim ler o valor atual.
   */
  const filtroAtual = useRef({ busca: "", contaId: null as number | null });

  // Escrita em efeito, e nao no corpo: mexer em ref durante o render e leitura
  // de valor que pode nao ter sido comitado.
  useEffect(() => {
    filtroAtual.current = { busca: busca.trim(), contaId: contaAtual?.id ?? null };
  }, [busca, contaAtual?.id]);

  /*
   * Realtime.
   *
   * Sem filtro por empresa de proposito: a RLS ja decide o que este usuario pode
   * receber, e um filtro na assinatura seria uma segunda regra de isolamento
   * para manter em sincronia com a policy.
   */
  useEffect(() => {
    const supabase = browserSupabase();

    const canal = supabase
      .channel("whatsapp-painel")
      .on(
        "postgres_changes",
        // Tambem `whatsappconversas`: e la que mora a marca de "a IA esta
        // respondendo", e sem escutar essa tabela o aviso so apareceria quando
        // a resposta ja tivesse saido.
        { event: "*", schema: "public", table: "whatsappconversas" },
        () => {
          const { busca: termo, contaId } = filtroAtual.current;
          void carregarConversas(contaId, termo || undefined);
          setSelecionada((atual) => {
            if (atual) void recarregarThread(atual.id);
            return atual;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsappmensagens" },
        () => {
          const { busca: termo, contaId } = filtroAtual.current;
          void carregarConversas(contaId, termo || undefined);
          setSelecionada((atual) => {
            if (atual) void recarregarThread(atual.id);
            return atual;
          });
        },
      )
      .subscribe();

    async function recarregarThread(id: number) {
      const r = await fetch(`/api/v1/whatsapp/conversas/${id}/mensagens`);
      if (!r.ok) return;
      const corpo = await r.json();
      setMensagens(corpo.data.mensagens);
      setSelecionada(corpo.data.conversa);
    }

    return () => {
      void supabase.removeChannel(canal);
    };
    // Uma assinatura por montagem. O filtro vive em `filtroAtual`, nao aqui.
  }, [carregarConversas]);

  /*
   * Esc fecha o painel, mas nao quando a configuracao esta por cima: ela tem o
   * proprio Esc, e os dois ouvindo `document` fechariam tudo de uma vez.
   */
  useEffect(() => {
    if (!aberto || configAberta) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, configAberta]);

  async function responder(texto: string) {
    if (!selecionada) return;

    const r = await fetch(`/api/v1/whatsapp/conversas/${selecionada.id}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "Não foi possível enviar a mensagem");
      return;
    }

    setMensagens((atuais) => [...atuais, corpo.data]);
    setConversas((atuais) =>
      atuais.map((c) =>
        c.id === selecionada.id
          ? { ...c, ultimoTexto: texto, ultimaEm: corpo.data.enviadaEm, ultimaDirecao: "saida" }
          : c,
      ),
    );
  }

  async function enviarAnexo(arquivo: File, legenda: string) {
    if (!selecionada) return;

    const form = new FormData();
    form.append("arquivo", arquivo);
    if (legenda.trim()) form.append("legenda", legenda.trim());

    const r = await fetch(`/api/v1/whatsapp/conversas/${selecionada.id}/anexo`, {
      method: "POST",
      body: form,
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "Não foi possível enviar o arquivo");
      return;
    }

    setMensagens((atuais) => [...atuais, corpo.data]);
    void carregarConversas(contaAtual?.id ?? null, busca.trim() || undefined);
  }

  async function enviarModelo(nome: string, parametros: string[]) {
    if (!selecionada) return;

    const r = await fetch(`/api/v1/whatsapp/conversas/${selecionada.id}/modelo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, parametros }),
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "Não foi possível enviar o modelo");
      return;
    }

    avisar("sucesso", "Modelo enviado.");
    setMensagens((atuais) => [...atuais, corpo.data]);
    void carregarConversas(contaAtual?.id ?? null, busca.trim() || undefined);
  }

  /*
   * O drawer sai por PORTAL, direto no `body`.
   *
   * ⚠️ Sem isso ele fica atras do menu lateral. O painel e montado dentro da
   * `Topbar`, que tem `position: relative` + `z-index`, e isso cria um contexto
   * de empilhamento: o `z-index: 401` daqui passa a valer DENTRO desse contexto,
   * e o contexto inteiro vale 50 — abaixo da sidebar, que esta em 60. E a mesma
   * armadilha do `position: sticky` ja registrada no doc 09.
   *
   * O portal so e criado com o drawer ABERTO, e `aberto` so vira true por
   * clique. Nao ha, portanto, render de servidor para casar — e por isso o
   * guard de `document` nao gera divergencia de hidratacao.
   */
  const conteudo = (
    <>
      <div
            onClick={() => setAberto(false)}
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.32)",
              backdropFilter: "blur(2px)",
              zIndex: 400,
              animation: "fade-in 160ms var(--ease-out)",
            }}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="WhatsApp"
            style={{
              position: "fixed",
              top: 8,
              right: 8,
              bottom: 8,
              width: `min(${LARGURA}px, calc(100vw - 16px))`,
              zIndex: 401,
              display: "flex",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              animation: "drawer-in 220ms var(--ease-out)",
            }}
          >
            {/*
              O fechar mora no canto superior direito do painel, e nao no
              cabecalho da coluna esquerda: ali ele parecia fechar a LISTA, nao a
              janela. Absoluto porque precisa existir tambem quando nenhuma
              conversa esta aberta, e nesse estado a coluna da direita nao tem
              cabecalho.
            */}
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              title="Fechar"
              style={{
                // 13 e nao 11: o cabecalho tem 10 de padding e 34 de avatar, e o
                // centro dele cai em 27. Com 28px de altura, o topo do botao
                // precisa ficar em 13 para os dois se alinharem com o de info.
                position: "absolute",
                top: 13,
                right: 12,
                zIndex: 2,
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/*
              Estreito mostra UMA coluna por vez: a lista, e a conversa no lugar
              dela depois de escolher. Manter as duas nao encolhe o problema, so
              o divide: a lista fica ilegivel e a conversa tambem.
            */}
            {(!estreito || !selecionada) && (
            <ListaDeConversas
              estreito={estreito}
              conversas={conversas}
              contas={contasAtivas}
              contaAtual={contaAtual}
              onTrocarConta={(id) => {
                setContaId(id);
                // A conversa aberta e de outro numero: mante-la mostraria a
                // thread de uma caixa de entrada que nao esta mais na tela.
                setSelecionada(null);
                setMensagens([]);
              }}
              selecionadaId={selecionada?.id ?? null}
              busca={busca}
              onBuscar={setBusca}
              onEscolher={(c) => void abrirConversa(c)}
              onAbrirConfig={() => setConfigAberta(true)}
            />
            )}

            {/*
              `key` pela conversa: trocar de contato remonta a thread, e o que
              e estado da conversa anterior (gaveta de detalhes aberta, posicao
              da rolagem) morre junto, sem efeito para zerar.
            */}
            {(!estreito || selecionada) && (
            <Thread
              key={selecionada?.id ?? "vazia"}
              onVoltar={estreito ? () => setSelecionada(null) : null}
              atendimento={atendimento}
              conversa={selecionada}
              mensagens={mensagens}
              carregando={carregando}
              onResponder={responder}
              onEnviarAnexo={enviarAnexo}
              onEnviarModelo={enviarModelo}
              onSair={() => setAberto(false)}
              onVinculou={() => {
                if (selecionada) void abrirConversa(selecionada);
                void carregarConversas(contaAtual?.id ?? null, busca.trim() || undefined);
              }}
            />
            )}
      </aside>

      {configAberta && (
        <ConfiguracaoDeContas
          contas={contas}
          onFechar={() => setConfigAberta(false)}
          onMudou={() => void carregarContas()}
        />
      )}
    </>
  );

  return (
    <>
      <BotaoDaBarra naoLidas={naoLidas} ativo={aberto} onClick={() => setAberto((v) => !v)} />
      {aberto && typeof document !== "undefined"
        ? createPortal(conteudo, document.body)
        : null}
    </>
  );
}

// ── Botao da barra ──────────────────────────────────────────────

/**
 * Botao flutuante, preso ao canto inferior direito da tela.
 *
 * Sai do topo porque nao pertence a nenhuma tela: responder cliente interrompe
 * o que a pessoa estava fazendo, venha de onde vier. No canto ele fica
 * alcancavel sem competir com a busca global nem com o aviso de demonstracao.
 *
 * z-index 300 e DELIBERADO: fica abaixo do veu do painel (400), entao ao abrir
 * a conversa o botao some junto com o resto da tela, em vez de boiar por cima do
 * proprio painel que ele abriu.
 */
function BotaoDaBarra({
  naoLidas,
  ativo,
  onClick,
}: {
  naoLidas: number;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="WhatsApp"
      aria-label={naoLidas > 0 ? `WhatsApp, ${naoLidas} não lidas` : "WhatsApp"}
      aria-pressed={ativo}
      className="redondo"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 300,
        width: 54,
        height: 54,
        display: "grid",
        placeItems: "center",
        border: "none",
        borderRadius: "var(--radius-full)",
        background: "var(--primary)",
        color: "var(--primary-fg)",
        boxShadow: "var(--shadow-md)",
        cursor: "pointer",
        transition: "transform 140ms var(--ease-out), filter 140ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/*
        O glifo do WhatsApp: balao com o fone dentro, preenchido. O contorno
        generico de "mensagem" nao se reconhece a 54px no canto da tela, e o que
        faz este botao ser encontrado sem legenda e justamente a silhueta.
      */}
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.23.25-.85.83-.85 2.02s.87 2.34.99 2.5c.12.17 1.71 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.11-.22-.17-.47-.29z" />
      </svg>

      {naoLidas > 0 && (
        <span
          className="redondo"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            minWidth: 21,
            height: 21,
            padding: "0 5px",
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--radius-full)",
            background: "var(--danger)",
            color: "#fff",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-semi)",
            lineHeight: 1,
            border: "2px solid var(--sidebar-bg)",
          }}
        >
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      )}
    </button>
  );
}

// ── Avatar ──────────────────────────────────────────────────────

/**
 * Iniciais coloridas, no lugar da foto.
 *
 * A Cloud API nao entrega a foto de perfil de quem escreve — nao ha endpoint
 * para isso, e nao e limitacao do nosso token: a Meta simplesmente nao expoe
 * foto de cliente. Entao a alternativa honesta e uma inicial com cor estavel,
 * que serve ao mesmo proposito: distinguir conversa de conversa no relance.
 *
 * A cor sai do telefone, e nao de um sorteio, para a mesma pessoa ter sempre a
 * mesma cor entre recarregamentos.
 */
const CORES_AVATAR = [
  "#0a7ea4",
  "#7c3aed",
  "#be123c",
  "#b45309",
  "#047857",
  "#4338ca",
  "#a21caf",
  "#0f766e",
];

function corDoAvatar(semente: string): string {
  let soma = 0;
  for (let i = 0; i < semente.length; i++) soma = (soma + semente.charCodeAt(i)) % 997;
  return CORES_AVATAR[soma % CORES_AVATAR.length];
}

function iniciais(nome: string): string {
  const partes = nome
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Avatar({
  nome,
  semente,
  foto,
  tamanho = 36,
}: {
  nome: string;
  semente: string;
  /** Logo do cliente, quando a conversa esta vinculada a um cadastro. */
  foto?: string | null;
  tamanho?: number;
}) {
  const [quebrou, setQuebrou] = useState(false);

  /*
   * A logo do cadastro entra no lugar das iniciais quando existe.
   *
   * ⚠️ Com reserva: a URL vem do bucket publico `virtusmind`, e imagem de
   * cadastro some, muda de nome ou nunca existiu. Falhando, `onError` devolve as
   * iniciais — nunca um quadrado vazio no lugar do contato.
   */
  if (foto && !quebrou) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={foto}
        alt=""
        aria-hidden
        onError={() => setQuebrou(true)}
        className="redondo"
        style={{
          width: tamanho,
          height: tamanho,
          flexShrink: 0,
          borderRadius: "var(--radius-full)",
          objectFit: "cover",
          background: "var(--surface-3)",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="redondo"
      style={{
        width: tamanho,
        height: tamanho,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-full)",
        background: corDoAvatar(semente),
        color: "#fff",
        fontSize: tamanho <= 30 ? "var(--text-xs)" : "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
        letterSpacing: "var(--tracking-snug)",
        userSelect: "none",
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

// ── Lista ───────────────────────────────────────────────────────

/*
 * O nome do perfil vem primeiro, e a empresa fica como contexto.
 *
 * Quem escreve e uma pessoa, e e o nome dela que se procura na lista. A empresa
 * responde "de quem e este numero", que e outra pergunta — ela aparece embaixo,
 * no cabecalho da conversa.
 */
function tituloDa(c: Conversa): string {
  return c.nome ?? c.clienteNome ?? formatarTelefone(c.telefone);
}

function ListaDeConversas({
  conversas,
  contas,
  contaAtual,
  onTrocarConta,
  selecionadaId,
  busca,
  onBuscar,
  onEscolher,
  onAbrirConfig,
  estreito,
}: {
  conversas: Conversa[];
  contas: ContaWhatsapp[];
  contaAtual: ContaWhatsapp | null;
  onTrocarConta: (id: number) => void;
  selecionadaId: number | null;
  busca: string;
  onBuscar: (v: string) => void;
  onEscolher: (c: Conversa) => void;
  onAbrirConfig: () => void;
  /** Unica coluna na tela: ocupa tudo em vez dos 300 fixos. */
  estreito: boolean;
}) {
  return (
    <div
      style={{
        width: estreito ? "100%" : LARGURA_LISTA,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        // Sem divisoria e sem fundo proprio: a lista se funde ao painel, e quem
        // separa as duas colunas passa a ser o cartao cinza da conversa.
        background: "var(--surface)",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "12px 12px 10px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SeletorDeNumero
            contas={contas}
            atual={contaAtual}
            onTrocar={onTrocarConta}
            onAbrirConfig={onAbrirConfig}
          />

          <button
            onClick={onAbrirConfig}
            aria-label="Configurar números"
            title="Configurar números"
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.1" />
              <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.5a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1.04z" />
            </svg>
          </button>

        </div>

        {/* Lupa dentro do campo: e o padrao do resto do sistema. */}
        <div style={{ position: "relative", display: "flex" }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-tertiary)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={busca}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar nome ou número"
            style={{
              flex: 1,
              height: 32,
              padding: "0 10px 0 28px",
              fontSize: "var(--text-sm)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>
      </header>

      {/*
        O respiro lateral e o MESMO do cabecalho (16 a esquerda, 12 a direita):
        assim o cartao do chat comeca e termina exatamente onde o campo de busca,
        e o realce do selecionado nao escapa para os lados.
      */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 12px 8px 16px" }}>
        {conversas.length === 0 ? (
          <p
            style={{
              padding: "24px 8px",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {busca
              ? "Nenhuma conversa com esse termo."
              : "Nenhuma conversa ainda. A primeira aparece assim que alguém escrever para o número."}
          </p>
        ) : (
          conversas.map((c) => (
            <ItemDaLista
              key={c.id}
              conversa={c}
              ativo={c.id === selecionadaId}
              onClick={() => onEscolher(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ItemDaLista({
  conversa,
  ativo,
  onClick,
}: {
  conversa: Conversa;
  ativo: boolean;
  onClick: () => void;
}) {
  const titulo = tituloDa(conversa);
  const naoLido = conversa.naoLidas > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "9px 10px",
        marginTop: 2,
        border: "none",
        borderRadius: "var(--radius-sm)",
        // A lista ficou branca, entao branco no selecionado nao destaca nada.
        // O realce passa a ser o verde suave da marca, o mesmo que a sidebar usa
        // para o item aberto.
        background: ativo ? "var(--surface-active)" : "transparent",
        boxShadow: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 120ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        if (!ativo) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!ativo) e.currentTarget.style.background = "transparent";
      }}
    >
      <Avatar nome={titulo} semente={conversa.telefone} foto={conversa.clienteIcone} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "var(--text-md)",
              fontWeight: naoLido ? "var(--fw-semi)" : "var(--fw-normal)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {titulo}
          </span>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: naoLido ? "var(--primary)" : "var(--text-tertiary)",
              fontWeight: naoLido ? "var(--fw-semi)" : "var(--fw-normal)",
              flexShrink: 0,
            }}
          >
            {quando(conversa.ultimaEm)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 1 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "flex-start",
              gap: 4,
              fontSize: "var(--text-sm)",
              color: naoLido ? "var(--text-secondary)" : "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            <PreviaDaUltima conversa={conversa} />
          </span>

          {naoLido && (
            <span
              className="redondo"
              style={{
                minWidth: 17,
                height: 17,
                padding: "0 5px",
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--radius-full)",
                background: "var(--primary)",
                color: "var(--primary-fg)",
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--fw-semi)",
                flexShrink: 0,
              }}
            >
              {conversa.naoLidas}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Seletor do numero, no lugar onde antes se lia "WhatsApp".
 *
 * Mantem o peso e o tamanho do titulo que substituiu — quem olha continua vendo
 * o cabecalho do painel, so que agora ele diz DE QUAL numero e a caixa de
 * entrada. Com um numero so, nao ha o que escolher: vira texto, sem seta.
 */
function SeletorDeNumero({
  contas,
  atual,
  onTrocar,
  onAbrirConfig,
}: {
  contas: ContaWhatsapp[];
  atual: ContaWhatsapp | null;
  onTrocar: (id: number) => void;
  onAbrirConfig: () => void;
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

  const titulo = { fontSize: "var(--text-xl)", fontWeight: "var(--fw-semi)", letterSpacing: "var(--tracking-snug)" } as const;

  if (contas.length === 0) {
    return (
      <button
        type="button"
        onClick={onAbrirConfig}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: "var(--text-tertiary)",
          ...titulo,
        }}
      >
        Configurar…
      </button>
    );
  }

  /*
   * A seta aparece mesmo com UM numero.
   *
   * Escondia-la parecia limpeza, mas apagava a unica pista de que o painel tem
   * mais de uma caixa de entrada possivel — e de que da para cadastrar outra.
   * Com um numero so, a lista mostra ele e o atalho para cadastrar.
   */
  return (
    <div ref={caixa} style={{ flex: 1, minWidth: 0, position: "relative" }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          maxWidth: "100%",
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: "var(--text-primary)",
          ...titulo,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {atual ? rotuloDaConta(atual) : "Escolher número"}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 220,
            zIndex: 5,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: 4,
          }}
        >
          {contas.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={c.id === atual?.id}
              onClick={() => {
                onTrocar(c.id);
                setAberto(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 9px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: c.id === atual?.id ? "var(--surface-active)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-md)", fontWeight: "var(--fw-semi)" }}>
                  {rotuloDaConta(c)}
                </div>
                {c.numero && c.apelido && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    {formatarTelefone(c.numero)}
                  </div>
                )}
              </div>

              {c.id === atual?.id && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="m4 12.5 5 5L20 6.5" />
                </svg>
              )}
            </button>
          ))}

          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

          <button
            type="button"
            onClick={() => {
              setAberto(false);
              onAbrirConfig();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 9px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M6.75 1.75a.75.75 0 0 0-1.5 0V5.25H1.75a.75.75 0 0 0 0 1.5H5.25v3.5a.75.75 0 0 0 1.5 0V6.75h3.5a.75.75 0 0 0 0-1.5H6.75V1.75z" />
            </svg>
            Cadastrar outro número
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Previa da ultima mensagem na lista.
 *
 * Anexo entra como icone + rotulo ("Foto", "Áudio"), igual ao WhatsApp — e a
 * legenda no lugar do rotulo quando existe, porque ali a legenda E a mensagem.
 * Antes vazava o marcador interno `[image]` para a tela.
 */
function PreviaDaUltima({ conversa }: { conversa: Conversa }) {
  const rotulo = rotuloDoTipo(conversa.ultimoTipo);
  const texto = previaDoTexto(conversa.ultimoTexto, conversa.ultimaDirecao);
  const prefixo = conversa.ultimaDirecao === "saida" ? "Você: " : "";

  // Anexo com legenda mostra a legenda; sem legenda, o nome do tipo. E o que o
  // WhatsApp faz: o icone diz o QUE e, o texto diz o que veio junto.
  const corpo = texto ?? rotulo ?? "—";

  return (
    <>
      {rotulo && <IconeDoTipo tipo={conversa.ultimoTipo} />}

      {/*
        Duas linhas, e o resto vira reticencias. A dica do navegador entrega a
        mensagem inteira sem gastar espaco na lista, do mesmo jeito que o (i)
        dos formularios explica sem ocupar linha.
      */}
      <span
        title={`${prefixo}${corpo}`}
        style={{
          flex: 1,
          minWidth: 0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {prefixo}
        {corpo}
      </span>
    </>
  );
}

function IconeDoTipo({ tipo }: { tipo: string | null }) {
  const comum = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    // 2px de recuo alinha o icone com a PRIMEIRA linha do texto, agora que a
    // previa pode ter duas.
    style: { flexShrink: 0, marginTop: 2 },
  };

  if (tipo === "image" || tipo === "sticker") {
    return (
      <svg {...comum} aria-hidden>
        <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
        <circle cx="8.5" cy="10" r="1.6" />
        <path d="m3.5 17 4.8-4.3a2 2 0 0 1 2.7 0L20 19" />
      </svg>
    );
  }

  if (tipo === "audio" || tipo === "voice") {
    return (
      <svg {...comum} aria-hidden>
        <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
        <path d="M5 11.5a7 7 0 0 0 14 0" />
        <path d="M12 18.5V22" />
      </svg>
    );
  }

  if (tipo === "video") {
    return (
      <svg {...comum} aria-hidden>
        <rect x="2.5" y="5.5" width="13" height="13" rx="2.5" />
        <path d="m15.5 10 6-3.2v10.4l-6-3.2z" />
      </svg>
    );
  }

  if (tipo === "location") {
    return (
      <svg {...comum} aria-hidden>
        <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (tipo === "contacts") {
    return (
      <svg {...comum} aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  return (
    <svg {...comum} aria-hidden>
      <path d="M14 3v5h5" />
      <path d="M19 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h9l6 6v11a1 1 0 0 1-1 1z" />
    </svg>
  );
}

// ── Thread ──────────────────────────────────────────────────────

/** Uma mensagem já posicionada dentro do seu bloco. */
type Item = {
  mensagem: Mensagem;
  /** Primeira do bloco: é quem mostra o avatar. */
  abreBloco: boolean;
  /** Última do bloco: é quem mostra hora, status e a "ponta" da bolha. */
  fechaBloco: boolean;
  /** Separador de dia acima desta mensagem. */
  diaNovo: string | null;
};

/**
 * Agrupa a conversa como um chat: mensagens seguidas do mesmo lado, próximas no
 * tempo, viram um bloco com uma hora só.
 *
 * Sem isso cada linha repete avatar e horário, e uma sequência de cinco frases
 * curtas — que é como as pessoas escrevem no WhatsApp — vira uma escada de
 * carimbos.
 */
function montarItens(mensagens: Mensagem[]): Item[] {
  return mensagens.map((m, i) => {
    const anterior = mensagens[i - 1];
    const proxima = mensagens[i + 1];

    const t = new Date(m.enviadaEm).getTime();
    const diaAtual = new Date(m.enviadaEm).toDateString();
    const diaAnterior = anterior ? new Date(anterior.enviadaEm).toDateString() : null;

    const colaAcima =
      anterior != null &&
      anterior.direcao === m.direcao &&
      diaAnterior === diaAtual &&
      t - new Date(anterior.enviadaEm).getTime() < AGRUPA_ATE_MS;

    const colaAbaixo =
      proxima != null &&
      proxima.direcao === m.direcao &&
      new Date(proxima.enviadaEm).toDateString() === diaAtual &&
      new Date(proxima.enviadaEm).getTime() - t < AGRUPA_ATE_MS;

    return {
      mensagem: m,
      abreBloco: !colaAcima,
      fechaBloco: !colaAbaixo,
      diaNovo: diaAnterior !== diaAtual ? m.enviadaEm : null,
    };
  });
}

function Thread({
  conversa,
  mensagens,
  carregando,
  onResponder,
  onEnviarAnexo,
  onEnviarModelo,
  onSair,
  onVinculou,
  onVoltar,
  atendimento,
}: {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  carregando: boolean;
  onResponder: (texto: string) => Promise<void>;
  onEnviarAnexo: (arquivo: File, legenda: string) => Promise<void>;
  onEnviarModelo: (nome: string, parametros: string[]) => Promise<void>;
  /** Fecha o painel inteiro. Sair para o cadastro sem isto deixaria o veu por cima. */
  onSair: () => void;
  /** Recarrega a conversa depois de vincular, para o nome e a foto entrarem. */
  onVinculou: () => void;
  /**
   * Volta para a lista. `null` quando as duas colunas estao na tela.
   *
   * ⚠️ Em tela estreita ele nao e enfeite: sem isso, escolhida uma conversa nao
   * ha caminho de volta a nao ser fechar o painel inteiro.
   */
  onVoltar: (() => void) | null;
  /** O que a triagem entendeu. `null` quando ninguem passou por aqui ainda. */
  atendimento: AtendimentoDaConversa | null;
}) {
  const area = useRef<HTMLDivElement>(null);
  const itens = useMemo(() => montarItens(mensagens), [mensagens]);

  // Comeca aberto e nao precisa de efeito para reabrir: a Thread tem `key` pela
  // conversa, entao trocar de contato remonta tudo e o resumo volta sozinho.
  const [resumoAberto, setResumoAberto] = useState(true);

  /*
   * Rolagem so acompanha quem JA estava no fim.
   *
   * O Realtime recarrega a thread inteira a cada mensagem, e antes isso jogava a
   * tela para baixo mesmo com a pessoa lendo o historico mais acima. Agora:
   * colado no fim, continua colado; lendo o passado, fica onde estava.
   *
   * Ref e nao estado: e lido dentro do efeito logo depois do render, e virar
   * estado renderizaria de novo a cada rolagem do mouse.
   */
  const coladoNoFim = useRef(true);
  // Estado local: some sozinho ao trocar de conversa, porque quem chama passa
  // `key={conversa.id}` e o componente remonta. Zerar por efeito custaria um
  // render a mais mostrando os detalhes da pessoa anterior.
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  // Conversa se lê de baixo para cima: abrir no topo obrigaria a rolar tudo
  // para achar o que acabou de chegar.
  useEffect(() => {
    const el = area.current;
    if (!el || !coladoNoFim.current) return;

    // `scrollTop` direto, e nao `scrollIntoView`: aquele pode rolar tambem os
    // ancestrais, e aqui o ancestral e o painel inteiro.
    el.scrollTop = el.scrollHeight;
  }, [itens]);

  if (!conversa) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 24,
          margin: "10px 10px 14px",
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 260 }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-disabled)", marginBottom: 10 }}
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.7A8.4 8.4 0 1 1 21 11.5z" />
          </svg>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            Escolha uma conversa à esquerda para ler e responder.
          </p>
        </div>
      </div>
    );
  }

  const aberta = janelaAberta(conversa.janelaExpiraEm);
  const titulo = tituloDa(conversa);

  return (
    /*
     * A coluna nao tem fundo proprio: cabecalho e campo de escrita ficam no
     * branco do painel. So a AREA DAS MENSAGENS e um cartao cinza arredondado,
     * flutuando entre os dois.
     */
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          // 48 a direita: o X do painel flutua ali por cima.
          padding: "10px 48px 10px 16px",
          background: "transparent",
        }}
      >
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar para as conversas"
            title="Voltar"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              marginLeft: -4,
              display: "grid",
              placeItems: "center",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <Avatar
          nome={titulo}
          semente={conversa.telefone}
          foto={conversa.clienteIcone}
          tamanho={34}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--fw-semi)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {titulo}
          </div>
          {/*
            Embaixo, o telefone e a empresa. Sao o contexto de quem esta falando,
            nao a identidade: dizer que "COCA COLA" mandou a mensagem esconderia
            a pessoa que de fato escreveu.
          */}
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {formatarTelefone(conversa.telefone)}
            {conversa.clienteNome && ` · ${conversa.clienteNome}`}
          </div>
        </div>

        <BotaoDeDetalhes
          conversaId={conversa.id}
          aberto={detalhesAbertos}
          onAlternar={() => setDetalhesAbertos((v) => !v)}
        />
      </header>

      {detalhesAbertos && (
        <DetalhesDoContato conversa={conversa} onSair={onSair} onVinculou={onVinculou} />
      )}

      <div
        ref={area}
        onScroll={(e) => {
          const el = e.currentTarget;
          // 120px de tolerancia: quase no fim ainda conta como no fim, senao
          // um pixel de folga ja congelaria a conversa.
          coladoNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 16px",
          margin: "0 10px 4px",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          /*
            Mesma leitura do quadro kanban: o fundo e casca, a bolha e dado. A
            cor da coluna e translucida e foi feita para assentar sobre o cinza
            da casca, entao vai empilhada sobre `--sidebar-bg` em vez de solta
            sobre o branco do painel.
          */
          background: "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
        }}
      >
        {carregando && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            Carregando…
          </p>
        )}

        {itens.map((item) => (
          <div key={item.mensagem.id}>
            {item.diaNovo && <SeparadorDeDia iso={item.diaNovo} />}
            <Bolha item={item} conversaId={conversa.id} />
          </div>
        ))}

      </div>

      {/*
        O resumo flutua SOBRE o campo de escrita, e nao acima dele no fluxo.
        Empurrar a conversa para cima a cada abertura moveria as ultimas
        mensagens de lugar, que e justamente onde o olho vai primeiro.
      */}
      <div style={{ position: "relative" }}>
        {atendimento && resumoAberto && (
          <ResumoDoAtendimento
            atendimento={atendimento}
            conversa={conversa}
            onFechar={() => setResumoAberto(false)}
          />
        )}

        {botRespondendo(conversa.botRespondendoEm) ? (
          <IaRespondendo />
        ) : aberta ? (
          /*
            Modelo tambem DENTRO da janela.
            
            Antes ele so aparecia com a janela fechada, quando e a unica saida.
            Mas modelo nao serve so para furar a janela: e o jeito de mandar
            cobranca e aviso com o texto ja aprovado, e ate agora, com a
            conversa quente, nao havia como usar um.
          */
          <Composicao
            onEnviar={onResponder}
            onEnviarAnexo={onEnviarAnexo}
            contaId={conversa.contaId}
            onEnviarModelo={onEnviarModelo}
          />
        ) : (
          <EnvioPorModelo contaId={conversa.contaId} onEnviar={onEnviarModelo} />
        )}
      </div>
    </div>
  );
}

/**
 * Salva o resumo como texto puro.
 *
 * ⚠️ Montado no navegador, sem rota nova: o cartao ja tem tudo o que vai no
 * arquivo, e um endpoint so para reescrever os mesmos campos seria uma segunda
 * versao da verdade para manter em dia.
 *
 * `.txt` e nao PDF porque isto e para colar em e-mail, CRM ou tarefa. Formato
 * que abre em qualquer lugar vale mais que formato bonito.
 */
function baixarResumo(a: AtendimentoDaConversa, conversa: Conversa) {
  const situacao = rotuloDaSituacao(a);

  const linhas = [
    `Atendimento #${a.id}`,
    `Aberto em: ${new Date(a.criadoEm).toLocaleString("pt-BR")}`,
    `Situação: ${situacao.texto}`,
    "",
    `Contato: ${conversa.nome ?? "sem nome"} (${formatarTelefone(conversa.telefone)})`,
    conversa.clienteNome ? `Cadastro: ${conversa.clienteNome}` : null,
    a.leadNome ? `Nome informado: ${a.leadNome}` : null,
    a.leadEmpresa ? `Empresa informada: ${a.leadEmpresa}` : null,
    a.leadEmail ? `E-mail informado: ${a.leadEmail}` : null,
    "",
    `Pedido: ${a.intencao ?? "não identificado"}`,
    "",
    "Resumo:",
    a.resumo ?? "sem resumo",
  ].filter((l) => l !== null);

  const url = URL.createObjectURL(
    new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = `atendimento-${a.id}.txt`;
  link.click();

  // Sem isto o blob fica na memoria da aba ate ela fechar, e quem baixa varios
  // resumos numa manha acumula todos.
  URL.revokeObjectURL(url);
}

/** Como cada estado da triagem se chama para quem atende. */
function rotuloDaSituacao(a: AtendimentoDaConversa): { texto: string; alerta: boolean } {
  switch (a.situacao) {
    case "ENCAMINHADO":
      return {
        // ⚠️ O setor entra NOMEADO. A pergunta que este cartao responde e "o bot
        // disse que ia transferir, transferiu mesmo?", e "encaminhado" sozinho
        // nao responde nada.
        texto: a.setorNome ? `Encaminhado para ${a.setorNome}` : "Encaminhado",
        alerta: false,
      };
    case "HUMANO":
      return { texto: "A IA não entendeu, precisa de você", alerta: true };
    case "TRIAGEM":
      return { texto: "Em triagem", alerta: false };
    case "ACEITO":
      return { texto: "Aceito", alerta: false };
    case "RECUSADO":
      return { texto: "Recusado", alerta: false };
    case "ABANDONADO":
      return { texto: "Encerrado sem retorno", alerta: false };
  }
}

/**
 * O que o cliente quer, sem precisar reler a conversa.
 *
 * Fica colado no campo de escrita de proposito: e ali que a pessoa esta olhando
 * quando vai responder, e um resumo no topo da thread seria rolado para fora da
 * tela antes de ser lido.
 */
function ResumoDoAtendimento({
  atendimento,
  conversa,
  onFechar,
}: {
  atendimento: AtendimentoDaConversa;
  conversa: Conversa;
  onFechar: () => void;
}) {
  const situacao = rotuloDaSituacao(atendimento);

  const lead = [
    atendimento.leadNome && `Nome: ${atendimento.leadNome}`,
    atendimento.leadEmpresa && `Empresa: ${atendimento.leadEmpresa}`,
    atendimento.leadEmail && `E-mail: ${atendimento.leadEmail}`,
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 14px)",
        // Recuado dos 10 do campo de escrita: o cartao flutua, e coisa que
        // flutua nao pode ter a mesma borda de quem esta no fluxo, senao le
        // como se fizesse parte dele.
        left: 26,
        right: 26,
        zIndex: 3,
        padding: "10px 12px",
        /*
         * Vidro: o fundo translucido desfoca a conversa por tras em vez de
         * tapa-la. E o que faz o cartao parecer sobreposto e temporario, que e
         * exatamente o que ele e.
         *
         * `color-mix` em vez de rgba fixo porque a cor de base muda com o tema:
         * escrito na mao, o cartao ficaria branco leitoso no modo escuro.
         */
        background: "color-mix(in srgb, var(--surface) 72%, transparent)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${
          situacao.alerta
            ? "var(--warning)"
            : "color-mix(in srgb, var(--border) 70%, transparent)"
        }`,
        borderRadius: "var(--radius-lg)",
        // Duas sombras: a larga descola do fundo, a fina de cima desenha o
        // brilho da quina que o vidro tem quando pega luz.
        boxShadow: "var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.22)",
        animation: "fade-in 160ms var(--ease-out)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              color: situacao.alerta ? "var(--warning)" : "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {situacao.texto}
          </div>

          {atendimento.intencao && (
            <div
              style={{
                marginTop: 4,
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-semi)",
                lineHeight: "var(--lh-snug)",
              }}
            >
              {atendimento.intencao}
            </div>
          )}

          {atendimento.resumo && (
            <p
              style={{
                marginTop: 2,
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              {atendimento.resumo}
            </p>
          )}

          {/*
            Os dados do lead ficam em linha propria, e nao diluidos no resumo:
            quem atende precisa bater o olho e achar o e-mail, nao ler um
            paragrafo ate encontrar.
          */}
          {lead.length > 0 && (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                flexWrap: "wrap",
                gap: "2px 10px",
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
              }}
            >
              {lead.map((linha) => (
                <span key={linha}>{linha}</span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => baixarResumo(atendimento, conversa)}
            style={{
              marginTop: 8,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              color: "var(--primary)",
            }}
          >
            Baixar resumo
          </button>
        </div>

        <button
          type="button"
          onClick={onFechar}
          aria-label="Esconder o resumo"
          title="Esconder"
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-tertiary)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function BotaoDeDetalhes({
  aberto,
  onAlternar,
}: {
  conversaId: number;
  aberto: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-label="Detalhes do contato"
      aria-expanded={aberto}
      title="Detalhes do contato"
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--border)",
        background: aberto ? "var(--surface-3)" : "var(--surface)",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        color: aberto ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 7.6h.01" />
      </svg>
    </button>
  );
}

/**
 * De quem e este numero.
 *
 * So responde essa pergunta. Telefone ja aparece sob o nome do contato, e a
 * janela de 24h ja se anuncia sozinha: fechada, o campo de escrita some e o
 * rodape explica. Repetir os dois aqui era dizer duas vezes o mesmo.
 *
 * Sem vinculo, oferece criar um. E o caso comum: a segunda pessoa da mesma
 * empresa escreve de outro numero, e sem isto so restaria editar o cadastro por
 * fora do sistema.
 */
function DetalhesDoContato({
  conversa,
  onSair,
  onVinculou,
}: {
  conversa: Conversa;
  onSair: () => void;
  onVinculou: () => void;
}) {
  const [candidatos, setCandidatos] = useState<ClienteCandidato[] | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/whatsapp/conversas/${conversa.id}`, { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const corpo = await r.json();
        setCandidatos(corpo.data.candidatos ?? []);
      })
      .catch((e: unknown) => {
        /*
         * Falhar aqui nao atrapalha a conversa, mas TEM de aparecer. Antes o
         * erro era engolido e `candidatos` ficava nulo, deixando "Carregando…"
         * para sempre — indistinguivel de uma consulta lenta.
         */
        if (e instanceof Error && e.name === "AbortError") return;
        setFalhou(true);
      });

    return () => controle.abort();
  }, [conversa.id]);

  const primeira = candidatos?.[0];
  const restantes = (candidatos?.length ?? 0) - 1;

  return (
    <section style={{ flexShrink: 0, padding: "0 16px 12px" }}>
      {/*
        Sem a classe `rotulo`: ela deixa em versalete e semibold, peso de titulo
        de formulario. Aqui e uma frase de apoio dentro da conversa, e competir
        com o nome do contato logo acima seria demais.
      */}
      <div
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          marginBottom: 4,
        }}
      >
        Empresas com este telefone
      </div>

      {falhou ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--danger-text)" }}>
          Não foi possível consultar os cadastros.
        </p>
      ) : candidatos == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Carregando…</p>
      ) : !primeira ? (
        vinculando ? (
          <EscolherCliente
            conversaId={conversa.id}
            onCancelar={() => setVinculando(false)}
            onPronto={() => {
              setVinculando(false);
              onVinculou();
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            <span>Nenhum cadastro tem este número.</span>
            <button
              type="button"
              onClick={() => setVinculando(true)}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                color: "var(--primary)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-semi)",
              }}
            >
              Vincular a um cadastro
            </button>
          </div>
        )
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 6,
            fontSize: "var(--text-sm)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          <a
            href={`/clientes?id=${primeira.id}`}
            onClick={onSair}
            style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: "var(--fw-semi)" }}
          >
            {primeira.razao}
          </a>

          {/*
            So a primeira e nomeada; o resto vira contagem. Listar oito razoes
            sociais empurraria a conversa para fora da tela, e quem precisa da
            lista inteira esta indo para o cadastro de qualquer forma.
          */}
          {restantes > 0 && (
            <a
              href="/clientes"
              onClick={onSair}
              title={candidatos.slice(1).map((c) => c.razao).join(", ")}
              style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "var(--fw-semi)" }}
            >
              +{restantes} {restantes === 1 ? "empresa" : "empresas"}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Busca de cadastro para vincular.
 *
 * O telefone da conversa e guardado como CONTATO do cliente escolhido, e nao
 * gravado na conversa: assim o vinculo vale tambem para conversas futuras do
 * mesmo numero, e a regra de "casamento unico" continua sendo uma so, no banco.
 */
function EscolherCliente({
  conversaId,
  onCancelar,
  onPronto,
}: {
  conversaId: number;
  onCancelar: () => void;
  onPronto: () => void;
}) {
  const { avisar } = useAvisos();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ id: number; razao: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [buscaFalhou, setBuscaFalhou] = useState(false);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      return;
    }

    const controle = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/v1/clientes?busca=${encodeURIComponent(termo)}&perPage=6`, {
        signal: controle.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const corpo = await r.json();
          setAchados(corpo.data ?? []);
          setBuscaFalhou(false);
        })
        .catch((e: unknown) => {
          /*
           * ⚠️ Sem este estado a tela MENTE.
           *
           * Falhando, `achados` ficava vazio e a mensagem abaixo dizia "nenhum
           * cadastro com esse termo" — como se a busca tivesse rodado e nao
           * encontrado nada. Quem lesse concluiria que o cliente nao existe.
           */
          if (e instanceof Error && e.name === "AbortError") return;
          setBuscaFalhou(true);
        });
    }, 250);

    return () => {
      clearTimeout(t);
      controle.abort();
    };
  }, [busca]);

  async function vincular(clienteId: number) {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch(`/api/v1/whatsapp/conversas/${conversaId}/vinculo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
    });

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível vincular");
      return;
    }

    avisar("sucesso", "Número salvo como contato do cadastro.");
    onPronto();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cadastro por nome ou CNPJ"
          style={{
            flex: 1,
            height: 30,
            padding: "0 10px",
            fontSize: "var(--text-sm)",
            border: "1px solid var(--input-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onCancelar}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Cancelar
        </button>
      </div>

      {busca.trim().length >= 2 && buscaFalhou && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--danger-text)" }}>
          A busca falhou. Tente de novo.
        </p>
      )}

      {busca.trim().length >= 2 && !buscaFalhou && achados.length === 0 && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Nenhum cadastro com esse termo.
        </p>
      )}

      {achados.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={salvando}
          onClick={() => void vincular(c.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "6px 9px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            cursor: salvando ? "wait" : "pointer",
            textAlign: "left",
            fontSize: "var(--text-sm)",
            color: "var(--text-primary)",
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.razao}
          </span>
          <span style={{ color: "var(--primary)", fontWeight: "var(--fw-semi)", flexShrink: 0 }}>
            Vincular
          </span>
        </button>
      ))}
    </div>
  );
}

function SeparadorDeDia({ iso }: { iso: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 12px" }}>
      <span
        style={{
          padding: "3px 10px",
          borderRadius: "var(--radius-full)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--fw-semi)",
        }}
      >
        {rotuloDoDia(iso)}
      </span>
    </div>
  );
}

function Bolha({ item, conversaId }: { item: Item; conversaId: number }) {
  const { mensagem: m, abreBloco, fechaBloco } = item;
  const minha = m.direcao === "saida";
  const falhou = m.status === "falhou" || m.status === "failed";

  /*
   * Figurinha nao mora em bolha.
   *
   * Ela ja e um recorte com fundo transparente; dentro de um cartao branco vira
   * um selo colado num papel. No WhatsApp ela flutua sobre a conversa, e o
   * carimbo sai de dentro dela.
   */
  const ehFigurinha = m.tipo === "sticker";

  /*
   * A "ponta" da bolha: o canto de baixo do lado de quem falou fica reto na
   * ULTIMA do bloco. É o que faz um bloco de tres mensagens ler como uma fala
   * só, em vez de tres cartoes soltos.
   */
  const raio = "var(--radius-lg)";
  const raioPonta = "var(--radius-xs)";

  /*
   * Quanto reservar no fim do texto para o carimbo caber ao lado.
   *
   * Medido, nao adivinhado: "12:34" a 9px ocupa ~30px, e os tiques somam ~18px
   * com o respiro. Sobrando, o carimbo so flutua sobre esse vao; faltando, o
   * proprio vao quebra a linha e leva o carimbo junto.
   */
  const larguraDoCarimbo = minha ? 54 : 34;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        justifyContent: minha ? "flex-end" : "flex-start",
        marginTop: abreBloco ? 8 : 2,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "70%",
          padding: ehFigurinha ? 0 : "7px 11px 5px",
          // Sem borda: a bolha se separa do fundo pela cor e pela sombra, como
          // o card do kanban. Contorno em cada mensagem vira ruido numa
          // conversa longa. So a que falhou ganha moldura, porque ali o
          // contorno E a informacao.
          background: ehFigurinha
            ? "transparent"
            : minha
              ? "var(--primary-subtle)"
              : "var(--surface)",
          border: falhou ? "1px solid var(--danger-border)" : "none",
          borderRadius: ehFigurinha
            ? 0
            : minha
              ? `${raio} ${raio} ${fechaBloco ? raioPonta : raio} ${raio}`
              : `${raio} ${raio} ${raio} ${fechaBloco ? raioPonta : raio}`,
          boxShadow: ehFigurinha ? "none" : "var(--shadow-xs)",
          fontSize: "var(--text-md)",
          lineHeight: "var(--lh-snug)",
          wordBreak: "break-word",
        }}
      >
        {m.midiaId != null && <Midia mensagem={m} conversaId={conversaId} />}

        {/*
          O horario entra na MESMA linha do texto quando sobra espaco.

          E o truque do proprio WhatsApp: um espaco vazio do tamanho do carimbo
          e emendado no fim do texto, e o carimbo vai absoluto por cima dele.
          Cabendo, os dois dividem a ultima linha; nao cabendo, o espaco quebra
          sozinho e o carimbo desce junto. Um flex simples nao faz isso, porque
          alinharia o carimbo ao BLOCO de texto, e nao a ultima linha dele.
        */}
        {m.texto && (
          <div style={{ whiteSpace: "pre-wrap", marginTop: m.midiaId != null ? 5 : 0 }}>
            {comFormatacaoDoWhatsapp(m.texto)}
            {fechaBloco && (
              <span
                aria-hidden
                style={{ display: "inline-block", width: larguraDoCarimbo, height: 1 }}
              />
            )}
          </div>
        )}

        {/*
          Marca de quem falou, so nas do bot.
          
          Mensagem de atendente nao precisa: no painel, saida sem marca e gente.
          O contrario encheria a conversa de etiqueta repetida.
        */}
        {m.doBot && abreBloco && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 3,
              fontSize: "var(--text-2xs)",
              fontWeight: "var(--fw-semi)",
              color: "var(--primary)",
              letterSpacing: "0.03em",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="7" width="16" height="12" rx="3" />
              <path d="M12 3v4" />
              <path d="M9 12.5v1.5M15 12.5v1.5" />
            </svg>
            IA
          </div>
        )}

        {fechaBloco && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--text-xs)",
              color: falhou ? "var(--danger)" : "var(--text-tertiary)",
              // Com texto o carimbo flutua sobre o espaco reservado; sem texto
              // (anexo puro) ele vira uma linha propria, alinhada a direita.
              //
              // `bottom` casa com o padding de baixo da bolha e `lineHeight: 1`
              // tira a folga que a altura de linha padrao acrescenta. Sem os
              // dois, o carimbo fica mais rente ao fundo que o texto das outras
              // bolhas, e o respiro de baixo parece menor so nas curtas.
              ...(m.texto
                ? ({ position: "absolute", right: 11, bottom: 5, lineHeight: 1 } as const)
                : ({
                    marginTop: 2,
                    justifyContent: minha ? "flex-end" : "flex-start",
                  } as const)),
            }}
          >
            <span>{hora(m.enviadaEm)}</span>
            {minha && <Confirmacao status={m.status} />}
          </div>
        )}

        {falhou && m.erro && (
          <div
            style={{
              marginTop: 3,
              fontSize: "var(--text-xs)",
              color: "var(--danger)",
            }}
          >
            {m.erro}
          </div>
        )}
      </div>
    </div>
  );
}

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
function Midia({ mensagem: m, conversaId }: { mensagem: Mensagem; conversaId: number }) {
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

/**
 * Player de audio no formato do WhatsApp.
 *
 * O `<audio controls>` nativo traz a barra cinza do navegador, que muda de
 * desenho em cada um e nao tem nada a ver com o resto da tela. Aqui o `<audio>`
 * fica escondido e serve so de motor; o que aparece e botao redondo, barras e
 * tempo.
 *
 * As barras sao decorativas e derivadas da URL, nao do som: desenhar a forma de
 * onda real exigiria baixar e decodificar o audio inteiro so para pintar uns
 * tracinhos. Elas indicam PROGRESSO, que e o que se usa de verdade.
 */
/*
 * ⚠️ 0.8, e nao 1.
 *
 * Nota de voz do WhatsApp vem muito normalizada, e no volume cheio do navegador
 * ela satura: a voz sai estourada. Oito decimos resolvem, e quem quiser mais
 * tem o volume do proprio sistema.
 *
 * Chegou a existir um botao de tres niveis aqui. Saiu porque colidia com o de
 * baixar dentro dos 240px do bloco, e o padrao sozinho ja resolvia o problema.
 */
const VOLUME_PADRAO = 0.8;

function PlayerDeAudio({ url, onFalha }: { url: string; onFalha?: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  // O elemento nasce em 1; sem isto o primeiro instante sai no volume cheio.
  useEffect(() => {
    if (audio.current) audio.current.volume = VOLUME_PADRAO;
  }, []);

  const barras = useMemo(() => {
    // Altura estavel por URL: a mesma mensagem desenha igual a cada render.
    // Sem acumulador mutavel — cada barra sai de uma conta pura sobre (semente,
    // indice), que e o que torna o desenho reprodutivel.
    const semente = Array.from(url).reduce(
      (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 10007,
      7,
    );

    return Array.from(
      { length: 28 },
      (_, i) => 30 + ((semente * (i + 13) * 2654435761) % 70),
    );
  }, [url]);

  const progresso = duracao > 0 ? posicao / duracao : 0;

  /*
   * `play()` devolve promessa, e pausar antes de ela resolver a REJEITA com
   * AbortError. Acontece no uso normal: dois cliques rapidos, ou o Realtime
   * recarregando a thread no meio da carga do audio.
   *
   * Duas defesas: engolir essa rejeicao especifica, que nao e falha de nada, e
   * deixar o estado seguir os EVENTOS do elemento em vez de ser cravado no
   * clique — assim ele nunca diz "tocando" para um play que foi cancelado.
   */
  function alternar() {
    const el = audio.current;
    if (!el) return;

    if (el.paused) {
      el.play().catch(() => {
        /* interrompido antes de comecar: nada a relatar */
      });
    } else {
      el.pause();
    }
  }

  function irPara(fracao: number) {
    const el = audio.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = el.duration * fracao;
    setPosicao(el.currentTime);
  }

  return (
    /*
     * Largura vem do PAI, nao daqui.
     *
     * Fixar 240 aqui somava com o botao de baixar ao lado e estourava a bolha.
     * Quem sabe quanto espaco ha e quem coloca o player.
     */
    <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onError={() => onFalha?.()}
        onEnded={() => {
          setTocando(false);
          setPosicao(0);
        }}
      />

      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? "Pausar" : "Tocar"}
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          color: "var(--primary)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {tocando ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4.5" height="16" rx="1.4" />
            <rect x="13.5" y="4" width="4.5" height="16" rx="1.4" />
          </svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4.8v14.4a1 1 0 0 0 1.53.85l11.2-7.2a1 1 0 0 0 0-1.7L8.53 3.95A1 1 0 0 0 7 4.8z" />
          </svg>
        )}
      </button>

      <div
        role="slider"
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progresso * 100)}
        tabIndex={0}
        onClick={(e) => {
          const caixa = e.currentTarget.getBoundingClientRect();
          irPara(Math.min(1, Math.max(0, (e.clientX - caixa.left) / caixa.width)));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") irPara(Math.min(1, progresso + 0.05));
          if (e.key === "ArrowLeft") irPara(Math.max(0, progresso - 0.05));
        }}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 2,
          // 22 e nao 26: com 26 as barras encostavam no respiro de cima da
          // bolha e o bloco lia mais alto que as bolhas de texto ao lado.
          height: 22,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {barras.map((altura, i) => (
          <span
            key={i}
            className="redondo"
            style={{
              flex: 1,
              height: `${altura}%`,
              minWidth: 3,
              // Ponta arredondada de verdade: `.redondo` desliga o squircle do
              // seletor universal, que num tracinho de 3px achata as laterais e
              // devolve o retangulo.
              borderRadius: "var(--radius-full)",
              background:
                i / barras.length <= progresso ? "var(--primary)" : "var(--text-disabled)",
              transition: "background 90ms linear",
            }}
          />
        ))}
      </div>

      <span
        style={{
          flexShrink: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 34,
          textAlign: "right",
        }}
      >
        {duracaoEmTexto(tocando || posicao > 0 ? posicao : duracao)}
      </span>
    </div>
  );
}

function duracaoEmTexto(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Menu do clipe, como no WhatsApp.
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
}: {
  desabilitado: boolean;
  onEscolher: (aceita: string) => void;
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
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.67 3.67 0 0 1 5.18 5.19l-9.2 9.19a1.83 1.83 0 1 1-2.6-2.6l8.5-8.48" />
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
 * Negrito e italico do WhatsApp (`*assim*`, `_assim_`).
 *
 * Existe porque a assinatura do autor sai em `*Nome:*` — sem isto o cliente ve
 * negrito e quem responde ve os asteriscos crus, e a tela mentiria sobre o que
 * foi enviado. Serve tambem para o que CHEGA, que usa a mesma marcacao.
 *
 * Monta nos de React em vez de HTML: `dangerouslySetInnerHTML` sobre texto que
 * um terceiro escreveu e injecao esperando acontecer.
 */
function comFormatacaoDoWhatsapp(texto: string): React.ReactNode[] {
  const partes: React.ReactNode[] = [];
  // `**assim**` antes de `*assim*`: a alternancia e testada em ordem, e o padrao
  // de um asterisco casaria com os dois primeiros de `**`, deixando o resto
  // solto na tela.
  const padrao = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;

  let ultimo = 0;
  let achado: RegExpExecArray | null;

  while ((achado = padrao.exec(texto)) !== null) {
    if (achado.index > ultimo) partes.push(texto.slice(ultimo, achado.index));

    const trecho = achado[0];
    const dobrado = trecho.startsWith("**");
    const marcas = dobrado ? 2 : 1;
    const miolo = trecho.slice(marcas, -marcas);

    partes.push(
      trecho.startsWith("*") ? (
        <strong key={achado.index}>{miolo}</strong>
      ) : (
        <em key={achado.index}>{miolo}</em>
      ),
    );

    ultimo = achado.index + trecho.length;
  }

  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Os tiques do WhatsApp: um enviado, dois entregue, dois em cor lida. */
function Confirmacao({ status }: { status: string | null }) {
  if (status === "falhou" || status === "failed") {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-label="falhou">
        <path d="M12 7v6M12 17h.01" />
      </svg>
    );
  }

  const lida = status === "read" || status === "lida";
  const entregue = lida || status === "delivered" || status === "entregue";

  return (
    <svg
      width="14"
      height="11"
      viewBox="0 0 18 12"
      fill="none"
      stroke={lida ? "var(--primary)" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={lida ? "lida" : entregue ? "entregue" : "enviada"}
    >
      <path d="M1 6.5 4 9.5 9.5 3" />
      {entregue && <path d="M7.5 6.5 10.5 9.5 16 3" />}
    </svg>
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

function Composicao({
  onEnviar,
  onEnviarAnexo,
  contaId,
  onEnviarModelo,
}: {
  onEnviar: (texto: string) => Promise<void>;
  onEnviarAnexo: (arquivo: File, legenda: string) => Promise<void>;
  contaId: number;
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
        contaId={contaId}
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

        {/* O clipe fica SEMPRE, inclusive gravando: nada impede anexar depois. */}
        <MenuDeAnexo
          desabilitado={enviando}
          onEscolher={(aceita) => {
            const alvo = seletor.current;
            if (!alvo) return;
            // Muda o filtro do seletor no DOM e abre no mesmo gesto: passar por
            // estado adiaria a mudanca para depois do clique.
            alvo.accept = aceita;
            alvo.click();
          }}
        />

        {/* Ao lado do clipe porque e a mesma familia de gesto: sair do texto
            livre para mandar algo pronto. */}
        <button
          type="button"
          onClick={() => setModeloAberto(true)}
          disabled={enviando || gravandoAudio}
          aria-label="Enviar modelo aprovado"
          title="Enviar modelo aprovado"
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            cursor: enviando || gravandoAudio ? "default" : "pointer",
            color: "var(--text-tertiary)",
            opacity: enviando || gravandoAudio ? 0.4 : 1,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M3 9h18M8 13h8M8 16.5h5" />
          </svg>
        </button>

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

/**
 * Identidade visual de um documento pelo tipo.
 *
 * A cor e a sigla saem da EXTENSAO, e nao do mime: o navegador manda mime vazio
 * ou `application/octet-stream` com frequencia, enquanto o nome do arquivo
 * praticamente sempre traz a extensao. O mime entra so como desempate.
 */
const DOCUMENTOS: { teste: RegExp; rotulo: string; cor: string }[] = [
  { teste: /\.pdf$/i, rotulo: "PDF", cor: "#d93025" },
  { teste: /\.docx?$/i, rotulo: "DOC", cor: "#2b579a" },
  { teste: /\.(xlsx?|csv)$/i, rotulo: "XLS", cor: "#1d7044" },
  { teste: /\.pptx?$/i, rotulo: "PPT", cor: "#c43e1c" },
  { teste: /\.(zip|rar|7z|gz)$/i, rotulo: "ZIP", cor: "#7a5ea8" },
  { teste: /\.(txt|md|log)$/i, rotulo: "TXT", cor: "#5f6368" },
  { teste: /\.(xml|json|html?)$/i, rotulo: "WEB", cor: "#b06000" },
];

function documentoDe(nome: string | null, mime: string | null): { rotulo: string; cor: string } {
  const arquivo = nome ?? "";

  const conhecido = DOCUMENTOS.find((d) => d.teste.test(arquivo));
  if (conhecido) return { rotulo: conhecido.rotulo, cor: conhecido.cor };

  if (mime?.includes("pdf")) return { rotulo: "PDF", cor: "#d93025" };

  // Extensao desconhecida ainda diz mais que um rotulo generico: quem recebeu
  // um `.dwg` prefere ler DWG a ler "arquivo".
  const extensao = arquivo.split(".").pop() ?? "";
  const util = /^[a-z0-9]{1,4}$/i.test(extensao) && extensao !== arquivo;

  return { rotulo: util ? extensao.toUpperCase() : "DOC", cor: "#5f6368" };
}

/** Folha com a ponta dobrada e a sigla numa faixa colorida, como no WhatsApp. */
function IconeDeDocumento({
  nome,
  mime,
  tamanho = 40,
}: {
  nome: string | null;
  mime: string | null;
  tamanho?: number;
}) {
  const { rotulo, cor } = documentoDe(nome, mime);

  return (
    <svg
      width={tamanho}
      height={tamanho * 1.22}
      viewBox="0 0 34 42"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path
        d="M2 3.5A2.5 2.5 0 0 1 4.5 1H22l10 10v27.5a2.5 2.5 0 0 1-2.5 2.5h-25A2.5 2.5 0 0 1 2 38.5z"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="1.4"
      />
      {/* A dobra: sem ela a silhueta e um retangulo qualquer. */}
      <path d="M22 1l10 10h-8a2 2 0 0 1-2-2z" fill="var(--surface-3)" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinejoin="round" />

      <rect x="2" y="22" width="30" height="13" rx="2" fill={cor} />
      <text
        x="17"
        y="31.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="9"
        fontWeight="700"
        fontFamily="var(--font)"
        letterSpacing="0.3"
      >
        {rotulo}
      </text>
    </svg>
  );
}

function tamanhoEmTexto(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * A IA esta respondendo agora.
 *
 * Substitui o campo de escrita em vez de so avisar ao lado: se o campo
 * continuasse ali, o atendente digitaria mesmo lendo o aviso, e o cliente
 * receberia duas respostas diferentes. Pior, a partir da resposta humana a IA
 * cala de vez, entao ela sumiria no meio da propria frase.
 *
 * Dura no maximo 45 segundos: passado isso, `botRespondendo` considera a marca
 * abandonada e o campo volta sozinho.
 */
function IaRespondendo() {
  return (
    <footer
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        background: "transparent",
      }}
    >
      <span style={{ display: "inline-flex", gap: 3, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="redondo"
            style={{
              width: 6,
              height: 6,
              borderRadius: "var(--radius-full)",
              background: "var(--primary)",
              animation: `fade-in 900ms var(--ease) ${i * 180}ms infinite alternate`,
            }}
          />
        ))}
      </span>

      <span
        style={{
          flex: 1,
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          lineHeight: "var(--lh-snug)",
        }}
      >
        A inteligência artificial está respondendo. Espere para não escrever por
        cima dela.
      </span>
    </footer>
  );
}

/**
 * Envio por modelo, para quem esta FORA da janela de 24 horas.
 *
 * Substitui a barra de escrita em vez de conviver com ela: ali texto livre nao
 * passa, e deixar o campo visivel so produziria erro no clique.
 *
 * ⚠️ Diferente do texto livre, isto CUSTA — template fora da janela e cobrado
 * por mensagem. Por isso o rodape avisa antes, e nao depois.
 */
function EnvioPorModelo({
  contaId,
  onEnviar,
  onFechar,
}: {
  contaId: number;
  onEnviar: (nome: string, parametros: string[]) => Promise<void>;
  /**
   * Volta para a escrita livre. `undefined` com a janela fechada, onde nao ha
   * para onde voltar: ali o modelo e a unica saida.
   */
  onFechar?: () => void;
}) {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [escolhido, setEscolhido] = useState<string>("");
  const [valores, setValores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [abertoParaEnvio, setAbertoParaEnvio] = useState(onFechar != null);

  useEffect(() => {
    if (!abertoParaEnvio) return;
    const controle = new AbortController();

    fetch(`/api/v1/whatsapp/modelos?contaId=${contaId}`, { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const corpo = await r.json();
        setModelos(corpo.data ?? []);
      })
      .catch(() => setModelos([]));

    return () => controle.abort();
  }, [abertoParaEnvio, contaId]);

  const modelo = modelos?.find((m) => m.nome === escolhido) ?? null;
  const faltaPreencher = modelo != null && valores.filter((v) => v?.trim()).length < modelo.parametros;

  async function enviar() {
    if (!modelo || faltaPreencher || enviando) return;

    setEnviando(true);
    await onEnviar(modelo.nome, valores.slice(0, modelo.parametros));
    setEnviando(false);
    setEscolhido("");
    setValores([]);
    setAbertoParaEnvio(false);
    onFechar?.();
  }

  if (!abertoParaEnvio) {
    return (
      <footer
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px 12px",
          background: "transparent",
        }}
      >
        <p
          style={{
            flex: 1,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Passaram-se mais de 24 horas desde a última mensagem deste contato.
          Só um modelo aprovado pode ser enviado agora.
        </p>

        <button
          type="button"
          onClick={() => setAbertoParaEnvio(true)}
          style={{
            flexShrink: 0,
            height: 30,
            padding: "0 12px",
            border: "1px solid var(--primary-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semi)",
            cursor: "pointer",
          }}
        >
          Enviar modelo
        </button>
      </footer>
    );
  }

  return (
    <footer
      style={{
        flexShrink: 0,
        maxHeight: 300,
        overflowY: "auto",
        padding: "10px 14px 12px",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="rotulo" style={{ flex: 1 }}>
          Enviar modelo aprovado
        </span>
        <button
          type="button"
          onClick={() => {
            setAbertoParaEnvio(false);
            // Dentro da janela, cancelar devolve a escrita livre; fora dela,
            // volta ao aviso das 24 horas, que e o unico estado possivel.
            onFechar?.();
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>

      {modelos == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Carregando modelos…
        </p>
      ) : modelos.length === 0 ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          Nenhum modelo aprovado. Modelo em revisão ou reprovado não pode ser
          enviado. Confira o status no painel da Meta.
        </p>
      ) : (
        <>
          <select
            value={escolhido}
            onChange={(e) => {
              setEscolhido(e.target.value);
              setValores([]);
            }}
            style={{
              height: 32,
              padding: "0 8px",
              fontSize: "var(--text-sm)",
              border: "1px solid var(--input-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Escolha um modelo…</option>
            {modelos.map((m) => (
              <option key={`${m.nome}-${m.idioma}`} value={m.nome}>
                {m.nome} · {m.categoria.toLowerCase()}
              </option>
            ))}
          </select>

          {modelo && (
            <>
              {/*
                Previa com os valores JA aplicados: os `{{1}}` crus nao dizem
                nada, e quem envia precisa ler a frase que o cliente vai receber
                antes de gastar uma mensagem cobrada.
              */}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--lh-snug)",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)",
                }}
              >
                {modelo.cabecalho && (
                  <div style={{ fontWeight: "var(--fw-semi)", color: "var(--text-primary)" }}>
                    {modelo.cabecalho}
                  </div>
                )}
                {preencher(modelo.corpo, valores)}
                {modelo.rodape && (
                  <div style={{ marginTop: 4, color: "var(--text-tertiary)" }}>
                    {modelo.rodape}
                  </div>
                )}
              </div>

              {Array.from({ length: modelo.parametros }, (_, i) => (
                <input
                  key={i}
                  value={valores[i] ?? ""}
                  onChange={(e) =>
                    setValores((atuais) => {
                      const copia = [...atuais];
                      copia[i] = e.target.value;
                      return copia;
                    })
                  }
                  placeholder={`Campo ${i + 1}`}
                  style={{
                    height: 32,
                    padding: "0 10px",
                    fontSize: "var(--text-sm)",
                    border: "1px solid var(--input-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              ))}

              <button
                type="button"
                onClick={() => void enviar()}
                disabled={faltaPreencher || enviando}
                style={{
                  height: 32,
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  background:
                    faltaPreencher || enviando ? "var(--surface-3)" : "var(--primary)",
                  color:
                    faltaPreencher || enviando ? "var(--text-disabled)" : "var(--primary-fg)",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--fw-semi)",
                  cursor: faltaPreencher || enviando ? "not-allowed" : "pointer",
                }}
              >
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </>
          )}
        </>
      )}
    </footer>
  );
}

/** Troca `{{1}}`, `{{2}}`… pelos valores digitados, para a prévia. */
function preencher(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (marcador, n: string) => {
    const v = valores[Number(n) - 1];
    return v?.trim() ? v : marcador;
  });
}

// ── Formatacao ──────────────────────────────────────────────────

function rotuloDaMidia(m: Mensagem): string {
  if (m.midiaNome) return m.midiaNome;

  const porTipo: Record<string, string> = {
    image: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    document: "Documento",
    sticker: "Figurinha",
  };

  return porTipo[m.tipo] ?? "Anexo";
}

/** Hoje mostra a hora; antes disso, a data. É o que a lista precisa distinguir. */
function quando(iso: string | null): string {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toDateString() === new Date().toDateString()
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d)
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
}

function rotuloDoDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: d.getFullYear() === hoje.getFullYear() ? undefined : "numeric",
  }).format(d);
}

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
