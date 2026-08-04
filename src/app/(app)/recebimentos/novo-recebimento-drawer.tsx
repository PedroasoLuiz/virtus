"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, CampoNumerico, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { filaDeRecebimento } from "@/shared/domain/parcelas";
import {
  acrescimoPorAtraso,
  SEM_COBRANCA,
  type ParametrosDeCobranca,
} from "@/shared/domain/cobranca";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { TIPOS_DE_RECEBIMENTO } from "@/modules/faturas/faturas.types";
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

type Valores = Record<number, { valor: number; juros: number; multa: number; quitar: boolean }>;

const VAZIO = { valor: 0, juros: 0, multa: 0, quitar: false };

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

  return { valor: parcela.emAberto, juros, multa, quitar: false };
}

export function NovoRecebimentoDrawer({
  clientes,
  clienteInicial,
  parcelaInicial,
  aoCriar,
  onClose,
}: {
  clientes: { id: number; nome: string }[];
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

  const [clienteId, setClienteId] = useState(clienteInicial ? String(clienteInicial) : "");
  const [data, setData] = useState<string>(hoje());
  const [tipo, setTipo] = useState<string>("PIX");
  const [contaId, setContaId] = useState("");
  const [observacoes, setObservacoes] = useState("");

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
        const sobra = p.total - p.recebido - preenchido.valor;
        // Esta ainda nao fechou: as seguintes continuam travadas.
        if (sobra > 0 && !preenchido.quitar) break;
      }
    }

    return livres;
  }, [parcelas, valores]);

  const destinos = parcelas
    .map((p) => ({ p, v: valores[p.parcelaId] ?? VAZIO }))
    .filter(({ v }) => v.valor > 0)
    .map(({ p, v }) => ({
      parcelaId: p.parcelaId,
      valor: v.valor,
      juros: v.juros,
      multa: v.multa,
      quitar: v.quitar,
    }));

  const abatido = destinos.reduce((s, d) => s + d.valor, 0) as Centavos;
  const acrescimo = destinos.reduce((s, d) => s + d.juros + d.multa, 0) as Centavos;
  const total = (abatido + acrescimo) as Centavos;

  function mudar(parcelaId: number, campo: keyof typeof VAZIO, valor: number | boolean) {
    setValores((atual) => ({
      ...atual,
      [parcelaId]: { ...(atual[parcelaId] ?? VAZIO), [campo]: valor },
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

  const contasDaLista = [...new Set(parcelas.map((p) => p.faturaId))];

  return (
    <Drawer
      open
      onClose={onClose}
      title="Registrar recebimento"
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Totais abatido={abatido} acrescimo={acrescimo} total={total} />

          <span style={{ flex: 1 }} />
          <Button
            size="sm"
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
            {salvando ? "Registrando…" : "Registrar recebimento"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 16 }}>
        <Field label="Cliente" required hint="De quem veio o dinheiro. Um pagamento é de um pagador só.">
          {/* Trocar de cliente zera a distribuicao: as parcelas sao outras, e um
              valor digitado para a parcela de outro cliente nao significa nada
              aqui. Fica no onChange e nao num efeito porque o reset e
              consequencia do gesto, nao do render. */}
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              setValores({});
            }}
            style={selectStyle}
          >
            <option value="">Escolher…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data" required hint="Quando o dinheiro entrou, não quando você lançou.">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={inputStyle} />
        </Field>

        <Field
          label="Forma"
          required
          hint="Lista fechada de propósito: no legado o mesmo PIX aparece com quatro grafias diferentes, e nenhum relatório consegue agrupar."
        >
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={selectStyle}>
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
      </div>

      {!clienteId ? (
        <Aviso>Escolha o cliente para ver o que ele tem em aberto.</Aviso>
      ) : carregando ? (
        <Aviso>Carregando as parcelas…</Aviso>
      ) : parcelas.length === 0 ? (
        <Aviso>Este cliente não tem parcela em aberto.</Aviso>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
              Para onde foi o dinheiro
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              Dentro de cada conta a ordem é a do vencimento: a parcela seguinte abre quando a
              anterior fecha.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {contasDaLista.map((faturaId) => (
              <div key={faturaId}>
                {/* O numero da conta encabeca o bloco: sem ele "parcela 1"
                    apareceria tres vezes na lista sem nada que as distinga. */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    paddingBottom: 5,
                    borderBottom: "1px solid var(--section-border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--fw-semi)",
                      letterSpacing: "var(--tracking-wide)",
                      color: "var(--section-title)",
                    }}
                  >
                    CONTA {faturaId}
                  </span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                    {formatarSemSimbolo(
                      parcelas
                        .filter((p) => p.faturaId === faturaId)
                        .reduce((s, p) => s + p.emAberto, 0) as Centavos,
                    )}{" "}
                    em aberto
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {parcelas
                    .filter((p) => p.faturaId === faturaId)
                    .map((p) => (
                      <LinhaParcela
                        key={p.parcelaId}
                        parcela={p}
                        estado={valores[p.parcelaId] ?? VAZIO}
                        liberada={liberadas.has(p.parcelaId)}
                        aoMudar={(campo, v) => mudar(p.parcelaId, campo, v)}
                        aoPreencher={() =>
                          setValores((atual) => ({
                            ...atual,
                            [p.parcelaId]: preencher(p, carga.cobranca, data),
                          }))
                        }
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
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

/**
 * Uma parcela candidata a receber.
 *
 * Juros e multa so aparecem depois que a linha tem valor: com quinze parcelas na
 * tela, tres campos em cada uma viram um paredao, e o acrescimo e a excecao, nao
 * a regra. Assim que a pessoa se compromete com a linha, os tres campos estao la.
 */
function LinhaParcela({
  parcela,
  estado,
  liberada,
  aoMudar,
  aoPreencher,
}: {
  parcela: ParcelaEmAberto;
  estado: { valor: number; juros: number; multa: number; quitar: boolean };
  liberada: boolean;
  aoMudar: (campo: "valor" | "juros" | "multa" | "quitar", v: number | boolean) => void;
  /** Preenche a linha inteira: o que falta mais o acréscimo sugerido. */
  aoPreencher: () => void;
}) {
  const atrasada = parcela.vencimento != null && parcela.vencimento < hoje();
  const diferenca = estado.valor > 0 ? parcela.emAberto - estado.valor : 0;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        background: liberada ? "var(--surface)" : "var(--surface-2)",
        opacity: liberada ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-wide)",
            color: "var(--text-secondary)",
          }}
        >
          PARCELA {parcela.numero}
          {parcela.totalParcelas > 0 && ` DE ${parcela.totalParcelas}`}
        </span>

        <span
          style={{
            fontSize: "var(--text-sm)",
            color: atrasada ? "var(--danger-text)" : "var(--text-tertiary)",
            fontWeight: atrasada ? "var(--fw-medium)" : 400,
          }}
        >
          vence {parcela.vencimento ? paraFormatoBR(parcela.vencimento as DataISO) : "—"}
        </span>

        <span style={{ flex: 1 }} />

        {parcela.recebido > 0 && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            já entrou {formatarSemSimbolo(parcela.recebido as Centavos)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          disabled={!liberada}
          title={
            liberada
              ? "Preencher com tudo o que falta"
              : "A parcela anterior desta conta ainda está em aberto"
          }
          onClick={aoPreencher}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font)",
            cursor: liberada ? "pointer" : "not-allowed",
          }}
        >
          Em aberto{" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatarSemSimbolo(parcela.emAberto as Centavos)}
          </strong>
        </button>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Recebi</span>
        <div style={{ width: 130 }}>
          <CampoNumerico
            valor={estado.valor}
            escala={100}
            aoMudar={(v) => aoMudar("valor", liberada ? Math.min(v, parcela.emAberto) : 0)}
          />
        </div>
      </div>

      {estado.valor > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Juros e multa NAO abatem a divida: entram no caixa por cima do
              valor. Por isso ficam depois do "Recebi", e nao no lugar dele. */}
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Juros</span>
          <div style={{ width: 100 }}>
            <CampoNumerico valor={estado.juros} escala={100} aoMudar={(v) => aoMudar("juros", v)} />
          </div>

          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Multa</span>
          <div style={{ width: 100 }}>
            <CampoNumerico valor={estado.multa} escala={100} aoMudar={(v) => aoMudar("multa", v)} />
          </div>

          <span style={{ flex: 1 }} />

          {(estado.juros > 0 || estado.multa > 0) && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              entra{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatarSemSimbolo((estado.valor + estado.juros + estado.multa) as Centavos)}
              </strong>
            </span>
          )}
        </div>
      )}

      {/*
       * A pergunta que o sistema nao pode responder sozinho.
       *
       * Recebi 500 de 510: os 10 continuam devidos, ou eu abri mao? As duas
       * respostas sao legitimas, e so quem recebeu sabe. O padrao e deixar em
       * aberto — perdoar divida por omissao seria a escolha errada de fazer
       * sozinho.
       */}
      {diferenca > 0 && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={estado.quitar}
            onChange={(e) => aoMudar("quitar", e.target.checked)}
            style={{ accentColor: "var(--primary)", cursor: "pointer" }}
          />
          Quitar e dar {formatarSemSimbolo(diferenca as Centavos)} de desconto
        </label>
      )}
    </div>
  );
}

/**
 * O que entrou no banco, com a composicao ao lado.
 *
 * O numero grande e o TOTAL, porque e ele que precisa bater com o extrato. O
 * abatimento e o acrescimo aparecem menores: explicam o total, nao competem com
 * ele.
 */
function Totais({
  abatido,
  acrescimo,
  total,
}: {
  abatido: Centavos;
  acrescimo: Centavos;
  total: Centavos;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
      <div>
        <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
          Entrando
        </div>
        <div
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--fw-semi)",
            fontVariantNumeric: "tabular-nums",
            color: total > 0 ? "var(--credito)" : "var(--text-tertiary)",
          }}
        >
          {formatarSemSimbolo(total)}
        </div>
      </div>

      {acrescimo > 0 && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          <div>
            dívida{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatarSemSimbolo(abatido)}
            </strong>
          </div>
          <div>
            acréscimo{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatarSemSimbolo(acrescimo)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
