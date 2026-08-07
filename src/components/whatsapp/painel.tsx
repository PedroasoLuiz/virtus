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
import {
  AvisoDaJanela,
  ColunaDeModelos,
  EnvioDoModelo,
  useModelos,
} from "@/components/whatsapp/painel/modelo";
import { ResumoDoAtendimento, fecharResumo, resumoFechado } from "@/components/whatsapp/painel/resumo";
import { Composicao } from "@/components/whatsapp/painel/composicao";
import {
  definirEstadoDoPainel,
  useEstadoDoPainel,
} from "@/components/whatsapp/estado-do-painel";
import { BotaoDeEtiquetas, ChipDeEtiqueta } from "@/components/whatsapp/painel/etiquetas";
import { Rascunho } from "@/components/whatsapp/painel/nova-conversa";
import { ListaDeContatos } from "@/components/whatsapp/painel/contatos";
import {
  avisarNoNavegador,
  navegadorNotifica,
  pedirPermissaoDeAviso,
  permissaoDeAviso,
} from "@/components/whatsapp/painel/avisos-do-navegador";
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
  type CorDeEtiqueta,
  type ContatoDoPainel,
  type Etiqueta,
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

/*
 * ⚠️ 1180 e nao 900. A conversa dividia o espaco com a lista de 300 fixos, e o
 * que sobrava deixava a bolha estreita: mensagem de cliente e paragrafo, nao
 * legenda, e quebrar a cada seis palavras obrigava a ler em zigue-zague.
 */
const LARGURA = 1180;
const LARGURA_LISTA = 384;

/*
 * A coluna dos avatares.
 *
 * Vale como constante porque o "ver arquivadas" mora acima da lista e precisa
 * cair nessa mesma coluna: numero solto la ficaria alinhado so ate alguem mexer
 * no tamanho do avatar.
 */
const LARGURA_DO_AVATAR = 36;

/*
 * O respiro lateral do cartao, agora que ele vai de ponta a ponta.
 *
 * ⚠️ Saiu da COLUNA e entrou no CARTAO. Na coluna, o realce do selecionado
 * parava antes da borda do painel e a conversa aberta parecia um bloco solto no
 * meio da lista; no cartao, o texto fica no mesmo lugar e o realce chega a
 * extremidade, como no WhatsApp.
 */
const RESPIRO_DO_CARTAO = 16;

/*
 * As duas faixas da linha, em altura FIXA: nome e previa de duas linhas.
 *
 * ⚠️ Fixa mesmo quando a previa tem uma linha so. Altura variavel fazia cada
 * conversa ter um tamanho, e a lista virava uma escada: o olho perde a cadencia
 * e passa a procurar cada nome em vez de varrer a coluna.
 */
