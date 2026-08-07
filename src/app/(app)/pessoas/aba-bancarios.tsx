"use client";

import { useCallback, useEffect, useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Button, CabecalhoDeSecao, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import type { DadoBancarioDaPessoa } from "@/modules/clientes/clientes.types";

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

export function AbaDeBancarios({ clienteId }: { clienteId: number }) {
  const { avisar } = useAvisos();

  const [itens, setItens] = useState<DadoBancarioDaPessoa[] | null>(null);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/v1/clientes/${clienteId}/bancarios`);
    if (!r.ok) return;

    const corpo = await r.json();
    setItens(corpo.data ?? []);
  }, [clienteId]);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

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
      <CabecalhoDeSecao
        primeiro
        colado
        titulo="Dados bancários"
        legenda="Para onde o pagamento sai, ou de onde a devolução vem. São dados de terceiro: não entram no fluxo de caixa nem na conciliação, servem para preencher o pagamento na hora certa."
        onIncluir={() => setNovo(true)}
        rotuloIncluir="Nova conta"
      />

      {itens == null ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Carregando…</p>
      ) : itens.length === 0 && !novo ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Nenhuma conta cadastrada.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {itens.map((d) => (
            <Cartao key={d.id} dado={d} onRemover={() => void remover(d.id)} />
          ))}
        </div>
      )}

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

function Cartao({ dado, onRemover }: { dado: DadoBancarioDaPessoa; onRemover: () => void }) {
  const conta = [
    dado.agencia && `Ag. ${dado.agencia}`,
    dado.conta && `Conta ${dado.conta}`,
    dado.tipo === "poupanca" ? "poupança" : dado.tipo === "corrente" ? "corrente" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "9px 11px",
        border: `1px solid ${dado.principal ? "var(--primary-border)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        background: dado.principal ? "var(--primary-subtle)" : "var(--surface)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-base)" }}>
          {dado.banco || <span style={{ color: "var(--text-tertiary)" }}>Sem banco</span>}
          {dado.principal && (
            <span
              style={{
                marginLeft: 7,
                fontSize: "var(--text-xs)",
                fontWeight: "var(--fw-semi)",
                color: "var(--primary)",
              }}
            >
              Principal
            </span>
          )}
        </div>

        {conta && (
          <div style={{ marginTop: 2, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {conta}
          </div>
        )}

        {/*
          A chave PIX numa linha própria: hoje ela é o dado que mais se copia, e
          espremida junto de agência e conta ela some no meio dos números.
        */}
        {dado.pixChave && (
          <div style={{ marginTop: 3, fontSize: "var(--text-xs)" }}>
            <span style={{ color: "var(--text-tertiary)" }}>
              PIX {PIX.find((p) => p.valor === dado.pixTipo)?.rotulo ?? ""}{" "}
            </span>
            <span style={{ color: "var(--text-primary)" }}>{dado.pixChave}</span>
          </div>
        )}

        {/*
          ⚠️ Titular só aparece quando é OUTRA pessoa. Repetir o nome do próprio
          cadastro em toda conta seria uma linha a mais dizendo o que já está no
          topo do drawer — e o que importa aqui é justamente o caso em que não
          bate, porque banco recusa depósito com titular diferente.
        */}
        {dado.titular && (
          <div style={{ marginTop: 3, fontSize: "var(--text-xs)", color: "var(--warning-text)" }}>
            Titular: {dado.titular}
            {dado.documento ? ` · ${dado.documento}` : ""}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemover}
        aria-label="Remover conta"
        title="Remover"
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--text-tertiary)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
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
