"use client";

import { useCallback, useEffect, useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  ActiveToggle,
  CampoBloqueado,
  Field,
  Formulario,
  GrupoDeCampos,
  PanelTabs,
  inputStyle,
} from "@/components/ui/kit";
import type { Cliente, ContatoDaPessoa, PapelPessoa } from "@/modules/clientes/clientes.types";
import { AbaDeContatos } from "./aba-contatos";
import { AbaDeEndereco } from "./aba-endereco";
import { AbaDeBancarios } from "./aba-bancarios";
import { AbaDeAcesso } from "./aba-acesso";
import { useCacheDoDrawer } from "./cache-do-drawer";

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
 * dado bancário no caminho. E cada aba tem seu próprio ritmo de mudança — o
 * nome quase nunca muda, o telefone muda toda hora.
 *
 * ⚠️ Não há aba de CENTRO DE CUSTO. O que existia amarrava a pessoa aos centros
 * da EMPRESA, e centro da empresa é a nossa contabilidade: dizer que um cliente
 * "usa" o nosso centro de receita mistura duas contabilidades diferentes. O
 * cliente terá os próprios centros, em tabela própria, quando isso for feito.
 */

const PAPEIS: { valor: PapelPessoa; rotulo: string; explica: string }[] = [
  { valor: "cliente", rotulo: "Cliente", explica: "aparece em faturas e recebimentos" },
  { valor: "fornecedor", rotulo: "Fornecedor", explica: "aparece em contas a pagar" },
  { valor: "colaborador", rotulo: "Colaborador", explica: "aparece em despesas de equipe" },
];

const ABA_INFO = "Informações";
const ABA_PAPEIS = "Papéis";
const ABA_CONTATOS = "Contatos";
const ABA_ENDERECO = "Endereço";
const ABA_BANCARIO = "Bancário";
const ABA_ACESSO = "Acesso";

/*
 * ⚠️ A ordem e a de QUEM ABRE, e nao a do banco.
 *
 * Informacoes e contato sao o que se consulta todo dia; endereco e dado
 * bancario, o que se preenche uma vez e se confere na hora de pagar; acesso, o
 * que quase ninguem toca. Ordenado por frequencia, a aba certa e quase sempre a
 * primeira.
 */
const ABAS = [ABA_INFO, ABA_PAPEIS, ABA_CONTATOS, ABA_ENDERECO, ABA_BANCARIO, ABA_ACESSO];

type Form = {
  razao: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  contato: string;
  responsavel: string;
  papeis: PapelPessoa[];
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
    ativo: cliente?.ativo ?? true,
  };
}

