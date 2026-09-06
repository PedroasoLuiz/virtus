"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, GrupoDeCampos, PanelTabs } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { SEM_COBRANCA, type ParametrosDeCobranca } from "@/shared/domain/cobranca";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { ehDataISO, hoje, type DataISO } from "@/shared/utils/datas";
import type { TipoDeRecebimento } from "@/modules/faturas/faturas.types";
import { previsaoDeCredito, temTaxaDeCostume } from "@/shared/domain/recebimento";
import type { ParcelaEmAberto } from "@/modules/recebimentos/recebimentos.types";
import { AbaDeInformacoes } from "./baixa-aba-informacoes";
import { AbaDePagamentos } from "./baixa-aba-pagamentos";
import { preencher, valorDaLinha, VAZIO, type Valores } from "./baixa-linhas";

/**
 * Registrar um dinheiro que entrou e dizer para onde ele foi.
 *
 * Comeca no CLIENTE e nao na conta, porque e assim que o dinheiro chega: o
 * cliente paga o que combinou, e um PIX de 5.000 pode fechar parcelas de tres
 * contas diferentes. Lancado conta a conta, o mesmo PIX viraria tres linhas no
 * extrato que o banco nunca reconhece — e a conciliacao empaca exatamente onde
 * deveria ser trivial.
 *
 * Juros e multa vao por PARCELA e nao no cabecalho: o atraso e de uma parcela
 * especifica, e um acrescimo no total nao saberia de qual.
 *
 * ⚠️ Este arquivo e A CASCA: estado do lancamento, as duas buscas e o salvar.
 * O formulario mora em `baixa-aba-informacoes`, a tabela em
 * `baixa-aba-pagamentos` e a conta de cada linha em `baixa-linhas`. Junto, isto
 * era um arquivo de mil linhas em que achar a regra do juros custava rolagem.
 */

/**
 * As duas metades do gesto.
 *
 * ⚠️ Aba, e nao uma tela so rolando. O drawer tinha quinze campos e uma tabela
 * de oito colunas num scroll unico, e distribuir o dinheiro exigia rolar por
 * cima de tudo o que ja fora respondido. Sao dois assuntos: o dinheiro que
 * chegou, que se responde uma vez, e a divida que ele abate, que se mexe ate
 * fechar.
 */
const ABA_INFORMACOES = "Informações";
const ABA_PAGAMENTOS = "Pagamentos";

/**
 * A data ja da para calcular em cima dela?
 *
 * ⚠️ `ehDataISO` sozinho nao basta: "0002-04-22" e uma data valida no calendario
 * e chega do `input type=date` a cada tecla digitada. O piso de 1900 e o que
 * separa uma data em construcao de uma data de verdade.
 */
function dataUtilizavel(v: string): v is DataISO {
  return ehDataISO(v) && v >= "1900-01-01";
}

