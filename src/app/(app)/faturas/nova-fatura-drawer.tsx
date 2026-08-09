"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  ActiveToggle,
  Button,
  CampoBloqueado,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
  MarcaDeUso,
  Pagination,
  PanelTabs,
  SeletorBuscavel,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, periodoEmMeses, type DataISO } from "@/shared/utils/datas";

/**
 * Quantos tickets cabem numa pagina.
 *
 * Dez, o mesmo da tabela de parcelas da baixa: a lista aqui e o meio e nao o
 * fim, e uma tabela mais alta que a tela empurra o total e o parcelamento para
 * fora justamente na hora de conferir.
 */
const POR_PAGINA = 10;

/**
 * De onde o dinheiro da conta pode vir.
 *
 * ⚠️ Produto ainda nao existe, e a aba fica assim mesmo. Escondida, a pessoa
 * procura onde nao ha; declarada e vazia, ela responde a duvida antes de a busca
 * comecar.
 */
const ABA_TICKETS = "Tickets";
const ABA_PRODUTOS = "Produtos";

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

/**
 * Nova conta a receber, a partir dos tickets em aberto.
 *
 * O caminho do dinheiro no VPay e ticket -> conta a receber -> baixa. Esta tela
 * e o meio: escolhe o cliente, mostra o que ele tem em aberto, e vira cobranca.
 *
 * ⚠️ O valor de cada ticket NAO se edita aqui: entra o saldo inteiro. Quem
 * entrega meio escopo emite meio ticket, e nao um ticket inteiro cobrado pela
 * metade — a conta e o ticket precisam concordar sobre o mesmo servico.
 */

type TicketFaturavel = {
  id: number;
  numero: number;
  titulo: string;
  clienteNome: string | null;
  inicio: string | null;
  fim: string | null;
  saldo: number;
  total: number;
};