export function PessoaDrawer({
  cliente,
  aberto,
  onClose,
}: {
  /** null = novo cadastro. */
  cliente: Cliente | null;
  aberto: boolean;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();

  // `key` no uso remonta o drawer a cada registro, entao o estado inicial ja
  // vem da pessoa certa e nao precisa de efeito para sincronizar.
  const [form, setForm] = useState<Form>(() => inicial(cliente));
  const [aba, setAba] = useState<string>(ABA_INFO);

  /*
   * O telefone e o e-mail PRINCIPAIS moram fora do formulário.
   *
   * ⚠️ Eles são escolhidos na aba Contatos, numa coluna, e gravam sozinhos. No
   * formulário, a pessoa cadastrava o telefone numa aba e precisava lembrar de
   * voltar na outra para dizer qual usar — e o `valores()` do formulário
   * sobrescreveria a escolha com o valor velho no primeiro salvar.
   */
  const [principal, setPrincipal] = useState({
    telefone: cliente?.contato ?? "",
    email: cliente?.email ?? "",
  });

  /*
   * ⚠️ O que cada aba já buscou, enquanto este drawer estiver aberto.
   *
   * As abas montam e desmontam ao trocar de guia: sem isto, ir a Endereço,
   * voltar e retornar são três idas ao servidor para ler a mesma lista. Morre
   * com o drawer de propósito — ele é remontado por `key` a cada pessoa, então
   * fechar e reabrir traz dado fresco.
   */
  const cache = useCacheDoDrawer();
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

  /**
   * Grava o principal na hora, sem esperar o salvar do formulário.
   *
   * ⚠️ É um PATCH de um campo só. Marcar a coluna é gesto de passagem, e guardar
   * a escolha para o botão de salvar faria quem trocasse de aba e fechasse o
   * drawer perder o que achou que já tinha feito.
   */
  async function marcarPrincipal(tipo: "telefone" | "email", valor: string) {
    if (!cliente) return;

    setPrincipal((p) => ({ ...p, [tipo]: valor }));

    const r = await fetch(`/api/v1/clientes/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tipo === "telefone" ? { contato: valor } : { email: valor }),
    });

    if (!r.ok) {
      // Volta ao que estava: o otimismo era só sobre o que o servidor aceitaria.
      setPrincipal((p) => ({
        ...p,
        [tipo]: tipo === "telefone" ? (cliente.contato ?? "") : (cliente.email ?? ""),
      }));

      avisar("atencao", "Não foi possível marcar como principal");
    }
  }

  return (
    <FormDrawer
      aberto={aberto}
      onClose={onClose}
      titulo="Detalhes"
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
        responsavel: form.responsavel.trim() || null,
        papeis: form.papeis,
        /*
         * ⚠️ `centroCustoId` NAO sai daqui. O salvar e um PATCH: fora do corpo,
         * a coluna fica com o que o gatilho do banco pos. Mandando null, todo
         * salvar de nome ou telefone apagaria o centro que a pessoa ja tinha.
         */
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
            principalTelefone={principal.telefone}
            principalEmail={principal.email}
            onMudou={() => void carregarContatos()}
            onPrincipal={(tipo, valor) => void marcarPrincipal(tipo, valor)}
          />
        ) : editando && aba === ABA_PAPEIS ? (
          <Formulario>
            <GrupoDeCampos
              primeiro
              titulo="Papéis"
              legenda="Decidem em que telas esta pessoa aparece. Uma transportadora que também compra é um cadastro só, com dois papéis marcados. É preciso ao menos um: sem papel, a pessoa não aparece em lugar nenhum."
            >
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
            </GrupoDeCampos>
          </Formulario>
        ) : editando && aba === ABA_ENDERECO ? (
          <AbaDeEndereco clienteId={cliente.id} cache={cache} />
        ) : editando && aba === ABA_BANCARIO ? (
          <AbaDeBancarios clienteId={cliente.id} cache={cache} />
        ) : editando && aba === ABA_ACESSO ? (
          <AbaDeAcesso
            clienteId={cliente.id}
            cache={cache}
            nome={form.nomeFantasia.trim() || form.razao.trim() || "este cadastro"}
          />
        ) : (
          /*
            ⚠️ O ritmo e o do FORMULARIO, e nao o das secoes de tela.
            
            Campos colados entre si (3), titulo colado no primeiro campo (12) e o
            vao grande so entre um assunto e outro (22). E o mesmo do formulario
            de personas, que agora divide o componente com esta tela.
          */
          <Formulario>
            <GrupoDeCampos
              primeiro
              titulo="Identificação"
              legenda={
                fisica
                  ? "O documento decide o resto do formulário: com onze dígitos, a pessoa é física e o cadastro pede só o nome."
                  : "O documento decide o resto do formulário. A razão social é o nome que sai nos documentos; o fantasia é o que a equipe usa para achar, e é ele que aparece na listagem."
              }
            >
              {editando && (
                /*
                 * ⚠️ O número é LEITURA, e mesmo assim tem cara de campo.
                 *
                 * Ele é o que se dita ao telefone e o que aparece na fatura —
                 * precisa poder ser lido e copiado. Como texto solto no
                 * cabeçalho, ninguém o encontrava; como campo, fica onde a mão
                 * procura um dado do cadastro.
                 *
                 * ⚠️ `CampoBloqueado` do kit, e não um input com fundo cinza
                 * escrito na mão. O cadeado à direita é o que diz POR QUE aquele
                 * campo não aceita foco, e o desenho é o mesmo em toda tela que
                 * mostra dado derivado.
                 */
                <Field label="Número">
                  <CampoBloqueado
                    valor={String(cliente.id)}
                    titulo="O número é dado pelo sistema quando o cadastro nasce."
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
            </GrupoDeCampos>

            <GrupoDeCampos
              titulo="Situação"
              legenda="Inativo some da listagem e das buscas, mas o histórico continua inteiro. É o jeito de aposentar um cadastro sem perder o que passou por ele."
            >
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
            </GrupoDeCampos>
          </Formulario>
        )}
      </div>
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