export function NovoRecebimentoDrawer({
  clientes,
  clienteInicial,
  parcelaInicial,
  aoCriar,
  onClose,
}: {
  /**
   * Quem ja veio decidido de fora, com o nome.
   *
   * ⚠️ Nao e mais a lista inteira: o seletor busca no servidor. Isto existe so
   * para o caso em que o drawer abre de dentro de uma conta, onde o pagador ja
   * esta escolhido e a tela precisa saber como chama-lo.
   */
  clientes?: { id: number; nome: string }[];
  /** Já vem escolhido quando o drawer abre a partir de uma conta. */
  clienteInicial?: number;
  /**
   * Parcela que dispara o gesto, quando ele começa na linha dela.
   *
   * Chega preenchida com tudo o que falta. As outras parcelas do cliente
   * continuam na tela: quem clicou numa pode ter recebido um valor que cobre
   * duas, e esconder as demais obrigaria a fechar e recomeçar.
   */
  parcelaInicial?: number;
  aoCriar: () => void;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();

  /**
   * Os clientes que casam com o que foi digitado.
   *
   * ⚠️ So os ATIVOS e so quem e cliente: fornecedor e cadastro aposentado nao
   * recebem dinheiro, e ocupariam a lista curta que a busca devolve.
   */
  const buscarClientes = useCallback(async (termo: string) => {
    const p = new URLSearchParams({ perPage: "15", papel: "cliente", ativo: "true" });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();

    return ((corpo.data ?? []) as { id: number; razao: string; nomeFantasia: string | null }[]).map(
      (c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }),
    );
  }, []);

  const [aba, setAba] = useState(ABA_INFORMACOES);
  const [clienteId, setClienteId] = useState(clienteInicial ? String(clienteInicial) : "");
  const [data, setData] = useState<string>(hoje());
  const [tipo, setTipo] = useState<string>("PIX");
  const [contaId, setContaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [nomeDoCliente, setNomeDoCliente] = useState<string | null>(
    () => clientes?.find((c) => c.id === clienteInicial)?.nome ?? null,
  );
  const [taxa, setTaxa] = useState(0);
  const [dataCredito, setDataCredito] = useState(() => previsaoDeCredito("PIX", hoje()));
  /*
   * A previsao para de seguir a forma depois que alguem a corrige.
   *
   * ⚠️ Sem isto, quem ajusta o credito para o dia certo do contrato ve a data
   * voltar sozinha ao trocar qualquer outro campo, e nao entende por que.
   */
  const [creditoNaMao, setCreditoNaMao] = useState(false);

  const [contas, setContas] = useState<{ id: number; nome: string }[]>([]);
  const [valores, setValores] = useState<Valores>({});
  const [salvando, setSalvando] = useState(false);
  /** Ver `registrar()`: e a chave de idempotencia do envio em curso. */
  const chaveDoEnvio = useRef<string | null>(null);

  /*
   * A carga guarda DE QUEM sao as parcelas, e nao so quais sao.
   *
   * Com o cliente de fora, "carregando" vira uma derivacao — o que esta na mao e
   * de outro cliente — em vez de um terceiro estado que precisa ser ligado e
   * desligado em sincronia com o fetch. Um estado a menos para sair de passo.
   */
  const [carga, setCarga] = useState<{
    de: string;
    parcelas: ParcelaEmAberto[];
    cobranca: ParametrosDeCobranca;
  }>({ de: "", parcelas: [], cobranca: SEM_COBRANCA });

  const parcelas = carga.de === clienteId ? carga.parcelas : SEM_PARCELAS;
  const carregando = clienteId !== "" && carga.de !== clienteId;

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/contas-bancarias", { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (r.ok) setContas(corpo.data);
      })
      .catch(() => {
        // Silencioso: sem conta na lista o botao ja fica travado, e o campo
        // obrigatorio explica sozinho o que falta.
      });

    return () => controle.abort();
  }, []);

  useEffect(() => {
    if (!clienteId) return;

    const controle = new AbortController();

    fetch(`/api/v1/recebimentos/parcelas-abertas?clienteId=${clienteId}`, {
      signal: controle.signal,
    })
      .then(async (r) => {
        const corpo = await r.json();
        const lista: ParcelaEmAberto[] = r.ok ? corpo.data.parcelas : [];
        const cobranca: ParametrosDeCobranca = r.ok ? corpo.data.cobranca : SEM_COBRANCA;
        setCarga({ de: clienteId, parcelas: lista, cobranca });

        // O preenchimento acontece aqui e nao num efeito porque depende do que
        // a rede trouxe: so agora se sabe quanto aquela parcela ainda deve, e
        // qual e a politica de atraso deste cliente.
        // `hoje()` e nao o campo `data`: este preenchimento so acontece na
        // abertura, quando os dois valem o mesmo. Depender do campo faria a
        // busca refazer a cada mudanca de data e apagar o que ja foi digitado.
        const alvo = parcelaInicial ? lista.find((p) => p.parcelaId === parcelaInicial) : null;
        if (alvo) setValores({ [alvo.parcelaId]: preencher(alvo, cobranca, hoje()) });
      })
      .catch((e: unknown) => {
        // Aborto e troca de cliente, nao falha: marcar carga aqui sobrescreveria
        // a busca nova que ja esta a caminho.
        if (e instanceof Error && e.name === "AbortError") return;
        setCarga({ de: clienteId, parcelas: [], cobranca: SEM_COBRANCA });
      });

    return () => controle.abort();
  }, [clienteId, parcelaInicial]);

  const destinos = parcelas
    .map((p) => ({ p, v: valores[p.parcelaId] ?? VAZIO }))
    .filter(({ v }) => v.incluida)
    .map(({ p, v }) => ({
      parcelaId: p.parcelaId,
      valor: valorDaLinha(v, p.emAberto),
      juros: v.juros,
      multa: v.multa,
      /*
       * ⚠️ `quitar` e DEDUZIDO, e nao mais uma caixa que alguem marca.
       *
       * Ele diz ao servidor "feche a parcela mesmo recebendo menos", e isso e
       * exatamente o que acontece quando ha desconto: o que se perdoa e a
       * diferenca. Sem desconto e com valor menor, a parcela continua devendo o
       * resto, que e o pagamento parcial.
       */
      quitar: v.desconto > 0,
    }))
    .filter((d) => d.valor > 0);

  const abatido = destinos.reduce((s, d) => s + d.valor, 0) as Centavos;
  const acrescimo = destinos.reduce((s, d) => s + d.juros + d.multa, 0) as Centavos;
  const total = (abatido + acrescimo) as Centavos;

  const rotuloDePagamentos = destinos.length
    ? `${ABA_PAGAMENTOS} (${destinos.length})`
    : ABA_PAGAMENTOS;

  async function registrar() {
    setSalvando(true);

    /*
     * ⚠️ A chave SOBREVIVE a falha de rede, e so ai.
     *
     * Ela nasce no primeiro clique e vale ate o servidor responder alguma coisa.
     * Se a resposta se perde no caminho e a pessoa clica de novo, o mesmo valor
     * volta e o servidor reconhece o reenvio em vez de gravar uma segunda baixa
     * sobre as mesmas parcelas — que e o caso que a trava do botao nao cobre.
     *
     * Respondeu, a chave e descartada: uma recusa de regra vai ser corrigida e
     * reenviada com outros valores, e reaproveitar a chave ali daria conflito de
     * corpo diferente.
     */
    chaveDoEnvio.current ??= crypto.randomUUID();

    let r: Response;
    try {
      r = await fetch("/api/v1/recebimentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": chaveDoEnvio.current,
        },
        body: JSON.stringify({
        clienteId: Number(clienteId),
        data,
        tipo,
        contaBancariaId: Number(contaId),
        dataCredito,
        taxa,
          observacoes: observacoes.trim() || null,
          destinos,
        }),
      });
    } catch {
      // A rede caiu antes de qualquer resposta. A chave FICA: o pedido pode ter
      // chegado, e reenviar com ela e o que impede a baixa em dobro.
      setSalvando(false);
      avisar(
        "atencao",
        "Não foi possível falar com o servidor",
        "Tente de novo: se o recebimento já tiver sido gravado, ele não será duplicado.",
      );
      return;
    }

    // Houve resposta: esta intencao terminou, para o bem ou para o mal.
    chaveDoEnvio.current = null;

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível registrar o recebimento",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    const contasTocadas = new Set(
      destinos.map((d) => parcelas.find((p) => p.parcelaId === d.parcelaId)!.faturaId),
    );
    avisar(
      "sucesso",
      "Recebimento registrado",
      `${formatarSemSimbolo(total)} em ${destinos.length} parcela(s) de ${contasTocadas.size} conta(s).`,
    );
    aoCriar();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Baixa"
      /*
        ⚠️ SEM `subtitle`. Nada mora embaixo do titulo de um drawer neste
        sistema: o cabecalho e o titulo e a acao, e um paragrafo ali empurra o
        conteudo para baixo em toda tela. O que a descricao explicava — um
        pagador so, varias contas — ja esta na dica do campo Cliente, que e onde
        a duvida aparece.
      */
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={salvando || destinos.length === 0 || !contaId || !clienteId}
          title={
            !clienteId
              ? "Escolha de quem veio o dinheiro"
              : !contaId
                ? "Escolha a conta em que o dinheiro entrou"
                : destinos.length === 0
                  ? "Informe quanto foi para cada parcela"
                  : undefined
          }
          onClick={registrar}
        >
          {salvando ? "Registrando…" : "Registrar"}
        </Button>
      }
    >
      {/*
        ⚠️ O titulo e a descricao ficam ACIMA das abas, e valem para as duas.

        Eles sao o assunto do drawer inteiro, e nao de metade dele: descendo para
        dentro de uma aba, o texto que explica que um pagamento tem um pagador so
        e quita varias contas sumiria justamente na aba em que as varias contas
        aparecem. E a mesma anatomia da aba de contatos do cadastro de pessoa,
        onde o `PanelTabs` tambem mora dentro do grupo.
      */}
      <GrupoDeCampos
        primeiro
        titulo="O dinheiro que entrou"
        legenda="Um pagamento é de um pagador só, e pode quitar parcelas de contas diferentes. É assim que o extrato do banco vê: uma linha só."
      >
        {/*
          ⚠️ O rotulo da aba de pagamentos carrega QUANTAS parcelas ja entraram.

          Sem ele, quem esta em Informacoes conferindo o valor nao tem como saber
          se a distribuicao ficou de pe: o total pode fechar com o extrato e
          mesmo assim faltar a parcela que se queria baixar. O numero e a unica
          coisa da outra aba que precisa ser vista desta.
        */}
        <PanelTabs
          tabs={[ABA_INFORMACOES, rotuloDePagamentos]}
          active={aba === ABA_INFORMACOES ? ABA_INFORMACOES : rotuloDePagamentos}
          onChange={(t) => setAba(t === ABA_INFORMACOES ? ABA_INFORMACOES : ABA_PAGAMENTOS)}
        />

        {aba === ABA_INFORMACOES ? (
          <AbaDeInformacoes
            campos={{ clienteId, nomeDoCliente, data, tipo, contaId, dataCredito, taxa, observacoes }}
            totais={{ total, abatido, acrescimo }}
            contas={contas}
            clienteTravado={clienteInicial != null}
            buscarClientes={buscarClientes}
            aoEscolherCliente={(c) => {
              setClienteId(c ? String(c.id) : "");
              setNomeDoCliente(c?.nome ?? null);
              /* Trocar de cliente zera a distribuicao: as parcelas sao outras, e
                 um valor digitado para a parcela de outro cliente nao significa
                 nada aqui. */
              setValores({});
            }}
            aoMudarData={(v) => {
              setData(v);
              /*
                A previsão acompanha a data enquanto ninguém a corrigiu à mão:
                trocando o dia do pagamento, o crédito anda junto.

                ⚠️ Só com a data PRONTA. O `input type=date` dispara `change` a
                cada tecla, e no meio da digitação ele entrega "0002-04-22" — um
                ano que existe no calendário e não existe em conta a receber. O
                cast cego para `DataISO` mandava esse lixo para dentro da regra.
              */
              if (!creditoNaMao && dataUtilizavel(v)) {
                setDataCredito(previsaoDeCredito(tipo as TipoDeRecebimento, v));
              }
            }}
            aoMudarTipo={(v) => {
              setTipo(v);
              const novo = v as TipoDeRecebimento;
              if (!creditoNaMao && dataUtilizavel(data)) {
                setDataCredito(previsaoDeCredito(novo, data));
              }
              // Trocar para uma forma que nao costuma reter zera a taxa: ela
              // ficaria escondida e continuaria virando despesa em silencio.
              if (!temTaxaDeCostume(novo)) setTaxa(0);
            }}
            aoMudarConta={setContaId}
            aoMudarCredito={(v) => {
              setCreditoNaMao(true);
              setDataCredito(v);
            }}
            aoMudarTaxa={setTaxa}
            aoMudarObservacoes={setObservacoes}
          />
        ) : (
          <AbaDePagamentos
            parcelas={parcelas}
            cobranca={carga.cobranca}
            data={data}
            total={total}
            valores={valores}
            aoMudarValores={setValores}
            carregando={carregando}
            semCliente={!clienteId}
          />
        )}
      </GrupoDeCampos>
    </Drawer>
  );
}

/**
 * A lista vazia, como constante.
 *
 * ⚠️ Um `[]` escrito na expressao seria um array novo a cada render, e os
 * `useMemo` da aba de pagamentos dependem desta referencia: a fila e o filtro
 * recalculariam a cada tecla digitada em qualquer campo do drawer.
 */
const SEM_PARCELAS: ParcelaEmAberto[] = [];
