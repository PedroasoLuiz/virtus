"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  GrupoDeCampos,
  MarcaDePrincipal,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import type { DadoBancarioDaPessoa } from "@/modules/clientes/clientes.types";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Para onde o dinheiro desta pessoa vai.
 *
 * ⚠️ Não é conta bancária da EMPRESA. Aquelas têm saldo, limite e extrato, e
 * entram no fluxo de caixa; estas são dado de terceiro, para preencher um
 * pagamento — e nunca para conciliar. Por isso não há valor nenhum aqui.
 */

const PIX = [
  { valor: "cpf", rotulo: "CPF" },
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "aleatoria", rotulo: "Chave aleatória" },
];

export function AbaDeBancarios({
  clienteId,
  cache,
}: {
  clienteId: number;
  cache: CacheDoDrawer;
}) {
  const { avisar } = useAvisos();
  const [novo, setNovo] = useState(false);

  const { dados: itens, recarregar: carregar } = useRecursoDaPessoa<DadoBancarioDaPessoa[]>(
    cache,
    "bancarios",
    `/api/v1/clientes/${clienteId}/bancarios`,
  );

  async function remover(id: number) {
    const r = await fetch(`/api/v1/clientes/${clienteId}/bancarios/${id}`, { method: "DELETE" });

    if (!r.ok) {
      avisar("atencao", "Não foi possível remover");
      return;
    }

    void carregar();
  }

  return (
    <>
      <GrupoDeCampos
        primeiro
        titulo="Dados bancários"
        legenda="Para onde o pagamento sai, ou de onde a devolução vem. São dados de terceiro: não entram no fluxo de caixa nem na conciliação, servem para preencher o pagamento na hora certa."
        onIncluir={novo ? undefined : () => setNovo(true)}
        rotuloIncluir="Nova conta"
      >
        <TableArea minWidth={0}>
          <TableHead>
            <Th>Banco</Th>
            <Th minWidth={150}>Conta</Th>
            <Th minWidth={170}>PIX</Th>
            <Th align="center" minWidth={90}>
              Principal
            </Th>
            <Th> </Th>
          </TableHead>

          <tbody>
            {itens == null ? (
              <EmptyRow colSpan={5} message="Carregando…" />
            ) : itens.length === 0 ? (
              <EmptyRow colSpan={5} message="Nenhuma conta cadastrada." />
            ) : (
              itens.map((d) => <Linha key={d.id} dado={d} onRemover={() => void remover(d.id)} />)
            )}
          </tbody>
        </TableArea>
      </GrupoDeCampos>

      {novo && (
        <Formulario
          clienteId={clienteId}
          primeiro={(itens ?? []).length === 0}
          onFechar={() => setNovo(false)}
          onSalvou={() => {
            setNovo(false);
            void carregar();
          }}
        />
      )}
    </>
  );
}

function Linha({ dado, onRemover }: { dado: DadoBancarioDaPessoa; onRemover: () => void }) {
  const conta = [dado.agencia && `Ag. ${dado.agencia}`, dado.conta].filter(Boolean).join(" · ");

  return (
    <Tr>
      <Td>
        {dado.banco || <span style={{ color: "var(--text-disabled)" }}>Sem banco</span>}

        {/*
          ⚠️ Titular só aparece quando é OUTRA pessoa, e em âmbar. Repetir o nome
          do próprio cadastro em toda linha seria dizer o que já está no topo do
          drawer — e o que importa é justamente o caso em que não bate, porque
          banco recusa depósito com titular diferente.
        */}
        {dado.titular && (
          <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--warning-text)" }}>
            Titular: {dado.titular}
          </div>
        )}
      </Td>

      <Td>
        <div>{conta || <span style={{ color: "var(--text-disabled)" }}>—</span>}</div>
        {dado.tipo && (
          <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {dado.tipo === "poupanca" ? "Poupança" : "Corrente"}
          </div>
        )}
      </Td>

      <Td style={{ maxWidth: 200 }}>
        {dado.pixChave ? (
          <>
            <div
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={dado.pixChave}
            >
              {dado.pixChave}
            </div>
            {dado.pixTipo && (
              <div
                style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}
              >
                {PIX.find((p) => p.valor === dado.pixTipo)?.rotulo ?? dado.pixTipo}
              </div>
            )}
          </>
        ) : (
          <span style={{ color: "var(--text-disabled)" }}>—</span>
        )}
      </Td>

      <Td style={{ textAlign: "center" }}>
        {/*
          Aqui a marca é só LEITURA: trocar o principal exige saber para onde o
          pagamento passa a ir, e um clique de passagem numa coluna de conta
          bancária é fácil demais de dar sem querer.
        */}
        <MarcaDePrincipal
          marcado={dado.principal}
          rotulo={dado.principal ? "É a conta principal" : "Não é a principal"}
          onClick={() => {}}
        />
      </Td>

      <Td>
        <AcoesDaLinha>
          <BotaoDeAcao rotulo="Remover" perigo onClick={onRemover}>
            <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
          </BotaoDeAcao>
        </AcoesDaLinha>
      </Td>
    </Tr>
  );
}

