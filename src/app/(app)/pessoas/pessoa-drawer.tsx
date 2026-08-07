"use client";

import { useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Avatar } from "@/components/ui/avatar";
import {
  ActiveToggle,
  CabecalhoDeSecao,
  Field,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";

/**
 * Cadastro de pessoa: cliente, fornecedor ou colaborador.
 *
 * ⚠️ Os três papéis moram na mesma tabela com colunas booleanas — por isso a tela
 * pede papel em vez de existirem três cadastros separados. Uma transportadora que
 * também compra é UMA pessoa com dois papéis, e não duas fichas para manter em
 * sincronia.
 *
 * ⚠️ Em seções com legenda, como o drawer de configuração do WhatsApp. Uma pilha
 * de dez campos sem divisão obriga a ler tudo para achar um; agrupados, o olho
 * pula direto para o bloco certo. E a legenda responde a pergunta que o rótulo
 * sozinho não responde ("papéis de quê?").
 */

const PAPEIS: { valor: PapelPessoa; rotulo: string; explica: string }[] = [
  { valor: "cliente", rotulo: "Cliente", explica: "aparece em faturas e recebimentos" },
  { valor: "fornecedor", rotulo: "Fornecedor", explica: "aparece em contas a pagar" },
  { valor: "colaborador", rotulo: "Colaborador", explica: "aparece em despesas de equipe" },
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
    // vale mesmo quando a pessoa nasce fora desta tela.
    centroCustoId: cliente?.centroCustoId ? String(cliente.centroCustoId) : "",
    ativo: cliente?.ativo ?? true,
  };
}

export function PessoaDrawer({
  cliente,
  centros,
  aberto,
  onClose,
}: {
  /** null = novo cadastro. */
  cliente: Cliente | null;
  /** Centros de RECEITA da empresa — pessoa e origem de entrada. */
  centros: { id: number; descricao: string }[];
  aberto: boolean;
  onClose: () => void;
}) {
  // `key` no uso remonta o drawer a cada registro, entao o estado inicial ja
  // vem da pessoa certa e nao precisa de efeito para sincronizar.
  const [form, setForm] = useState<Form>(() => inicial(cliente));

  const editando = cliente !== null;
  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const titulo = form.razao.trim() || (editando ? "Sem nome" : "Nova pessoa");

  return (
    <FormDrawer
      aberto={aberto}
      onClose={onClose}
      titulo={editando ? titulo : "Nova pessoa"}
      subtitulo={editando ? `#${cliente.id}` : undefined}
      larguraDrawer={600}
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
      {/*
        A identidade em cima, com a bolinha.

        ⚠️ A mesma cor da lista. Quem clicou numa linha precisa reconhecer que
        abriu a que queria, e o título do drawer sozinho não faz isso: nomes de
        empresa em caixa alta se parecem todos, e a cor é o que diferencia sem
        ler.
      */}
      {editando && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 4,
          }}
        >
          <Avatar nome={titulo} semente={String(cliente.id)} tamanho={44} />

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--fw-semi)",
                letterSpacing: "var(--tracking-snug)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {titulo}
            </div>

            <div style={{ marginTop: 2, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              {form.papeis.length > 0
                ? form.papeis
                    .map((p) => PAPEIS.find((x) => x.valor === p)?.rotulo ?? p)
                    .join(" · ")
                : "Sem papel"}
              {!form.ativo && " · Inativo"}
            </div>
          </div>
        </header>
      )}

      <CabecalhoDeSecao
        primeiro
        colado
        titulo="Identificação"
        legenda="A razão social é o nome que sai nos documentos. O fantasia é o que a equipe usa para achar a pessoa, e é ele que aparece na listagem."
      />

      <Field label="Razão social" required>
        <input
          style={inputStyle}
          value={form.razao}
          onChange={(e) => set("razao", e.target.value)}
          placeholder="Nome completo ou razão social"
          autoFocus={!editando}
        />
      </Field>

      <Field label="Nome fantasia">
        <input
          style={inputStyle}
          value={form.nomeFantasia}
          onChange={(e) => set("nomeFantasia", e.target.value)}
          placeholder="Como a pessoa é conhecida"
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

      <CabecalhoDeSecao
        colado
        titulo="Contato"
        legenda="É por aqui que o sistema fala com a pessoa: a cobrança vai para o e-mail, e o telefone é o que casa esta pessoa com a conversa no WhatsApp."
      />

      <Field label="Responsável">
        <input
          style={inputStyle}
          value={form.responsavel}
          onChange={(e) => set("responsavel", e.target.value)}
          placeholder="Pessoa de contato"
        />
      </Field>

      <Field label="Telefone" hint="Com DDD. É por ele que a conversa do WhatsApp encontra este cadastro.">
        <input
          style={inputStyle}
          value={form.contato}
          onChange={(e) => set("contato", e.target.value)}
          placeholder="(00) 00000-0000"
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

      <CabecalhoDeSecao
        colado
        titulo="No sistema"
        legenda="Os papéis decidem em que telas esta pessoa aparece. Uma transportadora que também compra é um cadastro só, com dois papéis marcados."
      />

      <Field label="Papéis" required>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {PAPEIS.map((p) => (
            <Papel
              key={p.valor}
              papel={p}
              marcado={form.papeis.includes(p.valor)}
              onAlternar={() =>
                setForm((f) => ({
                  ...f,
                  papeis: f.papeis.includes(p.valor)
                    ? f.papeis.filter((x) => x !== p.valor)
                    : [...f.papeis, p.valor],
                }))
              }
            />
          ))}
        </div>
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

      {editando && (
        <Field label="Situação" hint="Inativo some da listagem e das buscas, mas o histórico continua inteiro.">
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: "var(--h-input)" }}>
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

/**
 * Um papel, com o que ele significa na prática.
 *
 * ⚠️ Linha inteira clicável, e não uma pastilha com o nome. "Fornecedor" sozinho
 * não diz o que muda ao marcar — e o que muda é em que telas a pessoa passa a
 * aparecer, que é justamente a dúvida de quem cadastra pela primeira vez.
 */
function Papel({
  papel,
  marcado,
  onAlternar,
}: {
  papel: (typeof PAPEIS)[number];
  marcado: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-pressed={marcado}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "7px 10px",
        border: `1px solid ${marcado ? "var(--primary-border)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        background: marcado ? "var(--primary-subtle)" : "var(--surface)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font)",
        transition: "background var(--dur-fast) var(--ease)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 15,
          height: 15,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: 4,
          border: `1px solid ${marcado ? "var(--primary)" : "var(--border-strong)"}`,
          background: marcado ? "var(--primary)" : "transparent",
          color: "var(--primary-fg)",
        }}
      >
        {marcado && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5.5 5.5L20 6.5" />
          </svg>
        )}
      </span>

      <span style={{ minWidth: 0, fontSize: "var(--text-base)" }}>
        <span style={{ fontWeight: marcado ? "var(--fw-semi)" : "var(--fw-normal)" }}>
          {papel.rotulo}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}> · {papel.explica}</span>
      </span>
    </button>
  );
}
