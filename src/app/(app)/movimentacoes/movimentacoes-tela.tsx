"use client";

import { useState } from "react";
import { useRegistrarBusca } from "@/components/layout/busca-da-tela";
import {
  AcoesDaLinha,
  Alert,
  EmptyRow,
  PageHeader,
  PageLayout,
  Panel,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
  Button,
} from "@/components/ui/kit";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";
import {
  BarraDeFerramentas,
  BotaoDaBarra,
  IconeMais,
  TituloDoPainel,
} from "@/components/ui/barra-de-ferramentas";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { ehDataISO, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Movimentacao } from "@/modules/movimentacoes/movimentacoes.types";
import type { ContaBancaria } from "@/modules/contas/contas.types";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import { NovaMovimentacao } from "./nova-movimentacao";

export function MovimentacoesTela({
  inicial,
  contas,
  de: deInicial,
  ate: ateInicial,
  empresa,
  emitidoPor,
}: {
  inicial: Movimentacao[];
  contas: ContaBancaria[];
  de: DataISO;
  ate: DataISO;
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
}) {
  const [linhas, setLinhas] = useState(inicial);
  const [de, setDe] = useState<string>(deInicial);
  const [ate, setAte] = useState<string>(ateInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");
  /* A conta escolhida no painel de impressão. Nula = todas. */
  const [contaDoPdf, setContaDoPdf] = useState<number | null>(null);
  const { avisar, confirmar } = useAvisos();

  /*
   * ⚠️ O gerador entra por `import()` dentro do clique, e nao no topo do
   * arquivo. `jspdf` e `jspdf-autotable` sao a maior dependencia desta tela, e
   * no topo viajariam com o bundle de quem so quer LER a lista — que e quase
   * todo mundo, quase sempre. Mesmo caminho da DRE, do extrato e do fluxo.
   */
  async function imprimir() {
    const { imprimirMovimentacoes } = await import("./pdf-movimentacoes");

    /*
     * ⚠️ O recorte por conta olha as DUAS pontas.
     *
     * Uma transferencia da Cresol para o PicPay pertence as duas: no extrato da
     * Cresol ela e saida, no do PicPay e entrada. Filtrar so pela origem
     * esconderia da conta que recebeu justamente o dinheiro que entrou nela.
     */
    const alvo = contaDoPdf
      ? visiveis.filter((m) => m.origemId === contaDoPdf || m.destinoId === contaDoPdf)
      : visiveis;

    const nome = contaDoPdf
      ? (contas.find((c) => c.id === contaDoPdf)?.nome ?? null)
      : null;

    await imprimirMovimentacoes(
      alvo,
      { de: de as DataISO, ate: ate as DataISO },
      nome,
      empresa,
      emitidoPor,
    );
  }

  /*
   * ⚠️ Filtra em MEMORIA, e nao no servidor.
   *
   * O periodo ja limita o que veio; buscar de novo no banco a cada tecla seria
   * uma ida por letra pelo mesmo conjunto que ja esta na mao. E a busca cobre
   * numero, contas e observacao porque quem procura uma transferencia lembra de
   * um dos tres — quase nunca do valor exato.
   */
  const visiveis = linhas.filter((m) => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return true;

    return [
      String(m.numero ?? ""),
      m.origemNome,
      m.destinoNome,
      m.observacoes ?? "",
      m.criadoPor ?? "",
      formatarSemSimbolo(m.valor),
    ]
      .join(" ")
      .toLowerCase()
      .includes(alvo);
  });

  /*
   * ⚠️ Esta tela nao tem campo de busca proprio: ela ANUNCIA o seu filtro para a
   * caixa do topo, que e a unica do sistema.
   *
   * O estado continua sendo daqui — quem sabe o que e "buscar uma movimentacao"
   * e esta tela, e nao a barra de cima. A caixa so chama `setBusca`; a etiqueta
   * com o termo aplicado aparece sozinha no `PageHeader`.
   */
  useRegistrarBusca("Movimentações", busca, setBusca, visiveis.length);

  async function buscar(novo: { de?: string; ate?: string }) {
    const alvo = { de: novo.de ?? de, ate: novo.ate ?? ate };

    if (novo.de !== undefined) setDe(novo.de);
    if (novo.ate !== undefined) setAte(novo.ate);

    // Data pela metade nao vira consulta: enquanto se digita "2026-0", o valor
    // ja chega aqui e voltaria 422 a cada tecla.
    if (!ehDataISO(alvo.de) || !ehDataISO(alvo.ate)) return;

    setCarregando(true);
    setErro(null);

    try {
      const r = await fetch(`/api/v1/movimentacoes?de=${alvo.de}&ate=${alvo.ate}`);
      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(dados?.error?.message ?? "Não foi possível carregar o período");
        return;
      }
      setLinhas(dados.data as Movimentacao[]);
    } finally {
      setCarregando(false);
    }
  }

  async function excluir(m: Movimentacao) {
    const r = await fetch(`/api/v1/movimentacoes/${m.id}`, { method: "DELETE" });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("erro", corpo?.error?.message ?? "Não foi possível excluir");
      return;
    }

    avisar("sucesso", "Movimentação excluída");
    await buscar({});
  }

  const periodoBR = `${paraFormatoBR(de as DataISO)} a ${paraFormatoBR(ate as DataISO)}`;

  return (
    <PageLayout>
      {/*
        ⚠️ SEM legenda no titulo, e dentro de `Panel` — a anatomia das listagens
        firmadas (contas, tickets, faturas, contas a pagar).

        Modulo nao tem subtitulo nesta casa: uma frase aqui empurra a tabela para
        baixo para explicar o que o menu ja disse. E o `Panel` e quem empilha
        cabecalho e conteudo sem fundo nem recuo proprio.
      */}
      <Panel>
        {/*
          ⚠️ O periodo saiu daqui e foi para a BARRA da direita.

          O cabecalho fica com o titulo e a etiqueta do filtro em vigor. A busca
          subiu para a caixa do topo, o periodo e a acao foram para a BARRA:
          filtro de data usa-se de vez em quando e ocupava 300 pixels da linha
          mais disputada da tela.
        */}
        <PageHeader title="Movimentações" />

        {erro && <Alert variant="warning">{erro}</Alert>}

        {/*
          ⚠️ O recuo da pagina mora AQUI, e a tabela entra `solto`.

          O `TableFrame` traz `0 16px 16px` de margem propria. Com a barra ao
          lado, essa margem viraria um vao entre o cartao e a barra — e o pedido
          era justamente que eles se encostassem. Passando o recuo para a linha,
          os dois ficam colados e o conjunto continua alinhado com o resto da
          tela.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            /* Sem margem a DIREITA: o respiro daquele lado e da propria barra,
               que o carrega na largura. Ver `BarraDeFerramentas`. */
            margin: "0 0 16px 16px",
          }}
        >
          <TableFrame solto>
            <TableArea minWidth={720}>
            <TableHead>
              {/*
                ⚠️ A conciliação vem PRIMEIRO e ocupa o mínimo: só o ícone.

                Ela é o estado da linha, e estado se lê antes do conteúdo — do
                mesmo jeito que a caixa de seleção mora na esquerda. Escrita
                ("Conferida", "Metade", "Pendente") ela gastava 130 pixels para
                dizer o que um visto diz, e as palavras não explicavam nada:
                "metade" de quê não estava na tela.
              */}
              <Th minWidth={28}> </Th>
              <Th minWidth={64}>Nº</Th>
              <Th minWidth={96}>Data</Th>
              <Th>Origem</Th>
              <Th>Destino</Th>
              <Th minWidth={120} align="right">
                Valor
              </Th>
              <Th minWidth={140}>Lançado por</Th>
              <Th minWidth={44}> </Th>
            </TableHead>

            <tbody>
              {visiveis.length === 0 && (
                <EmptyRow
                  colSpan={8}
                  message={
                    busca.trim()
                      ? "Nenhuma transferência encontrada."
                      : "Nenhuma transferência neste período."
                  }
                />
              )}

              {visiveis.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    <MarcaDaConciliacao conferidas={m.conferidas} />
                  </Td>
                  <Td style={NUM}>{m.numero ?? "—"}</Td>
                  <Td style={NUM}>{paraFormatoBR(m.data)}</Td>
                  <Td>
                    <span style={CORTA}>{m.origemNome}</span>
                    {m.observacoes && (
                      <span
                        style={{
                          ...CORTA,
                          display: "block",
                          marginTop: 1,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {m.observacoes}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span style={CORTA}>{m.destinoNome}</span>
                  </Td>
                  <Td
                    style={{
                      ...NUM,
                      textAlign: "right",
                      fontWeight: "var(--fw-medium)",
                    }}
                  >
                    {formatarSemSimbolo(m.valor)}
                  </Td>
                  <Td>
                    <span style={CORTA}>{m.criadoPor ?? "—"}</span>
                  </Td>
                  <Td>
                    <AcoesDaLinha>
                      <MenuDeLinha>
                        {(fechar) => (
                          <ItemDoMenu
                            rotulo="Excluir movimentação"
                            perigo
                            /*
                              ⚠️ Basta UMA ponta conciliada, e não as duas.

                              A tela olhava `conciliada`, que só é verdade quando
                              as duas bateram — mas o servidor recusa com uma só,
                              e com razão: apagar deixaria a linha do extrato
                              daquela conta conferida contra um lançamento que
                              não existe mais. Com o critério mais frouxo aqui, a
                              transferência meio conciliada oferecia um botão que
                              só podia terminar em erro.
                            */
                            desabilitado={m.conferidas > 0}
                            motivo={
                              m.conferidas > 0
                                ? m.conciliada
                                  ? "Já conciliada com o extrato: desfaça a conciliação antes"
                                  : "Uma das pontas já foi conciliada: desfaça a conciliação antes"
                                : undefined
                            }
                            icone={<IconeLixeira />}
                            onClick={() => {
                              fechar();
                              confirmar(
                                "Excluir esta movimentação?",
                                "Excluir",
                                () => void excluir(m),
                                "As duas pontas saem juntas, e o saldo das duas contas volta ao que era.",
                              );
                            }}
                          />
                        )}
                      </MenuDeLinha>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))}
            </tbody>
            </TableArea>
          </TableFrame>

          <BarraDeFerramentas>
            {/*
              ⚠️ A AÇÃO no topo da barra, e não mais no cabeçalho.

              Incluir e imprimir são o mesmo tipo de gesto — coisas que se FAZEM
              nesta tela —, e estavam em dois cantos opostos por herança, não por
              decisão. Juntas numa coluna só, a mão vai sempre ao mesmo lugar; o
              cabeçalho fica com o que a tela É e onde se procura.

              Pintado, e único pintado: ele continua sendo o gesto principal, e a
              barra inteira depende de um destaque só para que isso se leia.
            */}
            <BotaoDaBarra
              rotulo="Nova movimentação"
              legenda="Nova"
              destaque
              icone={<IconeMais />}
              onClick={() => setCriando(true)}
            />

            {/*
              ⚠️ O periodo mora na barra, e o botao fica ACESO quando ele nao e o
              padrao.

              Escondido atras de um icone, o periodo em vigor deixa de estar a vista
              — e numa tela de dinheiro isso engana: uma lista curta pode ser "nao
              houve" ou "o filtro esta apertado". O botao aceso e a dica dizem qual
              dos dois, sem gastar linha do cabecalho.
            */}
            <BotaoDaBarra
              rotulo={`Período: ${periodoBR}`}
              legenda="Período"
              aceso={de !== deInicial || ate !== ateInicial}
              icone={<IconeCalendario />}
              painel={() => (
                <>
                  <TituloDoPainel>Período</TituloDoPainel>
                  <input
                    type="date"
                    value={de}
                    disabled={carregando}
                    onChange={(e) => void buscar({ de: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="date"
                    value={ate}
                    disabled={carregando}
                    onChange={(e) => void buscar({ ate: e.target.value })}
                    style={inputStyle}
                  />
                </>
              )}
            />

            <BotaoDaBarra
              rotulo="Imprimir o histórico em PDF"
              legenda="Imprimir"
              desabilitado={visiveis.length === 0}
              icone={<IconeImpressora />}
              painel={(fechar) => (
                <>
                  <TituloDoPainel>Imprimir</TituloDoPainel>

                  {/*
                    ⚠️ Escolher a conta ANTES de gerar, e nao um PDF por conta.

                    O histórico entre contas se lê de dois jeitos: o da empresa
                    inteira, para saber o que andou; e o de UMA conta, para conferir
                    contra o extrato dela. São o mesmo documento com recorte
                    diferente, e o papel diz qual dos dois é.
                  */}
                  <select
                    value={contaDoPdf ?? ""}
                    onChange={(e) =>
                      setContaDoPdf(e.target.value ? Number(e.target.value) : null)
                    }
                    style={selectStyle}
                  >
                    <option value="">Todas as contas</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      fechar();
                      void imprimir();
                    }}
                  >
                    Gerar PDF
                  </Button>
                </>
              )}
            />
          </BarraDeFerramentas>
        </div>
      </Panel>

      {criando && (
        <NovaMovimentacao
          contas={contas}
          onClose={() => setCriando(false)}
          aoCriar={async () => {
            setCriando(false);
            avisar("sucesso", "Movimentação criada");
            await buscar({});
          }}
        />
      )}
    </PageLayout>
  );
}

/**
 * Calendário: o período que a tela está mostrando.
 *
 * ⚠️ AZUL DA MARCA no traço, e uma cor só para a barra inteira.
 *
 * Tentamos uma cor por ferramenta, como o Google faz; lá funciona porque os
 * ícones são IMAGENS — massas de cor com forma própria, que se reconhecem de
 * longe. Um traço de 1,7px tingido não vira imagem: fica um desenho descorado,
 * e ainda gasta a paleta de gráficos, que existe para outra coisa. Uma cor só,
 * a da marca, dá à barra a mesma unidade sem prometer o que o traço não entrega.
 */
function IconeCalendario() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/** Impressora: papel saindo por cima, corpo no meio, bandeja embaixo. */
function IconeImpressora() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 8V4h10v4" />
      <path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
      <path d="M7 14h10v6H7z" />
    </svg>
  );
}