const ALTURA_DO_NOME = 18;
const ALTURA_DA_PREVIA = 29;

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
  /*
   * Aberto e nao lidas moram FORA deste componente.
   *
   * O botao que abre o painel passou a viver na barra lateral, em outro ramo da
   * arvore. Ver `estado-do-painel`.
   */
  const { aberto } = useEstadoDoPainel();
  const fechar = useCallback(() => definirEstadoDoPainel({ aberto: false }), []);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [atendimento, setAtendimento] = useState<AtendimentoDaConversa | null>(null);
  const [busca, setBusca] = useState("");
  /* O filtro da pendencia da equipe. Ver . */
  const [soEsperando, setSoEsperando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  /* As etiquetas que a empresa criou, e quais estao filtrando a lista. */
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [filtroEtiquetas, setFiltroEtiquetas] = useState<number[]>([]);
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [contas, setContas] = useState<ContaWhatsapp[]>([]);
  const [contaId, setContaId] = useState<number | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  /*
   * A agenda toma o lugar da lista de conversas, e o contato escolhido sem
   * conversa vira um RASCUNHO no lugar da thread.
   *
   * ⚠️ No lugar, e nao por cima. Escolher com quem falar e o mesmo gesto de
   * escolher qual conversa abrir; num drawer, a tela ganharia uma terceira
   * camada para fazer o que a primeira ja faz.
   */
  /*
   * A permissao de avisar no sistema operacional.
   *
   * ⚠️ Comeca `null` e so e lida depois de montar. `Notification.permission` nao
   * existe no servidor, e ler no corpo do componente daria divergencia de
   * hidratacao — o mesmo motivo do `useEstreito`.
   */
  const [permissao, setPermissao] = useState<NotificationPermission | null>(null);

  const [modoContatos, setModoContatos] = useState(false);
  const [rascunho, setRascunho] = useState<ContatoDoPainel | null>(null);

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

  const carregarEtiquetas = useCallback(async () => {
    const r = await fetch("/api/v1/whatsapp/etiquetas");
    if (!r.ok) return;

    const corpo = await r.json();
    setEtiquetas(corpo.data ?? []);
  }, []);

  const naoLidas = conversas.reduce((soma, c) => soma + c.naoLidas, 0);

  /*
   * O contador vai para a barra lateral.
   *
   * ⚠️ Em efeito, e nao durante o render: escrever numa loja externa enquanto o
   * React monta a arvore avisaria quem ja pintou, no meio da pintura.
   */
  useEffect(() => {
    definirEstadoDoPainel({ naoLidas });
  }, [naoLidas]);

  /*
   * O que cada caixa mostrou da ultima vez.
   *
   * ⚠️ Existe para a troca entre a caixa de entrada e o arquivo ser INSTANTANEA.
   * Sao duas listas diferentes, cada uma com sua consulta, e sem isto todo
   * ida-e-volta entre as duas era uma tela em branco esperando o servidor. Com o
   * cache a lista antiga aparece na hora e o pedido novo so a atualiza.
   *
   * Ref e nao estado: mudar o cache nao precisa redesenhar nada por si so, quem
   * redesenha e o `setConversas` logo em seguida.
   */
  const caixasCarregadas = useRef<Record<string, Conversa[]>>({});

  const carregarConversas = useCallback(
    async (conta: number | null, termo?: string, arquivadas = false) => {
    const parametros = new URLSearchParams();
    if (conta != null) parametros.set("contaId", String(conta));
    if (termo) parametros.set("busca", termo);
    if (arquivadas) parametros.set("arquivadas", "true");

    const consulta = parametros.toString();
    const url = `/api/v1/whatsapp/conversas${consulta ? `?${consulta}` : ""}`;

    const r = await fetch(url);
    if (!r.ok) return;

    const corpo = await r.json();
    const lista: Conversa[] = corpo.data ?? [];

    caixasCarregadas.current[arquivadas ? "arquivo" : "entrada"] = lista;
    setConversas(lista);
    },
    [],
  );

  /*
   * Etiquetar grava o CONJUNTO, e o painel ja mostra o resultado antes da
   * resposta: classificar e gesto de passagem, e um chip que so acende depois
   * da ida e volta faz a pessoa clicar de novo achando que nao pegou.
   */
  const alternarEtiqueta = useCallback(
    async (conversa: Conversa, etiquetaId: number) => {
      const marcadas = conversa.etiquetas.includes(etiquetaId)
        ? conversa.etiquetas.filter((id) => id !== etiquetaId)
        : [...conversa.etiquetas, etiquetaId];

      const aplicar = (c: Conversa) =>
        c.id === conversa.id ? { ...c, etiquetas: marcadas } : c;

      setConversas((atuais) => atuais.map(aplicar));
      setSelecionada((atual) => (atual ? aplicar(atual) : atual));

      const r = await fetch(`/api/v1/whatsapp/conversas/${conversa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiquetas: marcadas }),
      });

      // Falhou: desfaz o que o painel ja tinha mostrado. Um chip aceso sobre
      // uma marca que nao gravou e pior que nao ter marcado nada.
      if (!r.ok) {
        const voltar = (c: Conversa) =>
          c.id === conversa.id ? { ...c, etiquetas: conversa.etiquetas } : c;

        setConversas((atuais) => atuais.map(voltar));
        setSelecionada((atual) => (atual ? voltar(atual) : atual));
        avisar("erro", "Não foi possível salvar a etiqueta");
      }
    },
    [avisar],
  );

  const criarEtiqueta = useCallback(
    async (nome: string, cor: CorDeEtiqueta): Promise<number | null> => {
      const r = await fetch("/api/v1/whatsapp/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cor }),
      });

      if (!r.ok) {
        avisar("erro", "Não foi possível criar a etiqueta");
        return null;
      }

      const corpo = await r.json();
      await carregarEtiquetas();

      return corpo.data?.id ?? null;
    },
    [avisar, carregarEtiquetas],
  );

  /*
   * ⚠️ Arquivar TIRA da lista na hora, e nao espera o proximo carregamento.
   *
   * A conversa arquivada nao pertence mais a caixa de entrada: deixa-la la ate
   * a lista recarregar sozinha faria parecer que o clique nao funcionou, e a
   * pessoa arquivaria de novo.
   */
  const arquivarConversa = useCallback(
    async (conversa: Conversa, arquivada: boolean) => {
      setConversas((atuais) => atuais.filter((c) => c.id !== conversa.id));
      setSelecionada(null);
      setMensagens([]);

      const r = await fetch(`/api/v1/whatsapp/conversas/${conversa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivada }),
      });

      if (!r.ok) {
        avisar("erro", "Não foi possível arquivar");
        return;
      }

      avisar(
        "sucesso",
        arquivada ? "Conversa arquivada" : "Conversa de volta à caixa de entrada",
      );
    },
    [avisar],
  );

  /*
   * Abre pelo ID, com ou sem a linha da lista em maos.
   *
   * ⚠️ `parcial` existe so para a tela nao piscar: vindo da lista, ja ha nome e
   * foto para desenhar enquanto as mensagens chegam. Numa conversa recem-criada
   * nao ha nada disso, e a resposta traz tudo.
   */
  const abrirPorId = useCallback(async (id: number, parcial?: Conversa) => {
    setSelecionada(parcial ?? null);
    setMensagens([]);
    setAtendimento(null);
    setCarregando(true);

    const r = await fetch(`/api/v1/whatsapp/conversas/${id}/mensagens`);
    setCarregando(false);
    if (!r.ok) return;

    const corpo = await r.json();
    setSelecionada(corpo.data.conversa);
    setMensagens(corpo.data.mensagens);
    setAtendimento(corpo.data.atendimento ?? null);

    setConversas((atuais) => atuais.map((c) => (c.id === id ? { ...c, naoLidas: 0 } : c)));
  }, []);

  const abrirConversa = useCallback(
    (conversa: Conversa) => abrirPorId(conversa.id, conversa),
    [abrirPorId],
  );

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

  // Mesmo desvio do carregamento das contas: a busca sai do corpo do efeito
  // para nao virar uma cascata de render a cada montagem.
  useEffect(() => {
    const t = setTimeout(() => void carregarEtiquetas(), 0);
    return () => clearTimeout(t);
  }, [carregarEtiquetas]);

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
      () =>
        void carregarConversas(
          contaAtual?.id ?? null,
          busca.trim() || undefined,
          verArquivadas,
        ),
      250,
    );
    return () => clearTimeout(t);
  }, [busca, contaAtual?.id, carregarConversas, aberto, verArquivadas]);


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
    const t = setTimeout(() => setPermissao(permissaoDeAviso()), 0);
    return () => clearTimeout(t);
  }, []);

  /*
   * Quem ja foi avisado, para nao avisar duas vezes da mesma mensagem.
   *
   * ⚠️ O Realtime reentrega evento, e o painel esta montado em toda tela: sem
   * isto, uma mensagem podia render dois avisos identicos em sequencia.
   */
  const jaAvisadas = useRef<Set<number>>(new Set());

  /*
   * A lista atual, para o aviso ler o nome sem virar dependencia do canal.
   * Mesmo motivo do `filtroAtual`: por `conversas` nas dependencias, o Realtime
   * seria derrubado e recriado a cada mensagem que chega.
   */
  const conversasRef = useRef<Conversa[]>([]);

  useEffect(() => {
    conversasRef.current = conversas;
  }, [conversas]);

  /*
   * Se o painel esta na tela, para o aviso ler sem virar dependencia do canal.
   * Mesmo motivo do `filtroAtual`: por `aberto` nas dependencias, o Realtime
   * seria derrubado e recriado a cada abrir e fechar.
   */
  const painelAbertoRef = useRef(false);

  useEffect(() => {
    painelAbertoRef.current = aberto;
  }, [aberto]);

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

    /*
     * O aviso do sistema operacional, quando chega mensagem de CLIENTE.
     *
     * ⚠️ So o que a pessoa NAO esta vendo. Conversa aberta com a aba em foco
     * dispensa aviso: a mensagem acabou de aparecer na tela, e notificar aquilo
     * seria repetir na quina o que ja esta no meio.
     *
     * ⚠️ O nome sai da lista que ja esta na memoria, e nao de uma consulta. O
     * evento traz so o id da conversa, e ir ao servidor buscar o nome de quem
     * escreveu somaria uma chamada por mensagem recebida — em toda tela aberta,
     * de toda pessoa da equipe.
     */
    const avisarDaMensagem = (linha: {
      id?: number;
      fkConversa?: number;
      texto?: string | null;
      tipo?: string | null;
    }) => {
      const conversaId = linha.fkConversa;
      if (conversaId == null || linha.id == null) return;

      /*
       * ⚠️ "Estar vendo" exige o PAINEL ABERTO.
       *
       * A conversa escolhida continua guardada depois de fechar o painel, entao
       * so comparar o id calava o aviso justamente no caso mais comum: painel
       * fechado, pessoa trabalhando noutra tela do sistema, e a ultima conversa
       * aberta sendo a que respondeu.
       */
      const olhando =
        painelAbertoRef.current && conversaId === selecionadaRef.current && !document.hidden;

      if (olhando) return;

      if (jaAvisadas.current.has(linha.id)) return;
      jaAvisadas.current.add(linha.id);

      const conversa = conversasRef.current.find((c) => c.id === conversaId);

      avisarNoNavegador({
        titulo: conversa ? tituloDa(conversa) : "Nova mensagem",
        corpo:
          previaDoTexto(linha.texto ?? null, "entrada") ??
          rotuloDoTipo(linha.tipo ?? null) ??
          "Mensagem nova",
        tag: `conversa-${conversaId}`,
        icone: conversa?.clienteIcone,
        aoClicar: () => {
          definirEstadoDoPainel({ aberto: true });
          void abrirPorId(conversaId);
        },
      });
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
          const linha = (evento.new ?? evento.old) as {
            id?: number;
            fkConversa?: number;
            direcao?: string;
            texto?: string | null;
            tipo?: string | null;
          } | null;

          if (evento.eventType === "INSERT" && linha?.direcao === "entrada") {
            avisarDaMensagem(linha);
          }

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
  }, [abrirPorId, carregarConversas]);

  /*
   * Esc fecha o painel, mas nao quando a configuracao esta por cima: ela tem o
   * proprio Esc, e os dois ouvindo `document` fechariam tudo de uma vez.
   */
  useEffect(() => {
    if (!aberto || configAberta) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, configAberta, fechar]);

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

  async function enviarModelo(nome: string, parametros: string[], urlDoBotao?: string) {
    if (!selecionada) return;

    const r = await fetch(`/api/v1/whatsapp/conversas/${selecionada.id}/modelo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, parametros, urlDoBotao }),
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
            onClick={fechar}
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
              /*
               * ⚠️ ESQUERDA, e nao direita.
               *
               * E onde o WhatsApp poe a lista de conversas, e onde a mao vai
               * procurar. O botao que abre continua no canto inferior direito
               * de proposito: ele nao pertence a nenhuma tela, e ali nao briga
               * com a busca global.
               */
              left: 8,
              bottom: 8,
              width: `min(${LARGURA}px, calc(100vw - 16px))`,
              zIndex: 401,
              display: "flex",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              animation: "drawer-in-esquerda 220ms var(--ease-out)",
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
              onClick={fechar}
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
            {(!estreito || (!selecionada && !rascunho)) &&
              (modoContatos ? (
                <ListaDeContatos
                  contaId={contaAtual?.id ?? 0}
                  estreito={estreito}
                  onFechar={() => {
                    setModoContatos(false);
                    setRascunho(null);
                  }}
                  onEscolher={(c) => {
                    /*
                     * Ja tem conversa neste numero: abre a que existe.
                     *
                     * ⚠️ Comecar uma nova partiria o historico em dois, e a
                     * pessoa que abrisse a antiga nao veria o que acabou de ser
                     * mandado.
                     */
                    if (c.conversaId != null) {
                      setModoContatos(false);
                      setRascunho(null);
                      void abrirPorId(c.conversaId);
                      return;
                    }

                    setRascunho(c);
                  }}
                />
              ) : (
            <ListaDeConversas
              estreito={estreito}
              soEsperando={soEsperando}
              onFiltrarEsperando={setSoEsperando}
              etiquetas={etiquetas}
              filtroEtiquetas={filtroEtiquetas}
              onFiltrarEtiqueta={(id) =>
                setFiltroEtiquetas((atuais) =>
                  atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
                )
              }
              onLimparEtiquetas={() => setFiltroEtiquetas([])}
              verArquivadas={verArquivadas}
              onVerArquivadas={(v) => {
                setVerArquivadas(v);
                setSelecionada(null);
                setMensagens([]);
                // A lista da outra caixa entra JA, do cache. O pedido ao
                // servidor sai logo atras e so corrige o que mudou.
                setConversas(caixasCarregadas.current[v ? "arquivo" : "entrada"] ?? []);
              }}
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
              onPedirAviso={
                navegadorNotifica() && permissao === "default"
                  ? () => void pedirPermissaoDeAviso().then(setPermissao)
                  : null
              }
              onNovaConversa={() => {
                setModoContatos(true);
                setSelecionada(null);
                setMensagens([]);
              }}
            />
              ))}

            {/*
              `key` pela conversa: trocar de contato remonta a thread, e o que
              e estado da conversa anterior (gaveta de detalhes aberta, posicao
              da rolagem) morre junto, sem efeito para zerar.
            */}
            {/*
              O RASCUNHO ocupa o lugar da thread. E a mesma tela, sem historico:
              a conversa nasce quando o modelo sai.
            */}
            {rascunho && contaAtual ? (
              <Rascunho
                key={rascunho.telefone}
                contato={rascunho}
                contaId={contaAtual.id}
                onVoltar={estreito ? () => setRascunho(null) : null}
                onCancelar={() => {
                  setRascunho(null);
                  setModoContatos(false);
                }}
                onEnviou={(conversaId) => {
                  setRascunho(null);
                  setModoContatos(false);
                  /*
                   * ⚠️ ABRE a conversa criada. Sem isso o modelo saia e a tela
                   * ficava no mesmo lugar: a conversa nova entrava no topo da
                   * lista e ninguem garantia que a pessoa a reconheceria entre
                   * as outras.
                   */
                  void abrirPorId(conversaId);
                  void carregarConversas(contaAtual.id, busca.trim() || undefined);
                }}
              />
            ) : (
            (!estreito || selecionada) && (
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
              etiquetas={etiquetas}
              onAlternarEtiqueta={(id) => {
                if (selecionada) void alternarEtiqueta(selecionada, id);
              }}
              onCriarEtiqueta={criarEtiqueta}
              onArquivar={() => {
                if (selecionada) void arquivarConversa(selecionada, !selecionada.arquivada);
              }}
              onSair={fechar}
              onVinculou={() => {
                if (selecionada) void abrirConversa(selecionada);
                void carregarConversas(contaAtual?.id ?? null, busca.trim() || undefined);
              }}
            />
            )
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

  return aberto && typeof document !== "undefined"
    ? createPortal(conteudo, document.body)
    : null;
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
  onNovaConversa,
  onPedirAviso,
  etiquetas,
  filtroEtiquetas,
  onFiltrarEtiqueta,
  onLimparEtiquetas,
  verArquivadas,
  onVerArquivadas,
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
  onNovaConversa: () => void;
  /** `null` quando não há o que pedir: sem suporte, ou já respondida. */
  onPedirAviso: (() => void) | null;
  /** Unica coluna na tela: ocupa tudo em vez dos 300 fixos. */
  estreito: boolean;
  soEsperando: boolean;
  onFiltrarEsperando: (v: boolean) => void;
  etiquetas: Etiqueta[];
  filtroEtiquetas: number[];
  onFiltrarEtiqueta: (id: number) => void;
  onLimparEtiquetas: () => void;
  verArquivadas: boolean;
  onVerArquivadas: (v: boolean) => void;
}) {
  const esperando = conversas.filter(esperaDemais);

  /*
   * O filtro das etiquetas roda AQUI, e nao no servidor.
   *
   * A lista ja veio inteira e vem limitada a 200: marcar um chip precisa ser
   * instantaneo, e uma ida ao banco por clique daria meio segundo de espera
   * para peneirar o que ja esta na memoria. O arquivo e o unico que continua
   * indo ao servidor, porque aquilo e outra lista e nao um recorte desta.
   */
  const porEtiqueta =
    filtroEtiquetas.length === 0
      ? conversas
      : conversas.filter((c) => c.etiquetas.some((id) => filtroEtiquetas.includes(id)));

  const listadas = soEsperando ? porEtiqueta.filter(esperaDemais) : porEtiqueta;

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

          {/*
            ⚠️ Falar PRIMEIRO com alguem nao tinha caminho nenhum.

            Toda conversa nascia de uma mensagem recebida ou de uma cobranca
            disparada pelo sistema: confirmar um agendamento, avisar de uma
            entrega ou responder um lead que veio por outro canal exigia pedir
            para a pessoa escrever antes.
          */}
          {/*
            ⚠️ A permissão é pedida no CLIQUE, e o botão some depois de decidida.

            Pedido na carga da página, o navegador conta como abuso: o Chrome
            silencia o pedido para sempre naquele site, e aí nem quem queria
            consegue ligar depois. Some quando já foi respondida porque um botão
            que não faz mais nada é ruído numa barra de três ícones.
          */}
          {onPedirAviso && (
            <button
              onClick={onPedirAviso}
              aria-label="Avisar quando chegar mensagem"
              title="Avisar na tela quando chegar mensagem"
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--primary-border)",
                background: "var(--primary-subtle)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                color: "var(--primary)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 14.5 18 8.5z" />
                <path d="M13.7 20a2 2 0 0 1-3.4 0" />
              </svg>
            </button>
          )}

          <button
            onClick={onNovaConversa}
            aria-label="Nova conversa"
            title="Nova conversa"
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

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
        {/*
          A fileira de filtros: espera, etiquetas e o arquivo.

          ⚠️ Rola na horizontal em vez de quebrar linha. Uma empresa com dez
          etiquetas empurraria a lista de conversas para o rodape do painel, e a
          lista e o que a pessoa veio ver.
        */}
        {(esperando.length > 0 || etiquetas.length > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 1,
              scrollbarWidth: "none",
            }}
          >
            {esperando.length > 0 && (
              <button
                type="button"
                onClick={() => onFiltrarEsperando(!soEsperando)}
                aria-pressed={soEsperando}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 22,
                  padding: "0 9px",
                  borderRadius: "var(--radius-full)",
                  border: `1px solid ${soEsperando ? "var(--warning-border)" : "var(--border)"}`,
                  background: soEsperando ? "var(--warning-bg)" : "var(--surface)",
                  color: soEsperando ? "var(--warning-text)" : "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--fw-semi)",
                  fontFamily: "var(--font)",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    flexShrink: 0,
                    borderRadius: "var(--radius-full)",
                    background: soEsperando ? "var(--warning-text)" : "var(--text-disabled)",
                  }}
                />
                Aguardando resposta ({esperando.length})
              </button>
            )}

            {/*
              O "todos" abre a fileira, e comeca aceso.

              ⚠️ Sem ele, desligar o ultimo filtro exigia lembrar QUAL chip
              estava aceso e clicar nele de novo. E nao havia nada dizendo que a
              lista sem filtro nenhum e um estado, e nao um descuido: fileira
              toda apagada parecia que a pessoa tinha deixado de escolher.
            */}
            {etiquetas.length > 0 && (
              <button
                type="button"
                onClick={onLimparEtiquetas}
                aria-pressed={filtroEtiquetas.length === 0}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  height: 22,
                  padding: "0 10px",
                  borderRadius: "var(--radius-full)",
                  border: `1px solid ${
                    filtroEtiquetas.length === 0 ? "var(--primary-border)" : "var(--border)"
                  }`,
                  background:
                    filtroEtiquetas.length === 0 ? "var(--primary-subtle)" : "var(--surface)",
                  color:
                    filtroEtiquetas.length === 0 ? "var(--primary)" : "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--fw-semi)",
                  fontFamily: "var(--font)",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Todos
              </button>
            )}

            {etiquetas.map((e) => (
              <ChipDeEtiqueta
                key={e.id}
                etiqueta={e}
                ativa={filtroEtiquetas.includes(e.id)}
                onClick={() => onFiltrarEtiqueta(e.id)}
              />
            ))}
          </div>
        )}

        {/*
          O arquivo e uma LISTA A PARTE, e nao mais um chip da fileira.
          Misturado com os filtros ele viraria "mostrar tambem as arquivadas", e
          devolveria a caixa de entrada ao estado de onde a pessoa acabou de
          tirar a conversa.
        */}
        {/*
          Na MESMA grade das conversas: o icone na coluna dos avatares, o texto
          na coluna dos nomes. Ele mora logo acima da primeira conversa, e
          desalinhado por poucos pixels leria como um cabecalho torto em vez de
          mais uma linha da lista.
        */}
        <button
          type="button"
          onClick={() => onVerArquivadas(!verArquivadas)}
          aria-pressed={verArquivadas}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
            padding: 0,
            border: "none",
            background: "transparent",
            color: verArquivadas ? "var(--primary)" : "var(--text-tertiary)",
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            fontFamily: "var(--font)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: LARGURA_DO_AVATAR,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="4.5" rx="1.4" />
              <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4" />
            </svg>
          </span>
          {verArquivadas ? "Voltar à caixa de entrada" : "Ver arquivadas"}
        </button>
      </header>

      {/*
        O respiro lateral e o MESMO do cabecalho (16 a esquerda, 12 a direita):
        assim o cartao do chat comeca e termina exatamente onde o campo de busca,
        e o realce do selecionado nao escapa para os lados.
      */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingBottom: 8 }}>
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
              marcadas={c.etiquetas
                .map((id) => etiquetas.find((e) => e.id === id))
                .filter((e): e is Etiqueta => Boolean(e))}
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
  marcadas,
  onClick,
}: {
  conversa: Conversa;
  ativo: boolean;
  /** Ha tempo demais sem alguem responder. Ver `esperaDemais`. */
  esperando: boolean;
  /** As etiquetas desta conversa, ja resolvidas pela lista. */
  marcadas: Etiqueta[];
  onClick: () => void;
}) {
  const titulo = tituloDa(conversa);
  const naoLido = conversa.naoLidas > 0;

  return (
    <div>
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        gap: 10,
        alignItems: "center",
        /*
         * ⚠️ Sem respiro LATERAL. Com ele, o nome comecava recuado do campo de
         * busca logo acima, e a coluna perdia a linha vertical que o olho segue
         * de cima a baixo. O respiro que sobrou e so o de cima e o de baixo,
         * maior que antes, porque agora ha um divisor separando as conversas.
         */
        padding: `10px ${RESPIRO_DO_CARTAO}px`,
        border: "none",
        borderRadius: 0,
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
              /* Em CIMA, porque a quina de baixo passou a ser da etiqueta. As
                 duas ali embaixo se encostavam e viravam uma mancha so. */
              top: -1,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: ALTURA_DO_NOME,
          }}
        >
          {/*
            ⚠️ Sem `flex: 1`. Esticando, o nome empurraria as bolinhas para o
            meio da linha e elas parariam de pertencer a ele.
          */}
          <span
            style={{
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

          {/*
            A etiqueta COM O NOME, colada no do cliente, igual ao chat aberto.

            ⚠️ Saiu da quina do avatar: ali ela ocupava o lugar onde todo
            aplicativo de mensagem põe o ponto de "está online", e era assim que
            ela era lida — cor no canto da foto é presença, não classificação.

            ⚠️ Duas no máximo. A linha tem altura fixa e divide espaço com o
            nome, que é o que identifica a conversa; a terceira empurraria
            justamente ele para as reticências.
          */}
          {marcadas.slice(0, 2).map((e) => (
            <ChipDeEtiqueta key={e.id} etiqueta={e} miudo />
          ))}

          <span style={{ flex: 1 }} />

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

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            marginTop: 1,
            height: ALTURA_DA_PREVIA,
            overflow: "hidden",
          }}
        >
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

        {/*
          A etiqueta vem DEPOIS da previa, como no WhatsApp.

          ⚠️ Em cima, ao lado do nome, ela disputava espaco com a hora e com o
          proprio nome, que e o que identifica a conversa. Embaixo ela ocupa uma
          faixa que estava vazia e ainda le como o que e: uma marca colada na
          conversa, e nao parte do titulo.
        */}
      </div>
    </button>

    </div>
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

  /*
   * Anexo com legenda mostra a legenda; sem legenda, o nome do tipo. E o que o
   * WhatsApp faz: o icone diz o QUE e, o texto diz o que veio junto.
   *
   * ⚠️ O ultimo caso e "sem texto", e nao um traco. Um traco solto na linha nao
   * diz se a mensagem chegou vazia, se o painel falhou ou se ainda esta
   * carregando; a frase fecha a duvida.
   */
  const corpo = texto ?? rotulo ?? "Mensagem sem texto";

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

  if (tipo === "unsupported") {
    return (
      <svg {...comum} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.2v.1" />
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
  etiquetas,
  onAlternarEtiqueta,
  onCriarEtiqueta,
  onArquivar,
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
  onEnviarModelo: (nome: string, parametros: string[], urlDoBotao?: string) => Promise<void>;
  /** As etiquetas da empresa, para marcar sem sair da conversa. */
  etiquetas: Etiqueta[];
  onAlternarEtiqueta: (id: number) => void;
  onCriarEtiqueta: (nome: string, cor: CorDeEtiqueta) => Promise<number | null>;
  onArquivar: () => void;
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

  /*
   * A coluna dos modelos, a direita da conversa.
   *
   * ⚠️ Fora da janela de 24h ela ja nasce aberta: ali o modelo e a UNICA saida,
   * e obrigar um clique para revelar a unica coisa possivel e um passo a toa.
   */
  const [modelosAbertos, setModelosAbertos] = useState(
    conversa != null && !janelaAberta(conversa.janelaExpiraEm),
  );
  const [modeloEscolhido, setModeloEscolhido] = useState<Modelo | null>(null);
  const lista = useModelos(conversa?.id ?? 0, modelosAbertos && conversa != null);

  /*
   * Fechar o resumo VALE. A Thread tem `key` pela conversa e remonta a cada
   * troca de contato, entao um estado local reabria o cartao toda vez — quem
   * fechou uma vez o via de novo no proximo clique, e no seguinte.
   *
   * Quem lembra e o modulo, por atendimento: assunto novo abre atendimento novo,
   * e resumo de assunto novo merece ser lido.
   */
  const [, redesenhar] = useState(0);

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
  // A conversa guarda so os ids; nome e cor vivem na lista da empresa.
  const marcadas = conversa.etiquetas
    .map((id) => etiquetas.find((e) => e.id === id))
    .filter((e): e is Etiqueta => Boolean(e));

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
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--fw-semi)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {titulo}
            </span>

            {/*
              As etiquetas correm NA LINHA DO NOME, e nao numa faixa embaixo.

              ⚠️ A faixa propria empurrava a conversa inteira para baixo por
              causa de um chip de dezoito pixels. Aqui elas ocupam o vao que ja
              sobrava a direita do nome, e o X de cada uma tira a marca sem
              precisar reabrir o menu.
            */}
            {marcadas.map((e) => (
              <ChipDeEtiqueta
                key={e.id}
                etiqueta={e}
                miudo
                onRemover={() => onAlternarEtiqueta(e.id)}
              />
            ))}
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

        {/*
          Etiquetar e arquivar moram AQUI, com a conversa aberta.

          ⚠️ Classificar depende de ler o que a pessoa escreveu. Numa tela de
          cadastro a parte, quem etiqueta estaria decidindo de cabeca — e a
          etiqueta erra justamente por isso.
        */}
        <BotaoDeEtiquetas
          etiquetas={etiquetas}
          marcadas={conversa.etiquetas}
          onAlternar={onAlternarEtiqueta}
          onCriar={onCriarEtiqueta}
        />

        <button
          type="button"
          onClick={onArquivar}
          aria-label={conversa.arquivada ? "Desarquivar conversa" : "Arquivar conversa"}
          title={conversa.arquivada ? "Voltar à caixa de entrada" : "Arquivar"}
          style={{
            flexShrink: 0,
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="4.5" rx="1.4" />
            <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4" />
          </svg>
        </button>

        <BotaoDeDetalhes
          conversaId={conversa.id}
          aberto={detalhesAbertos}
          onAlternar={() => setDetalhesAbertos((v) => !v)}
        />
      </header>



      {detalhesAbertos && (
        <DetalhesDoContato conversa={conversa} onSair={onSair} onVinculou={onVinculou} />
      )}

      {/*
        Duas colunas: a conversa, e os modelos quando pedidos.

        ⚠️ A coluna nasce AO LADO, e nao por cima. Escolher um modelo depende de
        ler o que o cliente escreveu, e um painel sobreposto tapa exatamente
        isso. A conversa so encolhe.
      */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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
        {atendimento && !resumoFechado(atendimento.id) && (
          <ResumoDoAtendimento
            atendimento={atendimento}
            conversa={conversa}
            onFechar={() => {
              fecharResumo(atendimento.id);
              redesenhar((n) => n + 1);
            }}
          />
        )}

        {botRespondendo(conversa.botRespondendoEm) ? (
          <IaRespondendo />
        ) : modeloEscolhido ? (
          /*
            `key` pelo NOME: trocar de modelo remonta a caixa e o preenchido
            morre junto. Sem isso, os valores do modelo anterior ficavam nos
            campos do novo, e mandar um valor herdado e mandar a mensagem errada.
          */
          <EnvioDoModelo
            key={modeloEscolhido.nome}
            modelo={modeloEscolhido}
            onEnviar={onEnviarModelo}
            onTrocar={() => {
              setModeloEscolhido(null);
              setModelosAbertos(true);
            }}
          />
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
            onAbrirModelos={() => setModelosAbertos(true)}
          />
        ) : (
          <AvisoDaJanela onAbrirModelos={() => setModelosAbertos(true)} />
        )}
      </div>
      </div>

      {modelosAbertos && (
        <ColunaDeModelos
          lista={lista}
          escolhido={modeloEscolhido?.nome ?? null}
          onEscolher={(m) => {
            setModeloEscolhido(m);
            /*
             * ⚠️ A coluna FECHA na escolha. Ela existe para escolher, e escolhido
             * o modelo o que importa e a conversa de volta na largura inteira
             * mais os campos para preencher. Aberta, ela ficava ali repetindo
             * uma decisao ja tomada e comendo trezentos pixels da leitura.
             */
            setModelosAbertos(false);
          }}
          onFechar={() => {
            setModelosAbertos(false);
            setModeloEscolhido(null);
          }}
        />
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
  /*
   * O canto do RABINHO nao e arredondado: e dali que o balao sai.
   *
   * ⚠️ Com raio, sobrava uma meia-lua entre a curva do canto e a base do rabo, e
   * o rabo parecia colado por fora em vez de nascer da bolha.
   */
  const corDaBolha = minha ? "var(--primary-subtle)" : "var(--surface)";

  /*
   * Quanto reservar no fim do texto para o carimbo caber ao lado.
   *
   * Medido, nao adivinhado: "12:34" a 9px ocupa ~30px, e os tiques somam ~18px
   * com o respiro. Sobrando, o carimbo so flutua sobre esse vao; faltando, o
   * proprio vao quebra a linha e leva o carimbo junto.
   */
  /*
   * O espaco que o carimbo ocupa, reservado no fim do texto para ele nao cair
   * por cima da ultima palavra.
   *
   * ⚠️ Cresce quando a faisca da IA entra na linha: ela mora ali junto da hora,
   * e sem contar os catorze pixels dela o texto passava por baixo.
   */
  const larguraDoCarimbo = (minha ? 54 : 34) + (m.doBot ? 14 : 0);

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
          /*
           * ⚠️ 8 embaixo, e nao 5. O carimbo da hora flutua sobre esse respiro,
           * e com 5 ele encostava no fundo da bolha: sobrava mais ar em cima do
           * texto do que embaixo da hora, e a bolha ficava torta na vertical.
           */
          padding: ehFigurinha ? 0 : "7px 11px 8px",
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
              ? `${raio} ${raio} ${fechaBloco ? "0" : raio} ${raio}`
              : `${raio} ${raio} ${raio} ${fechaBloco ? "0" : raio}`,
          boxShadow: ehFigurinha ? "none" : "var(--shadow-xs)",
          fontSize: "var(--text-md)",
          lineHeight: "var(--lh-snug)",
          wordBreak: "break-word",
        }}
      >
        {/*
          O rabinho do balão, como no iMessage e no WhatsApp do iPhone.

          ⚠️ Só na ÚLTIMA do bloco. Um rabo por mensagem transformaria uma
          sequência de três em três balões soltos; com um só, as três leem como
          uma fala contínua e o rabo aponta para quem falou.

          ⚠️ Desenhado, e não um canto quadrado fingindo de bico. O canto era
          reto e lia como recorte, não como balão — e é justamente a curva da
          barriga do rabo que faz o desenho parecer conversa.
        */}
        {fechaBloco && !ehFigurinha && (
          <svg
            width="10"
            height="14"
            viewBox="0 0 10 14"
            aria-hidden
            style={{
              position: "absolute",
              bottom: 0,
              // Encostado na lateral, e não sobreposto: sobrepondo, a cor
              // translúcida da minha bolha escurecia onde as duas se cruzam.
              ...(minha ? { right: -9 } : { left: -9, transform: "scaleX(-1)" }),
            }}
          >
            <path d="M0 3C0 9 3.6 12.9 9.6 13.9L0 14Z" fill={corDaBolha} />
          </svg>
        )}

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
                ? ({ position: "absolute", right: 11, bottom: 8, lineHeight: 1 } as const)
                : ({
                    marginTop: 2,
                    justifyContent: minha ? "flex-end" : "flex-start",
                  } as const)),
            }}
          >
            {/*
              A marca da IA vira FAÍSCA, e mora à esquerda da hora.

              ⚠️ Antes era um robô com a palavra "IA" numa linha própria, acima
              do texto, e só na primeira mensagem do bloco. Duas mudanças: o robô
              é o desenho de "máquina falando", e o que a faísca diz é "isto foi
              gerado" — a mesma marca que o resto do sistema já usa. E na linha
              da hora ela aparece em TODA mensagem dela, que é onde o olho já vai
              conferir quem falou e quando.
            */}
            {m.doBot && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ flexShrink: 0, color: "var(--primary)" }}
                aria-label="Enviada pela IA"
              >
                <path d="M12 2c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8z" />
              </svg>
            )}

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
