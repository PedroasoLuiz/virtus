"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { PageLayout, Panel, selectStyle } from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";
import { FichaDaPessoa } from "./ficha-da-pessoa";

/**
 * Pessoas: lista à esquerda, ficha à direita.
 *
 * ⚠️ Duas colunas, e não tabela mais drawer. Cadastro é coisa que se CONSULTA:
 * ver um telefone custava abrir o drawer, ler e fechar, e comparar dois
 * cadastros era impossível. Ao lado da lista, trocar de pessoa é um clique.
 *
 * ⚠️ A tabela larga também dizia pouco. "Razão social, CNPJ, responsável,
 * contato, papéis" em cinco colunas obriga a ler na horizontal para montar uma
 * pessoa na cabeça — e das cinco, só o nome serve para ACHAR alguém. As outras
 * são o que se lê depois de achar, que é exatamente o que a ficha mostra.
 */

const PAPEIS: { valor: PapelPessoa; rotulo: string }[] = [
  { valor: "cliente", rotulo: "Clientes" },
  { valor: "fornecedor", rotulo: "Fornecedores" },
  { valor: "colaborador", rotulo: "Colaboradores" },
];

export function PessoasTela({
  pessoas,
  centros,
}: {
  /*
   * ⚠️ O tipo continua `Cliente`, e a tabela `clientes`.
   *
   * O que mudou foi o NOME da tela: ali dentro há cliente, fornecedor e
   * colaborador, e chamar tudo de cliente escondia dois terços do cadastro.
   * Renomear a tabela e a API junto seria uma migração de banco e de rota para
   * consertar uma palavra na tela.
   */
  pessoas: Cliente[];
  centros: { id: number; descricao: string }[];
}) {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState("");
  const [inativos, setInativos] = useState(false);
  const [escolhida, setEscolhida] = useState<number | null>(pessoas[0]?.id ?? null);
  const [criando, setCriando] = useState(false);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");

    return pessoas.filter((p) => {
      if (!inativos && !p.ativo) return false;
      if (papel && !p.papeis.includes(papel as PapelPessoa)) return false;
      if (!termo) return true;

      return (
        p.razao.toLowerCase().includes(termo) ||
        (p.nomeFantasia ?? "").toLowerCase().includes(termo) ||
        (digitos.length > 0 && (p.cnpj ?? "").includes(digitos)) ||
        (digitos.length > 0 && (p.contato ?? "").replace(/\D/g, "").includes(digitos))
      );
    });
  }, [pessoas, busca, papel, inativos]);

  const pessoa = criando ? null : (pessoas.find((p) => p.id === escolhida) ?? null);

  return (
    <PageLayout>
      <Panel>
        {/*
          O mesmo cartão branco das tabelas do sistema, sobre o cinza da casca.
          Aqui ele vem com respiro em CIMA também: nas outras telas quem dá esse
          ar é o cabeçalho da página, e nesta o cabeçalho mora dentro da coluna
          da esquerda.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            margin: 16,
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          {/* ── Coluna da lista ───────────────────────────────── */}
          <div
            style={{
              width: 320,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              borderRight: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                padding: "16px 16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: "calc(var(--text-lg) + 2px)",
                    fontWeight: "var(--fw-semi)",
                    letterSpacing: "var(--tracking-snug)",
                  }}
                >
                  Pessoas
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setCriando(true);
                    setEscolhida(null);
                  }}
                  aria-label="Novo cadastro"
                  title="Novo cadastro"
                  style={{
                    width: 28,
                    height: 28,
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--border-strong)",
                    background: "var(--surface)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>

              <div style={{ position: "relative", display: "flex" }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-tertiary)",
                    pointerEvents: "none",
                  }}
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>

                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome, documento ou telefone"
                  style={{
                    flex: 1,
                    height: 32,
                    padding: "0 10px 0 28px",
                    fontSize: "var(--text-sm)",
                    fontFamily: "var(--font)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-full)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={papel}
                  onChange={(e) => setPapel(e.target.value)}
                  aria-label="Papel"
                  style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                >
                  <option value="">Todos os papéis</option>
                  {PAPEIS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>

                {/*
                  ⚠️ Inativo fica FORA por padrão, e a chave diz isso.

                  Antes eles vinham na lista em cinza claro, misturados: quem
                  procurava um fornecedor achava o cadastro velho e mandava
                  cobrança para ele. Escondido por padrão, e a um clique de
                  aparecer quando o assunto é justamente o cadastro antigo.
                */}
                <button
                  type="button"
                  onClick={() => setInativos((v) => !v)}
                  aria-pressed={inativos}
                  title="Mostrar também os cadastros inativos"
                  style={{
                    flexShrink: 0,
                    height: "var(--h-input)",
                    padding: "0 10px",
                    border: `1px solid ${inativos ? "var(--primary-border)" : "var(--border-strong)"}`,
                    borderRadius: "var(--radius-md)",
                    background: inativos ? "var(--primary-subtle)" : "var(--surface)",
                    color: inativos ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: "var(--text-sm)",
                    fontFamily: "var(--font)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Inativos
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 8px 12px" }}>
              {filtradas.length === 0 ? (
                <p
                  style={{
                    padding: "24px 8px",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    textAlign: "center",
                    lineHeight: "var(--lh-snug)",
                  }}
                >
                  {busca.trim() || papel
                    ? "Nenhuma pessoa com esse filtro."
                    : "Nenhuma pessoa cadastrada ainda."}
                </p>
              ) : (
                filtradas.map((p) => (
                  <LinhaDaPessoa
                    key={p.id}
                    pessoa={p}
                    ativa={!criando && p.id === escolhida}
                    onClick={() => {
                      setCriando(false);
                      setEscolhida(p.id);
                    }}
                  />
                ))
              )}
            </div>

            <div
              style={{
                flexShrink: 0,
                padding: "9px 16px",
                borderTop: "1px solid var(--border)",
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
              }}
            >
              {filtradas.length} de {pessoas.length}
            </div>
          </div>

          {/* ── Coluna da ficha ───────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 20 }}>
            {criando || pessoa ? (
              <FichaDaPessoa
                // `key` pela pessoa: trocar de cadastro remonta a ficha, e o que
                // estava digitado no anterior morre junto em vez de vazar.
                key={criando ? "novo" : pessoa!.id}
                pessoa={pessoa}
                centros={centros}
                onCancelarNovo={() => {
                  setCriando(false);
                  setEscolhida(pessoas[0]?.id ?? null);
                }}
                onSalvou={() => {
                  setCriando(false);
                  // A página é servidor: o `refresh` traz a lista nova sem
                  // recarregar a aba inteira nem duplicar a consulta aqui.
                  router.refresh();
                }}
              />
            ) : (
              <SemPessoa />
            )}
          </div>
        </div>
      </Panel>
    </PageLayout>
  );
}

function LinhaDaPessoa({
  pessoa,
  ativa,
  onClick,
}: {
  pessoa: Cliente;
  ativa: boolean;
  onClick: () => void;
}) {
  const titulo = pessoa.nomeFantasia?.trim() || pessoa.razao;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 8px",
        border: "none",
        borderRadius: "var(--radius-md)",
        background: ativa ? "var(--surface-active)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
        opacity: pessoa.ativo ? 1 : 0.55,
        transition: "background 120ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        if (!ativa) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!ativa) e.currentTarget.style.background = "transparent";
      }}
    >
      <Avatar nome={titulo} semente={String(pessoa.id)} tamanho={32} />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-md)",
            fontWeight: ativa ? "var(--fw-semi)" : "var(--fw-normal)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {titulo}
        </span>

        {/*
          Uma linha de apoio só, e ela muda de conteúdo.

          ⚠️ O documento é o que distingue dois cadastros de nome parecido, e é o
          que falta quando não há. Sem documento, o telefone serve ao mesmo
          propósito; sem os dois, os papéis dizem ao menos por que a pessoa está
          ali.
        */}
        <span
          style={{
            display: "block",
            marginTop: 1,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {apoio(pessoa)}
        </span>
      </span>
    </button>
  );
}

function apoio(p: Cliente): string {
  if (p.cnpj) return formatarDocumento(p.cnpj);
  if (p.contato) return p.contato;
  return p.papeis.join(" · ");
}

/** CPF ou CNPJ, pela quantidade de dígitos. */
function formatarDocumento(bruto: string): string {
  const d = bruto.replace(/\D/g, "");

  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

  return bruto;
}

/**
 * Nada escolhido.
 *
 * ⚠️ Acontece com a lista filtrada até o vazio, ou logo depois de excluir. Fora
 * isso a primeira pessoa já vem escolhida: abrir num painel vazio faria a tela
 * pedir um clique antes de mostrar qualquer coisa.
 */
function SemPessoa() {
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 260 }}>
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-disabled)", marginBottom: 10 }}
        >
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>

        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Escolha alguém na lista para ver o cadastro.
        </p>
      </div>
    </div>
  );
}