function Formulario({
  clienteId,
  primeiro,
  onFechar,
  onSalvou,
}: {
  clienteId: number;
  primeiro: boolean;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();

  const [form, setForm] = useState({
    banco: "",
    agencia: "",
    conta: "",
    tipo: "corrente",
    titular: "",
    documento: "",
    pixTipo: "",
    pixChave: "",
    principal: primeiro,
  });

  const [salvando, setSalvando] = useState(false);

  const set = (campo: keyof typeof form, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/bancarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        banco: form.banco.trim() || null,
        agencia: form.agencia.trim() || null,
        conta: form.conta.trim() || null,
        tipo: form.tipo || null,
        titular: form.titular.trim() || null,
        documento: form.documento.trim() || null,
        // Sem chave não há tipo: o par só faz sentido junto, e gravar o tipo
        // sozinho deixaria "PIX CPF" escrito sem CPF nenhum embaixo.
        pixTipo: form.pixChave.trim() ? form.pixTipo || null : null,
        pixChave: form.pixChave.trim() || null,
        principal: form.principal,
      }),
    });

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      const detalhe = corpo?.error?.details?.[0];

      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível salvar"),
      );
      return;
    }

    onSalvou();
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Field label="Banco">
        <input
          style={inputStyle}
          value={form.banco}
          onChange={(e) => set("banco", e.target.value)}
          placeholder="Nome ou número do banco"
          autoFocus
        />
      </Field>

      <Field label="Agência / Conta">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={form.agencia}
            onChange={(e) => set("agencia", e.target.value)}
            placeholder="Agência"
          />
          <input
            style={{ ...inputStyle, flex: 2 }}
            value={form.conta}
            onChange={(e) => set("conta", e.target.value)}
            placeholder="Conta com dígito"
          />
          <select
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
            aria-label="Tipo de conta"
          >
            <option value="corrente">Corrente</option>
            <option value="poupanca">Poupança</option>
          </select>
        </div>
      </Field>

      <Field label="PIX">
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={form.pixTipo}
            onChange={(e) => set("pixTipo", e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
            aria-label="Tipo da chave PIX"
          >
            <option value="">Tipo</option>
            {PIX.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>

          <input
            style={{ ...inputStyle, flex: 2 }}
            value={form.pixChave}
            onChange={(e) => set("pixChave", e.target.value)}
            placeholder="Chave"
          />
        </div>
      </Field>

      {/*
        ⚠️ Titular só quando é OUTRA pessoa, e a dica diz por quê. Banco recusa
        depósito com titular diferente do que está na ordem, e essa é a hora de
        registrar a diferença — não a hora de repetir o nome do cadastro.
      */}
      <Field
        label="Titular"
        hint="Só quando a conta é de outra pessoa. Em branco, o titular é o próprio cadastro."
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 2 }}
            value={form.titular}
            onChange={(e) => set("titular", e.target.value)}
            placeholder="Nome do titular"
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={form.documento}
            onChange={(e) => set("documento", e.target.value)}
            placeholder="CPF / CNPJ"
          />
        </div>
      </Field>

      {!primeiro && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.principal}
            onChange={(e) => setForm((f) => ({ ...f, principal: e.target.checked }))}
          />
          Usar como principal
        </label>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}
