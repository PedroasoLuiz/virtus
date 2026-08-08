"use client";

import { useState } from "react";
import {
  ActiveToggle,
  CampoBloqueado,
  CampoDeTexto,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { CLASSIFICACOES, REGIMES } from "@/modules/clientes/clientes.types";
import { documentoValido } from "@/shared/domain/cadastro-pessoa";
import { buscarCnpj, mascararDocumento } from "@/shared/domain/cnpj";
import { mascararTelefone } from "@/shared/domain/telefone";
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
  aplicar,
  clienteId,
  novoCadastro,
  onDuplicado,
}: {
  form: Form;
  set: <K extends keyof Form>(campo: K, valor: Form[K]) => void;
  /** Mexe em vários campos de uma vez: é o que a consulta do CNPJ faz. */
  aplicar: (mudanca: Partial<Form>) => void;
  /** `null` num cadastro que ainda não nasceu. */
  clienteId: number | null;
  novoCadastro: boolean;
  /**
   * Avisa o drawer que o documento é de outro cadastro.
   *
   * ⚠️ Sobe porque quem segura o salvar é o drawer. O servidor também recusa,
   * mas deixar o botão aceso convida a mandar e esperar a recusa voltar.
   */
  onDuplicado: (duplicado: boolean) => void;
}) {
  const [buscando, setBuscando] = useState(false);

  /**
   * Quem ja tem este documento, quando ha alguem.
   *
   * ⚠️ A conferencia acontece ao DIGITAR, e nao no salvar. O servidor tambem
   * recusa duplicidade, mas ali a pessoa ja preencheu a ficha inteira: descobrir
   * no fim que aquele cliente ja existia joga fora o trabalho todo.
   */
  const [jaExiste, setJaExiste] = useState<{ id: number; nome: string } | null>(null);

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

  /**
   * Digitou o CNPJ inteiro, a Receita responde o resto.
   *
   * ⚠️ Só preenche o que está VAZIO, com uma exceção: a razão social e a data,
   * que são o cadastro oficial e não opinião de quem digita. Sobrescrevendo tudo,
   * quem corrigiu o nome fantasia à mão veria a correção sumir ao conferir o
   * documento; preservando tudo, um cadastro começado errado nunca se acertaria.
   *
   * ⚠️ O ENDEREÇO fica guardado no formulário e nasce junto com a pessoa. Ele não
   * tem campo aqui de propósito: endereço tem aba própria, com principal e vários.
   * Aparece só a linha dizendo o que veio, para ninguém salvar sem saber.
   */
  async function aoDigitarDocumento(bruto: string) {
    const mascarado = mascararDocumento(bruto);
    set("cnpj", mascarado);

    /*
     * ⚠️ Documento incompleto limpa o aviso em vez de manter o anterior.
     *
     * Sem isto, apagar um dígito do documento repetido deixava o campo vermelho
     * acusando duplicidade de um número que já não estava mais escrito ali.
     */
    if (!documentoValido(mascarado)) {
      setJaExiste(null);
      onDuplicado(false);
      return;
    }

    /*
     * ⚠️ As duas perguntas vão JUNTAS, e não uma depois da outra.
     *
     * Uma é nossa (já existe este cadastro?) e a outra é da Receita (quem é este
     * CNPJ?). Em sequência, a tela ficaria parada o tempo das duas somadas para
     * responder coisas que não dependem uma da outra.
     */
    const eCnpj = mascarado.replace(/\D/g, "").length === 14;

    setBuscando(true);
    const [duplicado, achado] = await Promise.all([
      conferirDuplicidade(mascarado),
      eCnpj && novoCadastro ? buscarCnpj(mascarado) : Promise.resolve(null),
    ]);
    setBuscando(false);

    setJaExiste(duplicado);
    onDuplicado(duplicado != null);

    // Sem achado a tela não reclama: a consulta é atalho, e o serviço é de fora.
    if (!achado) return;

    aplicar({
      razao: achado.razaoSocial || form.razao,
      dataNascimento: achado.dataAbertura || form.dataNascimento,
      nomeFantasia: form.nomeFantasia || achado.nomeFantasia,
      contato: form.contato || achado.telefone,
      email: form.email || achado.email,
      regimeTributario: form.regimeTributario || achado.regime,
      endereco: achado.endereco,
    });
  }

  /**
   * Pergunta ao nosso cadastro quem ja tem este documento.
   *
   * ⚠️ O proprio registro em edicao nao conta. Sem isto, abrir uma ficha e mexer
   * no documento acusaria que ele "ja existe" — apontando para ela mesma.
   */
  async function conferirDuplicidade(documento: string) {
    const r = await fetch(`/api/v1/clientes/documento?documento=${encodeURIComponent(documento)}`);
    if (!r.ok) return null;

    const corpo = await r.json();
    const achado = corpo.data as { id: number; nome: string } | null;

    return achado && achado.id !== clienteId ? achado : null;
  }

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

        {/*
          ⚠️ O aviso de "já existe" mora NO CAMPO: borda vermelha e o alerta no
          canto, com a frase no hover.

          Toast passa, e este é um impedimento; escrita embaixo do campo, a frase
          empurrava os campos seguintes a cada tecla. No canto do campo é onde
          este sistema já fala sobre o próprio campo, ao lado do número que
          causou o problema.
        */}
        <Field
          label={rotuloDoDocumento}
          hint={
            buscando
              ? "Conferindo…"
              : novoCadastro
                ? "Com o CNPJ completo, o resto vem preenchido"
                : undefined
          }
        >
          <CampoDeTexto
            valor={form.cnpj}
            onMudar={(v) => void aoDigitarDocumento(v)}
            alerta={
              jaExiste ? `Já existe um cadastro com este documento: ${jaExiste.nome}` : null
            }
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
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
        ⚠️ Telefone e e-mail SÓ no cadastro novo, e um deles é obrigatório.

        Depois que a pessoa existe, os dois viram lista na aba de contatos, com
        setor, responsável e a escolha de qual é o principal. Aqui eles são a
        pergunta mínima: um nome sem jeito de falar com ele é um cadastro que a
        primeira cobrança descobre estar vazio.

        O que for digitado aqui nasce como o principal E como a primeira linha da
        aba de contatos, para os dois nunca discordarem.
      */}
      {novoCadastro && (
        <GrupoDeCampos
          titulo="Como falar com esta pessoa"
          legenda="Ao menos um dos dois. Depois de salvar, os demais telefones e e-mails entram na aba de contatos, cada um com o setor e quem atende."
        >
          <Field label="Telefone" required={!form.email.trim()}>
            <input
              style={inputStyle}
              value={form.contato}
              onChange={(e) => set("contato", mascararTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
            />
          </Field>

          <Field label="E-mail" required={!form.contato.trim()}>
            <input
              type="email"
              style={inputStyle}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="financeiro@empresa.com.br"
            />
          </Field>

          {/*
            ⚠️ O endereço não tem campo, mas tem AVISO.

            Ele veio da Receita e vai nascer junto com a pessoa; sem esta linha,
            um endereço apareceria do nada na aba depois de salvar, e ninguém
            saberia de onde. Corrigir se faz lá, onde endereço se edita.
          */}
          {form.endereco && (
            <Field label="Endereço">
              {/*
                ⚠️ `CampoBloqueado` do kit, e não um texto solto. Ele é dado que
                veio de fora e não se edita aqui: o cadeado à direita diz isso
                sem precisar de uma frase, e é o mesmo desenho de toda tela que
                mostra dado derivado.
              */}
              <CampoBloqueado
                valor={[
                  [form.endereco.logradouro, form.endereco.numero].filter(Boolean).join(", "),
                  form.endereco.bairro,
                  [form.endereco.cidade, form.endereco.uf].filter(Boolean).join(" / "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                titulo="Veio da Receita com o CNPJ. Nasce como o endereço principal, e se corrige na aba de endereços."
              />
            </Field>
          )}
        </GrupoDeCampos>
      )}

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
