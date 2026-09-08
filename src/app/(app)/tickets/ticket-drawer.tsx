"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import {
  Alert,
  Button,
  CampoBloqueado,
  CampoNumerico,
  CampoQuantidade,
  Field,
  AcoesDaLinha,
  BotaoDeAcao,
  EmptyRow,
  GrupoDeCampos,
  PanelTabs,
  SkeletonRows,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputDeCelula,
  inputStyle,
  selectStyle,
  tdNum,
} from "@/components/ui/kit";
import { Icon } from "@/components/layout/icones";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";
import { ItemDeHistorico, MenuDoCabecalho } from "@/components/ui/menu-de-cabecalho";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";


/**
 * A conta a receber e carregada sob demanda porque `fatura-drawer` importa ESTE
 * arquivo — abrir um ticket a partir de uma conta ja era possivel. Import
 * estatico nos dois sentidos fecharia um ciclo, e ciclo entre componentes React
 * quebra em runtime, nao no build.
 */
/**
 * O gerador de PDF entra sob demanda: jsPDF e autotable pesam mais que o resto
 * da tela somado, e quase toda abertura de ticket nao imprime nada.
 */
/**
 * O gerador de PDF entra sob demanda: jsPDF e autotable pesam mais que o resto
 * da tela somado, e quase toda abertura de ticket nao imprime nada.
 *
 * `pdf.ts` — a replica do documento do FlutterFlow — continua no codigo, mas
 * sem botao. Ficou como referencia do layout antigo e como dona de
 * `carregarLogo`, que os dois usam.
 */
async function imprimir(ticket: unknown, emitidoPor: string) {
  const { imprimirRecibo } = await import("./pdf-recibo");
  await imprimirRecibo(ticket as Parameters<typeof imprimirRecibo>[0], emitidoPor);
}


/**
 * Detalhe do ticket, em tres modos: ver, editar e incluir.
 *
 * Sao o mesmo componente porque os campos, as regras e o layout sao os mesmos —
 * dois arquivos divergiriam no primeiro campo novo. O que muda e se o campo
 * aceita digitacao e para onde o Salvar aponta.
 *
 * As abas existem porque empilhado o drawer teria servicos, contas e totais um
 * embaixo do outro, e a segunda pergunta ja cairia abaixo da dobra.
 */

type Item = {
  id: number;
  servicoId: number | null;
  servicoNome: string | null;
  descricao: string;
  /** A tarefa de projeto que virou esta linha. Nulo em serviço digitado à mão. */
  demandaId: number | null;
  demandaTitulo: string | null;
  data: string | null;
  quantidade: number;
  unidade: "UN" | "H";
  valorUnitario: number;
  desconto: number;
  acrescimo: number;
  despesas: { id: number; descricao: string; valor: number }[];
  total: number;
};

type FaturaDoTicket = {
  faturaId: number;
  /** O numero que a empresa ve (`faturas.idtenant`), e nao a chave do banco. */
  numero: number;
  valor: number;
  totalFatura: number;
  situacao: string;
  emitidaEm: string | null;
  observacoes: string | null;
  pago: number;
  atrasado: number;
  aVencer: number;
  proximoVencimento: string | null;
};

type Autoria = {
  criadoPor: string | null;
  criadoEm: string | null;
  editadoPor: string | null;
  editadoEm: string | null;
};

type Ticket = {
  id: number;
  numero: number;
  projetoId: number | null;
  enderecoId: number | null;
  titulo: string;
  statusChave: string | null;
  autoria: Autoria;
  clienteId: number | null;
  clienteNome: string | null;
  projetoNome: string | null;
  status: string;
  cancelada: boolean;
  origem: string;
  inicio: string | null;
  fim: string | null;
  descricao: string | null;
  local: string | null;
  total: number;
  faturado: number;
  saldo: number;
  qtdFaturas: number;
  itens: Item[];
  faturas: FaturaDoTicket[];
};

export type OpcaoEndereco = { id: number; resumo: string };
export type OpcaoProjeto = { id: number; nome: string };

/**
 * ⚠️ Sem centro de custo, e sem cascata de tres niveis.
 *
 * O endereco vinha pendurado no centro de custo, e escolher onde o cliente fica
 * exigia antes escolher uma CATEGORIA CONTABIL. Agora enderecos e projetos sao
 * ramos irmaos do cliente, e cada um responde o que sabe.
 */
export type OpcaoCliente = {
  id: number;
  nome: string;
  enderecos: OpcaoEndereco[];
  projetos: OpcaoProjeto[];
};
export type OpcaoServico = { id: number; descricao: string; valor: number };


const ABA_SERVICOS = "Serviços";
const ABA_FINANCEIRO = "Financeiro";

export function TicketDrawer({
  ticketId,
  resumo,
  criando,
  clientes = [],
  servicos = [],
  somenteLeitura,
  emitidoPor,
  onClose,
}: {
  /** null com `criando` falso = fechado. */
  ticketId: number | null;
  /**
   * O que a listagem ja tem em memoria sobre este ticket.
   *
   * Desenha cabecalho e totais no primeiro quadro, sem esperar a rede: o
   * usuario clicou num card que ja mostrava cliente, periodo e valor, e ver
   * esses mesmos campos como esqueleto por meio segundo e o que fazia a tela
   * parecer mais lenta que a antiga. O `fetch` continua e completa o resto
   * (servicos, contas, autoria).
   */
  resumo?: Partial<Ticket> | null;
  criando?: boolean;
  clientes?: OpcaoCliente[];
  servicos?: OpcaoServico[];
  /**
   * Esconde o Editar. Usado quando o drawer abre empilhado sobre outro — ali
   * ele e uma espiada no registro, e as listas de cliente e servico nem foram
   * carregadas.
   */
  somenteLeitura?: boolean;
  /** Nome de quem esta com a tela aberta — vai no rodape do PDF. */
  emitidoPor?: string;
  onClose: () => void;
}) {
  // `key` remonta a cada ticket: estado nasce vazio sozinho, sem limpar a mao
  // num efeito, e sem mostrar o registro anterior enquanto carrega.
  if (!criando && ticketId == null) return null;

  return (
    <Conteudo
      key={criando ? "novo" : ticketId}
      ticketId={criando ? null : ticketId}
      resumo={resumo}
      clientes={clientes}
      servicos={servicos}
      somenteLeitura={somenteLeitura}
      emitidoPor={emitidoPor}
      onClose={onClose}
    />
  );
}

/** Estado editavel. Espelha o corpo da API, nao a linha do banco. */
type Form = {
  clienteId: string;
  projetoId: string;
  enderecoId: string;
  descricao: string;
  itens: Item[];
};

function vazio(): Form {
  return { clienteId: "", projetoId: "", enderecoId: "", descricao: "", itens: [] };
}

function doTicket(t: Ticket): Form {
  return {
    clienteId: t.clienteId ? String(t.clienteId) : "",
    projetoId: t.projetoId ? String(t.projetoId) : "",
    enderecoId: t.enderecoId ? String(t.enderecoId) : "",
    descricao: t.descricao ?? "",
    itens: t.itens,
  };
}

