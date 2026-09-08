"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  CampoNumerico,
  Field,
  GrupoDeCampos,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { Drawer } from "@/components/ui/drawer";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { hoje } from "@/shared/utils/datas";
import type { ContaBancaria } from "@/modules/contas/contas.types";

/**
 * Uma transferencia entre contas da propria empresa.
 *
 * ⚠️ NAO e um recebimento nem um pagamento. Nada entra ou sai da empresa: o
 * dinheiro troca de conta. Por isso nao ha cliente, fornecedor nem centro de
 * custo aqui — nenhum dos tres faz sentido, e um campo de centro nesta tela
 * convidaria a classificar como despesa o que e so mudanca de lugar.
 */
export function NovaMovimentacao({
  contas,
  onClose,
  aoCriar,
}: {
  contas: ContaBancaria[];
  onClose: () => void;
  aoCriar: () => Promise<void>;
}) {
  const [data, setData] = useState<string>(hoje());
  const [valor, setValor] = useState(0);
  const [origemId, setOrigemId] = useState<number | null>(null);
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /*
    ⚠️ Só conta ATIVA pode receber ou mandar.

    Conta inativa é a que saiu de uso; movimentar para dentro dela criaria saldo
    num lugar que ninguém mais confere. Ela continua aparecendo no extrato e nos
    relatórios do passado — o que se barra é o movimento novo.
  */
  const disponiveis = contas.filter((c) => c.ativo);

  const origem = disponiveis.find((c) => c.id === origemId) ?? null;
  const destino = disponiveis.find((c) => c.id === destinoId) ?? null;

  const mesmaConta = origemId != null && origemId === destinoId;

  /*
    ⚠️ O disponível é saldo MAIS limite, e não só o saldo.

    O limite é dinheiro que a conta pode usar: quem tem 5.000 de cheque especial
    e 1.000 de saldo pode transferir 5.500 e ficar negativo, que é o que o banco
    permite. Barrar pelo saldo recusaria uma operação legítima.

    ⚠️ `saldo` é nulo na LISTAGEM de contas — a `vwsaldo` varre `pagamentos`
    inteiro e pedir o saldo de todas custaria caro. Sem ele, a tela não trava:
    quem recusa é o servidor, que lê o saldo de verdade. Aqui é só o aviso
    antecipado.
  */
  const disponivel =
    origem?.saldo != null ? origem.saldo + origem.limite : null;
  const estoura = disponivel != null && valor > disponivel;

  const podeSalvar =
    origemId != null &&
    destinoId != null &&
    !mesmaConta &&
    !estoura &&
    valor > 0 &&
    !salvando;

  async function salvar() {
    setSalvando(true);
    setErro(null);

    try {
      const r = await fetch("/api/v1/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          valor,
          origemId,
          destinoId,
          observacoes: observacoes.trim() || null,
        }),
      });

      if (!r.ok) {
        const corpo = await r.json().catch(() => null);
        setErro(corpo?.error?.message ?? "Não foi possível criar a movimentação");
        return;
      }

      await aoCriar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Nova movimentação"
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" onClick={() => void salvar()} disabled={!podeSalvar}>
            {salvando ? "Gravando…" : "Transferir"}
          </Button>
          <Button onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
        </div>
      }
    >
      <GrupoDeCampos
        primeiro
        titulo="De onde para onde"
        legenda="As duas pontas nascem juntas, com a mesma data e o mesmo valor. Nenhuma delas conta como receita ou despesa."
      >
        {erro && <Alert variant="warning">{erro}</Alert>}

        <Field label="Conta de origem" required>
          <select
            value={origemId ?? ""}
            onChange={(e) => setOrigemId(e.target.value ? Number(e.target.value) : null)}
            style={selectStyle}
          >
            <option value="">Escolha a conta</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Conta de destino"
          required
          /*
            ⚠️ O aviso da mesma conta aparece AQUI, e não como erro do servidor.

            Transferir de uma conta para ela mesma grava duas linhas que se
            anulam: o saldo não muda e o extrato ganha duas conferências a fazer
            sem nada que as explique. O servidor recusa de qualquer forma; a tela
            diz antes.
          */
          hint={mesmaConta ? "A conta de destino precisa ser diferente da origem." : undefined}
        >
          <select
            value={destinoId ?? ""}
            onChange={(e) => setDestinoId(e.target.value ? Number(e.target.value) : null)}
            style={selectStyle}
          >
            <option value="">Escolha a conta</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data" required>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field
          label="Valor"
          required
          /*
            ⚠️ O teto aparece ANTES de tentar gravar, e diz de quanto ele é.

            O servidor recusa de qualquer forma — ele lê o saldo de verdade, e o
            corpo vem do navegador. Mas descobrir o limite pelo erro é descobrir
            tarde: a pessoa já digitou o valor, a data e a observação.
          */
          hint={
            estoura && disponivel != null
              ? `A origem tem ${formatarSemSimbolo(disponivel as never)} disponível, somando saldo e limite.`
              : undefined
          }
        >
          <CampoNumerico valor={valor} aoMudar={setValor} escala={100} casas={2} />
        </Field>

        <Field
          label="Observações"
          hint="Aparece no extrato das duas contas, junto do histórico."
        >
          <input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Para que serviu"
            maxLength={300}
            style={inputStyle}
          />
        </Field>

        {/*
          ⚠️ O resumo do que vai acontecer, escrito por extenso.

          São duas linhas em duas contas, e a pessoa só vê uma tela. Sem dizer o
          que vai ser gravado, a diferença entre origem e destino se descobre
          depois — no extrato, quando o saldo andou para o lado errado.
        */}
        {origem && destino && !mesmaConta && valor > 0 && (
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            Saem <strong>{formatarSemSimbolo(valor as never)}</strong> de{" "}
            <strong>{origem.nome}</strong> e entram em{" "}
            <strong>{destino.nome}</strong>. O saldo da empresa não muda.
          </p>
        )}
      </GrupoDeCampos>
    </Drawer>
  );
}