export function NovaFaturaDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [clienteId, setClienteId] = useState("");
  const [nomeDoCliente, setNomeDoCliente] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketFaturavel[] | null>(null);
  /** Quanto tirar de cada ticket. Ausente = não entra nesta conta. */
  const [valores, setValores] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState(ABA_TICKETS);

  const [parcelas, setParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<string>(hoje());
  const [intervalo, setIntervalo] = useState(30);
  const [observacoes, setObservacoes] = useState("");
  const [emitir, setEmitir] = useState(true);

  /**
   * Os clientes que casam com o que foi digitado.
   *
   * ⚠️ BUSCA, e nao a arvore inteira. A pagina carregava todos os clientes so
   * para encher um `<select>`: numa base com vinte mil ativos, sao vinte mil
   * linhas no HTML da pagina para escolher uma, e a tela trava antes de
   * aparecer. Mesmo caminho que o drawer da baixa ja seguia.
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

  /*
   * O efeito so BUSCA; quem limpa a lista e o proprio `aoEscolher` do cliente.
   *
   * Limpar aqui seria escrever estado no meio do render — o React reclama com
   * razao: o efeito rodaria, marcaria a tela como suja e pediria outro render
   * antes de pintar o primeiro.
   */
  useEffect(() => {
    if (!clienteId) return;

    const controle = new AbortController();

    fetch(`/api/v1/tickets/faturaveis?clienteId=${clienteId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar os tickets");
        setTickets(corpo.data as TicketFaturavel[]);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          avisar("erro", e.message);
          setTickets([]);
        }
      });

    return () => controle.abort();
  }, [clienteId, avisar]);

  const todos = tickets ?? [];
  const totalPaginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = todos.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const escolhidos = useMemo(
    () => (tickets ?? []).filter((t) => (valores[t.id] ?? 0) > 0),
    [tickets, valores],
  );

  const total = escolhidos.reduce((soma, t) => soma + (valores[t.id] ?? 0), 0) as Centavos;

  /*
   * A competência sai do período dos tickets escolhidos, não de um campo.
   *
   * É a mesma pergunta respondida duas vezes: quem escolheu os tickets de julho
   * já disse qual é a competência, e digitá-la de novo só cria a chance de
   * divergir do que está sendo cobrado.
   */
  const datas = escolhidos.flatMap((t) => [t.inicio, t.fim]).filter(Boolean) as string[];
  const apuracaoInicio = datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : hoje();
  const apuracaoFim = datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : hoje();

  /**
   * Marca ou desmarca um ticket.
   *
   * ⚠️ Entra pelo SALDO INTEIRO, e nao ha meio-termo. O valor cobrado e o do
   * ticket: quem entrega meio escopo emite meio ticket, e nao um ticket inteiro
   * cobrado pela metade. Com o numero editavel aqui, a conta e o ticket passavam
   * a discordar sobre o mesmo servico, e o saldo que sobrava no ticket nao tinha
   * documento que o explicasse.
   */
  function alternar(t: TicketFaturavel) {
    setValores((v) => {
      const copia = { ...v };
      if (copia[t.id]) delete copia[t.id];
      else copia[t.id] = t.saldo;
      return copia;
    });
  }

  async function criar() {
    setSalvando(true);

    const r = await fetch("/api/v1/faturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: Number(clienteId),
        apuracaoInicio,
        apuracaoFim,
        /*
         * Só as origens: quanto sai de cada ticket.
         *
         * A conta a receber não tem itens próprios. O serviço vive no ticket, e
         * copiá-lo para cá criaria um segundo detalhamento que divergiria no
         * primeiro ajuste — e quebraria o faturamento parcial, onde o valor
         * cobrado não é o do serviço.
         */
        origens: escolhidos.map((t) => ({ ticketId: t.id, valor: valores[t.id] })),
        parcelamento: {
          quantidade: parcelas,
          primeiroVencimento,
          intervaloDias: intervalo,
        },
        observacoes: observacoes.trim() || null,
        emitir,
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível criar a conta",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    avisar(
      "sucesso",
      `Conta a receber criada`,
      `${dados.data.parcelas} parcela(s), ${formatarSemSimbolo(dados.data.total)}.`,
    );
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Nova conta a receber"
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={salvando || escolhidos.length === 0}
          title={escolhidos.length === 0 ? "Escolha ao menos um ticket para cobrar" : undefined}
          onClick={criar}
        >
          {salvando ? "Criando…" : emitir ? "Criar e emitir" : "Criar rascunho"}
        </Button>
      }
    >
      {/*
        ⚠️ A anatomia e a do resto do sistema: `Formulario` e `GrupoDeCampos`,
        com o vao entre campos vindo do token. Havia um `div` com `gap: 3` e
        rotulos de secao escritos a mao, que acertavam o ritmo por coincidencia e
        erravam o de um bloco para o outro.
      */}
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="De quem é a cobrança"
          legenda="A conta nasce do que o cliente tem em aberto: os tickets entregues e ainda não faturados."
        >
          <Field label="Cliente" required>
            <SeletorBuscavel
              valor={clienteId ? Number(clienteId) : null}
              rotulo={nomeDoCliente}
              buscar={buscarClientes}
              aoEscolher={(c) => {
                setClienteId(c ? String(c.id) : "");
                setNomeDoCliente(c?.nome ?? null);
                // Nada marcado ao trocar de cliente: valor escolhido para um
                // cliente nao pode sobreviver ao outro.
                setTickets(null);
                setValores({});
                setPagina(1);
              }}
            />
          </Field>
        </GrupoDeCampos>

        {clienteId && (
          <>
            {/*
              ⚠️ O parcelamento vem ANTES da lista, e nao depois.

              Ele e a decisao da conta — em quantas vezes, a partir de quando —, e
              a lista abaixo e o detalhamento dela. Embaixo, quem escolhia dez
              tickets rolava a lista inteira de volta para achar onde se define o
              vencimento, e o total ficava fora da vista justamente enquanto se
              montava a conta.

              ⚠️ Aparece com o CLIENTE escolhido, e nao com o primeiro ticket
              marcado. Preso a marcacao, o bloco nascia no meio da tela e
              empurrava a lista para baixo no instante do clique — e a linha que a
              pessoa acabou de marcar saia de debaixo do cursor.
            */}
            <GrupoDeCampos
              titulo="Como vai ser cobrada"
              legenda="O parcelamento e a competência da conta. A competência sai dos tickets escolhidos e não se digita."
            >
              {/*
                ⚠️ O TOTAL saiu do rodape e virou campo.

                La era um numero solto com rotulo miudo, do lado de fora do bloco
                em que se monta a conta — e e ele que decide se ela esta certa.
                Mesma decisao da baixa e do recebimento.
              */}
              <Field
                label="Total da conta"
                hint="A soma do que foi marcado na lista abaixo. É este valor que será parcelado."
              >
                <CampoBloqueado valor={formatarSemSimbolo(total)} />
              </Field>

              <Field
                label="Competência"
                hint="Sai do período dos tickets escolhidos — não se digita para não divergir do que está sendo cobrado."
              >
                <CampoBloqueado
                  valor={
                    escolhidos.length === 0
                      ? "—"
                      : `${paraFormatoBR(apuracaoInicio as DataISO)} a ${paraFormatoBR(
                          apuracaoFim as DataISO,
                        )}`
                  }
                />
              </Field>

              <Field label="Parcelas">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={parcelas}
                  onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
                  style={inputStyle}
                />
              </Field>

              <Field label="1º vencimento">
                <input
                  type="date"
                  value={primeiroVencimento}
                  onChange={(e) => setPrimeiroVencimento(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              {parcelas > 1 && (
                <Field label="Intervalo" hint="Dias entre uma parcela e a seguinte.">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalo}
                    onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value) || 30))}
                    style={inputStyle}
                  />
                </Field>
              )}

              <Field label="Observações">
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Sai no documento enviado ao cliente"
                  maxLength={400}
                  style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
                />
              </Field>

              <Field
                label="Emitir"
                hint="Rascunho não cobra e não baixa o ticket — serve para conferir antes."
              >
                {/*
                  ⚠️ O interruptor do kit, no lugar de uma caixa de marcar nativa
                  com rotulo proprio alinhado a mao pela altura do campo.
                */}
                <ActiveToggle active={emitir} onChange={() => setEmitir((e) => !e)} />
              </Field>
            </GrupoDeCampos>

            {/*
              ⚠️ SEM titulo de grupo aqui: a aba ja se chama Tickets, e um titulo
              logo acima seria o mesmo assunto dito duas vezes em dois tamanhos de
              letra. E a mesma decisao da aba de pagamentos da baixa.
            */}
            <div>
              <PanelTabs tabs={[ABA_TICKETS, ABA_PRODUTOS]} active={aba} onChange={setAba} />

              {aba === ABA_PRODUTOS ? (
                /*
                  ⚠️ A aba existe VAZIA de proposito, e diz o que falta.

                  Produto ainda nao entra numa conta a receber, e esconder a aba
                  faria a pessoa procurar onde nao ha. Dizendo, ela sabe que o
                  caminho e o ticket enquanto isto nao existir — e nao fica
                  tentando faturar produto por outro lugar.
                */
                <p
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    border: "1px dashed var(--border-strong)",
                    borderRadius: "var(--radius-lg)",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--text-sm)",
                    lineHeight: 1.6,
                  }}
                >
                  Cobrar produto direto na conta ainda não existe. Por enquanto o
                  produto entra pelo ticket, e o ticket entra aqui.
                </p>
              ) : (
                <>
                  {/*
                    ⚠️ SEM moldura em volta da tabela: o cartao do drawer ja e a
                    moldura, e as duas juntas dao contorno dentro de contorno.
                  */}
                  <TableArea minWidth={0}>
                    <TableHead>
                      {/*
                        ⚠️ A marca de COBRAR abre a linha.

                        Sem ela, com o valor saindo do saldo, todo ticket em
                        aberto entraria na conta sozinho: abrir a tela de um
                        cliente com seis tickets significaria faturar os seis.
                      */}
                      <Th minWidth={54}>Cobrar</Th>
                      <Th minWidth={70}>Ticket</Th>
                      <Th>Período</Th>
                      {/*
                        ⚠️ Uma coluna de dinheiro, e ela NAO se edita.

                        Ja foram duas — "em aberto" e "valor" — mostrando o mesmo
                        numero na maioria das linhas, e depois uma so que virava
                        campo ao marcar. O valor cobrado e o do ticket: quem
                        entrega meio escopo emite meio ticket, e nao um ticket
                        inteiro cobrado pela metade. Editavel aqui, a conta e o
                        ticket passavam a discordar sobre o mesmo servico.
                      */}
                      <Th minWidth={110}>Em aberto</Th>
                    </TableHead>

                    <tbody>
                      {tickets == null && <EmptyRow colSpan={4} message="Carregando…" />}
                      {tickets != null && tickets.length === 0 && (
                        <EmptyRow
                          colSpan={4}
                          message="Nenhum ticket em aberto para este cliente."
                        />
                      )}

                      {visiveis.map((t, n) => (
                        <Tr key={t.id} delay={n * 12}>
                          <Td>
                            {/*
                              ⚠️ A marca do KIT, e nao uma caixa desenhada aqui.

                              Havia um `Caixa` local repetindo o mesmo circulo com
                              visto, no verde generico e com meio pixel de borda
                              proprio. O gesto de incluir uma linha ja tem desenho
                              no sistema.
                            */}
                            <MarcaDeUso
                              marcado={(valores[t.id] ?? 0) > 0}
                              rotulo={
                                (valores[t.id] ?? 0) > 0
                                  ? "Tirar este ticket da conta"
                                  : "Cobrar este ticket"
                              }
                              onClick={() => alternar(t)}
                            />
                          </Td>

                          <Td style={NUM}>{t.numero}</Td>

                          <Td>
                            {t.inicio || t.fim
                              ? periodoEmMeses(t.inicio as DataISO, t.fim as DataISO)
                              : "—"}
                          </Td>

                          <Td style={NUM}>{formatarSemSimbolo(t.saldo as Centavos)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </TableArea>

                  {/*
                    ⚠️ Pagina, e o que foi marcado nas outras paginas CONTINUA
                    valendo. O estado e da conta inteira e nao da pagina: o total
                    la em cima soma tudo que foi marcado, em qualquer uma. Mesma
                    decisao da tabela de parcelas da baixa.
                  */}
                  {todos.length > POR_PAGINA && (
                    <Pagination
                      page={paginaAtual}
                      totalPages={totalPaginas}
                      total={todos.length}
                      pageSize={POR_PAGINA}
                      onPage={setPagina}
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </Formulario>
    </Drawer>
  );
}
