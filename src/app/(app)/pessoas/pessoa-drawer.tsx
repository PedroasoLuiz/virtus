"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { FormDrawer } from "@/components/ui/form-drawer";
import { PanelTabs } from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";
import { AbaDeInformacoes } from "./aba-informacoes";
import { AbaDePapeis } from "./aba-papeis";
import { AbaDeContatos } from "./aba-contatos";
import { AbaDeEndereco } from "./aba-endereco";
import { AbaDeBancarios } from "./aba-bancarios";
import { AbaDeAcesso } from "./aba-acesso";
import { useCacheDoDrawer } from "./cache-do-drawer";
import { inicial, type Form } from "./pessoa-form";

/**
 * A ficha de uma pessoa: cliente, fornecedor, colaborador, transportadora ou
 * corretor.
 *
 * ⚠️ Este arquivo ORQUESTRA, e não desenha. Ele guarda o formulário, decide qual
 * aba aparece e monta o corpo do salvar; cada aba mora no próprio arquivo. Já foi
 * um só de quinhentas linhas, e mexer no endereço obrigava a passar por
 * identificação, papéis e contatos no caminho.
 *
 * ⚠️ Em ABAS, e não numa pilha. Contato, endereço e acesso são assuntos que se
 * consultam separados: quem abre para conferir um telefone não quer rolar por
 * dado bancário no caminho. E cada aba tem seu próprio ritmo de mudança: o nome
 * quase nunca muda, o telefone muda toda hora.
 *
 * ⚠️ Não há aba de CENTRO DE CUSTO. O que existia amarrava a pessoa aos centros
 * da EMPRESA, e centro da empresa é a nossa contabilidade: dizer que um cliente
 * "usa" o nosso centro de receita mistura duas contabilidades diferentes. O
 * cliente terá os próprios centros, em tabela própria, quando isso for feito.
 */

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
   * voltar na outra para dizer qual usar, e o `valores()` do formulário
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
   * com o drawer de propósito: ele é remontado por `key` a cada pessoa, então
   * fechar e reabrir traz dado fresco.
   */
  const cache = useCacheDoDrawer();

  /*
   * O documento digitado ja pertence a outro cadastro.
   *
   * ⚠️ Mora aqui, e nao na aba, porque quem segura o salvar e este componente. A
   * aba confere ao digitar e avisa; o servidor recusa de novo, mas deixar o botao
   * aceso convida a mandar e esperar a recusa voltar.
   */
  const [documentoDuplicado, setDocumentoDuplicado] = useState(false);

  const editando = cliente !== null;
  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const digitos = form.cnpj.replace(/\D/g, "");
  const fisica = digitos.length > 0 && digitos.length <= 11;

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

  function alternarPapel(papel: PapelPessoa) {
    setForm((f) => ({
      ...f,
      papeis: f.papeis.includes(papel)
        ? f.papeis.filter((x) => x !== papel)
        : [...f.papeis, papel],
    }));
  }

  return (
    <FormDrawer
      aberto={aberto}
      onClose={onClose}
      titulo="Detalhes"
      url={editando ? `/api/v1/clientes/${cliente.id}` : "/api/v1/clientes"}
      metodo={editando ? "PATCH" : "POST"}
      /*
       * ⚠️ Documento e data NAO seguram o salvar; um CANAL segura, e so no
       * cadastro novo.
       *
       * O cadastro nasce muitas vezes antes do documento: um orcamento para quem
       * ainda nao passou o CPF precisa de alguem para apontar, e travando ali o
       * atendimento inventava numero para o botao liberar. Um jeito de falar com
       * a pessoa e outra conversa: sem isso o que entra e um nome solto, e a
       * primeira cobranca descobre que nao ha para onde mandar.
       *
       * Na edicao a regra nao vale: o canal mora na aba de contatos, que ja
       * impede tirar o ultimo.
       */
      podeSalvar={
        form.razao.trim().length > 0 &&
        form.papeis.length > 0 &&
        !documentoDuplicado &&
        (editando || Boolean(form.contato.trim() || form.email.trim()))
      }
      valores={() => ({
        razao: form.razao.trim(),
        // Pessoa fisica nao tem fantasia: o campo nem aparece, e mandar o que
        // sobrou de um cadastro que era juridico gravaria lixo.
        nomeFantasia: fisica ? null : form.nomeFantasia.trim() || null,
        cnpj: digitos || null,
        dataNascimento: form.dataNascimento || null,
        inscricaoMunicipal: form.inscricaoMunicipal.trim() || null,
        inscricaoEstadual: form.inscricaoEstadual.trim() || null,
        regimeTributario: form.regimeTributario || null,
        classificacaoTributaria: form.classificacaoTributaria || null,
        papeis: form.papeis,
        /*
         * ⚠️ Contato, e-mail e endereco so vao no NASCIMENTO.
         *
         * Depois disso eles pertencem as abas: o principal e marcado numa coluna
         * que grava sozinha, e o endereco tem drawer proprio. Mandando-os em todo
         * salvar da ficha, um PATCH de nome desfaria o principal que a aba de
         * contatos acabou de gravar.
         */
        ...(editando
          ? { ativo: form.ativo }
          : {
              contato: form.contato.trim() || null,
              email: form.email.trim() || null,
              endereco: form.endereco,
            }),
        /*
         * ⚠️ `responsavel` e `centroCustoId` NAO saem daqui.
         *
         * O responsavel mora no contato agora, e a coluna de `clientes` e copia
         * do responsavel do principal. O centro tem gatilho no banco. Mandando os
         * dois, todo salvar de nome desfaria o que outra tela acabou de gravar.
         */
      })}
    >
      {/*
        Um filho só: o `FormDrawer` separa os filhos dele com o vão entre campos,
        e com seções, campos e abas misturados esse vão brigava com a margem de
        cada um.
      */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/*
          Sem cadastro salvo não há abas: endereço, conta e acesso precisam de
          dono, e uma aba que só sabe dizer "salve primeiro" é uma aba que não
          devia estar ali.
        */}
        {editando && <PanelTabs tabs={ABAS} active={aba} onChange={setAba} />}

        {editando && aba === ABA_PAPEIS ? (
          <AbaDePapeis papeis={form.papeis} onAlternar={alternarPapel} />
        ) : editando && aba === ABA_CONTATOS ? (
          <AbaDeContatos
            clienteId={cliente.id}
            cache={cache}
            principalTelefone={principal.telefone}
            principalEmail={principal.email}
            onPrincipal={(tipo, valor) => void marcarPrincipal(tipo, valor)}
          />
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
          <AbaDeInformacoes
            form={form}
            set={set}
            aplicar={(mudanca) => setForm((f) => ({ ...f, ...mudanca }))}
            clienteId={cliente?.id ?? null}
            novoCadastro={!editando}
            onDuplicado={setDocumentoDuplicado}
          />
        )}
      </div>
    </FormDrawer>
  );
}
