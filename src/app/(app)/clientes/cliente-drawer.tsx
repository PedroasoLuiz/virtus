"use client";

import { useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { ActiveToggle, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";

/**
 * Cadastro de cliente / fornecedor / colaborador.
 *
 * Os tres papeis moram na mesma tabela com flags booleanas — por isso a tela
 * pede papel em vez de ter tres cadastros separados.
 */

const PAPEIS: { valor: PapelPessoa; rotulo: string }[] = [
  { valor: "cliente", rotulo: "Cliente" },
  { valor: "fornecedor", rotulo: "Fornecedor" },
  { valor: "colaborador", rotulo: "Colaborador" },
];

type Form = {
  razao: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  contato: string;
  responsavel: string;
  papeis: PapelPessoa[];
  centroCustoId: string;
  ativo: boolean;
};

function inicial(cliente: Cliente | null): Form {
  return {
    razao: cliente?.razao ?? "",
    nomeFantasia: cliente?.nomeFantasia ?? "",
    cnpj: cliente?.cnpj ?? "",
    email: cliente?.email ?? "",
    contato: cliente?.contato ?? "",
    responsavel: cliente?.responsavel ?? "",
    papeis: cliente?.papeis ?? ["cliente"],
    // Vazio num cadastro novo: quem escolhe o padrao e o banco, e o "Geral"
    // vale mesmo quando o cliente nasce fora desta tela.
    centroCustoId: cliente?.centroCustoId ? String(cliente.centroCustoId) : "",
    ativo: cliente?.ativo ?? true,
  };
}

export function ClienteDrawer({
  cliente,
  centros,
  aberto,
  onClose,
}: {
  /** null = novo cadastro. */
  cliente: Cliente | null;
  /** Centros de RECEITA da empresa — cliente e origem de entrada. */
  centros: { id: number; descricao: string }[];
  aberto: boolean;
  onClose: () => void;
}) {
  // `key` no uso remonta o drawer a cada registro, entao o estado inicial ja
  // vem do cliente certo e nao precisa de efeito para sincronizar.
  const [form, setForm] = useState<Form>(() => inicial(cliente));

  const editando = cliente !== null;
  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  function alternarPapel(papel: PapelPessoa) {
    setForm((f) => ({
      ...f,
      papeis: f.papeis.includes(papel)
        ? f.papeis.filter((p) => p !== papel)
        : [...f.papeis, papel],
    }));
  }

  return (
    <FormDrawer
      aberto={aberto}
      onClose={onClose}
      titulo={editando ? form.razao || "Cliente" : "Novo cadastro"}
      subtitulo={editando ? `#${cliente.id}` : undefined}
      url={editando ? `/api/v1/clientes/${cliente.id}` : "/api/v1/clientes"}
      metodo={editando ? "PATCH" : "POST"}
      podeSalvar={form.razao.trim().length > 0 && form.papeis.length > 0}
      valores={() => ({
        razao: form.razao.trim(),
        nomeFantasia: form.nomeFantasia.trim() || null,
        // Campo opcional vazio vai como null: string vazia falharia na
        // validacao de CNPJ e no formato de e-mail.
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        email: form.email.trim() || null,
        contato: form.contato.trim() || null,
        responsavel: form.responsavel.trim() || null,
        papeis: form.papeis,
        centroCustoId: form.centroCustoId ? Number(form.centroCustoId) : null,
        ...(editando ? { ativo: form.ativo } : {}),
      })}
    >
      <Field label="Razão social" required>
        <input
          style={inputStyle}
          value={form.razao}
          onChange={(e) => set("razao", e.target.value)}
          placeholder="Razão social"
          autoFocus
        />
      </Field>

      <Field label="Nome fantasia">
        <input
          style={inputStyle}
          value={form.nomeFantasia}
          onChange={(e) => set("nomeFantasia", e.target.value)}
          placeholder="Como o cliente é conhecido"
        />
      </Field>

      <Field label="CNPJ / CPF" hint="Somente números; deixe vazio se não tiver">
        <input
          style={inputStyle}
          value={form.cnpj}
          onChange={(e) => set("cnpj", e.target.value)}
          placeholder="00.000.000/0000-00"
        />
      </Field>

      <Field label="Responsável">
        <input
          style={inputStyle}
          value={form.responsavel}
          onChange={(e) => set("responsavel", e.target.value)}
          placeholder="Pessoa de contato"
        />
      </Field>

      <Field label="E-mail">
        <input
          style={inputStyle}
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="financeiro@empresa.com.br"
        />
      </Field>

      <Field label="Telefone">
        <input
          style={inputStyle}
          value={form.contato}
          onChange={(e) => set("contato", e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </Field>

      <Field label="Centro de custo" hint="Padrão: Geral">
        <select
          value={form.centroCustoId}
          onChange={(e) => set("centroCustoId", e.target.value)}
          style={{ ...selectStyle, width: "100%" }}
        >
          <option value="">Geral (padrão)</option>
          {centros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.descricao}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Papéis" required>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PAPEIS.map((p) => {
            const marcado = form.papeis.includes(p.valor);
            return (
              <button
                key={p.valor}
                type="button"
                onClick={() => alternarPapel(p.valor)}
                aria-pressed={marcado}
                style={{
                  height: 26,
                  padding: "0 10px",
                  borderRadius: "var(--radius-full)",
                  border: `1px solid ${marcado ? "var(--primary-border)" : "var(--border-strong)"}`,
                  background: marcado ? "var(--primary-subtle)" : "var(--surface)",
                  color: marcado ? "var(--primary)" : "var(--text-secondary)",
                  fontSize: "var(--text-sm)",
                  fontWeight: marcado ? "var(--fw-medium)" : 400,
                  fontFamily: "var(--font)",
                  cursor: "pointer",
                }}
              >
                {p.rotulo}
              </button>
            );
          })}
        </div>
      </Field>

      {editando && (
        <Field label="Situação">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ActiveToggle active={form.ativo} onChange={() => set("ativo", !form.ativo)} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {form.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </Field>
      )}
    </FormDrawer>
  );
}
