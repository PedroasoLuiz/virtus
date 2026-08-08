"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoBloqueado,
  CampoNumerico,
  Field,
  Formulario,
  GrupoDeCampos,
  inputDeCelula,
  inputStyle,
  MarcaDeUso,
  Pagination,
  selectStyle,
  SeletorBuscavel,
  TableArea,
  TableHead,
  Td,
  tdNum,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { filaDeRecebimento } from "@/shared/domain/parcelas";
import {
  acrescimoPorAtraso,
  SEM_COBRANCA,
  type ParametrosDeCobranca,
} from "@/shared/domain/cobranca";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { TIPOS_DE_RECEBIMENTO, type TipoDeRecebimento } from "@/modules/faturas/faturas.types";
import {
  creditaNoMesmoDia,
  previsaoDeCredito,
  temTaxaDeCostume,
} from "@/shared/domain/recebimento";
import type { ParcelaEmAberto } from "@/modules/recebimentos/recebimentos.types";

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
 */

type Valores = Record<number, EstadoDaLinha>;

/**
 * O que a tela guarda de cada parcela da baixa.
 *
 * ⚠️ `recebido` e o que se DIGITA quando o cliente pagou so uma parte. Vazio, o
 * valor sai da conta: o que estava em aberto menos o que foi perdoado. E o caso
 * comum — quem paga, paga a parcela — e digitar de novo um numero que ja esta na
 * linha ao lado seria trabalho de copia.
 */
const VAZIO: EstadoDaLinha = {
  incluida: false,
  juros: 0,
  multa: 0,
  desconto: 0,
  recebido: null,
};

type EstadoDaLinha = {
  /** Esta parcela entra nesta baixa. Sem isto, toda a lista entraria sozinha. */
  incluida: boolean;
  juros: number;
  multa: number;
  desconto: number;
  /** `null` = o valor e calculado. Numero = pagamento parcial digitado a mao. */
  recebido: number | null;
};

/** O que abate divida nesta linha: o digitado, ou o que sobra do desconto. */
function valorDaLinha(estado: EstadoDaLinha, emAberto: number): number {
  if (!estado.incluida) return 0;
  return estado.recebido ?? Math.max(0, emAberto - estado.desconto);
}

/**
 * Quantas parcelas cabem numa pagina da baixa.
 *
 * Dez porque a lista aqui e o meio, e nao o fim: quem baixa esta olhando o total
 * la embaixo, e uma tabela mais alta que a tela empurra o total para fora
 * justamente na hora de conferir.
 */
const POR_PAGINA_NA_BAIXA = 10;

/**
 * A linha preenchida: tudo o que falta, mais o acréscimo que a política sugere.
 *
 * O juros entra calculado e não zerado porque digitar é o passo em que se erra:
 * quem recebe uma parcela vencida há 40 dias sabe que há juros, mas raramente
 * refaz a conta. Continua editável — acordo com cliente nem sempre segue a
 * tabela, e a data do recebimento é o que define o atraso.
 */
