"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoNumerico,
  Field,
  GrupoDeCampos,
  SeletorBuscavel,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { hoje } from "@/shared/utils/datas";
import type { CartaoDaBaixa } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Uma compra lançada NO CARTÃO.
 *
 * ⚠️ Ela não passa por conta a pagar, e essa é a diferença que importa.
 *
 * `cartaofaturasparcelas` carrega fornecedor, descrição, data, valor e centro de
 * custo próprios: a linha É a despesa, e a DRE a lê pela competência do ciclo e
 * pelo centro dela. Passar por conta a pagar criaria um título para uma dívida
 * que ainda não existe — a dívida nasce quando a fatura fecha, e é uma só.
 *
 * ⚠️ O CICLO é escolhido pelo servidor, a partir do dia de fechamento do cartão.
 * Não há campo de competência aqui de propósito: quem sabe em que fatura uma
 * compra do dia 13 cai é a regra do cartão, não quem digita.
 */
export function CompraDrawer({
  cartao,
  competenciaInicial,
  onClose,
  aoLancar,
}: {
  cartao: CartaoDaBaixa;
  /**
   * O ciclo de onde a compra foi lançada.
   *
   * ⚠️ Quando vem preenchido, a primeira parcela cai NELE — quem abriu a fatura
   * de junho e clicou em lançar já disse em qual ciclo aquilo entra. Recalcular
   * pela data jogaria a compra para outra fatura, e o lançamento sumiria da tela
   * em que a pessoa estava.
   */
  competenciaInicial?: string;
  onClose: () => void;
  aoLancar: () => void;
}) {
  const { avisar } = useAvisos();

  const [fornecedor, setFornecedor] = useState<{ id: number; nome: string } | null>(null);
  const [descricao, setDescricao] = useState("");
  const [dataCompra, setDataCompra] = useState<string>(hoje());
  const [valor, setValor] = useState(0);
  const [parcelas, setParcelas] = useState(1);
  const [centroCustoId, setCentroCustoId] = useState("");
  const [centros, setCentros] = useState<{ id: number; descricao: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/centro-custo", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setCentros((corpo.data ?? []) as { id: number; descricao: string }[]);
      })
      .catch(() => {
        // Silencioso: sem a lista a compra nasce sem centro, que é permitido.
        // Um aviso assustaria sobre algo que não impede de salvar.
      });

    return () => controle.abort();
  }, []);

  const buscarFornecedor = useCallback(async (termo: string) => {
    const p = new URLSearchParams({
      page: "1",
      perPage: "15",
      papel: "fornecedor",
      ativo: "true",
    });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();
    return (
      (corpo.data ?? []) as { id: number; razao: string; nomeFantasia: string | null }[]
    ).map((c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch(`/api/v1/contas-pagar/cartoes/${cartao.id}/compras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fornecedorId: fornecedor?.id,
          descricao: descricao.trim(),
          dataCompra,
          valor,
          centroCustoId: centroCustoId ? Number(centroCustoId) : null,
          parcelas,
          competenciaInicial,
        }),
      });

      if (!r.ok) {
        const dados = await r.json().catch(() => null);
        // `details` traz o campo que o Zod recusou; só "Dados inválidos"
        // obrigaria o usuário a adivinhar qual.
        const detalhe = dados?.error?.details?.[0];
        avisar(
          "erro",
          "Não foi possível lançar a compra",
          detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : dados?.error?.message,
        );
        return;
      }

      avisar(
        "sucesso",
        "Compra lançada",
        parcelas > 1 ? `${parcelas} parcelas, uma por ciclo do cartão.` : undefined,
      );
      aoLancar();
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = fornecedor != null && descricao.trim().length > 0 && valor > 0;

  return (
    <Drawer
      open
      /* Nível 3: abre de dentro do drawer de faturas, que já é nível 2. */
      nivel={3}
      onClose={onClose}
      title="Nova compra"
      subtitle={cartao.apelido ?? `Cartão ${cartao.id}`}
      acoes={
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="xs" variant="primary" onClick={salvar} disabled={!podeSalvar || salvando}>
            {salvando ? "Lançando…" : "Lançar"}
          </Button>
          <Button size="xs" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
        </div>
      }
    >
      <GrupoDeCampos
        primeiro
        titulo="O que foi comprado"
        legenda="Esta linha é a despesa: ela entra na DRE pelo centro de custo escolhido aqui, na competência do ciclo em que a compra cair."
      >
        <Field label="Fornecedor" required>
          <SeletorBuscavel
            valor={fornecedor?.id ?? null}
            rotulo={fornecedor?.nome ?? null}
            aoEscolher={setFornecedor}
            buscar={buscarFornecedor}
            placeholder="Quem recebeu"
          />
        </Field>

        <Field label="Descrição" required>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que foi comprado"
            maxLength={255}
            style={inputStyle}
          />
        </Field>

        <Field
          label="Data da compra"
          hint={
            competenciaInicial
              ? "A compra entra no ciclo que você abriu. A data serve para o histórico."
              : `Depois do dia ${cartao.diaFechamento} entra no ciclo seguinte. Data retroativa é permitida e cai no ciclo dela.`
          }
        >
          <input
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Valor total" required>
          <CampoNumerico valor={valor} aoMudar={setValor} escala={100} casas={2} />
        </Field>

        <Field
          label="Parcelas"
          hint="Cada parcela cai num ciclo diferente — uma despesa por mês, e não tudo neste."
        >
          <CampoNumerico valor={parcelas} aoMudar={setParcelas} escala={1} casas={0} />
        </Field>

        <Field label="Centro de custo">
          <select
            value={centroCustoId}
            onChange={(e) => setCentroCustoId(e.target.value)}
            style={selectStyle}
          >
            <option value="">Sem centro</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao}
              </option>
            ))}
          </select>
        </Field>
      </GrupoDeCampos>
    </Drawer>
  );
}
