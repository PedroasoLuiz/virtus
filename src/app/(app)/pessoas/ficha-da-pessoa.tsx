"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Avatar } from "@/components/ui/avatar";
import { ActiveToggle, Button, selectStyle } from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";

/**
 * A ficha da pessoa, na coluna da direita.
 *
 * ⚠️ Substitui o drawer. O cadastro é o CONTEÚDO desta tela, não um formulário
 * que ela abre: com o drawer, ver um telefone custava abrir, ler e fechar, e
 * comparar dois cadastros era impossível. Ao lado da lista, trocar de pessoa é
 * um clique e a ficha simplesmente troca.
 */

/*
 * O campo dentro da ficha: SEM moldura própria.
 *
 * ⚠️ A seção já é uma caixa e cada linha já tem sua divisória. Uma borda por
 * campo dentro disso são três molduras aninhadas, e a ficha volta a parecer o
 * formulário que ela deixou de ser. É a anatomia dos Ajustes do iOS: o valor
 * fica solto ao lado do rótulo, e só o cursor mostra que dá para editar.
 */
const campoDaFicha: React.CSSProperties = {
  width: "100%",
  height: 30,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: "var(--text-base)",
  fontFamily: "var(--font)",
  outline: "none",
};

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
   * lista sairia da ficha com metade da alteração no banco. O botão só aparece
   * quando há diferença, então ele não fica pedindo atenção à toa.
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

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      {/*
        O topo é o CARTÃO de identidade: avatar grande, nome e papéis. O mesmo
        gesto do app Contatos — quem é, antes do que se sabe sobre.
      */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "4px 4px 18px",
        }}
      >
        <Avatar
          nome={titulo}
          semente={String(pessoa?.id ?? (form.razao || "novo"))}
          tamanho={56}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "calc(var(--text-lg) + 2px)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-snug)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={titulo}
          >
            {titulo}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginTop: 5,
              flexWrap: "wrap",
            }}
          >
            {form.papeis.length === 0 ? (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--danger-text)" }}>
                Escolha ao menos um papel
              </span>
            ) : (
              form.papeis.map((p) => (
                <span
                  key={p}
                  style={{
                    height: 19,
                    padding: "0 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "var(--radius-full)",
                    background: "var(--primary-subtle)",
                    color: "var(--primary)",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--fw-semi)",
                  }}
                >
                  {PAPEIS.find((x) => x.valor === p)?.rotulo ?? p}
                </span>
              ))
            )}

            {editando && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                #{pessoa.id}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 4 }}>
        <Secao titulo="Identificação">
          <Linha rotulo="Razão social" obrigatorio>
            <input
              style={campoDaFicha}
              value={form.razao}
              onChange={(e) => set("razao", e.target.value)}
              placeholder="Nome completo ou razão social"
            />
          </Linha>

          <Linha rotulo="Nome fantasia">
            <input
              style={campoDaFicha}
              value={form.nomeFantasia}
              onChange={(e) => set("nomeFantasia", e.target.value)}
              placeholder="Como é conhecida"
            />
          </Linha>

          <Linha rotulo="CNPJ / CPF">
            <input
              style={campoDaFicha}
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              placeholder="Somente números"
            />
          </Linha>
        </Secao>

        <Secao titulo="Contato">
          <Linha rotulo="Responsável">
            <input
              style={campoDaFicha}
              value={form.responsavel}
              onChange={(e) => set("responsavel", e.target.value)}
              placeholder="Pessoa de contato"
            />
          </Linha>

          <Linha rotulo="Telefone">
            <input
              style={campoDaFicha}
              value={form.contato}
              onChange={(e) => set("contato", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </Linha>

          <Linha rotulo="E-mail">
            <input
              style={campoDaFicha}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="financeiro@empresa.com.br"
            />
          </Linha>
        </Secao>

        <Secao titulo="No sistema">
          <Linha rotulo="Papéis" obrigatorio>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                      height: 28,
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
          </Linha>

          <Linha rotulo="Centro de custo">
            <select
              value={form.centroCustoId}
              onChange={(e) => set("centroCustoId", e.target.value)}
              style={{
                ...selectStyle,
                width: "100%",
                height: 30,
                paddingLeft: 0,
                border: "none",
                background: "transparent",
                backgroundImage: "none",
              }}
            >
              <option value="">Geral (padrão)</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.descricao}
                </option>
              ))}
            </select>
          </Linha>

          {editando && (
            <Linha rotulo="Situação">
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30 }}>
                <ActiveToggle active={form.ativo} onChange={() => set("ativo", !form.ativo)} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {form.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
            </Linha>
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
            paddingTop: 12,
            marginTop: 4,
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ flex: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
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
 * Um bloco de campos com título discreto.
 *
 * ⚠️ Título em caixa alta e pequeno, no tom terciário — é uma divisória, não um
 * cabeçalho de tela. Três títulos com o peso do nome da pessoa fariam a ficha
 * parecer três telas empilhadas.
 */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Um campo: rótulo à esquerda, valor à direita.
 *
 * ⚠️ Deitado, e não empilhado. É a anatomia dos Ajustes do iOS, e ela existe por
 * um motivo prático: com o rótulo em cima, cada campo custa duas linhas e a
 * ficha inteira vira rolagem. Lado a lado, os rótulos formam uma coluna que o
 * olho desce sem ler tudo.
 */
function Linha({
  rotulo,
  obrigatorio = false,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        // A divisória some na última: linha embaixo do último campo desenharia
        // um fundo de moldura dentro da própria moldura.
        borderBottom: "1px solid var(--border)",
      }}
      className="linha-da-ficha"
    >
      <span
        style={{
          width: 118,
          flexShrink: 0,
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
        }}
      >
        {rotulo}
        {obrigatorio && <span style={{ color: "var(--danger)" }}> *</span>}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </label>
  );
}