function preencher(
  parcela: ParcelaEmAberto,
  cobranca: ParametrosDeCobranca,
  data: string,
): Valores[number] {
  const { juros, multa } = acrescimoPorAtraso(
    parcela.emAberto as Centavos,
    parcela.vencimento,
    data,
    cobranca,
  );

  /*
   * O acrescimo sugerido pela regra de cobranca; o valor fica calculado, e nao
   * digitado: ele e o que esta em aberto menos o que for perdoado.
   */
  return { incluida: true, juros, multa, desconto: 0, recebido: null };
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

  const [clienteId, setClienteId] = useState(clienteInicial ? String(clienteInicial) : "");
  const [data, setData] = useState<string>(hoje());
  const [tipo, setTipo] = useState<string>("PIX");
  const [contaId, setContaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [nomeDoCliente, setNomeDoCliente] = useState<string | null>(
    () => clientes?.find((c) => c.id === clienteInicial)?.nome ?? null,
  );
  const [taxa, setTaxa] = useState(0);
  const [paginaDeParcelas, setPaginaDeParcelas] = useState(1);
  /*
   * A parcela cujo valor esta sendo digitado a mao.
   *
   * ⚠️ Uma de cada vez, e por clique. Receber menos e o caso raro, e um campo
   * aberto em toda linha convidaria a digitar o numero que ja esta calculado ao
   * lado — com as duas versoes podendo discordar.
   */
  const [parcial, setParcial] = useState<number | null>(null);
  const [dataCredito, setDataCredito] = useState(() =>
    previsaoDeCredito("PIX", hoje()),
  );
  /*
   * A previsao para de seguir a forma depois que alguem a corrige.
   *
   * ⚠️ Sem isto, quem ajusta o credito para o dia certo do contrato ve a data
   * voltar sozinha ao trocar qualquer outro campo, e nao entende por que.
   */
  const [creditoNaMao, setCreditoNaMao] = useState(false);

  const tipoAtual = tipo as TipoDeRecebimento;

  const [contas, setContas] = useState<{ id: number; nome: string }[]>([]);
  const [valores, setValores] = useState<Valores>({});
  const [salvando, setSalvando] = useState(false);

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

  // Memorizado por causa do `[]` do caso vazio: um literal novo a cada render
  // invalidaria o `useMemo` da fila logo abaixo, que depende desta lista.
  const parcelas = useMemo(
    () => (carga.de === clienteId ? carga.parcelas : []),
    [carga, clienteId],
  );
  const carregando = clienteId !== "" && carga.de !== clienteId;

  const totalPaginas = Math.max(1, Math.ceil(parcelas.length / POR_PAGINA_NA_BAIXA));
  const paginaAtual = Math.min(paginaDeParcelas, totalPaginas);
  const visiveis = parcelas.slice(
    (paginaAtual - 1) * POR_PAGINA_NA_BAIXA,
    paginaAtual * POR_PAGINA_NA_BAIXA,
  );

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
        // Mudou a data? O botao "Em aberto" da linha recalcula com ela.
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

  /*
   * Quais parcelas aceitam valor AGORA.
   *
   * Recalculado a cada digito porque a fila anda dentro do proprio formulario:
   * cobrir a parcela 1 por inteiro libera a 2 na mesma tela, sem salvar e voltar.
   * A regra e a mesma que o servidor confere em `paradaNaFila` — aqui ela apenas
   * evita que o usuario descubra o bloqueio depois de preencher tudo.
   */
  const liberadas = useMemo(() => {
    const livres = new Set<number>();

    for (const faturaId of new Set(parcelas.map((p) => p.faturaId))) {
      const fila = filaDeRecebimento(
        parcelas
          .filter((p) => p.faturaId === faturaId)
          .map((p) => ({
            id: p.parcelaId,
            numero: p.numero,
            vencimento: p.vencimento,
            total: p.total,
            recebido: p.recebido,
            pago: false,
          })),
      );

      for (const p of fila) {
        livres.add(p.id);

        const preenchido = valores[p.id] ?? VAZIO;
        const emAberto = p.total - p.recebido;
        const sobra = emAberto - valorDaLinha(preenchido, emAberto) - preenchido.desconto;
        // Esta ainda nao fechou: as seguintes continuam travadas.
        if (sobra > 0) break;
      }
    }

    return livres;
  }, [parcelas, valores]);

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

  /**
   * Mexe num campo de uma linha.
   *
   * ⚠️ Mexer INCLUI a parcela. Digitar juros numa linha que ninguem marcou seria
   * um numero guardado que nao vai a lugar nenhum, e a pessoa so descobriria
   * conferindo o total no fim.
   */
  function mudar(parcelaId: number, campo: keyof EstadoDaLinha, valor: number | boolean | null) {
    setValores((atual) => ({
      ...atual,
      [parcelaId]: { ...(atual[parcelaId] ?? VAZIO), incluida: true, [campo]: valor },
    }));
  }

  async function registrar() {
    setSalvando(true);

    const r = await fetch("/api/v1/recebimentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    const contas = new Set(destinos.map((d) => parcelas.find((p) => p.parcelaId === d.parcelaId)!.faturaId));
    avisar(
      "sucesso",
      "Recebimento registrado",
      `${formatarSemSimbolo(total)} em ${destinos.length} parcela(s) de ${contas.size} conta(s).`,
    );
    aoCriar();
  }


  return (
    <Drawer
      open
      onClose={onClose}
      title="Baixa"
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
        ⚠️ O ritmo e a anatomia sao os do resto do sistema: `Formulario` e
        `GrupoDeCampos`, com o vao entre campos vindo do token. Havia um `gap: 3`
        escrito aqui, que acertava o vao dos campos por acaso e errava o resto.
      */}
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="O dinheiro que entrou"
          legenda="Um pagamento é de um pagador só, e pode quitar parcelas de contas diferentes. É assim que o extrato do banco vê: uma linha só."
        >
        {/*
          ⚠️ BUSCA, e nao lista pronta.

          Um `<select>` carrega tudo antes de mostrar qualquer coisa: numa base
          com vinte mil clientes ativos, sao vinte mil linhas no HTML da pagina
          para escolher uma, e a tela trava antes de aparecer. Aqui a pergunta vai
          ao servidor com o que ja foi digitado.
        */}
        <Field
          label="Cliente"
          required
          hint="De quem veio o dinheiro. Um pagamento é de um pagador só."
        >
          <SeletorBuscavel
            valor={clienteId ? Number(clienteId) : null}
            rotulo={nomeDoCliente}
            // Vindo de uma conta, o pagador ja esta decidido: trocar aqui abriria
            // parcelas de outro cliente na tela que existe para baixar ESTA.
            desabilitado={clienteInicial != null}
            buscar={buscarClientes}
            aoEscolher={(c) => {
              setClienteId(c ? String(c.id) : "");
              setNomeDoCliente(c?.nome ?? null);
              /* Trocar de cliente zera a distribuicao: as parcelas sao outras, e
                 um valor digitado para a parcela de outro cliente nao significa
                 nada aqui. */
              setValores({});
            }}
          />
        </Field>

        <Field
          label="Cliente pagou em"
          required
          hint="O dia em que o cliente pagou. É ele que fecha a parcela, mesmo que o dinheiro só caia depois."
        >
          <input
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              // A previsao acompanha a data enquanto ninguem a corrigiu a mao:
              // trocando o dia do pagamento, o credito anda junto.
              if (!creditoNaMao) setDataCredito(previsaoDeCredito(tipoAtual, e.target.value as DataISO));
            }}
            style={inputStyle}
          />
        </Field>

        <Field
          label="Forma"
          required
          hint="Lista fechada de propósito: no legado o mesmo PIX aparece com quatro grafias diferentes, e nenhum relatório consegue agrupar."
        >
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              const novo = e.target.value as TipoDeRecebimento;
              if (!creditoNaMao) setDataCredito(previsaoDeCredito(novo, data as DataISO));
              // Trocar para uma forma que nao costuma reter zera a taxa: ela
              // ficaria escondida e continuaria virando despesa em silencio.
              if (!temTaxaDeCostume(novo)) setTaxa(0);
            }}
            style={selectStyle}
          >
            {TIPOS_DE_RECEBIMENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Conta" required hint="Onde o dinheiro caiu. É o que liga o recebimento ao extrato.">
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} style={selectStyle}>
            <option value="">Escolher…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>

        {/*
          ⚠️ Duas datas, e nao uma.

          O cliente passa o cartao no dia 20 e a parcela fecha ali: ele pagou, nao
          deve mais. O dinheiro so aparece no extrato trinta dias depois, e ate la
          nao esta na conta. Com uma data so, ou a cobranca fica aberta um mes
          depois de paga, ou o caixa promete dinheiro que ainda nao existe.

          A previsao vem preenchida pelo prazo da forma escolhida, e vira "na mao"
          no primeiro toque: cada contrato com a adquirente tem o seu prazo, e
          antecipacao muda tudo.
        */}
        <Field
          label="Dinheiro cai em"
          required
          hint={
            creditaNoMesmoDia(tipoAtual)
              ? "Nesta forma o dinheiro entra no mesmo dia."
              : "Cartão credita em D+30, boleto no dia útil seguinte. Corrija se o seu contrato for outro."
          }
        >
          <input
            type="date"
            value={dataCredito}
            min={data}
            onChange={(e) => {
              setCreditoNaMao(true);
              setDataCredito(e.target.value);
            }}
            style={inputStyle}
          />
        </Field>

        {/*
          ⚠️ A taxa aparece só onde ela é o normal, e não em todo recebimento.

          Perguntar taxa em cada PIX é pedir para preencher zero cinquenta vezes
          por semana. Onde ela existe — cartão, boleto —, ela é a regra e o campo
          já vem aberto.
        */}
        {temTaxaDeCostume(tipoAtual) && (
          <Field
            label="Taxa retida"
            hint="O que a adquirente ou o banco ficou. Não é desconto: o cliente pagou o valor cheio, e isto vira uma despesa própria no seu resultado."
          >
            <CampoNumerico valor={taxa} aoMudar={setTaxa} escala={100} />
          </Field>
        )}

        {/*
          ⚠️ Os tres numeros viraram CAMPO, e sairam do rodape.

          No rodape eram numeros soltos com rotulo miudo, e o que entra no banco —
          que e o unico que precisa bater com o extrato — ficava do tamanho de um
          detalhe. Como campo, cada um tem o rotulo a esquerda como todo dado da
          tela, da para copiar, e os tres ficam onde a leitura ja esta: logo
          acima do que se digita por ultimo.

          ⚠️ Dívida e acréscimo so aparecem quando ha acréscimo. Sem juros nem
          multa, "entrando" e "dívida" sao o mesmo numero, e repetir e fazer
          procurar a diferenca que nao existe.
        */}
        <Field
          label="Entrando na conta"
          hint="É este valor que vai aparecer no extrato do banco."
        >
          <CampoBloqueado valor={formatarSemSimbolo(total)} />
        </Field>

        {acrescimo > 0 && (
          <>
            <Field label="Abate de dívida">
              <CampoBloqueado valor={formatarSemSimbolo(abatido)} />
            </Field>

            <Field label="Juros e multa">
              <CampoBloqueado valor={formatarSemSimbolo(acrescimo)} />
            </Field>
          </>
        )}

        <Field label="Observações">
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex.: PIX único do mês, cliente pediu recibo por conta"
            maxLength={400}
            style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
          />
        </Field>
        </GrupoDeCampos>
      </Formulario>

      {!clienteId ? (
        <Aviso>Escolha o cliente para ver o que ele tem em aberto.</Aviso>
      ) : carregando ? (
        <Aviso>Carregando as parcelas…</Aviso>
      ) : parcelas.length === 0 ? (
        <Aviso>Este cliente não tem parcela em aberto.</Aviso>
      ) : (
        <>
          {/*
            O mesmo cabecalho de grupo do resto do sistema, no lugar de um rotulo
            e um paragrafo escritos a mao: o vao acima dele vinha de uma margem
            propria e nao batia com o dos outros blocos da tela.
          */}
          <GrupoDeCampos
            titulo="Para onde foi"
            legenda="Dentro de cada conta a ordem é a do vencimento: a parcela seguinte abre quando a anterior fecha. Clicar no que está em aberto preenche a linha inteira."
          >
            {/*
              ⚠️ TABELA, e nao um cartao por parcela.

              Sao seis numeros por linha — em aberto, recebido, juros, multa,
              desconto — e cartao empilhado punha cada um num lugar diferente da
              tela: conferir se a soma bate exigia ler quinze blocos em vez de
              varrer uma coluna. Aqui valor fica embaixo de valor.
            */}
            <TableArea minWidth={0}>
              <TableHead>
                {/*
                  ⚠️ A marca de INCLUIR abre a linha.

                  Sem ela, com o valor recebido saindo de uma conta, toda parcela
                  da lista entraria na baixa sozinha: abrir a tela de um cliente
                  com seis parcelas em aberto significaria receber as seis.
                */}
                <Th minWidth={54}>Baixar</Th>
                <Th minWidth={150}>Conta</Th>
                <Th minWidth={96}>Vence</Th>
                <Th minWidth={96}>Em aberto</Th>
                {/*
                  ⚠️ A unidade no rotulo, e nao so no campo.

                  Juros e multa se falam em porcentagem no dia a dia — "dois por
                  cento de multa" —, e um campo chamado so "Juros" convida a
                  digitar 2 querendo dizer 2%. Aqui o que entra e o dinheiro que
                  o cliente pagou a mais, e o rotulo diz isso antes do erro.
                */}
                <Th minWidth={86}>Juros (R$)</Th>
                <Th minWidth={86}>Multa (R$)</Th>
                <Th minWidth={96}>Desconto (R$)</Th>
                {/*
                  ⚠️ O TOTAL da linha, e nao o que abate a divida.

                  E o que o cliente pagou por esta parcela: o que abate, menos o
                  perdoado, mais juros e multa. E o numero que vai bater com o
                  extrato, e por isso ele se move a cada tecla nos tres campos ao
                  lado — mostrando so o abatimento, digitar juros nao mudava nada
                  na coluna e a pessoa procurava o dinheiro que tinha somado.

                  Nunca se digita: seria o mesmo numero pedido duas vezes, e as
                  duas podiam discordar.
                */}
                <Th align="right" minWidth={110}>
                  Total
                </Th>
              </TableHead>

              <tbody>
                {visiveis.map((p) => {
                  const estado = valores[p.parcelaId] ?? VAZIO;
                  const liberada = liberadas.has(p.parcelaId);
                  const atrasada = p.vencimento != null && p.vencimento < hoje();
                  const valor = valorDaLinha(estado, p.emAberto);
                  /*
                   * O que o cliente pagou por esta parcela: o que abate a divida
                   * mais o acrescimo. Juros e multa NAO abatem — entram por cima
                   * —, e e por isso que o total e maior que a divida quitada.
                   */
                  const totalDaLinha = estado.incluida ? valor + estado.juros + estado.multa : 0;
                  const sobra = estado.incluida
                    ? Math.max(0, p.emAberto - valor - estado.desconto)
                    : 0;

                  return (
                    <Tr
                      key={p.parcelaId}
                      /*
                        A parcela que ainda nao chegou na fila aparece apagada, e
                        nao escondida: some, e ninguem entende por que a conta tem
                        tres parcelas e a tela mostra uma.
                      */
                      dimmed={!liberada}
                      /*
                        ⚠️ Duas cores, duas coisas diferentes.

                        Vencida e vermelho claro: e o unico estado que pede acao
                        hoje, e a data sozinha em vermelho se perde no meio da
                        tabela. Travada e o cinza esverdiado das linhas que nao se
                        editam, o mesmo da parcela paga no parcelamento — ela
                        aparece para explicar a conta, e nao para ser mexida.

                        Travada ganha do vermelho: nao adianta chamar para uma
                        acao que a fila ainda nao liberou.
                      */
                      style={
                        !liberada
                          ? { background: "var(--surface-hover)" }
                          : atrasada
                            ? { background: "var(--danger-bg)" }
                            : undefined
                      }
                    >
                      <Td>
                        <MarcaDeUso
                          marcado={estado.incluida}
                          desabilitado={!liberada}
                          rotulo={
                            !liberada
                              ? "A parcela anterior desta conta ainda está em aberto"
                              : estado.incluida
                                ? "Tirar esta parcela da baixa"
                                : "Recebi esta parcela"
                          }
                          onClick={() =>
                            setValores((atual) => {
                              const antes = atual[p.parcelaId] ?? VAZIO;

                              return {
                                ...atual,
                                [p.parcelaId]: antes.incluida
                                  ? VAZIO
                                  : /*
                                      Marcar ja traz o acrescimo sugerido pela
                                      regra de cobranca: quem baixa uma parcela
                                      atrasada quase sempre cobra o juro, e
                                      calcula-lo de cabeca era o trabalho que a
                                      tela existe para poupar.
                                    */
                                    { ...preencher(p, carga.cobranca, data), incluida: true },
                              };
                            })
                          }
                        />
                      </Td>

                      <Td>
                        {p.faturaNumero}
                        <div
                          style={{
                            marginTop: 1,
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          parcela {p.numero}
                          {p.totalParcelas > 0 && ` de ${p.totalParcelas}`}
                        </div>
                      </Td>

                      <Td
                        style={
                          atrasada
                            ? { color: "var(--danger-text)", fontWeight: "var(--fw-medium)" }
                            : undefined
                        }
                      >
                        {p.vencimento ? paraFormatoBR(p.vencimento as DataISO) : "—"}
                      </Td>

                      {/*
                        ⚠️ Clicar aqui e dizer "destes X, recebi so uma parte".

                        E o caso raro — quase todo mundo paga a parcela —, e por
                        isso e um clique e nao um campo aberto. Ele mora nesta
                        coluna porque a pergunta e sobre a DIVIDA: quanto dela
                        entrou. O total do fim continua sendo conta, nunca
                        digitacao.
                      */}
                      <Td>
                        {parcial === p.parcelaId ? (
                          <CampoNumerico
                            valor={valor}
                            escala={100}
                            style={inputDeCelula}
                            aoMudar={(v) =>
                              mudar(
                                p.parcelaId,
                                "recebido",
                                Math.min(Math.max(0, v), p.emAberto - estado.desconto),
                              )
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!liberada}
                            title={
                              liberada
                                ? "Clique para receber só uma parte: o resto continua devendo"
                                : "A parcela anterior desta conta ainda está em aberto"
                            }
                            onClick={() => setParcial(p.parcelaId)}
                            style={{
                              border: "none",
                              background: "none",
                              padding: 0,
                              fontFamily: "var(--font)",
                              fontSize: "var(--text-sm)",
                              fontVariantNumeric: "tabular-nums",
                              color: "inherit",
                              textDecoration: liberada ? "underline dotted" : undefined,
                              textUnderlineOffset: 3,
                              cursor: liberada ? "pointer" : "default",
                            }}
                          >
                            {formatarSemSimbolo(p.emAberto as Centavos)}
                          </button>
                        )}

                        {p.recebido > 0 && (
                          <div
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            já entrou {formatarSemSimbolo(p.recebido as Centavos)}
                          </div>
                        )}
                      </Td>

                      {/*
                        ⚠️ Juros e multa NAO abatem a divida: entram no caixa por
                        cima do valor. Por isso ficam antes dele na leitura, e
                        nunca somados a ele.
                      */}
                      <Td>
                        <CampoNumerico
                          valor={estado.juros}
                          escala={100}
                          style={inputDeCelula}
                          aoMudar={(v) => mudar(p.parcelaId, "juros", v)}
                        />
                      </Td>

                      <Td>
                        <CampoNumerico
                          valor={estado.multa}
                          escala={100}
                          style={inputDeCelula}
                          aoMudar={(v) => mudar(p.parcelaId, "multa", v)}
                        />
                      </Td>

                      {/*
                        ⚠️ O desconto e a resposta a uma pergunta que o sistema
                        nao pode responder sozinho: recebi 500 de 510, os 10
                        continuam devidos ou eu abri mao? Digitando aqui, a pessoa
                        diz que abriu mao — e o valor ao lado se ajusta.
                      */}
                      <Td>
                        <CampoNumerico
                          valor={estado.desconto}
                          escala={100}
                          style={inputDeCelula}
                          aoMudar={(v) =>
                            mudar(p.parcelaId, "desconto", Math.min(Math.max(0, v), p.emAberto))
                          }
                        />
                      </Td>

                      <Td style={{ ...tdNum, fontWeight: "var(--fw-medium)" }}>
                        {formatarSemSimbolo(totalDaLinha as Centavos)}

                        {/* O que sobra depois desta baixa. So aparece quando
                            sobra: uma linha "ainda devendo 0,00" seria ruido. */}
                        {sobra > 0 && (
                          <div
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              fontWeight: 400,
                              color: "var(--danger-text)",
                            }}
                          >
                            ainda devendo {formatarSemSimbolo(sobra as Centavos)}
                          </div>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableArea>

            {/*
              ⚠️ Pagina, e a soma do rodape continua sendo do TODO.

              Um cliente com trinta parcelas em aberto nao cabe na tela, e rolar
              trinta linhas para achar a que se quer baixar e pior do que virar
              pagina. O que ja foi digitado nas outras paginas continua valendo:
              o estado e da baixa inteira, e nao da pagina.
            */}
            {parcelas.length > POR_PAGINA_NA_BAIXA && (
              <Pagination
                page={paginaAtual}
                totalPages={totalPaginas}
                total={parcelas.length}
                pageSize={POR_PAGINA_NA_BAIXA}
                onPage={setPaginaDeParcelas}
              />
            )}
          </GrupoDeCampos>
        </>
      )}
    </Drawer>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        color: "var(--text-tertiary)",
        fontSize: "var(--text-base)",
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

