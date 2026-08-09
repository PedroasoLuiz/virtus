"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  ActiveToggle,
  Button,
  CampoBloqueado,
  CampoNumerico,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  inputDeCelula,
  inputStyle,
  MarcaDeUso,
  Pagination,
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
 * O valor de cada ticket e EDITAVEL: faturamento parcial e comum — entrega-se
 * metade do escopo e cobra-se metade. O que sobra continua no saldo do ticket,
 * disponivel para a proxima.
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

  function alternar(t: TicketFaturavel) {
    setValores((v) => {
      const copia = { ...v };
      // Marcar traz o saldo inteiro: é o caso comum. Quem cobra parcial ajusta
      // o número ao lado.
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
          titulo="O que vai ser cobrado"
          legenda="A conta nasce dos tickets em aberto do cliente. Cobrar menos que o saldo é faturamento parcial: o que sobra continua no ticket, disponível para a próxima."
        >
          <Field label="Cliente" required hint="De quem é a cobrança.">
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

          {clienteId && (
            /*
              ⚠️ O vao aqui e o de TITULO, e nao o de campo.

              Os filhos do grupo se separam por `--form-gap-campo`, que sao 3px:
              e o respiro de um campo para o seguinte numa pilha de campos
              irmaos. O cliente e a tabela nao sao irmaos — um comanda a outra —,
              e com 3px o campo encostava no cabecalho da tabela.

              ⚠️ SEM moldura em volta da tabela.

              Havia um `div` com borda envolvendo o `TableArea`, e o cartao do
              drawer ja e a moldura: as duas juntas davam contorno dentro de
              contorno. E o rotulo "Tickets em aberto" escrito a mao saiu — o
              titulo do grupo acima ja diz do que a lista trata.
            */
            <div style={{ marginTop: "var(--form-gap-titulo)" }}>
            <TableArea minWidth={0}>
              <TableHead>
                {/*
                  ⚠️ A marca de COBRAR abre a linha.

                  Sem ela, com o valor saindo do saldo, todo ticket em aberto
                  entraria na conta sozinho: abrir a tela de um cliente com seis
                  tickets significaria faturar os seis.
                */}
                <Th minWidth={54}>Cobrar</Th>
                <Th minWidth={70}>Ticket</Th>
                <Th>Período</Th>
                {/*
                  ⚠️ UMA coluna de dinheiro, e nao duas.

                  "Em aberto" e "Valor" mostravam o mesmo numero na maioria das
                  linhas: marcar um ticket ja traz o saldo inteiro, e cobrar menos
                  e a excecao. Duas colunas iguais lado a lado fazem procurar a
                  diferenca que quase nunca existe.

                  Aqui a coluna e a DIVIDA do ticket: sem marcar, ela diz quanto
                  ha em aberto; marcada, ela vira o campo do quanto disso entra
                  nesta conta. E a mesma anatomia da coluna "Em aberto" da baixa.

                  ⚠️ E alinhada a ESQUERDA, como tudo no sistema — inclusive
                  dinheiro. Puxada para a direita, a leitura salta o vao vazio do
                  meio e volta.
                */}
                <Th minWidth={130}>Em aberto</Th>
              </TableHead>

              <tbody>
                {tickets == null && <EmptyRow colSpan={5} message="Carregando…" />}
                {tickets != null && tickets.length === 0 && (
                  <EmptyRow colSpan={5} message="Nenhum ticket em aberto para este cliente." />
                )}

                {visiveis.map((t, n) => {
                  const escolhido = (valores[t.id] ?? 0) > 0;

                  return (
                    <Tr key={t.id} delay={n * 12}>
                      <Td>
                        {/*
                          ⚠️ A marca do KIT, e nao uma caixa desenhada aqui.

                          Havia um `Caixa` local repetindo o mesmo circulo com
                          visto, no verde generico e com meio pixel de borda
                          proprio. O gesto de incluir uma linha ja tem desenho no
                          sistema, e dois desenhos para ele fazem aprender duas
                          vezes.
                        */}
                        <MarcaDeUso
                          marcado={escolhido}
                          rotulo={escolhido ? "Tirar este ticket da conta" : "Cobrar este ticket"}
                          onClick={() => alternar(t)}
                        />
                      </Td>

                      <Td style={NUM}>{t.numero}</Td>

                      <Td>
                        {t.inicio || t.fim
                          ? periodoEmMeses(t.inicio as DataISO, t.fim as DataISO)
                          : "—"}
                      </Td>

                      <Td>
                        {/* Editável quando marcado: faturamento parcial é comum,
                            e o que sobra continua no saldo do ticket para a
                            próxima. O teto é o próprio saldo. */}
                        {escolhido ? (
                          <CampoNumerico
                            valor={valores[t.id]}
                            escala={100}
                            style={inputDeCelula}
                            aoMudar={(v) =>
                              setValores((atual) => ({ ...atual, [t.id]: Math.min(v, t.saldo) }))
                            }
                          />
                        ) : (
                          <span style={NUM}>{formatarSemSimbolo(t.saldo as Centavos)}</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableArea>

            {/*
              ⚠️ Pagina, e o que foi marcado nas outras paginas CONTINUA valendo.

              Um cliente com trinta tickets em aberto nao cabe na tela, e rolar
              trinta linhas para achar o que se quer cobrar e pior que virar
              pagina. O estado e da conta inteira e nao da pagina: o total la
              embaixo soma tudo que foi marcado, em qualquer pagina. Mesma
              decisao da tabela de parcelas da baixa.
            */}
            {(tickets ?? []).length > POR_PAGINA && (
              <Pagination
                page={paginaAtual}
                totalPages={totalPaginas}
                total={(tickets ?? []).length}
                pageSize={POR_PAGINA}
                onPage={setPagina}
              />
            )}
            </div>
          )}
        </GrupoDeCampos>

        {escolhidos.length > 0 && (
          <GrupoDeCampos
            titulo="Como vai ser cobrada"
            legenda="O parcelamento e a competência da conta. A competência sai dos tickets escolhidos e não se digita."
          >
            {/*
              ⚠️ O TOTAL saiu do rodape e virou campo.

              La ele era um numero solto com rotulo miudo, do lado de fora do
              bloco em que se escolhe o que cobrar — e e ele que decide se a conta
              esta certa. Como campo, tem o rotulo a esquerda como todo dado da
              tela e da para copiar. Mesma decisao da baixa e do recebimento.
            */}
            <Field
              label="Total da conta"
              hint="A soma do que foi marcado. É este valor que será parcelado abaixo."
            >
              <CampoBloqueado valor={formatarSemSimbolo(total)} />
            </Field>

            <Field
              label="Competência"
              hint="Sai do período dos tickets escolhidos — não se digita para não divergir do que está sendo cobrado."
            >
              <CampoBloqueado
                valor={`${paraFormatoBR(apuracaoInicio as DataISO)} a ${paraFormatoBR(
                  apuracaoFim as DataISO,
                )}`}
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
        )}
      </Formulario>
    </Drawer>
  );
}