function Conteudo({
  ticketId,
  resumo,
  clientes,
  servicos,
  somenteLeitura,
  emitidoPor = "",
  onClose,
}: {
  ticketId: number | null;
  resumo?: Partial<Ticket> | null;
  clientes: OpcaoCliente[];
  servicos: OpcaoServico[];
  somenteLeitura?: boolean;
  /** Nome de quem esta com a tela aberta — vai no rodape do PDF. */
  emitidoPor?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();
  const criando = ticketId == null;

  // Comeca com o que a listagem sabe; o fetch substitui pelo completo.
  const [ticket, setTicket] = useState<Ticket | null>(
    () => (resumo ? ({ itens: [], faturas: [], ...resumo } as Ticket) : null),
  );
  const [completo, setCompleto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState(ABA_SERVICOS);

  const [form, setForm] = useState<Form>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [salvandoProjeto, setSalvandoProjeto] = useState(false);

  useEffect(() => {
    if (ticketId == null) return;
    const controle = new AbortController();

    fetch(`/api/v1/tickets/${ticketId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o ticket");
        setTicket(corpo.data);
        setForm(doTicket(corpo.data));
        setCompleto(true);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [ticketId]);

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const doCliente = useMemo(
    () => clientes.find((c) => String(c.id) === form.clienteId) ?? null,
    [clientes, form.clienteId],
  );

  const enderecosDoCliente = doCliente?.enderecos ?? [];
  const projetosDoCliente = doCliente?.projetos ?? [];

  /**
   * Trocar de cliente limpa projeto e endereço.
   *
   * Mantê-los seria deixar no formulário uma obra e um endereço que não são do
   * cliente novo — o banco recusaria só no Salvar, depois de tudo preenchido.
   *
   * Com uma opção só, ela já vem escolhida: obrigar a abrir um select de item
   * único é clique que não decide nada.
   */
  function escolherCliente(id: string) {
    const escolhido = clientes.find((c) => String(c.id) === id) ?? null;
    const enderecos = escolhido?.enderecos ?? [];
    const projetos = escolhido?.projetos ?? [];

    const enderecoId = enderecos.length === 1 ? String(enderecos[0].id) : "";
    const projetoId = projetos.length === 1 ? String(projetos[0].id) : "";
    const anterior = form;

    setForm((f) => ({ ...f, clienteId: id, enderecoId, projetoId }));

    /* Os três num PATCH só: trocar de cliente sem soltar endereço e obra
       deixaria o ticket apontando para o endereço de outra empresa, e o banco
       recusaria — mas só na próxima gravação, longe do gesto que causou. */
    if (!criando && id) {
      void salvarParcial(
        {
          clienteId: Number(id),
          enderecoId: enderecoId ? Number(enderecoId) : null,
          projetoId: projetoId ? Number(projetoId) : null,
        },
        () => setForm(anterior),
      );
    }
  }



  // Enquanto edita, o total vem dos itens em tela — nao do que o servidor
  // devolveu. Senao o rodape mostraria o valor anterior ate salvar.
  const totalEmTela = useMemo(
    () => form.itens.reduce((s, i) => s + totalDoItem(i), 0),
    [form.itens],
  );

  // Periodo tambem: e derivado das datas dos servicos, entao acompanha a edicao.
  const periodoEmTela = useMemo(() => {
    const datas = form.itens.map((i) => i.data).filter(Boolean).sort() as DataISO[];
    return datas.length ? periodoEmMeses(datas[0], datas[datas.length - 1]) : null;
  }, [form.itens]);

  async function salvar() {
    setSalvando(true);
    setErro(null);

    const corpo = {
      clienteId: Number(form.clienteId),
      /* ⚠️ A obra e OPCIONAL. Ticket de manutencao avulsa nao pertence a obra
         nenhuma, e exigir uma faria alguem criar um "Geral" — que e como o
         centro de custo virou o que virou. */
      projetoId: form.projetoId ? Number(form.projetoId) : null,
      enderecoId: form.enderecoId ? Number(form.enderecoId) : null,
      descricao: form.descricao.trim() || null,
      itens: form.itens.map((i) => ({
        servicoId: i.servicoId,
        descricao: i.descricao,
        data: i.data,
        quantidade: i.quantidade,
        unidade: i.unidade,
        valorUnitario: i.valorUnitario,
        desconto: i.desconto,
        acrescimo: i.acrescimo,
        despesas: i.despesas.map((d) => ({ descricao: d.descricao, valor: d.valor })),
      })),
    };

    try {
      const r = await fetch(criando ? "/api/v1/tickets" : `/api/v1/tickets/${ticketId}`, {
        method: criando ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        // `details` traz o campo que o Zod recusou; so "Dados invalidos"
        // obrigaria o usuario a adivinhar qual.
        const detalhe = dados?.error?.details?.[0];
        avisar(
          "erro",
          criando ? "Não foi possível criar o ticket" : "Não foi possível salvar",
          detalhe
            ? `${detalhe.campo}: ${detalhe.mensagem}`
            : (dados?.error?.message ?? undefined),
        );
        return;
      }

      router.refresh();

      if (criando) {
        /* ⚠️ O aviso sai DEPOIS de fechar, e sobrevive a isso: ele vive no
           provider, e nao no drawer. Dentro dele, sumiria junto. */
        onClose();
        avisar("sucesso", `Ticket ${dados.data.numero} criado`, dados.data.clienteNome ?? undefined);
        return;
      }

      setTicket(dados.data);
      setForm(doTicket(dados.data));
    } catch {
      avisar("erro", "Falha de conexão", "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  /**
   * A descricao salva sozinha, fora do modo de edicao.
   *
   * E o campo que se anota no meio do atendimento — obrigar a entrar em edicao,
   * mexer e sair faria a anotacao rapida custar tres cliques, e o que nao e
   * barato de escrever nao e escrito.
   *
   * So ela vai no PATCH: mandar o resto arriscaria gravar campo que o usuario
   * nem abriu para editar.
   */
  /**
   * A obra grava sozinha, sem passar pelo modo de edicao.
   *
   * ⚠️ Vale ate em ticket ENCERRADO, e por isso tem rota propria. O PATCH do
   * ticket recusa encerrado — valor e servicos ja viraram cobranca paga. A obra
   * nao e dinheiro: e classificacao, e sao justamente os tickets antigos, ja
   * recebidos, que ficaram sem obra porque projeto nem existia quando foram
   * fechados. Sem isto eles nunca entrariam num relatorio por obra.
   */
  async function salvarProjeto(valor: string) {
    if (criando || ticket == null) return;

    const anterior = form.projetoId;
    set("projetoId", valor);
    setSalvandoProjeto(true);

    try {
      const r = await fetch(`/api/v1/tickets/${ticketId}/projeto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projetoId: valor ? Number(valor) : null }),
      });
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        avisar("erro", "Não foi possível salvar o projeto", dados?.error?.message);
        set("projetoId", anterior);
        return;
      }

      setTicket(dados.data);
      router.refresh();
    } catch {
      avisar("erro", "Falha de conexão", "O projeto não foi salvo.");
      set("projetoId", anterior);
    } finally {
      setSalvandoProjeto(false);
    }
  }

  /**
   * Grava um punhado de campos, sem passar por modo de edicao nenhum.
   *
   * ⚠️ O drawer deixou de ter "Editar". Ele existia para juntar as alteracoes e
   * mandar tudo de uma vez, mas os campos que mais se mexem — descricao e obra —
   * ja gravavam sozinhos, e o serviço passou a se editar num drawer proprio. O
   * que sobrava era um botao que trancava a tela para depois destrancar.
   *
   * ⚠️ Manda SO o que mudou. O PATCH aceita o cadastro inteiro; enviar o resto
   * junto gravaria campo que o usuario nem abriu.
   *
   * ⚠️ E devolve o estado anterior quando o servidor recusa. Sem isso a tela
   * ficaria mostrando uma escolha que o banco nao aceitou, e so um F5 revelaria.
   */
  async function salvarParcial(
    patch: Record<string, unknown>,
    aoFalhar: () => void,
  ): Promise<boolean> {
    if (criando || ticket == null) return false;

    setSalvando(true);
    setErro(null);

    try {
      const r = await fetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        const detalhe = dados?.error?.details?.[0];
        avisar(
          "erro",
          "Não foi possível salvar",
          detalhe
            ? `${detalhe.campo}: ${detalhe.mensagem}`
            : (dados?.error?.message ?? undefined),
        );
        aoFalhar();
        return false;
      }

      setTicket(dados.data);
      router.refresh();
      return true;
    } catch {
      avisar("erro", "Falha de conexão", "A alteração não foi salva.");
      aoFalhar();
      return false;
    } finally {
      setSalvando(false);
    }
  }

  /**
   * Os serviços ficam PENDENTES, e só gravam no "Salvar alterações".
   *
   * ⚠️ Eles são a exceção ao resto do drawer, que grava sozinho — e a diferença
   * é o que o campo significa. Cliente, local, obra e descrição são
   * classificação e texto: errar e corrigir custa outro clique. Serviço é
   * dinheiro, e é ele que forma o total que vira cobrança.
   *
   * Gravando na hora, abrir um serviço só para ver como ficaria já alterava o
   * ticket — e não havia nada a desfazer, porque o gesto de olhar e o de gravar
   * eram o mesmo. Agora a tabela mostra o resultado e a gravação espera um sim.
   */
  const [pendente, setPendente] = useState(false);

  /** Tudo que espera o check: serviços e descrição. */
  function mexerNoRascunho<K extends keyof Form>(campo: K, valor: Form[K]) {
    set(campo, valor);
    if (!criando) setPendente(true);
  }

  function salvarPendentes() {
    void salvarParcial(
      {
        descricao: form.descricao.trim() || null,
        itens: form.itens.map((i) => ({
          servicoId: i.servicoId,
          descricao: i.descricao,
          data: i.data,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valorUnitario: i.valorUnitario,
          desconto: i.desconto,
          acrescimo: i.acrescimo,
          despesas: i.despesas.map((d) => ({ descricao: d.descricao, valor: d.valor })),
        })),
      },
      // Sem rollback: falhando, o que o usuario digitou continua na tela para
      // ele corrigir. Descartar e o botao ao lado.
      () => {},
    ).then((gravou) => {
      if (!gravou) return;
      setPendente(false);
      avisar("sucesso", "Alterações salvas");
    });
  }

  /** Volta serviços e descrição ao que está gravado. */
  function descartarPendentes() {
    if (ticket) {
      const gravado = doTicket(ticket);
      setForm((f) => ({ ...f, itens: gravado.itens, descricao: gravado.descricao }));
    }
    setPendente(false);
    setErro(null);
  }

  /** Ha rascunho por gravar: o cabecalho vira as duas acoes e esconde o resto. */
  const emEdicao = criando || pendente;


  /**
   * Ter faturamento NAO tranca a edicao.
   *
   * A versao anterior travava os servicos sempre que `faturado > 0`, e isso
   * pegava os 151 tickets migrados — inclusive os que estao em "Orcamento" —,
   * porque a migracao criou vinculo em `faturasorigens` para TODA fatura, ate
   * as que nunca foram cobranca de verdade.
   *
   * A regra que e sempre verdadeira e outra: o total nao pode cair abaixo do
   * que ja virou cobranca. Quem a aplica e `atualizarTicket`, com o valor exato
   * na mensagem — e o gatilho `guarda_saldo_por_origem` fecha a porta do outro
   * lado. Aqui fica so o aviso.
   */
  const faturado = (ticket?.faturado ?? 0) > 0;

  /**
   * Encerrado e ponto final: faturado por inteiro e recebido por inteiro.
   *
   * Nada aqui aceita gesto: nem os campos, nem o menu do serviço. Barrar so no
   * Salvar faria o usuario preencher para depois descobrir que nao podia.
   *
   * A obra e a excecao, e tem rota propria — ver `salvarProjeto`.
   */
  const encerrado = ticket?.statusChave === "ENCERRADA";

  /**
   * Onde os campos aceitam gesto.
   *
   * ⚠️ Nao existe mais modo de edicao. Havia um "Editar" que trancava a tela
   * para depois destrancar: ele existia para juntar alteracoes e mandar tudo de
   * uma vez, mas descricao e obra ja gravavam sozinhas, e o serviço passou a se
   * editar num drawer proprio. O que sobrava era um clique antes de todo gesto.
   *
   * Cada campo grava no proprio `onChange`. O unico rascunho que ainda existe e
   * o da CRIACAO, que ainda nao tem registro no banco para gravar em cima — e e
   * so ele que tem rodape com Criar e Cancelar.
   */
  const podeMexer = !somenteLeitura && !encerrado;

  /*
   * As duas travas das ações destrutivas, e elas são DIFERENTES.
   *
   * `temConta` barra a exclusão: a conta guarda o valor que saiu daqui, e sem o
   * ticket a composição dela aponta para um registro que não existe.
   *
   * `temBaixa` barra o cancelamento, que é mais permissivo de propósito: conta
   * gerada e não recebida ainda pode ser desfeita, e é justamente aí que
   * cancelar serve. O que não volta atrás é dinheiro que entrou.
   */
  const temConta = (ticket?.faturas.length ?? 0) > 0;
  const temBaixa = (ticket?.faturas ?? []).some((f) => f.pago > 0);

  async function cancelarTicket() {
    const r = await fetch(`/api/v1/tickets/${ticketId}/cancelar`, { method: "POST" });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("erro", dados?.error?.message ?? "Não foi possível cancelar o ticket");
      return;
    }

    setTicket(dados.data);
    router.refresh();
    avisar("sucesso", `Ticket ${ticket?.numero ?? ""} cancelado`.trim(), "Ele saiu das listagens do dia a dia e as origens foram liberadas.");
  }

  async function excluirTicket() {
    const r = await fetch(`/api/v1/tickets/${ticketId}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", dados?.error?.message ?? "Não foi possível excluir o ticket");
      return;
    }

    // Fecha antes de atualizar: o drawer aponta para um ticket que não existe
    // mais, e recarregar com ele aberto daria 404 na tela.
    const numero = ticket?.numero;
    onClose();
    router.refresh();
    avisar("sucesso", `Ticket ${numero ?? ""} excluído`.trim());
  }

  const carregando = !criando && !ticket && !erro;
  const carregandoDetalhe = !criando && !completo && !erro;
  const podeSalvar =
    form.clienteId !== "" &&
    form.itens.every((i) => i.quantidade > 0);

  return (
    <Drawer
      open
      onClose={onClose}
      title={criando ? "Novo ticket" : ticket ? `Ticket ${ticket.numero}` : "Ticket"}
      headerExtra={
        /*
         * `completo`, nao `ticket`: o drawer nasce com o resumo da listagem, e
         * ele nao traz emitente, endereco nem autoria. Imprimir nesse momento
         * estourava em `t.empresa.logo` — o botao existia antes do dado.
         *
         * ⚠️ E TUDO some em edicao. Imprimir, cancelar, excluir e o historico
         * falam do ticket como ele esta gravado; com alteracoes por salvar na
         * tela, imprimir sairia com o valor antigo e excluir levaria junto o que
         * estava sendo escrito. Editando, as unicas saidas sao salvar e desistir.
         */
        /* ⚠️ Some com alteracao pendente. Ver `Rodape`: naquele momento o
           cabecalho tem duas acoes e nao pode ter mais nada. */
        completo && ticket && !emEdicao && (
          <div style={{ display: "flex", gap: 6 }}>
            <BotaoDeCabecalho
              rotulo="Imprimir"
              onClick={() => void imprimir(ticket, emitidoPor)}
            >
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a1 1 0 01-1-1v-5a2 2 0 012-2h14a2 2 0 012 2v5a1 1 0 01-1 1h-2" />
              <rect x="6" y="14" width="12" height="7" rx="1" />
            </BotaoDeCabecalho>

            {/*
              ⚠️ Cancelar, excluir e historico num MENU, e nao tres botoes.

              O cabecalho tinha cinco alvos de 28 pixels lado a lado — imprimir,
              cancelar, excluir, historico e fechar —, e dois deles destrutivos
              encostados no X. Numa barra assim o gesto de fechar fica a um
              pixel do gesto de apagar.

              Ficam de fora os dois que se usam sem pensar: imprimir, que e o
              motivo mais comum de abrir o ticket, e fechar, que precisa estar
              sempre no mesmo lugar.

              ⚠️ O historico entra como CONTEUDO do menu, e nao como item que
              abre outro popover. Ele ja era um cartao flutuante proprio; dentro
              do menu viraria popover sobre popover, e o de dentro morreria junto
              com o de fora ao clicar.
            */}
            <MenuDoCabecalho>
              {(fechar) => (
                <>
                  <ItemDeHistorico autoria={ticket.autoria} />

                  {!ticket.cancelada && !somenteLeitura && (
                    <ItemDoMenu
                      rotulo="Cancelar ticket"
                      desabilitado={temBaixa}
                      motivo={
                        temBaixa
                          ? "Ticket com recebimento na conta não é cancelado; estorne a baixa antes"
                          : undefined
                      }
                      icone={
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        >
                          {/* Circulo cortado: proibido, e nao um X, que aqui
                              significaria fechar o drawer. */}
                          <circle cx="12" cy="12" r="9" />
                          <path d="M5.6 5.6l12.8 12.8" />
                        </svg>
                      }
                      onClick={() => {
                        fechar();
                        confirmar(
                          `Cancelar o ticket ${ticket.numero}?`,
                          "Cancelar ticket",
                          cancelarTicket,
                          "Ele para de ser cobrável e sai das listagens do dia a dia. As tarefas voltam a poder ser faturadas e o vínculo com o projeto sai. O histórico fica.",
                        );
                      }}
                    />
                  )}

                  {!somenteLeitura && (
                    <ItemDoMenu
                      rotulo="Excluir ticket"
                      perigo
                      desabilitado={temConta}
                      motivo={
                        temConta
                          ? "Ticket que já gerou conta a receber não é excluído, é cancelado"
                          : undefined
                      }
                      icone={
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                          <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      }
                      onClick={() => {
                        fechar();
                        confirmar(
                          `Excluir o ticket ${ticket.numero}?`,
                          "Excluir",
                          excluirTicket,
                          "Serviços, despesas e o vínculo com o projeto vão junto. As tarefas que viraram itens voltam a poder ser faturadas.",
                        );
                      }}
                    />
                  )}
                </>
              )}
            </MenuDoCabecalho>
          </div>
        )
      }
      acoes={
        <Rodape
          criando={criando}
          pendente={pendente}
          salvando={salvando}
          podeSalvar={podeSalvar}
          onSalvar={criando ? salvar : salvarPendentes}
        />
      }
      /*
       * ⚠️ Com alteracao pendente o X DESCARTA, em vez de fechar.
       *
       * Fechando, o que foi mexido e nao gravado sumiria sem aviso — e o X e o
       * botao que a mao acerta sem olhar. Ele fica no mesmo pixel e troca de
       * significado: as duas saidas daquele momento sao gravar e descartar, e
       * sao as duas unicas coisas no cabecalho.
       */
      fecharPersonalizado={
        emEdicao
          ? {
              rotulo: criando ? "Descartar e fechar" : "Descartar alterações",
              onClick: criando ? onClose : descartarPendentes,
            }
          : undefined
      }
    >
      {/*
        ⚠️ Falha de gravacao NAO vira faixa aqui dentro.

        Ela virava um `Alert` no topo do drawer, e isso tem dois problemas: em
        formulario rolado a faixa nasce fora da vista, e ela empurra o conteudo
        para baixo — quem estava lendo um campo perde o lugar no exato momento em
        que precisa de atencao.

        Vai para a notificacao do sistema, que e onde todo o resto do sistema
        avisa. O `erro` de CARREGAMENTO continua aqui embaixo: aquele nao e um
        recado passageiro, e a tela nao tem o que mostrar sem ele.
      */}

      {erro && !ticket && !criando && (
        <div style={{ marginBottom: 12 }}>
          <Alert variant="danger" title={erro} />
        </div>
      )}

      {carregando && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[70, 90, 55, 100].map((l, i) => (
            <div
              key={i}
              className="sk"
              style={{
                height: 14,
                width: `${l}%`,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-3)",
              }}
            />
          ))}
        </div>
      )}

      {(ticket || criando) && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 18 }}>
            {/* Faturado trava o cliente: ja existe conta a receber emitida no
                nome dele, e trocar aqui deixaria a cobranca no nome errado. */}
            <Field label="Cliente" required={criando}>
              {podeMexer && !faturado ? (
                <select
                  value={form.clienteId}
                  onChange={(e) => escolherCliente(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Selecione…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <CampoBloqueado
                  valor={ticket?.clienteNome ?? "—"}
                  titulo={
                    faturado
                      ? "Já existe conta a receber emitida — o cliente não pode ser trocado"
                      : undefined
                  }
                />
              )}
            </Field>

            <Field label="Local">
              {podeMexer ? (
                <select
                  value={form.enderecoId}
                  onChange={(e) => {
                    const anterior = form.enderecoId;
                    set("enderecoId", e.target.value);
                    if (!criando) {
                      void salvarParcial(
                        { enderecoId: e.target.value ? Number(e.target.value) : null },
                        () => set("enderecoId", anterior),
                      );
                    }
                  }}
                  disabled={!form.clienteId}
                  style={selectStyle}
                >
                  <option value="">
                    {form.clienteId
                      ? enderecosDoCliente.length === 0
                        ? "Este cliente não tem endereço cadastrado"
                        : "Selecione…"
                      : "Escolha o cliente primeiro"}
                  </option>
                  {enderecosDoCliente.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.resumo}
                    </option>
                  ))}
                </select>
              ) : (
                <CampoBloqueado valor={ticket?.local || "—"} />
              )}
            </Field>

            {/*
              ⚠️ Projeto, e nao centro de custo.

              Aqui se escolhia uma categoria contabil para so entao chegar ao
              endereco. A obra e o que descreve um ticket; a categoria descreve
              um lancamento, e as duas nao se substituem — a mesma obra tem
              despesa de salario e receita de servico.

              ⚠️ E NAO e obrigatorio, ao contrario do centro que estava aqui.
            */}
            {/* Sempre editavel, mesmo fora do modo de edicao e mesmo encerrado. */}
            <Field
              label="Projeto"
              hint={
                salvandoProjeto
                  ? "Salvando…"
                  : "A que projeto este ticket pertence. Um ticket pertence a um só."
              }
            >
              <select
                value={form.projetoId}
                onChange={(e) =>
                  criando ? set("projetoId", e.target.value) : salvarProjeto(e.target.value)
                }
                disabled={!form.clienteId || salvandoProjeto}
                style={selectStyle}
              >
                <option value="">
                  {form.clienteId
                    ? projetosDoCliente.length > 0
                      ? "Sem projeto"
                      : "Este cliente não tem projeto"
                    : "Escolha o cliente primeiro"}
                </option>
                {projetosDoCliente.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Período">
              <CampoBloqueado
                titulo="Vem das datas dos serviços"
                valor={
                  (criando ? periodoEmTela : periodoEmMeses(ticket?.inicio ?? null, ticket?.fim ?? null)) ??
                  "—"
                }
              />
            </Field>

            <Field label="Situação">
              <CampoBloqueado
                valor={ticket?.cancelada ? "CANCELADO" : (ticket?.status ?? "—")}
                titulo="Muda ao arrastar o card no quadro ou ao faturar"
              />
            </Field>

            {/*
              ⚠️ Um CAMPO, e não a tabela de contas que ficava na aba Financeiro.

              Aquela tabela trazia para dentro do ticket o pago e o a receber da
              CONTA — e a conta reúne vários tickets, então os números que ela
              mostrava não eram deste ticket. Quem responde "quanto entrou e
              quanto falta" é a tela de contas a receber; aqui basta saber em
              qual conta este ticket entrou.

              O NÚMERO, e não o id: `faturas.idtenant` é o que a empresa vê.
            */}
            <Field label="Conta a receber">
              <CampoBloqueado
                valor={
                  (ticket?.faturas ?? []).length === 0
                    ? "—"
                    : (ticket?.faturas ?? []).map((f) => f.numero).join(", ")
                }
                titulo="A conta a receber que consumiu valor deste ticket"
              />
            </Field>

            {/*
              ⚠️ O total sobe para os campos, ao lado da conta.

              Ele e a resposta mais procurada do ticket — quanto isto vale — e
              estava atras de um clique na aba Financeiro. La ele continua, como
              ULTIMA linha de uma conta que se le de cima para baixo (serviços,
              desconto, acrescimo, despesas, total): ali ele fecha a aritmetica,
              aqui ele e o numero em si.
            */}
            <Field label="Total do ticket">
              <CampoBloqueado
                valor={formatarSemSimbolo(
                  (criando ? totalEmTela : (ticket?.total ?? 0)) as Centavos,
                )}
                titulo="Soma dos serviços, com ajustes e despesas"
              />
            </Field>

            {/* Sempre editavel, mesmo fora do modo de edicao. */}
            <Field label="Descrição">
              {encerrado ? (
                <CampoBloqueado
                  valor={ticket?.descricao || "—"}
                  multilinha
                  titulo="Ticket encerrado — não pode mais ser alterado"
                />
              ) : (
                <textarea
                  value={form.descricao}
                  /* ⚠️ Cai no check, e nao mais no blur. Gravando ao sair do
                     campo, clicar fora sem querer ja tinha gravado — e o texto
                     e o unico campo que se edita junto com os serviços, entao
                     eles esperam o mesmo sim. */
                  onChange={(e) => mexerNoRascunho("descricao", e.target.value)}
                  rows={3}
                  placeholder="Anotações sobre este ticket"
                  style={{
                    ...inputStyle,
                    width: "100%",
                    height: "auto",
                    padding: 8,
                    resize: "vertical",
                  }}
                />
              )}
            </Field>
          </div>

          <PanelTabs
            tabs={[`${ABA_SERVICOS} (${form.itens.length})`, ABA_FINANCEIRO]}
            active={
              aba === ABA_SERVICOS ? `${ABA_SERVICOS} (${form.itens.length})` : ABA_FINANCEIRO
            }
            onChange={(t) => setAba(t.startsWith(ABA_SERVICOS) ? ABA_SERVICOS : ABA_FINANCEIRO)}
          />

          {aba === ABA_SERVICOS && (
            <ListaServicos
              itens={form.itens}
              carregando={carregandoDetalhe}
              editando={podeMexer}
              faturado={ticket?.faturado ?? 0}
              servicos={servicos}
              aoMudar={(itens) => mexerNoRascunho("itens", itens)}
            />
          )}

          {aba === ABA_FINANCEIRO && (
            <Financeiro itens={form.itens} />
          )}
        </>
      )}
    </Drawer>
  );
}

/**
 * As acoes do ticket, no cabecalho.
 *
 * ⚠️ "Cancelar" CONTINUA existindo, ao contrario dos outros drawers. Aqui ele
 * nao fecha a tela: ele sai do modo de edicao e devolve os campos ao que
 * estavam. O X do cabecalho fecharia o drawer inteiro, que e outra coisa.
 */
function Rodape({
  criando,
  pendente,
  salvando,
  podeSalvar,
  onSalvar,
}: {
  criando: boolean;
  /** Ha serviço mexido e ainda nao gravado. */
  pendente: boolean;
  salvando: boolean;
  podeSalvar: boolean;
  onSalvar: () => void;
}) {
  /*
   * ⚠️ O rodape aparece em DOIS casos, e some no resto.
   *
   *   criando  -> os campos formam um rascunho que ainda nao existe no banco.
   *   pendente -> algum serviço foi mexido, e serviço e dinheiro: ele espera um
   *               sim antes de virar o total que forma a cobranca.
   *
   * Fora disso nao ha o que confirmar — cliente, local, obra e descricao gravam
   * sozinhos, e um "Salvar" permanente prometeria juntar o que ja foi.
   *
   * Sem "Gerar conta a receber" tambem: a cobranca nasce na tela de contas a
   * receber, que e onde se escolhe QUAIS tickets entram nela. Um botao aqui
   * sugeriria a conta 1:1 com o ticket, que e justamente o que o modelo desfez.
   */
  if (!criando && !pendente) return null;

  /*
   * ⚠️ Um CHECK, e nao "Salvar alterações" escrito.
   *
   * Ele divide a linha com o X que descarta, e os dois vivem entre botoes de
   * icone de 28 pixels: um botao de texto no meio deles quebrava o ritmo do
   * cabecalho e empurrava o titulo do ticket para fora em drawer estreito.
   *
   * O par le sozinho — check grava, X descarta —, e o `title` diz o resto para
   * quem parar em cima.
   */
  return (
    <button
      type="button"
      onClick={onSalvar}
      disabled={salvando || !podeSalvar}
      title={salvando ? "Salvando…" : criando ? "Criar ticket" : "Salvar alterações"}
      style={{
        height: 28,
        padding: "0 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        whiteSpace: "nowrap",
        border: "1px solid var(--primary)",
        background: "var(--primary)",
        borderRadius: "var(--radius-sm)",
        cursor: salvando || !podeSalvar ? "not-allowed" : "pointer",
        opacity: salvando || !podeSalvar ? 0.5 : 1,
        color: "var(--primary-fg)",
      }}
    >
      {salvando ? (
        <span className="girando" style={{ display: "grid", placeItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 3a9 9 0 1 1-6.4 2.6" />
          </svg>
        </span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
      )}
      {/* ⚠️ Este e o UNICO com palavra. O X ao lado descarta, e um par de
          icones iguais em peso deixaria o gesto que grava com a mesma cara do
          que joga fora. Escrito, ele e o caminho obvio; o X e a saida. */}
      {salvando ? "Salvando…" : criando ? "Criar" : "Salvar"}
    </button>
  );
}

// ── Aba Financeiro ──────────────────────────────────────────────────────────

/**
 * Os numeros que ficavam na barra do topo, em campos.
 *
 * A barra ocupava a primeira dobra do drawer com uma pergunta que quase nunca e
 * a primeira — quem abre um ticket quer ver o que foi executado. Em aba, o
 * numero continua a um clique e para de disputar o comeco da tela.
 *
 * Mede FATURAMENTO, nao recebimento: o dinheiro so entra quando a conta a
 * receber for baixada.
 */
function Financeiro({ itens }: { itens: Item[] }) {
  /*
   * ⚠️ Sem a guia "Histórico" e sem a tabela de contas.
   *
   * Ela listava, por conta, "Deste ticket", "Pago" e "A receber" — e só a
   * primeira era deste ticket. Pago e a receber eram da CONTA inteira, porque
   * ratear a baixa entre as origens de uma conta composta exigiria decidir qual
   * ticket foi pago primeiro, que é invenção e não dado. Três colunas lado a
   * lado, duas delas de outro universo, leem como se somassem.
   *
   * Em que conta este ticket entrou virou um campo lá em cima, ao lado da
   * situação. O resto é da tela de contas a receber, que é a dona da cobrança.
   */
  return <Resumo itens={itens} />;
}

/**
 * Composicao do valor do ticket.
 *
 * Desconto e acrescimo sao SOMA DOS ITENS, nao campos do ticket: eles ja vivem
 * na linha do servico, e um segundo par no cabecalho criaria dois lugares para
 * dar o mesmo desconto — com resultados diferentes dependendo de onde foi
 * digitado.
 */
function Resumo({ itens }: { itens: Item[] }) {
  const bruto = itens.reduce((s, i) => s + Math.round(i.quantidade * i.valorUnitario), 0);
  const desconto = itens.reduce((s, i) => s + i.desconto, 0);
  const acrescimo = itens.reduce((s, i) => s + i.acrescimo, 0);
  const despesas = itens.reduce((s, i) => s + i.despesas.reduce((t, d) => t + d.valor, 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Field label="Serviços">
        <CampoBloqueado valor={formatarSemSimbolo(bruto as Centavos)} />
      </Field>
      <Field label="Desconto">
        <CampoBloqueado valor={formatarSemSimbolo(desconto as Centavos)} />
      </Field>
      <Field label="Acréscimo">
        <CampoBloqueado valor={formatarSemSimbolo(acrescimo as Centavos)} />
      </Field>

      {/* Soma das despesas lancadas em cada servico — abastecimento, pedagio,
          material. Diferente de acrescimo, que e ajuste de preco sem
          justificativa itemizada. */}
      <Field label="Despesas adicionais">
        <CampoBloqueado valor={formatarSemSimbolo(despesas as Centavos)} />
      </Field>

      {/*
        ⚠️ Sem "Faturado", sem "Saldo a faturar" e sem "Total do ticket".

        Eles descreviam um faturamento PARCIAL que o modelo deixou de permitir: a
        composição congela quando o ticket vira conta a receber — nenhum serviço
        entra, nenhum sai, nenhum valor muda —, então o total passa a ser
        exatamente o que foi faturado, e o saldo, sempre zero. Três campos para
        dizer o mesmo número, dois deles prometendo uma folga que não existe.

        Em que conta ele entrou é o campo lá em cima, ao lado da situação. Quanto
        entrou e quanto falta receber é da tela de contas a receber.

        E o TOTAL subiu para os campos, junto da conta. Repetido aqui embaixo de
        uma soma que ele fecha, ele seria o mesmo número em duas telas — e a
        aba passou a ser só a composição: de onde o total veio.
      */}
    </div>
  );
}


// ── Aba Serviços ────────────────────────────────────────────────────────────

/**
 * Valor final do servico: bruto − desconto + acrescimo + despesas.
 *
 * ⚠️ Tem de bater com `totalDoItem` em `tickets.service.ts`, que e quem grava.
 * As despesas ficaram de fora daqui quando foram criadas — a tela mostrava o
 * total sem elas enquanto se editava, e o numero so "pulava" depois de salvar.
 */
function totalDoItem(i: Item): number {
  const bruto = Math.round(i.quantidade * i.valorUnitario);
  const despesas = i.despesas.reduce((s, d) => s + d.valor, 0);
  return Math.max(0, bruto - i.desconto + i.acrescimo + despesas);
}

/** Id negativo em linha nova: distingue do id real sem precisar de outro campo. */
let proximoIdLocal = -1;

/**
 * Servicos como lista de cards, nao tabela.
 *
 * Em tabela, mostrar desconto e acrescimo exigiria seis colunas numa largura de
 * 720 — todas espremidas e a descricao cortada. Em card, o nome fica com a
 * linha inteira e a composicao do preco vem embaixo, no lugar onde ela e lida:
 * quantidade x unitario, os ajustes, e o total na direita.
 *
 * Desconto e acrescimo so aparecem quando existem. Fixos em "0,00" pintariam de
 * ruido todos os itens que nao tem ajuste nenhum — que sao a maioria.
 */
function ListaServicos({
  itens,
  carregando,
  editando,
  faturado,
  servicos,
  aoMudar,
}: {
  itens: Item[];
  carregando: boolean;
  editando: boolean;
  /**
   * Quanto deste ticket ja virou conta a receber.
   *
   * ⚠️ Acima de zero, a COMPOSICAO congela: nao entra serviço novo, nenhum sai,
   * e valores e seletor travam no drawer. So a descricao continua livre. Sem
   * isso dava para trocar o serviço de um ticket ja cobrado por outro, de outro
   * centro de custo, mantendo o mesmo total — a conta fechava e o rateio
   * contabil passava a apontar para uma categoria que nunca foi cobrada.
   *
   * A mesma regra vive em `atualizarTicket`: a tela evita o gesto, o servico
   * garante.
   */
  faturado: number;
  servicos: OpcaoServico[];
  aoMudar: (itens: Item[]) => void;
}) {
  /* O item aberto no drawer de cima. Um id negativo distingue o que ainda nao
     existe no banco — ver `proximoIdLocal`. */
  const [emEdicao, setEmEdicao] = useState<Item | null>(null);

  function adicionar() {
    setEmEdicao({
        id: proximoIdLocal--,
        servicoId: null,
        servicoNome: null,
        demandaId: null,
        demandaTitulo: null,
        descricao: "",
        data: null,
        quantidade: 1,
        unidade: "UN",
        valorUnitario: 0,
        desconto: 0,
        acrescimo: 0,
      despesas: [],
      total: 0,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/*
        ⚠️ TABELA sempre, inclusive editando.

        Editar abria cards no lugar das linhas: a tabela se desmontava para
        virar formulário e voltava a montar ao salvar, e no meio disso o
        alinhamento das colunas — que é o que deixa comparar valores — sumia.

        O serviço agora se edita num drawer POR CIMA deste. A tabela fica de pé
        atrás dele, e ao fechar a linha alterada já está no lugar, na mesma
        grade. É o mesmo gesto do resto do sistema: a lista mostra, a ação de
        linha abre o detalhe.
      */}
      {/*
        ⚠️ O incluir e o "+" COLADO no titulo, e nao um botao no fim da lista —
        o mesmo `GrupoDeCampos` de "adicionar ticket" na conta a receber.

        No rodape de uma tabela que rola, ele descia junto com a ultima linha:
        num ticket de dez serviços era preciso rolar ate o fim para achar como
        lancar o decimo primeiro. E a legenda entra ANTES da tabela, que e onde
        ela ainda pode explicar o que vem — depois dela, ja nao explica nada.
      */}
      <GrupoDeCampos
        primeiro
        /* ⚠️ O titulo COMPLEMENTA o nome da aba, nao o repete. A aba ja se
           chama "Serviços"; um titulo igual seria a mesma palavra duas vezes,
           uma embaixo da outra, e nenhuma das duas informa. */
        titulo="O que foi executado"
        legenda="O valor do ticket é a soma deles. Cada linha abre no menu ao lado, com data, quantidade, ajustes e despesas."
        onIncluir={editando && faturado === 0 ? adicionar : undefined}
        rotuloIncluir="Adicionar serviço"
      >
        <TabelaServicos
          itens={itens}
          carregando={carregando}
          editando={editando}
          faturado={faturado}
          aoEditar={setEmEdicao}
          aoRemover={(id) => aoMudar(itens.filter((x) => x.id !== id))}
        />
      </GrupoDeCampos>

      {emEdicao && (
        <ServicoDrawer
          item={emEdicao}
          servicos={servicos}
          faturado={faturado}
          somenteLeitura={!editando}
          onClose={() => setEmEdicao(null)}
          aoSalvar={(salvo) => {
            aoMudar(
              itens.some((x) => x.id === salvo.id)
                ? itens.map((x) => (x.id === salvo.id ? salvo : x))
                : [...itens, salvo],
            );
            setEmEdicao(null);
          }}
        />
      )}
    </div>
  );
}



/**
 * Os serviços do ticket, na tabela padrão do sistema.
 *
 * Mesmas peças da lista de tickets da conta a receber (`TableArea`, `Th`, `Tr`,
 * `Td`, `EmptyRow`): duas listas do mesmo assunto, em drawers vizinhos, não
 * podem ter desenhos diferentes.
 *
 * ⚠️ `minWidth={0}`: a tabela cabe na largura do drawer e não rola de lado. O
 * padrão de 760 é das telas de listagem, que têm a página inteira.
 */
function TabelaServicos({
  itens,
  carregando,
  editando,
  faturado,
  aoEditar,
  aoRemover,
}: {
  itens: Item[];
  carregando: boolean;
  editando: boolean;
  faturado: number;
  aoEditar: (item: Item) => void;
  aoRemover: (id: number) => void;
}) {
  /* Remover so enquanto nada foi cobrado. Depois disso o serviço ja saiu numa
     conta a receber, e tira-lo daqui deixaria a conta apontando para o vazio. */
  const podeRemover = editando && faturado === 0;
  return (
    <TableArea minWidth={0}>
      <TableHead>
        <Th>Serviço</Th>
        <Th minWidth={90}>Data</Th>
        {/*
          ⚠️ UMA coluna de valor, e não três.

          Quantidade, unitário e total são a mesma conta lida em três pedaços, e
          separadas gastavam metade da largura do drawer para dizer "1 un" e
          "1.000,00" — dois números que só existem para explicar o terceiro. Na
          mesma coluna a composição fica em cima, apagada, e o que vale fica
          embaixo, em negrito: o olho pega o total e a conta está do lado quando
          se quer conferir.
        */}
        <Th align="right" minWidth={130}>
          Valor
        </Th>
        {/* ⚠️ SEMPRE. A coluna sumia fora do modo de edição, e como não há mais
            modo de edição ela seria a única porta para o serviço — escondida
            justamente quando se quer abrir. Sem cabeçalho: é a coluna de ações
            do sistema inteiro, e ela não se anuncia. */}
        <Th> </Th>
      </TableHead>

      <tbody>
        {/* O esqueleto e da TABELA agora: como lista de cards ele prometia um
            desenho que nao era o que chegava depois. */}
        {carregando && (
          <SkeletonRows cols={4} rows={3} labels={["Serviço", "Data", "Valor", ""]} />
        )}

        {!carregando && itens.length === 0 && (
          <EmptyRow
            colSpan={4}
            message="Nenhum serviço lançado. O valor do ticket é a soma deles."
          />
        )}

        {!carregando &&
          itens.map((item) => (
          <Tr key={item.id}>
            {/* ⚠️ Respiro em cima e embaixo, e so na vertical.

                A celula tem duas linhas agora, e sem folga elas encostavam na
                regua da linha seguinte. O recuo LATERAL continua sendo do CSS:
                estilo em linha vence seletor, e cravar `padding` aqui mataria a
                regra que tira a margem da primeira e da ultima celula. */}
            <Td style={CELULA}>
              {/*
                Despesas DEPOIS do nome, na mesma linha, com quebra quando não
                couberem. Embaixo elas empurravam a descrição para longe do nome.
              */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {/* Sem servico vinculado, o texto livre assume o topo — senao a
                    linha ficaria sem identificacao. */}
                <span>{item.servicoNome ?? item.descricao ?? "Serviço avulso"}</span>

                {/* De onde veio o valor. Sem isto o ticket mostrava o número sem
                    dizer o que foi entregue para chegar nele. */}
                {item.demandaTitulo && (
                  <span
                    title={`Gerado pela tarefa "${item.demandaTitulo}"`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--fw-medium)",
                      color: "var(--text-tertiary)",
                      letterSpacing: "var(--tracking-wide)",
                    }}
                  >
                    <svg
                      aria-hidden
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8.5 12.2l2.5 2.5 4.5-5" />
                    </svg>
                    TAREFA
                  </span>
                )}

                {/* ⚠️ Sem as despesas aqui.

                    Elas saiam como etiquetas na frente do nome do serviço, e
                    numa coluna estreita empurravam o nome — que e o dado da
                    linha — para o fim, atras de dois ou tres balões. Elas ja
                    entram no total, e o detalhe delas e a aba do drawer. */}
              </div>

              {item.servicoNome && item.descricao && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {item.descricao}
                </div>
              )}
            </Td>

            {/* ⚠️ Ao CENTRO na vertical, como as outras. Alinhada ao topo, a
                data ficava na altura da primeira linha da célula de valor e
                parecia legenda dela, e não o dado da sua própria coluna. */}
            <Td style={CELULA}>
              {item.data ? (
                paraFormatoBR(item.data as DataISO)
              ) : (
                <span style={{ color: "var(--text-disabled)" }}>—</span>
              )}
            </Td>

            <Td style={{ ...tdNum, ...CELULA }}>
              <Valor item={item} />
            </Td>

            {/*
              ⚠️ MENU de "…", e não dois ícones soltos — o mesmo padrão da lista
              de tickets da conta a receber e da de lançamentos da conta a pagar.

              Ícones soltos multiplicam alvos numa coluna estreita e, quando uma
              ação está barrada, ou some (e a coluna dança de linha para linha)
              ou fica cinza sem dizer por quê. No menu cada item tem espaço para
              o rótulo, e o que não pode aparece desabilitado com o motivo.
            */}
            <Td style={CELULA}>
              <AcoesDaLinha>
                <MenuDeLinha>
                  {(fechar) => (
                    <>
                      <ItemDoMenu
                        rotulo={editando ? "Editar serviço" : "Ver serviço"}
                        icone={<Icon name="ticket" size={14} />}
                        onClick={() => {
                          fechar();
                          aoEditar(item);
                        }}
                      />

                      <ItemDoMenu
                        rotulo="Remover serviço"
                        perigo
                        desabilitado={!podeRemover}
                        motivo={
                          !editando
                            ? "Ticket encerrado: valor e serviços já viraram cobrança recebida"
                            : faturado > 0
                              ? "Este ticket já virou conta a receber; os serviços dele não saem mais"
                              : undefined
                        }
                        icone={
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 4h11" />
                            <path d="M5.5 4V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V4" />
                            <path d="M12.3 4l-.7 9a.8.8 0 0 1-.8.8H5.2a.8.8 0 0 1-.8-.8L3.7 4" />
                            <path d="M6.5 6.8v4.4M9.5 6.8v4.4" />
                          </svg>
                        }
                        onClick={() => {
                          fechar();
                          aoRemover(item.id);
                        }}
                      />
                    </>
                  )}
                </MenuDeLinha>
              </AcoesDaLinha>
            </Td>
          </Tr>
          ))}
      </tbody>
    </TableArea>
  );
}

/** Recuo vertical da célula. O lateral é do CSS — ver o comentário no `Tr`. */
const CELULA: React.CSSProperties = { paddingTop: 9, paddingBottom: 9 };

/**
 * O valor da linha: a conta em cima, o que vale embaixo.
 *
 * `1 un × 1.000,00` apagado, e `1.000,00` em negrito. O total é o número que se
 * procura; a composição fica ali para quem quiser conferir, sem gastar duas
 * colunas.
 *
 * ⚠️ Quando há desconto ou acréscimo, a primeira linha mostra o BRUTO — que é
 * exatamente `quantidade × unitário` — e uma etiqueta diz o abatimento. Sem ela,
 * a diferença entre as duas linhas apareceria sem causa, e o leitor procuraria
 * um erro que não existe.
 */
function Valor({ item }: { item: Item }) {
  const bruto = Math.round(item.quantidade * item.valorUnitario);
  const liquido = totalDoItem(item);
  const ajuste = liquido - bruto;

  return (
    /* ⚠️ `alignItems: flex-end`. A célula é alinhada à direita, mas a caixa
       flex de dentro alinhava os próprios filhos à esquerda: as duas linhas
       ficavam justificadas pela borda esquerda do bloco, e os totais da coluna
       não se alinhavam entre si. */
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
      }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
        {quantidadeComUnidade(item)} × {formatarSemSimbolo(item.valorUnitario as Centavos)}
      </span>

      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        {ajuste !== 0 && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              /* Crédito para o que abate, débito para o que soma: as mesmas
                 cores do extrato, onde essa leitura já está aprendida. */
              color: ajuste < 0 ? "var(--credito)" : "var(--debito)",
            }}
          >
            {ajuste < 0 ? "−" : "+"}
            {formatarSemSimbolo(Math.abs(ajuste) as Centavos)}
          </span>
        )}
        <span style={{ fontWeight: "var(--fw-semibold)", color: "var(--text-primary)" }}>
          {formatarSemSimbolo(liquido as Centavos)}
        </span>
      </span>
    </div>
  );
}

/** "3 un" ou "2h30" — o decimal é o formato de quem calcula, não de quem lê. */
function quantidadeComUnidade(item: Item): string {
  if (item.unidade === "H") {
    const min = Math.round(item.quantidade * 60);
    const m = min % 60;
    return m === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${String(m).padStart(2, "0")}`;
  }
  return Number.isInteger(item.quantidade)
    ? `${item.quantidade} un`
    : `${item.quantidade.toFixed(2).replace(".", ",")} un`;
}


