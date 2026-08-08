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
  MarcaDeUso,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { CLASSIFICACOES, REGIMES } from "@/modules/clientes/clientes.types";
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
  { valor: "transportadora", rotulo: "Transportadora", explica: "leva a entrega, e cobra frete" },
  { valor: "corretor", rotulo: "Corretor", explica: "traz negócio, e recebe comissão" },
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
  dataNascimento: string;
  email: string;
  contato: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  regimeTributario: string;
  classificacaoTributaria: string;
  papeis: PapelPessoa[];
  ativo: boolean;
};

function inicial(cliente: Cliente | null): Form {
  return {
    razao: cliente?.razao ?? "",
    nomeFantasia: cliente?.nomeFantasia ?? "",
    cnpj: cliente?.cnpj ?? "",
    dataNascimento: cliente?.dataNascimento ?? "",
    email: cliente?.email ?? "",
    contato: cliente?.contato ?? "",
    inscricaoMunicipal: cliente?.inscricaoMunicipal ?? "",
    inscricaoEstadual: cliente?.inscricaoEstadual ?? "",
    regimeTributario: cliente?.regimeTributario ?? "",
    classificacaoTributaria: cliente?.classificacaoTributaria ?? "",
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

  /*
   * ⚠️ O rotulo do documento só AFIRMA quando o número já decidiu.
   *
   * Com onze dígitos é CPF, com catorze é CNPJ, e no meio do caminho ele volta a
   * oferecer os dois. Trocando a cada tecla, o rótulo dizia "CPF" enquanto a
   * pessoa digitava um CNPJ e parecia estar recusando o que ela ia escrever.
   */
  const rotuloDoDocumento =
    digitos.length === 11 ? "CPF" : digitos.length === 14 ? "CNPJ" : "CNPJ / CPF";

  /*
   * ⚠️ Só a pessoa JURÍDICA tem inscrição e regime.
   *
   * Inscrição municipal e estadual são registros de empresa, e regime é como a
   * empresa apura imposto. Numa ficha de pessoa física, os três eram campos que
   * ninguém preenche e que, preenchidos por engano, sujavam a nota.
   *
   * Sem documento nenhum o cadastro segue como jurídico, que é o mesmo caminho
   * que a razão social e o nome fantasia já tomam.
   */
  const juridica = !fisica;

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
      url={editando ? `/api/v1/clientes/${cliente.id}` : "/api/v1/clientes"}
      metodo={editando ? "PATCH" : "POST"}
      /*
       * ⚠️ Documento e data NAO seguram o salvar.
       *
       * O cadastro nasce muitas vezes antes deles: um orcamento para quem ainda
       * nao passou o CPF precisa de alguem para apontar. Travando aqui, o
       * atendimento inventava documento para o botao liberar. Quem cobra a falta
       * e o faturamento, quando o dado passa a ser necessario de verdade.
       */
      podeSalvar={form.razao.trim().length > 0 && form.papeis.length > 0}
      valores={() => ({
        razao: form.razao.trim(),
        // Pessoa fisica nao tem fantasia: o campo nem aparece, e mandar o que
        // sobrou de um cadastro que era juridico gravaria lixo.
        nomeFantasia: fisica ? null : form.nomeFantasia.trim() || null,
        cnpj: digitos || null,
        dataNascimento: form.dataNascimento || null,
        // Campo opcional vazio vai como null: string vazia falharia na
        // validacao de tamanho e no formato de e-mail.
        /*
         * ⚠️ `responsavel` NAO sai daqui. Ele mora no contato agora, e a coluna
         * de `clientes` e copia do responsavel do principal: mandando o campo do
         * formulario, todo salvar da ficha desfaria o que a aba de contatos
         * acabou de gravar.
         */
        inscricaoMunicipal: form.inscricaoMunicipal.trim() || null,
        inscricaoEstadual: form.inscricaoEstadual.trim() || null,
        regimeTributario: form.regimeTributario || null,
        classificacaoTributaria: form.classificacaoTributaria || null,
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
              <TableArea minWidth={0}>
                <TableHead>
                  <Th>Papel</Th>
                  <Th>Onde aparece</Th>
                  <Th align="center" minWidth={70}>
                    Usa
                  </Th>
                </TableHead>

                <tbody>
                  {PAPEIS.map((p) => {
                    const marcado = form.papeis.includes(p.valor);

                    return (
                      <Tr key={p.valor}>
                        <Td>{p.rotulo}</Td>
                        <Td style={{ color: "var(--text-tertiary)" }}>{p.explica}</Td>

                        <Td style={{ textAlign: "center" }}>
                          <MarcaDeUso
                            marcado={marcado}
                            rotulo={marcado ? `Tirar ${p.rotulo}` : `Marcar ${p.rotulo}`}
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                papeis: f.papeis.includes(p.valor)
                                  ? f.papeis.filter((x) => x !== p.valor)
                                  : [...f.papeis, p.valor],
                              }))
                            }
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </TableArea>
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

              <Field label={rotuloDoDocumento} hint="Somente números">
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

              {/*
                ⚠️ Uma data só para os dois casos. É a mesma data na vida do
                cadastro, e dois campos fariam a tela decidir qual ler cada vez
                que o documento troca de tamanho.
              */}
              <Field label={fisica ? "Data de nascimento" : "Data de fundação"}>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.dataNascimento}
                  onChange={(e) => set("dataNascimento", e.target.value)}
                />
              </Field>

              {/*
                ⚠️ Situação mora AQUI, e não numa seção só dela.

                Ativo e inativo é estado do cadastro, do mesmo naipe do nome e do
                documento. Sozinho num grupo, ele ganhava um título e uma legenda
                do tamanho de um assunto para dizer o que um botão já diz.
              */}
              <Field
                label="Situação"
                hint="Inativo some da listagem e das buscas, e o histórico continua inteiro."
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
            </GrupoDeCampos>

            <GrupoDeCampos
              titulo="Campos opcionais"
              legenda="Nada aqui trava o cadastro. São dados que só aparecem na hora de emitir nota ou de falar com quem responde pela pessoa, e ficam guardados para quando essa hora chegar."
            >
              {/*
                ⚠️ Não há campo de RESPONSÁVEL aqui. Ele é do contato: quem
                atende o telefone do financeiro não é quem lê o e-mail do
                comercial, e um nome só na ficha mandava todo mundo falar com a
                mesma pessoa. `clientes.responsavel` continua guardado, agora
                como cópia do responsável do contato principal, que é o que a
                listagem mostra e ordena.
              */}
              {juridica && (
                <>
                  <Field label="Inscrição municipal">
                    <input
                      style={inputStyle}
                      value={form.inscricaoMunicipal}
                      onChange={(e) => set("inscricaoMunicipal", e.target.value)}
                      placeholder="Somente números"
                    />
                  </Field>

                  <Field label="Inscrição estadual">
                    <input
                      style={inputStyle}
                      value={form.inscricaoEstadual}
                      onChange={(e) => set("inscricaoEstadual", e.target.value)}
                      placeholder="Somente números, ou ISENTO"
                    />
                  </Field>

                  {/*
                    ⚠️ Lista fechada, e não texto livre. O valor decide imposto
                    na nota, e digitado à mão "Simples", "simples nacional" e
                    "SN" virariam três regimes diferentes para o mesmo cadastro.
                  */}
                  <Field label="Regime de tributação">
                    <select
                      style={selectStyle}
                      value={form.regimeTributario}
                      onChange={(e) => set("regimeTributario", e.target.value)}
                    >
                      <option value="">Não informado</option>
                      {REGIMES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Classificação tributária"
                    hint="Como a empresa figura diante do ICMS"
                  >
                    <select
                      style={selectStyle}
                      value={form.classificacaoTributaria}
                      onChange={(e) => set("classificacaoTributaria", e.target.value)}
                    >
                      <option value="">Não informado</option>
                      {CLASSIFICACOES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </GrupoDeCampos>
          </Formulario>
        )}
      </div>
    </FormDrawer>
  );
}
