"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoBloqueado,
  CampoNumerico,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
  MarcaDeUso,
  selectStyle,
  SeletorBuscavel,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { TIPOS_DE_PAGAMENTO } from "@/modules/contas-pagar/contas-pagar.types";
import { competenciaBR, competenciaDaCompra } from "@/shared/domain/cartao";

/**
 * Nova baixa: um dinheiro que saiu, repartido entre as parcelas que ele quita.
 *
 * Espelho do drawer de recebimento. A pergunta central é a mesma vista do outro
 * lado: um dinheiro saiu, de onde ele veio e o que ele pagou.
 *
 * ⚠️ Cartão de crédito NÃO aparece nas formas. Baixar no cartão não tira do
 * saldo: o dinheiro sai quando a conta a pagar da fatura é paga. Oferecer aqui
 * faria a mesma despesa sair do caixa duas vezes.
 */

type Parcela = {
  parcelaId: number;
  contaId: number;
  contaNumero: number | null;
  contaDescricao: string | null;
  numero: number;
  totalParcelas: number;
  vencimento: string | null;
  total: number;
  quitado: number;
  emAberto: number;
  liberada: boolean;
};

type Conta = { id: number; nome: string };

type Cartao = {
  id: number;
  apelido: string | null;
  bandeira: string | null;
  diaFechamento: number;
  diaVencimento: number;
};

/** O que a tela guarda de cada parcela marcada. */
type Destino = { valor: number; juros: number; multa: number; quitar: boolean };

const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