let proximoIdDespesa = -1;

/**
 * Um serviço do ticket, num drawer POR CIMA do dele.
 *
 * ⚠️ Substituiu o card que aparecia dentro da lista. Editando, a tabela se
 * desmontava para virar formulário: as colunas sumiam justamente quando se
 * precisa comparar um serviço com o outro. Aqui a tabela fica de pé atrás, e ao
 * fechar a linha alterada já está no lugar.
 *
 * ⚠️ Ele edita uma CÓPIA e só devolve no salvar. Escrevendo direto no item da
 * lista, cada tecla digitada já teria mudado a tabela atrás — e "Cancelar" não
 * teria o que desfazer.
 *
 * ⚠️ FATURADO congela a composição: seletor de serviço, quantidade, valores e
 * despesas travam, e só a descrição segue livre. Sem isso dava para trocar o
 * serviço de um ticket já cobrado por outro, de outro centro de custo, mantendo
 * o mesmo total — a conta continuava fechando e o rateio contábil passava a
 * apontar para uma categoria que nunca foi cobrada, com a operação do outro
 * lado possivelmente já encerrada. A mesma regra vive em `atualizarTicket`.
 */
function ServicoDrawer({
  item,
  servicos,
  faturado,
  somenteLeitura,
  onClose,
  aoSalvar,
}: {
  item: Item;
  servicos: OpcaoServico[];
  faturado: number;
  somenteLeitura: boolean;
  onClose: () => void;
  aoSalvar: (item: Item) => void;
}) {
  const [rascunho, setRascunho] = useState<Item>(item);

  function mudar(campos: Partial<Item>) {
    setRascunho((r) => ({ ...r, ...campos }));
  }

  function mudarDespesa(id: number, campos: Partial<{ descricao: string; valor: number }>) {
    mudar({
      despesas: rascunho.despesas.map((d) => (d.id === id ? { ...d, ...campos } : d)),
    });
  }

  const novo = rascunho.id < 0;
  /** Quem manda no dinheiro. A descrição fica de fora, sempre. */
  const podeMexerNoValor = !somenteLeitura && faturado === 0;

  /*
   * ⚠️ UMA aba, e o serviço NAO e uma delas.
   *
   * Os campos do serviço sao o conteudo do drawer, nao uma escolha: por-los numa
   * aba obrigaria a escolher entre olhar o que se esta editando e olhar as
   * despesas dele. A aba unica e o ROTULO da tabela, no mesmo desenho das outras
   * listas do sistema — e por isso ela vem depois dos campos, onde a tabela
   * comeca.
   */
  const ABA_DESPESAS = `Despesas (${rascunho.despesas.length})`;

  return (
    <Drawer
      open
      nivel={2}
      onClose={onClose}
      title={novo ? "Novo serviço" : "Serviço"}
      acoes={
        somenteLeitura ? undefined : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              size="xs"
              variant="primary"
              onClick={() => aoSalvar({ ...rascunho, total: totalDoItem(rascunho) })}
              disabled={rascunho.quantidade <= 0}
            >
              {novo ? "Adicionar" : "Salvar"}
            </Button>
            <Button size="xs" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        )
      }
    >
      {/*
        ⚠️ O aviso mora AQUI, e não em cima da lista de serviços.

        Lá ele era uma faixa amarela permanente sobre o rótulo da tabela,
        avisando de uma trava que só importa na hora de mexer num serviço. Aqui
        ele aparece exatamente onde o gesto seria feito, e explica por que os
        campos estão cinza.
      */}
      {faturado > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 11px",
            borderRadius: "var(--radius-md)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            color: "var(--warning-text)",
            fontSize: "var(--text-sm)",
          }}
        >
          {formatarSemSimbolo(faturado as Centavos)} deste ticket já virou conta a receber.
          Serviço, valores e despesas não mudam mais; só a descrição.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Field label="Serviço" required={!faturado}>
            {podeMexerNoValor ? (
              <select
                value={rascunho.servicoId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const s = servicos.find((x) => x.id === id);
                  // Nao mexe na `descricao`: ela e complemento livre, e
                  // sobrescrever apagaria o que o usuario escreveu ao trocar.
                  mudar({
                    servicoId: id,
                    servicoNome: s ? s.descricao : null,
                    valorUnitario: s ? s.valor : rascunho.valorUnitario,
                  });
                }}
                style={selectStyle}
              >
                <option value="">Serviço avulso</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.descricao}
                  </option>
                ))}
              </select>
            ) : (
              <CampoBloqueado
                valor={rascunho.servicoNome ?? "Serviço avulso"}
                titulo="Já faturado — o serviço não pode ser trocado"
              />
            )}
          </Field>

          <Field label="Data">
            <input
              type="date"
              value={rascunho.data ?? ""}
              onChange={(e) => mudar({ data: e.target.value || null })}
              disabled={!podeMexerNoValor}
              style={inputStyle}
            />
          </Field>

          <Field label="Quantidade">
            {podeMexerNoValor ? (
              <CampoQuantidade
                valor={rascunho.quantidade}
                unidade={rascunho.unidade}
                aoMudar={(v, u) => mudar({ quantidade: v, unidade: u })}
              />
            ) : (
              <CampoBloqueado valor={quantidadeComUnidade(rascunho)} />
            )}
          </Field>

          <Field label="Valor unitário">
            {podeMexerNoValor ? (
              <CampoValor
                valor={rascunho.valorUnitario}
                aoMudar={(v) => mudar({ valorUnitario: v })}
              />
            ) : (
              <CampoBloqueado
                valor={formatarSemSimbolo(rascunho.valorUnitario as Centavos)}
              />
            )}
          </Field>

          <Field label="Desconto">
            {podeMexerNoValor ? (
              <CampoValor valor={rascunho.desconto} aoMudar={(v) => mudar({ desconto: v })} />
            ) : (
              <CampoBloqueado valor={formatarSemSimbolo(rascunho.desconto as Centavos)} />
            )}
          </Field>

          <Field label="Acréscimo">
            {podeMexerNoValor ? (
              <CampoValor valor={rascunho.acrescimo} aoMudar={(v) => mudar({ acrescimo: v })} />
            ) : (
              <CampoBloqueado valor={formatarSemSimbolo(rascunho.acrescimo as Centavos)} />
            )}
          </Field>

          {/*
            ⚠️ O total é um CAMPO, logo abaixo de acréscimo — e não um rodapé.

            Ele é o resultado da conta que os campos acima fazem, e lido na mesma
            coluna deles a conta se fecha na vertical: quantidade, unitário,
            desconto, acréscimo, total. No rodapé ele ficava longe das parcelas
            que o formam, e as despesas da outra aba entravam nele sem aviso.

            Calculado, nunca digitado: um campo editável aqui abriria a chance de
            os de cima não fecharem com ele.
          */}
          <Field
            label="Total"
            hint={
              rascunho.despesas.length > 0
                ? `Inclui ${formatarSemSimbolo(
                    rascunho.despesas.reduce((t, d) => t + d.valor, 0) as Centavos,
                  )} de despesas`
                : undefined
            }
          >
            <CampoBloqueado
              valor={formatarSemSimbolo(totalDoItem(rascunho) as Centavos)}
              titulo="Calculado: quantidade × unitário, menos desconto, mais acréscimo e despesas"
            />
          </Field>

          {/*
            ⚠️ `textarea`, e não `input` de uma linha.

            É o único campo que continua livre depois de faturado, e é onde se
            escreve o que a nota vai discriminar. Numa linha só, texto de duas
            frases rolava para o lado e não dava para reler o que se escreveu.
          */}
          <Field label="Descrição">
            <textarea
              value={rascunho.descricao}
              onChange={(e) => mudar({ descricao: e.target.value })}
              placeholder={
                rascunho.servicoId == null ? "Nome do serviço" : "Complemento (opcional)"
              }
              maxLength={255}
              rows={3}
              disabled={somenteLeitura}
              style={{
                ...inputStyle,
                width: "100%",
                height: "auto",
                padding: 8,
                resize: "vertical",
                lineHeight: 1.45,
              }}
            />
          </Field>
      </div>

      {/* A aba única é o RÓTULO da tabela — mesmo desenho das outras listas do
          sistema —, e vem depois dos campos porque é ali que a tabela começa. */}
      <div style={{ marginTop: 18 }}>
        <PanelTabs tabs={[ABA_DESPESAS]} active={ABA_DESPESAS} onChange={() => {}} />
      </div>

      <div>
          {/*
            ⚠️ O título COMPLEMENTA o nome da aba, não o repete. A aba já se
            chama "Despesas"; um título igual seria a mesma palavra duas vezes,
            uma embaixo da outra.

            Elas viram TABELA pela mesma razão que os serviços viraram: eram três
            campos soltos por linha, sem cabeçalho, e nada dizia qual era o nome
            e qual era o valor até se clicar dentro.
          */}
          <GrupoDeCampos
            primeiro
            titulo="Gastos lançados junto"
            legenda="Abastecimento, pedágio, material. Entram no total do serviço."
            onIncluir={
              podeMexerNoValor
                ? () =>
                    mudar({
                      despesas: [
                        ...rascunho.despesas,
                        { id: proximoIdDespesa--, descricao: "", valor: 0 },
                      ],
                    })
                : undefined
            }
            rotuloIncluir="Adicionar despesa"
          >
            {/* Sem linha de totais: o total do serviço fica na aba ao lado, e
                repetir a soma aqui daria dois lugares dizendo o mesmo. */}
            <TableArea minWidth={0}>
              <TableHead>
                <Th>Descrição</Th>
                <Th align="right" minWidth={120}>
                  Valor
                </Th>
                <Th> </Th>
              </TableHead>

              <tbody>
                {rascunho.despesas.length === 0 && (
                  <EmptyRow colSpan={3} message="Nenhuma despesa neste serviço." />
                )}

                {rascunho.despesas.map((d) => (
                  <Tr key={d.id}>
                    <Td style={CELULA}>
                      {podeMexerNoValor ? (
                        <input
                          value={d.descricao}
                          onChange={(e) => mudarDespesa(d.id, { descricao: e.target.value })}
                          placeholder="Abastecimento, pedágio…"
                          maxLength={120}
                          style={{ ...inputDeCelula, width: "100%" }}
                        />
                      ) : (
                        (d.descricao || "Despesa")
                      )}
                    </Td>

                    <Td style={{ ...tdNum, ...CELULA }}>
                      {podeMexerNoValor ? (
                        <CampoValor
                          emCelula
                          valor={d.valor}
                          aoMudar={(v) => mudarDespesa(d.id, { valor: v })}
                        />
                      ) : (
                        formatarSemSimbolo(d.valor as Centavos)
                      )}
                    </Td>

                    <Td style={CELULA}>
                      {podeMexerNoValor && (
                        <AcoesDaLinha>
                          <BotaoDeAcao
                            rotulo="Remover despesa"
                            perigo
                            onClick={() =>
                              mudar({
                                despesas: rascunho.despesas.filter((x) => x.id !== d.id),
                              })
                            }
                          >
                            <path d="M2.5 4h11" />
                            <path d="M5.5 4V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V4" />
                            <path d="M12.3 4l-.7 9a.8.8 0 0 1-.8.8H5.2a.8.8 0 0 1-.8-.8L3.7 4" />
                            <path d="M6.5 6.8v4.4M9.5 6.8v4.4" />
                          </BotaoDeAcao>
                        </AcoesDaLinha>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableArea>
          </GrupoDeCampos>
      </div>
    </Drawer>
  );
}

/** Dinheiro em reais na tela, centavos inteiros no estado. */
function CampoValor({
  valor,
  aoMudar,
  emCelula,
}: {
  valor: number;
  aoMudar: (v: number) => void;
  /**
   * Dentro de tabela: pontilhado embaixo e sem moldura, igual ao campo de texto
   * ao lado.
   *
   * ⚠️ Com a moldura padrao ele virava uma caixa fechada ao lado de um campo que
   * so tem sublinhado — dois desenhos de campo na mesma linha, e o de valor
   * parecendo o unico editavel.
   */
  emCelula?: boolean;
}) {
  return (
    <CampoNumerico
      valor={valor}
      aoMudar={aoMudar}
      escala={100}
      casas={2}
      alinhar={emCelula ? "right" : "left"}
      style={emCelula ? inputDeCelula : undefined}
    />
  );
}




// ── Peças de tabela ─────────────────────────────────────────────────────────






