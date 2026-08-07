"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Avatar } from "@/components/ui/avatar";
import { ActiveToggle, Button, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";

/**
 * A ficha da pessoa, na coluna da direita.
 *
 * ⚠️ Substitui o drawer. O cadastro é o CONTEÚDO desta tela, não um formulário
 * que ela abre: com o drawer, ver um telefone custava abrir, ler e fechar, e
 * comparar dois cadastros era impossível. Ao lado da lista, trocar de pessoa é
 * um clique e a ficha simplesmente troca.
 *
 * ⚠️ Sem caixas em volta das seções. O que separa uma da outra é a RÉGUA sob o
 * título e o espaço em branco, como no App Store Connect. Molduras aninhadas
 * (cartão, seção, campo) foi a primeira tentativa, e o resultado parecia
 * formulário empilhado em vez de ficha.
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

function inicial(pessoa: Cliente | null): Form {
  return {
    razao: pessoa?.razao ?? "",
    nomeFantasia: pessoa?.nomeFantasia ?? "",
    cnpj: pessoa?.cnpj ?? "",
    email: pessoa?.email ?? "",
    contato: pessoa?.contato ?? "",
    responsavel: pessoa?.responsavel ?? "",
    papeis: pessoa?.papeis ?? ["cliente"],
    // Vazio num cadastro novo: quem escolhe o padrão é o banco, e o "Geral" vale
    // mesmo quando a pessoa nasce fora desta tela.
    centroCustoId: pessoa?.centroCustoId ? String(pessoa.centroCustoId) : "",
    ativo: pessoa?.ativo ?? true,
  };
}

export function FichaDaPessoa({
  pessoa,
  centros,
  onSalvou,
  onCancelarNovo,
}: {
  /** null = cadastro novo. */
  pessoa: Cliente | null;
  /** Centros de RECEITA da empresa: pessoa é origem de entrada. */
  centros: { id: number; descricao: string }[];
  onSalvou: () => void;
  onCancelarNovo: () => void;
}) {
  const { avisar } = useAvisos();

  // `key` no uso remonta a ficha a cada pessoa, então o estado inicial já vem da
  // certa e não precisa de efeito para sincronizar.
  const [form, setForm] = useState<Form>(() => inicial(pessoa));
  const [salvando, setSalvando] = useState(false);

  const editando = pessoa !== null;
  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /*
   * ⚠️ Nada é salvo sozinho.
   *
   * Salvar a cada tecla parece elegante e é perigoso num cadastro: apagar o CNPJ
   * para redigitar gravaria o vazio no meio do caminho, e um clique errado na
   * lista sairia da ficha com metade da alteração no banco. A barra só aparece
   * quando há diferença, então ela não fica pedindo atenção à toa.
   */
  const mudou = JSON.stringify(form) !== JSON.stringify(inicial(pessoa));
  const podeSalvar = form.razao.trim().length > 0 && form.papeis.length > 0 && mudou;

  async function salvar() {
    if (!podeSalvar || salvando) return;

    setSalvando(true);

    const r = await fetch(editando ? `/api/v1/clientes/${pessoa.id}` : "/api/v1/clientes", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razao: form.razao.trim(),
        nomeFantasia: form.nomeFantasia.trim() || null,
        // Campo opcional vazio vai como null: string vazia falharia na validação
        // de CNPJ e no formato de e-mail.
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        email: form.email.trim() || null,
        contato: form.contato.trim() || null,
        responsavel: form.responsavel.trim() || null,
        papeis: form.papeis,
        centroCustoId: form.centroCustoId ? Number(form.centroCustoId) : null,
        ...(editando ? { ativo: form.ativo } : {}),
      }),
    });

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível salvar");
      return;
    }

    avisar("sucesso", editando ? "Cadastro atualizado." : "Cadastro criado.");
    onSalvou();
  }

  const titulo = form.razao.trim() || (editando ? "Sem nome" : "Novo cadastro");

  /*
   * A linha de apoio do cabeçalho, separada por ponto.
   *
   * ⚠️ Papel entra aqui como TEXTO, e não como pastilha colorida. São até três,
   * e três pastilhas verdes embaixo de um nome grande brigam com ele: a linha
   * cinza diz a mesma coisa e deixa o nome ser o único destaque do topo.
   */
  const apoio = [
    ...form.papeis.map((p) => PAPEIS.find((x) => x.valor === p)?.rotulo ?? p),
    editando ? `#${pessoa.id}` : null,
    editando && !form.ativo ? "Inativo" : null,
  ].filter(Boolean) as string[];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 32px 24px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
          <Avatar
            nome={titulo}
            semente={String(pessoa?.id ?? (form.razao || "novo"))}
            tamanho={54}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: "var(--text-3xl)",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "var(--tracking-tight)",
                lineHeight: "var(--lh-tight)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={titulo}
            >
              {titulo}
            </h1>

            <p
              style={{
                marginTop: 6,
                fontSize: "var(--text-base)",
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {apoio.length > 0 ? apoio.join(" · ") : "Escolha ao menos um papel"}
            </p>
          </div>
        </header>

        <Secao titulo="Identificação">
          <Field label="Razão social" required>
            <input
              style={inputStyle}
              value={form.razao}
              onChange={(e) => set("razao", e.target.value)}
              placeholder="Nome completo ou razão social"
            />
          </Field>

          <Field label="Nome fantasia">
            <input
              style={inputStyle}
              value={form.nomeFantasia}
              onChange={(e) => set("nomeFantasia", e.target.value)}
              placeholder="Como é conhecida"
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
        </Secao>

        <Secao titulo="Contato">
          <Field label="Responsável">
            <input
              style={inputStyle}
              value={form.responsavel}
              onChange={(e) => set("responsavel", e.target.value)}
              placeholder="Pessoa de contato"
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

          <Field label="E-mail">
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="financeiro@empresa.com.br"
            />
          </Field>
        </Secao>

        <Secao titulo="No sistema" ultima>
          <Field label="Papéis" required>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2 }}>
              {PAPEIS.map((p) => {
                const marcado = form.papeis.includes(p.valor);

                return (
                  <button
                    key={p.valor}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        papeis: f.papeis.includes(p.valor)
                          ? f.papeis.filter((x) => x !== p.valor)
                          : [...f.papeis, p.valor],
                      }))
                    }
                    aria-pressed={marcado}
                    style={{
                      height: 26,
                      padding: "0 11px",
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
            <Field label="Situação">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: "var(--h-input)",
                }}
              >
                <ActiveToggle active={form.ativo} onChange={() => set("ativo", !form.ativo)} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {form.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
            </Field>
          )}
        </Secao>
      </div>

      {/*
        ⚠️ A barra só aparece quando há o que salvar.

        Um rodapé fixo com o botão apagado o tempo todo transforma a ficha num
        formulário permanente; aqui ela é leitura, e vira formulário no instante
        em que alguém mexe.
      */}
      {(mudou || !editando) && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 32px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
            {mudou ? "Alterações não salvas" : "Preencha e salve para criar"}
          </span>

          {!editando && (
            <Button variant="ghost" size="sm" onClick={onCancelarNovo}>
              Cancelar
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            disabled={!podeSalvar || salvando}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Um bloco de campos: título e uma RÉGUA embaixo.
 *
 * ⚠️ Régua, e não moldura. A caixa FECHA o conteúdo e conta como mais um nível
 * de hierarquia; a linha só marca onde um assunto acaba. Numa ficha com três
 * assuntos, três caixas viram três telas empilhadas — foi exatamente o que
 * aconteceu na primeira tentativa.
 */
function Secao({
  titulo,
  ultima = false,
  children,
}: {
  titulo: string;
  /** Sem o vão de baixo: o rodapé de salvar já fecha a ficha. */
  ultima?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: ultima ? 0 : 30 }}>
      <h2
        style={{
          paddingBottom: 9,
          marginBottom: 14,
          borderBottom: "1px solid var(--border)",
          fontSize: "var(--text-xl)",
          fontWeight: "var(--fw-semi)",
          letterSpacing: "var(--tracking-snug)",
        }}
      >
        {titulo}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}
