"use client";

import { useCallback, useEffect, useState } from "react";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  ActiveToggle,
  CabecalhoDeSecao,
  Field,
  PanelTabs,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import type { Cliente, ContatoDaPessoa, PapelPessoa } from "@/modules/clientes/clientes.types";
import { AbaDeContatos } from "./aba-contatos";
import { AbaDeEndereco } from "./aba-endereco";
import { AbaDeBancarios } from "./aba-bancarios";
import { AbaDeAcesso } from "./aba-acesso";
import { AbaDeCentros } from "./aba-centros";

/**
 * Detalhes de uma pessoa: cliente, fornecedor ou colaborador.
 *
 * ⚠️ Os três papéis moram na mesma tabela com colunas booleanas — por isso a tela
 * pede papel em vez de existirem três cadastros separados. Uma transportadora que
 * também compra é UMA pessoa com dois papéis, e não duas fichas para manter em
 * sincronia.
 *
 * ⚠️ Em ABAS, e não numa pilha. Contato, endereço e acesso são assuntos que se
 * consultam separados: quem abre para conferir um telefone não quer rolar por
 * centro de custo no caminho. E cada aba tem seu próprio ritmo de mudança — o
 * nome quase nunca muda, o telefone muda toda hora.
 */

const PAPEIS: { valor: PapelPessoa; rotulo: string; explica: string }[] = [
  { valor: "cliente", rotulo: "Cliente", explica: "aparece em faturas e recebimentos" },
  { valor: "fornecedor", rotulo: "Fornecedor", explica: "aparece em contas a pagar" },
  { valor: "colaborador", rotulo: "Colaborador", explica: "aparece em despesas de equipe" },
];

const ABA_INFO = "Informações";
const ABA_CONTATOS = "Contatos";
const ABA_ENDERECO = "Endereço";
const ABA_BANCARIO = "Bancário";
const ABA_CENTROS = "Centro de custo";
const ABA_ACESSO = "Acesso";

/*
 * ⚠️ A ordem e a de QUEM ABRE, e nao a do banco.
 *
 * Informacoes e contato sao o que se consulta todo dia; endereco e dado
 * bancario, o que se preenche uma vez e se confere na hora de pagar; acesso, o
 * que quase ninguem toca. Ordenado por frequencia, a aba certa e quase sempre a
 * primeira.
 */