export function NovaBaixaDrawer({
  fornecedorInicial,
  parcelaInicial,
  onClose,
}: {
  /** Ja vem escolhido quando a baixa nasce de dentro de uma conta. */
  fornecedorInicial?: { id: number; nome: string | null };
  /** Ja vem marcada quando a baixa nasce do menu de uma parcela. */
  parcelaInicial?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [fornecedorId, setFornecedorId] = useState<number | null>(
    fornecedorInicial?.id ?? null,
  );
  const [nomeDoFornecedor, setNomeDoFornecedor] = useState<string | null>(
    fornecedorInicial?.nome ?? null,
  );
  const [parcelas, setParcelas] = useState<Parcela[] | null>(null);
  const [destinos, setDestinos] = useState<Record<number, Destino>>({});

  const [data, setData] = useState<string>(hoje());
  const [tipo, setTipo] = useState<string>("PIX");
  /** "conta:3" ou "cartao:5". Um seletor so para as duas origens. */
  const [origem, setOrigem] = useState("");
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  const buscarFornecedores = useCallback(async (termo: string) => {
    const p = new URLSearchParams({
      perPage: "15",
      papel: "fornecedor",
      ativo: "true",
    });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();
    return (
      (corpo.data ?? []) as {
        id: number;
        razao: string;
        nomeFantasia: string | null;
      }[]
    ).map((c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }));
  }, []);

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

    fetch("/api/v1/contas-pagar/cartoes", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setCartoes((corpo.data ?? []) as Cartao[]);
      })
      .catch(() => {
        // Silencioso: sem cartao na lista sobra a conta bancaria, que e o caso
        // comum. O campo obrigatorio explica sozinho o que falta.
      });

    return () => controle.abort();
  }, []);

  const [tipoDeOrigem, idDaOrigem] = origem.split(":");
  const cartaoEscolhido =
    tipoDeOrigem === "cartao"
      ? (cartoes.find((c) => String(c.id) === idDaOrigem) ?? null)
      : null;

  /*
   * O efeito so BUSCA; quem limpa a lista e o proprio `aoEscolher`.
   *
   * Limpar aqui seria escrever estado no meio do render — o React reclama com
   * razao: o efeito rodaria, marcaria a tela como suja e pediria outro render
   * antes de pintar o primeiro.
   */
  useEffect(() => {
    if (!fornecedorId) return;

    const controle = new AbortController();

    fetch(
      `/api/v1/contas-pagar/parcelas-abertas?fornecedorId=${fornecedorId}`,
      {
        signal: controle.signal,
      },
    )
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok)
          throw new Error(
            corpo?.error?.message ?? "Falha ao carregar as parcelas",
          );
        const lista = corpo.data as Parcela[];
        setParcelas(lista);

        /*
         * ⚠️ A parcela que abriu o drawer ja nasce marcada, e so ela.
         *
         * Quem clicou "Baixar" no menu daquela linha ja disse o que quer; pedir
         * para marcar de novo seria repetir a pergunta. As outras ficam
         * disponiveis, porque o pagamento pode cobrir mais de uma.
         */
        const alvo = parcelaInicial
          ? lista.find((p) => p.parcelaId === parcelaInicial)
          : null;
        if (alvo) {
          setDestinos({
            [alvo.parcelaId]: {
              valor: alvo.emAberto,
              juros: 0,
              multa: 0,
              quitar: false,
            },
          });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          avisar("erro", e.message);
          setParcelas([]);
        }
      });

    return () => controle.abort();
  }, [fornecedorId, parcelaInicial, avisar]);

  const marcadas = useMemo(
    () => (parcelas ?? []).filter((p) => destinos[p.parcelaId] != null),
    [parcelas, destinos],
  );

  /*
   * O total que sai do banco inclui o acrescimo.
   *
   * ⚠️ `valor` abate divida; juros e multa saem junto e PRECISAM estar no
   * lancamento. Guardando so o abatimento, a linha do Vope fica menor que a do
   * banco em todo pagamento em atraso, e a conciliacao acusa uma diferenca que
   * nao existe.
   */
  const total = marcadas.reduce((soma, p) => {
    const d = destinos[p.parcelaId];
    return soma + d.valor + d.juros + d.multa;
  }, 0);

  /**
   * Marca ou desmarca uma parcela.
   *
   * ⚠️ Ao marcar, o valor nasce com o EM ABERTO inteiro. E o caso comum — paga-se
   * a parcela toda —, e quem vai pagar menos corrige um numero em vez de digitar
   * todos.
   */
  function alternar(p: Parcela) {
    setDestinos((atual) => {
      const copia = { ...atual };
      if (copia[p.parcelaId]) delete copia[p.parcelaId];
      else
        copia[p.parcelaId] = {
          valor: p.emAberto,
          juros: 0,
          multa: 0,
          quitar: false,
        };
      return copia;
    });
  }

  function mudarDestino(parcelaId: number, mudanca: Partial<Destino>) {
    setDestinos((atual) => ({
      ...atual,
      [parcelaId]: { ...atual[parcelaId], ...mudanca },
    }));
  }

  const motivoTravado = !fornecedorId
    ? "Escolha o fornecedor"
    : marcadas.length === 0
      ? "Marque ao menos uma parcela"
      : !origem
        ? "Escolha de onde o dinheiro sai"
        : total <= 0
          ? "Informe o valor pago"
          : undefined;

  async function criar() {
    setSalvando(true);

    const r = await fetch("/api/v1/contas-pagar/baixas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fornecedorId,
        data,
        tipo,
        contaBancariaId: tipoDeOrigem === "conta" ? Number(idDaOrigem) : null,
        cartaoId: tipoDeOrigem === "cartao" ? Number(idDaOrigem) : null,
        observacoes: observacoes.trim() || null,
        destinos: marcadas.map((p) => ({
          parcelaId: p.parcelaId,
          valor: destinos[p.parcelaId].valor,
          juros: destinos[p.parcelaId].juros,
          multa: destinos[p.parcelaId].multa,
          quitar: destinos[p.parcelaId].quitar,
        })),
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível registrar a baixa",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    avisar(
      "sucesso",
      "Baixa registrada",
      `${marcadas.length === 1 ? "1 parcela" : `${marcadas.length} parcelas`}, ${formatarSemSimbolo(total as Centavos)}.`,
    );
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Nova baixa"
      acoes={
        <span title={motivoTravado}>
          <Button
            size="xs"
            variant="primary"
            disabled={salvando || !!motivoTravado}
            onClick={criar}
          >
            {salvando ? "Registrando…" : "Registrar baixa"}
          </Button>
        </span>
      }
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="Para quem foi o dinheiro"
          legenda="Um pagamento é para um recebedor só, e pode cobrir parcelas de várias contas dele."
        >
          <Field label="Fornecedor" required>
            <SeletorBuscavel
              valor={fornecedorId}
              rotulo={nomeDoFornecedor}
              buscar={buscarFornecedores}
              aoEscolher={(f) => {
                setFornecedorId(f?.id ?? null);
                setNomeDoFornecedor(f?.nome ?? null);
                // Nada marcado ao trocar de fornecedor: valor escolhido para um
                // nao pode sobreviver ao outro.
                setParcelas(null);
                setDestinos({});
              }}
            />
          </Field>
        </GrupoDeCampos>

        {fornecedorId && (
          <>
            {/*
              ⚠️ O bloco do pagamento vem ANTES da lista, e aparece com o
              FORNECEDOR escolhido — não com a primeira parcela marcada. Preso à
              marcação, ele nasceria no meio da tela e empurraria a lista para
              baixo no instante do clique, tirando de debaixo do cursor a linha
              que a pessoa acabou de marcar. Mesma decisão da conta a receber.
            */}
            <GrupoDeCampos
              titulo="De onde saiu"
              legenda="A conta e a forma que o extrato vai mostrar."
            >
              <Field
                label="Total pago"
                hint="A soma do que foi marcado, com juros e multa. É o valor que sai do banco."
              >
                <CampoBloqueado valor={formatarSemSimbolo(total as Centavos)} />
              </Field>

              <Field label="Data" hint="O dia em que o dinheiro saiu.">
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Forma" required>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  style={selectStyle}
                >
                  {TIPOS_DE_PAGAMENTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              {/*
                ⚠️ Conta bancária OU cartão, num seletor só.

                São duas respostas para a mesma pergunta — de onde sai o dinheiro
                —, e dois campos separados deixariam preencher os dois. O
                servidor recusa de qualquer forma; aqui a escolha nem chega a ser
                ambígua.
              */}
              <Field label="De onde sai" required>
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Escolha</option>

                  <optgroup label="Conta bancária">
                    {contas.map((c) => (
                      <option key={`conta-${c.id}`} value={`conta:${c.id}`}>
                        {c.nome}
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="Cartão de crédito">
                    {cartoes.map((c) => (
                      <option key={`cartao-${c.id}`} value={`cartao:${c.id}`}>
                        {c.apelido ?? `Cartão ${c.id}`}
                        {c.bandeira ? ` · ${c.bandeira}` : ""}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>

              {/*
                ⚠️ No cartão o dinheiro NÃO sai agora, e isso precisa ser dito
                antes do clique. Quem baixa esperando ver o saldo cair e não vê
                acha que a baixa falhou e lança de novo.
              */}
              {cartaoEscolhido && (
                <Field label="Entra na fatura de">
                  <CampoBloqueado
                    valor={competenciaBR(
                      competenciaDaCompra(
                        cartaoEscolhido.diaFechamento,
                        data as DataISO,
                      ),
                    )}
                    titulo="O dinheiro sai do banco quando esta fatura virar conta a pagar e ela for paga."
                  />
                </Field>
              )}

              <Field label="Observações">
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  maxLength={400}
                  style={{
                    ...inputStyle,
                    height: "auto",
                    padding: 8,
                    resize: "vertical",
                  }}
                />
              </Field>
            </GrupoDeCampos>

            <GrupoDeCampos
              titulo="O que este dinheiro quita"
              legenda="A parcela mais antiga em aberto de cada conta vem primeiro. Quitar fecha a parcela perdoando a diferença que sobrar."
            >
              <TableArea minWidth={0}>
                <TableHead>
                  {/*
                    ⚠️ A marca de PAGAR abre a linha. Sem ela, com o valor saindo
                    do em aberto, toda parcela entraria na baixa sozinha: abrir a
                    tela de um fornecedor com seis parcelas significaria pagar as
                    seis.
                  */}
                  <Th minWidth={54}>Pagar</Th>
                  <Th minWidth={64}>Conta</Th>
                  <Th minWidth={44}>#</Th>
                  <Th minWidth={104}>Vencimento</Th>
                  <Th minWidth={110}>Em aberto</Th>
                  <Th minWidth={110}>Valor</Th>
                  <Th minWidth={100}>Juros</Th>
                  <Th minWidth={100}>Multa</Th>
                  <Th minWidth={64}>Quitar</Th>
                </TableHead>

                <tbody>
                  {parcelas == null && (
                    <EmptyRow colSpan={9} message="Carregando…" />
                  )}
                  {parcelas != null && parcelas.length === 0 && (
                    <EmptyRow
                      colSpan={9}
                      message="Nenhuma parcela em aberto para este fornecedor."
                    />
                  )}

                  {(parcelas ?? []).map((p, n) => {
                    const d = destinos[p.parcelaId];

                    return (
                      <Tr key={p.parcelaId} delay={n * 12}>
                        <Td>
                          {/*
                            ⚠️ A fila é conferida por CONTA, e o servidor recusa
                            de novo. A trava aqui poupa a viagem e explica o
                            motivo; ela não é a regra, só o eco dela.
                          */}
                          <span
                            title={
                              p.liberada
                                ? undefined
                                : "Há parcela mais antiga em aberto nesta conta. Pague ela primeiro."
                            }
                          >
                            <MarcaDeUso
                              marcado={d != null}
                              desabilitado={!p.liberada && d == null}
                              rotulo={
                                d != null
                                  ? "Tirar esta parcela"
                                  : "Pagar esta parcela"
                              }
                              onClick={() => alternar(p)}
                            />
                          </span>
                        </Td>

                        <Td style={NUM}>
                          {/* A descricao da conta na dica: ela nao cabe numa
                              coluna aqui, e o numero sozinho nao diz de que
                              divida se trata. */}
                          <span title={p.contaDescricao ?? undefined}>
                            {p.contaNumero ?? p.contaId}
                          </span>
                        </Td>
                        <Td style={NUM}>
                          {p.numero}/{p.totalParcelas}
                        </Td>
                        <Td style={NUM}>
                          {p.vencimento
                            ? paraFormatoBR(p.vencimento as DataISO)
                            : "—"}
                        </Td>
                        <Td style={NUM}>
                          {formatarSemSimbolo(p.emAberto as Centavos)}
                        </Td>

                        <Td>
                          {d ? (
                            <CampoNumerico
                              valor={d.valor}
                              escala={100}
                              aoMudar={(v) =>
                                mudarDestino(p.parcelaId, { valor: v })
                              }
                            />
                          ) : (
                            <span style={{ color: "var(--text-disabled)" }}>
                              —
                            </span>
                          )}
                        </Td>

                        <Td>
                          {d ? (
                            <CampoNumerico
                              valor={d.juros}
                              escala={100}
                              aoMudar={(v) =>
                                mudarDestino(p.parcelaId, { juros: v })
                              }
                            />
                          ) : (
                            <span style={{ color: "var(--text-disabled)" }}>
                              —
                            </span>
                          )}
                        </Td>

                        <Td>
                          {d ? (
                            <CampoNumerico
                              valor={d.multa}
                              escala={100}
                              aoMudar={(v) =>
                                mudarDestino(p.parcelaId, { multa: v })
                              }
                            />
                          ) : (
                            <span style={{ color: "var(--text-disabled)" }}>
                              —
                            </span>
                          )}
                        </Td>

                        <Td>
                          {d ? (
                            <MarcaDeUso
                              marcado={d.quitar}
                              rotulo={
                                d.quitar
                                  ? "Não perdoar a diferença"
                                  : "Fechar a parcela perdoando a diferença"
                              }
                              onClick={() =>
                                mudarDestino(p.parcelaId, { quitar: !d.quitar })
                              }
                            />
                          ) : (
                            <span style={{ color: "var(--text-disabled)" }}>
                              —
                            </span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          </>
        )}
      </Formulario>
    </Drawer>
  );
}
