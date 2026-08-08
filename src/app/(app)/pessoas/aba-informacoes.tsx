"use client";

import {
  ActiveToggle,
  CampoBloqueado,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { CLASSIFICACOES, REGIMES } from "@/modules/clientes/clientes.types";
import type { Form } from "./pessoa-form";

/**
 * Quem é esta pessoa: documento, nome, data e o que a nota fiscal pede.
 *
 * ⚠️ Física ou jurídica sai do DOCUMENTO, e não de uma escolha a mais. O cadastro
 * guarda os dois na mesma coluna, e a quantidade de dígitos já responde: onze é
 * CPF, catorze é CNPJ. Um seletor "tipo de pessoa" seria um campo pedindo o que o
 * outro campo ao lado já disse, e um jeito a mais de os dois discordarem.
 */
export function AbaDeInformacoes({
  form,
  set,
  clienteId,
  novoCadastro,
}: {
  form: Form;
  set: <K extends keyof Form>(campo: K, valor: Form[K]) => void;
  /** `null` num cadastro que ainda não nasceu. */
  clienteId: number | null;
  novoCadastro: boolean;
}) {
  const digitos = form.cnpj.replace(/\D/g, "");
  const fisica = digitos.length > 0 && digitos.length <= 11;

  /*
   * ⚠️ O rótulo do documento só AFIRMA quando o número já decidiu.
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

  return (
    /*
      ⚠️ O ritmo é o do FORMULÁRIO, e não o das seções de tela.

      Campos colados entre si (3), título colado no primeiro campo (12) e o vão
      grande só entre um assunto e outro (22). É o mesmo do formulário de
      personas, que divide o componente com esta tela.
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
        {clienteId != null && (
          /*
           * ⚠️ O número é LEITURA, e mesmo assim tem cara de campo.
           *
           * Ele é o que se dita ao telefone e o que aparece na fatura: precisa
           * poder ser lido e copiado. Como texto solto no cabeçalho, ninguém o
           * encontrava; como campo, fica onde a mão procura um dado do cadastro.
           *
           * ⚠️ `CampoBloqueado` do kit, e não um input com fundo cinza escrito na
           * mão. O cadeado à direita é o que diz POR QUE aquele campo não aceita
           * foco, e o desenho é o mesmo em toda tela que mostra dado derivado.
           */
          <Field label="Número">
            <CampoBloqueado
              valor={String(clienteId)}
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
            autoFocus={novoCadastro}
          />
        </Field>

        {/*
          ⚠️ Fantasia some na pessoa física. Gente não tem nome fantasia, e o
          campo ali era um convite a preencher com apelido — que depois aparecia
          na listagem no lugar do nome de verdade.
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
          ⚠️ Uma data só para os dois casos. É a mesma data na vida do cadastro, e
          dois campos fariam a tela decidir qual ler cada vez que o documento
          troca de tamanho.
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
          documento. Sozinho num grupo, ele ganhava um título e uma legenda do
          tamanho de um assunto para dizer o que um botão já diz.
        */}
        <Field
          label="Situação"
          hint="Inativo some da listagem e das buscas, e o histórico continua inteiro."
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, height: "var(--h-input)" }}
          >
            <ActiveToggle active={form.ativo} onChange={() => set("ativo", !form.ativo)} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {form.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </Field>
      </GrupoDeCampos>

      {/*
        ⚠️ O grupo inteiro some na pessoa física, e não só os campos.

        Com os quatro escondidos, sobrava um título e uma legenda anunciando uma
        seção vazia. Não há campo de RESPONSÁVEL aqui tampouco: ele é do contato,
        porque quem atende o telefone do financeiro não é quem lê o e-mail do
        comercial.
      */}
      {juridica && (
        <GrupoDeCampos
          titulo="Campos opcionais"
          legenda="Nada aqui trava o cadastro. São dados que só aparecem na hora de emitir nota, e ficam guardados para quando essa hora chegar."
        >
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
            ⚠️ Lista fechada, e não texto livre. O valor decide imposto na nota, e
            digitado à mão "Simples", "simples nacional" e "SN" virariam três
            regimes diferentes para o mesmo cadastro.
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

          <Field label="Classificação tributária" hint="Como a empresa figura diante do ICMS">
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
        </GrupoDeCampos>
      )}
    </Formulario>
  );
}