const ABAS = [ABA_INFO, ABA_CONTATOS, ABA_ENDERECO, ABA_BANCARIO, ABA_CENTROS, ABA_ACESSO];

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
  const [aba, setAba] = useState<string>(ABA_INFO);
  const [contatos, setContatos] = useState<ContatoDaPessoa[] | null>(null);

  const editando = cliente !== null;
  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /*
   * ⚠️ Fisica ou juridica sai do DOCUMENTO, e nao de uma escolha a mais.
   *
   * O cadastro guarda os dois na mesma coluna, e a quantidade de digitos ja
   * responde: onze e CPF, catorze e CNPJ. Um seletor "tipo de pessoa" seria um
   * campo pedindo o que o outro campo ao lado ja disse, e um jeito a mais de os
   * dois discordarem.
   */
  const digitos = form.cnpj.replace(/\D/g, "");
  const fisica = digitos.length > 0 && digitos.length <= 11;

  const carregarContatos = useCallback(async () => {
    if (!cliente) return;

    const r = await fetch(`/api/v1/clientes/${cliente.id}/contatos`);
    if (!r.ok) return;

    const corpo = await r.json();
    setContatos(corpo.data ?? []);
  }, [cliente]);

  useEffect(() => {
    const t = setTimeout(() => void carregarContatos(), 0);
    return () => clearTimeout(t);
  }, [carregarContatos]);

  const telefones = (contatos ?? []).filter((c) => c.tipo === "telefone");
  const emails = (contatos ?? []).filter((c) => c.tipo === "email");

  return (
    <FormDrawer
      aberto={aberto}
      onClose={onClose}
      titulo="Detalhes"
      subtitulo={editando ? form.razao.trim() || `#${cliente.id}` : "Nova pessoa"}
      larguraDrawer={620}
      url={editando ? `/api/v1/clientes/${cliente.id}` : "/api/v1/clientes"}
      metodo={editando ? "PATCH" : "POST"}
      podeSalvar={form.razao.trim().length > 0 && form.papeis.length > 0}
      valores={() => ({
        razao: form.razao.trim(),
        // Pessoa fisica nao tem fantasia: o campo nem aparece, e mandar o que
        // sobrou de um cadastro que era juridico gravaria lixo.
        nomeFantasia: fisica ? null : form.nomeFantasia.trim() || null,
        // Campo opcional vazio vai como null: string vazia falharia na
        // validacao de documento e no formato de e-mail.
        cnpj: digitos || null,
        email: form.email.trim() || null,
        contato: form.contato.trim() || null,
        responsavel: form.responsavel.trim() || null,
        papeis: form.papeis,
        centroCustoId: form.centroCustoId ? Number(form.centroCustoId) : null,
        ...(editando ? { ativo: form.ativo } : {}),
      })}
    >
      {/*
        Um filho só: o `FormDrawer` separa os filhos dele com um vão fixo, e com
        seções, campos e abas misturados esse vão brigava com a margem de cada
        um — o respiro ficava diferente em cada trecho da mesma tela.
      */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/*
          Sem cadastro salvo não há abas: endereço, conta e acesso precisam de
          dono, e uma aba que só sabe dizer "salve primeiro" é uma aba que não
          devia estar ali.
        */}
        {editando && <PanelTabs tabs={ABAS} active={aba} onChange={setAba} />}

        {editando && aba === ABA_CONTATOS ? (
          <AbaDeContatos
            clienteId={cliente.id}
            contatos={contatos}
            onMudou={() => void carregarContatos()}
          />
        ) : editando && aba === ABA_ENDERECO ? (
          <AbaDeEndereco clienteId={cliente.id} />
        ) : editando && aba === ABA_BANCARIO ? (
          <AbaDeBancarios clienteId={cliente.id} />
        ) : editando && aba === ABA_CENTROS ? (
          <AbaDeCentros clienteId={cliente.id} centros={centros} />
        ) : editando && aba === ABA_ACESSO ? (
          <AbaDeAcesso
            clienteId={cliente.id}
            nome={form.nomeFantasia.trim() || form.razao.trim() || "este cadastro"}
          />
        ) : (
          <>
            <CabecalhoDeSecao
              primeiro
              colado
              titulo="Identificação"
              legenda={
                fisica
                  ? "O documento decide o resto do formulário: com onze dígitos, a pessoa é física e o cadastro pede só o nome."
                  : "O documento decide o resto do formulário. A razão social é o nome que sai nos documentos; o fantasia é o que a equipe usa para achar, e é ele que aparece na listagem."
              }
            />

            <Campos>
              {editando && (
                /*
                 * ⚠️ O número é LEITURA, e mesmo assim tem cara de campo.
                 *
                 * Ele é o que se dita ao telefone e o que aparece na fatura —
                 * precisa poder ser lido e copiado. Como texto solto no
                 * cabeçalho, ninguém o encontrava; como campo desabilitado, ele
                 * fica onde a mão procura um dado do cadastro.
                 */
                <Field label="Número">
                  <input
                    value={cliente.id}
                    readOnly
                    style={{
                      ...inputStyle,
                      background: "var(--input-disabled-bg)",
                      color: "var(--text-secondary)",
                      cursor: "default",
                    }}
                  />
                </Field>
              )}

              <Field label="CNPJ / CPF" hint="Somente números; deixe vazio se não tiver">
                <input
                  style={inputStyle}
                  value={form.cnpj}
                  onChange={(e) => set("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </Field>

              <Field label={fisica ? "Nome completo" : "Razão social"} required>
                <input
                  style={inputStyle}
                  value={form.razao}
                  onChange={(e) => set("razao", e.target.value)}
                  placeholder={fisica ? "Nome completo" : "Razão social"}
                  autoFocus={!editando}
                />
              </Field>

              {/*
                ⚠️ Fantasia some na pessoa física. Gente não tem nome fantasia, e
                o campo ali era um convite a preencher com apelido — que depois
                aparecia na listagem no lugar do nome de verdade.
              */}
              {!fisica && (
                <Field label="Nome fantasia">
                  <input
                    style={inputStyle}
                    value={form.nomeFantasia}
                    onChange={(e) => set("nomeFantasia", e.target.value)}
                    placeholder="Como a pessoa é conhecida"
                  />
                </Field>
              )}
            </Campos>

            <CabecalhoDeSecao
              colado
              titulo="Contato principal"
              legenda={
                editando
                  ? "É para onde a cobrança vai, e é o telefone que casa esta pessoa com a conversa no WhatsApp. Os demais ficam na aba Contatos."
                  : "É para onde a cobrança vai. Depois de salvar, a aba Contatos guarda os outros telefones e e-mails."
              }
            />

            <Campos>
              <Field label="Responsável">
                <input
                  style={inputStyle}
                  value={form.responsavel}
                  onChange={(e) => set("responsavel", e.target.value)}
                  placeholder="Pessoa de contato"
                />
              </Field>

              {/*
                ⚠️ Com cadastro salvo, o principal é ESCOLHIDO entre os
                cadastrados; sem, é digitado.

                Digitar aqui um telefone que não está na lista criaria um número
                que existe na cobrança e não existe na agenda — e ninguém
                descobriria até a mensagem não chegar.
              */}
              <Field label="Telefone">
                <Principal
                  valor={form.contato}
                  opcoes={telefones}
                  editando={editando}
                  onMudar={(v) => set("contato", v)}
                  vazio="Nenhum telefone cadastrado"
                  placeholder="(00) 00000-0000"
                />
              </Field>

              <Field label="E-mail">
                <Principal
                  valor={form.email}
                  opcoes={emails}
                  editando={editando}
                  onMudar={(v) => set("email", v)}
                  vazio="Nenhum e-mail cadastrado"
                  placeholder="financeiro@empresa.com.br"
                  tipo="email"
                />
              </Field>
            </Campos>

            <CabecalhoDeSecao
              colado
              titulo="No sistema"
              legenda="Os papéis decidem em que telas esta pessoa aparece. Uma transportadora que também compra é um cadastro só, com dois papéis marcados."
            />

            <Campos>
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

              {/*
                ⚠️ Aqui fica só o PADRÃO. A lista de centros em que a pessoa
                entra mora na aba própria: são coisas diferentes, e juntas num
                campo só a pessoa acabava restrita ao centro que era só o
                sugerido.
              */}
              <Field
                label="Centro padrão"
                hint="O que vem preenchido ao lançar. Os demais ficam na aba Centro de custo."
              >
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
                <Field
                  label="Situação"
                  hint="Inativo some da listagem e das buscas, mas o histórico continua inteiro."
                >
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
            </Campos>
          </>
        )}
      </div>
    </FormDrawer>
  );
}

/**
 * O bloco de campos de uma seção.
 *
 * ⚠️ O vão entre campos mora AQUI, e não no `FormDrawer`. Lá ele valia para
 * qualquer filho, e com seções e abas no meio o mesmo vão separava um campo do
 * outro e um título do campo abaixo — coisas que precisam de distâncias
 * diferentes.
 */
function Campos({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;
}

/**
 * O contato principal: escolhido entre os cadastrados, ou digitado.
 *
 * ⚠️ Vira seleção só depois de salvo, porque antes disso não existe lista de onde
 * escolher. E quando a lista existe, digitar deixa de ser opção: um telefone
 * escrito aqui e ausente da agenda é um número que existe na cobrança e não
 * existe em lugar nenhum — descoberto quando a mensagem não chega.
 */
function Principal({
  valor,
  opcoes,
  editando,
  onMudar,
  vazio,
  placeholder,
  tipo = "text",
}: {
  valor: string;
  opcoes: ContatoDaPessoa[];
  editando: boolean;
  onMudar: (v: string) => void;
  vazio: string;
  placeholder: string;
  tipo?: "text" | "email";
}) {
  if (!editando) {
    return (
      <input
        style={inputStyle}
        type={tipo}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <select
      value={valor}
      onChange={(e) => onMudar(e.target.value)}
      style={{ ...selectStyle, width: "100%" }}
    >
      <option value="">Nenhum</option>

      {/*
        ⚠️ O valor atual entra na lista mesmo quando não está entre os
        cadastrados. Toda pessoa que já existia tem um telefone gravado e nenhum
        contato na tabela nova: sem esta linha, abrir o cadastro apagaria o
        número em silêncio no primeiro salvar.
      */}
      {valor && !opcoes.some((o) => o.valor === valor) && (
        <option value={valor}>{valor} (não está na lista)</option>
      )}

      {opcoes.map((o) => (
        <option key={o.id} value={o.valor}>
          {o.valor}
          {o.rotulo ? ` · ${o.rotulo}` : ""}
        </option>
      ))}

      {opcoes.length === 0 && <option disabled>{vazio}</option>}
    </select>
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