/**
 * O estado da conciliacao, em icone.
 *
 * ⚠️ Sao TRES estados e nao dois, porque a transferencia tem duas pontas.
 *
 * Ela aparece no extrato das duas contas, e cada lado se concilia por conta
 * propria — a saida quando o extrato da origem e importado, a entrada quando e o
 * do destino. Com uma so, metade do dinheiro ainda nao bateu com o banco.
 *
 * ⚠️ O que separa os tres e a COR e a dica, nao tres desenhos. Um simbolo novo
 * para "metade" seria mais uma coisa a aprender; o relogio ja diz "ainda nao
 * terminou", e a cor diz o quanto falta.
 */
function MarcaDaConciliacao({ conferidas }: { conferidas: number }) {
  const pronta = conferidas === 2;

  const dica = pronta
    ? "Conciliada: as duas pontas bateram com o extrato das suas contas"
    : conferidas === 1
      ? "Só uma das duas contas teve o extrato conferido"
      : "Nenhuma das duas contas teve o extrato conferido";

  return (
    <span
      aria-label={dica}
      title={dica}
      style={{
        display: "grid",
        placeItems: "center",
        color: pronta
          ? "var(--success-text)"
          : conferidas === 1
            ? "var(--warning-text)"
            : "var(--text-tertiary)",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pronta ? (
          /* Visto: as duas pontas bateram com o banco. */
          <path d="M4.5 12.5l5 5 10-11" />
        ) : (
          /* Relógio: ainda falta conferir ao menos um dos lados. */
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.2 1.9" />
          </>
        )}
      </svg>
    </span>
  );
}

function IconeLixeira() {
  return (
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
  );
}

/** O texto que nao pode empurrar a coluna: corta com reticencias. */
const CORTA: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
