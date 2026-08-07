"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { browserSupabase } from "@/infra/supabase/browser";
import { useAvisos } from "@/components/ui/avisos";
import { ConfiguracaoDeContas } from "@/components/whatsapp/configuracao/drawer";
import { comFormatacaoDoWhatsapp } from "@/components/whatsapp/formatacao";
import { hora, quando, rotuloDoDia } from "@/components/whatsapp/painel/datas";
import { Avatar } from "@/components/whatsapp/painel/avatar";
import { Midia } from "@/components/whatsapp/painel/midia";
import { EnvioPorModelo } from "@/components/whatsapp/painel/modelo";
import { ResumoDoAtendimento } from "@/components/whatsapp/painel/resumo";
import { Composicao } from "@/components/whatsapp/painel/composicao";
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
  /* O filtro da pendencia da equipe. Ver . */
  const [soEsperando, setSoEsperando] = useState(false);
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

  /*
   * Qual conversa esta aberta, para o canal ler sem virar dependencia dele.
   * Como `filtroAtual`: por o valor nas dependencias derrubaria e recriaria a
   * assinatura a cada troca de conversa.
   */
  const selecionadaRef = useRef<number | null>(null);

  // Escrita em efeito, e nao no corpo: mexer em ref durante o render e leitura
  // de valor que pode nao ter sido comitado.
  useEffect(() => {
    filtroAtual.current = { busca: busca.trim(), contaId: contaAtual?.id ?? null };
  }, [busca, contaAtual?.id]);

  useEffect(() => {
    selecionadaRef.current = selecionada?.id ?? null;
  }, [selecionada?.id]);

  /*
   * Realtime.
   *
   * Sem filtro por empresa de proposito: a RLS ja decide o que este usuario pode
   * receber, e um filtro na assinatura seria uma segunda regra de isolamento
   * para manter em sincronia com a policy.
   */
  useEffect(() => {
    const supabase = browserSupabase();

    /*
     * ⚠️ Os eventos sao AGRUPADOS antes de virar consulta.
     *
     * Antes, cada evento disparava duas chamadas na hora: a lista inteira e a
     * thread aberta. Uma unica resposta do bot produz varios eventos seguidos
     * (a marca de "IA respondendo" liga, a mensagem entra, a marca desliga), e
     * este painel vive na casca do sistema: ele esta montado em TODA tela, para
     * TODO usuario logado. Numa equipe de dez pessoas, uma mensagem recebida
     * virava dezenas de requisicoes em menos de um segundo.
     *
     * Agora os eventos se acumulam por 400ms e viram no maximo uma recarga de
     * lista e uma de thread.
     */
    let agendado: ReturnType<typeof setTimeout> | null = null;
    let precisaDaThread = false;

    const aoMudar = (conversaTocada: number | null) => {
      /*
       * A thread so recarrega quando o evento e DELA. Antes qualquer mensagem
       * de qualquer conversa remontava a conversa aberta, com as 500 mensagens
       * junto.
       */
      if (conversaTocada != null && conversaTocada === selecionadaRef.current) {
        precisaDaThread = true;
      }

      if (agendado) return;

      agendado = setTimeout(() => {
        agendado = null;

        const { busca: termo, contaId } = filtroAtual.current;
        void carregarConversas(contaId, termo || undefined);

        if (precisaDaThread) {
          precisaDaThread = false;
          const id = selecionadaRef.current;
          if (id != null) void recarregarThread(id);
        }
      }, 400);
    };

    const canal = supabase
      .channel("whatsapp-painel")
      .on(
        "postgres_changes",
        // Tambem `whatsappconversas`: e la que mora a marca de "a IA esta
        // respondendo", e sem escutar essa tabela o aviso so apareceria quando
        // a resposta ja tivesse saido.
        { event: "*", schema: "public", table: "whatsappconversas" },
        (evento) => {
          const linha = (evento.new ?? evento.old) as { id?: number } | null;
          aoMudar(linha?.id ?? null);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsappmensagens" },
        (evento) => {
          const linha = (evento.new ?? evento.old) as { fkConversa?: number } | null;
          aoMudar(linha?.fkConversa ?? null);
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
      if (agendado) clearTimeout(agendado);
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
              soEsperando={soEsperando}
              onFiltrarEsperando={setSoEsperando}
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
  soEsperando,
  onFiltrarEsperando,
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
  soEsperando: boolean;
  onFiltrarEsperando: (v: boolean) => void;
}) {
  const esperando = conversas.filter(esperaDemais);
  const listadas = soEsperando ? esperando : conversas;

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

        {/*
          ⚠️ A pendencia e da EQUIPE, e nao do cliente.

          Depois que o bot encaminha, ninguem mais olha para aquela conversa: a
          varredura so cobra quem esta em triagem, e de proposito — cobrar o
          cliente que ja explicou o problema e esta esperando a empresa seria
          jogar a espera de volta para ele. Entao a cobranca vem para ca, onde
          quem pode resolver esta olhando.

          A conta e simples e nao custa consulta nenhuma: a ultima mensagem e do
          cliente e ja passou tempo demais. Cobre os dois casos que importam —
          "encaminhei e ninguem respondeu" e "ele voltou a escrever e ninguem
          viu".
        */}
        {esperando.length > 0 && (
          <button
            type="button"
            onClick={() => onFiltrarEsperando(!soEsperando)}
            aria-pressed={soEsperando}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 24,
              padding: "0 10px",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${soEsperando ? "var(--warning-border)" : "var(--border)"}`,
              background: soEsperando ? "var(--warning-bg)" : "var(--surface)",
              color: soEsperando ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              fontFamily: "var(--font)",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "var(--radius-full)",
                background: "var(--warning-text)",
              }}
            />
            Aguardando resposta ({esperando.length})
          </button>
        )}
      </header>

      {/*
        O respiro lateral e o MESMO do cabecalho (16 a esquerda, 12 a direita):
        assim o cartao do chat comeca e termina exatamente onde o campo de busca,
        e o realce do selecionado nao escapa para os lados.
      */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 12px 8px 16px" }}>
        {listadas.length === 0 ? (
          <p
            style={{
              padding: "24px 8px",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {soEsperando
              ? "Ninguém esperando resposta. Tudo em dia por aqui."
              : busca
                ? "Nenhuma conversa com esse termo."
                : "Nenhuma conversa ainda. A primeira aparece assim que alguém escrever para o número."}
          </p>
        ) : (
          listadas.map((c) => (
            <ItemDaLista
              key={c.id}
              conversa={c}
              ativo={c.id === selecionadaId}
              esperando={esperaDemais(c)}
              onClick={() => onEscolher(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Ha quanto tempo esta conversa espera alguem.
 *
 * ⚠️ Quinze minutos, e nao "desde a ultima mensagem". O bot responde em segundos
 * e a varredura passa a cada vinte: abaixo disso a conversa ainda esta sendo
 * atendida por quem devia, e marcar ali encheria a lista de falso alarme logo no
 * minuto em que a pessoa escreveu.
 */
const MINUTOS_ESPERANDO = 15;

function esperaDemais(c: Conversa): boolean {
  if (c.ultimaDirecao !== "entrada" || !c.ultimaEm) return false;

  const desde = new Date(c.ultimaEm).getTime();

  return Number.isFinite(desde) && Date.now() - desde > MINUTOS_ESPERANDO * 60_000;
}

function ItemDaLista({
  conversa,
  ativo,
  esperando,
  onClick,
}: {
  conversa: Conversa;
  ativo: boolean;
  /** Ha tempo demais sem alguem responder. Ver `esperaDemais`. */
  esperando: boolean;
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
      {/*
        A marca da espera fica NA BOLINHA, e nao numa etiqueta ao lado.

        ⚠️ A linha ja carrega nome, previa, hora e nao lidas. Mais um elemento
        ali empurraria a previa para fora; um ponto na quina do avatar aparece
        no mesmo relance em que o olho reconhece de quem e a conversa.
      */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar nome={titulo} semente={conversa.telefone} foto={conversa.clienteIcone} />

        {esperando && (
          <span
            aria-label="Aguardando resposta"
            title="Aguardando resposta da equipe"
            style={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: 10,
              height: 10,
              borderRadius: "var(--radius-full)",
              background: "var(--warning-text)",
              border: "2px solid var(--surface)",
            }}
          />
        )}
      </div>

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
