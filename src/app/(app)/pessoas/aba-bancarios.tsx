"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  GrupoDeCampos,
  MarcaDePrincipal,
  MarcaDeUso,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import type { DadoBancarioDaPessoa } from "@/modules/clientes/clientes.types";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Para onde o dinheiro desta pessoa vai.
 *
 * ⚠️ Não é conta bancária da EMPRESA. Aquelas têm saldo, limite e extrato, e
 * entram no fluxo de caixa; estas são dado de terceiro, para preencher um
 * pagamento — e nunca para conciliar. Por isso não há valor nenhum aqui.
 */

const PIX = [
  { valor: "cpf", rotulo: "CPF" },
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "aleatoria", rotulo: "Chave aleatória" },
];

export function AbaDeBancarios({
  clienteId,
  cache,
}: {
  clienteId: number;
  cache: CacheDoDrawer;
}) {
  const { avisar } = useAvisos();

  /**
   * O que o formulário está fazendo: nada, cadastrando, ou corrigindo um id.
   *
   * ⚠️ Um estado só para os dois. Com um `novo` e um `editando` separados, os
   * dois podiam estar ligados ao mesmo tempo e o formulário ficava sem saber se
   * salvava por cima ou criava outro.
   */
  const [aberto, setAberto] = useState<null | "novo" | { id: number }>(null);

  const { dados: itens, recarregar: carregar } = useRecursoDaPessoa<DadoBancarioDaPessoa[]>(
    cache,
    "bancarios",
    `/api/v1/clientes/${clienteId}/bancarios`,
  );

  async function remover(id: number) {
    const r = await fetch(`/api/v1/clientes/${clienteId}/bancarios/${id}`, { method: "DELETE" });

    if (!r.ok) {
      avisar("atencao", "Não foi possível remover");
      return;
    }

    // Fecha antes de recarregar: o formulário lê o registro pelo id da lista, e
    // com o registro fora dela ele viraria um cadastro novo em branco.
    setAberto(null);
    void carregar();
  }

  return (
    <>
      <GrupoDeCampos
        primeiro
        titulo="Dados bancários"
        legenda="Para onde o pagamento sai, ou de onde a devolução vem. São dados de terceiro: não entram no fluxo de caixa nem na conciliação, servem para preencher o pagamento na hora certa."
        onIncluir={aberto ? undefined : () => setAberto("novo")}
        rotuloIncluir="Nova conta"
      >
        <TableArea minWidth={0}>
          <TableHead>
            <Th>Banco</Th>
            <Th minWidth={150}>Conta</Th>
            <Th minWidth={170}>PIX</Th>
            <Th align="center" minWidth={90}>
              Principal
            </Th>
            <Th> </Th>
          </TableHead>

          <tbody>
            {itens == null ? (
              <EmptyRow colSpan={5} message="Carregando…" />
            ) : itens.length === 0 ? (
              <EmptyRow colSpan={5} message="Nenhuma conta cadastrada." />
            ) : (
              itens.map((d) => (
                <Linha key={d.id} dado={d} onEditar={() => setAberto({ id: d.id })} />
              ))
            )}
          </tbody>
        </TableArea>
      </GrupoDeCampos>

      {aberto && (
        <Formulario
          // Trocar de linha remonta o formulário, então os campos já nascem do
          // registro certo sem efeito para sincronizar.
          key={aberto === "novo" ? "novo" : aberto.id}
          clienteId={clienteId}
          dado={aberto === "novo" ? null : ((itens ?? []).find((d) => d.id === aberto.id) ?? null)}
          primeiro={(itens ?? []).length === 0}
          /*
           * ⚠️ Só dá para excluir com mais de uma cadastrada. Zerando a lista, o
           * pagamento fica sem destino e a tela não tem onde avisar disso. Quem
           * quer trocar a única que existe corrige a que está ali.
           */
          podeExcluir={(itens ?? []).length > 1}
          onRemover={(id) => void remover(id)}
          onFechar={() => setAberto(null)}
          onSalvou={() => {
            setAberto(null);
            void carregar();
          }}
        />
      )}
    </>
  );
}

function Linha({ dado, onEditar }: { dado: DadoBancarioDaPessoa; onEditar: () => void }) {
  const conta = [dado.agencia && `Ag. ${dado.agencia}`, dado.conta].filter(Boolean).join(" · ");

  return (
    <Tr>
      <Td>
        {dado.banco || <span style={{ color: "var(--text-disabled)" }}>Sem banco</span>}

        {/*
          ⚠️ Titular só aparece quando é OUTRA pessoa, e em âmbar. Repetir o nome
          do próprio cadastro em toda linha seria dizer o que já está no topo do
          drawer — e o que importa é justamente o caso em que não bate, porque
          banco recusa depósito com titular diferente.
        */}
        {dado.titular && (
          <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--warning-text)" }}>
            Titular: {dado.titular}
          </div>
        )}
      </Td>

      <Td>
        <div>{conta || <span style={{ color: "var(--text-disabled)" }}>—</span>}</div>
        {dado.tipo && (
          <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {dado.tipo === "poupanca" ? "Poupança" : "Corrente"}
          </div>
        )}
      </Td>

      <Td style={{ maxWidth: 200 }}>
        {dado.pixChave ? (
          <>
            <div
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={dado.pixChave}
            >
              {dado.pixChave}
            </div>
            {dado.pixTipo && (
              <div
                style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}
              >
                {PIX.find((p) => p.valor === dado.pixTipo)?.rotulo ?? dado.pixTipo}
              </div>
            )}
          </>
        ) : (
          <span style={{ color: "var(--text-disabled)" }}>—</span>
        )}
      </Td>

      <Td style={{ textAlign: "center" }}>
        {/*
          Aqui a marca é só LEITURA: trocar o principal exige saber para onde o
          pagamento passa a ir, e um clique de passagem numa coluna de conta
          bancária é fácil demais de dar sem querer.
        */}
        <MarcaDePrincipal
          marcado={dado.principal}
          rotulo={dado.principal ? "É a conta principal" : "Não é a principal"}
          onClick={() => {}}
        />
      </Td>

      <Td>
        {/*
          ⚠️ A linha tem EDITAR, e não a lixeira. Excluir é a ação rara e a
          irreversível; à mão numa lista que se abre para conferir uma conta,
          ela convida o clique errado. Mora dentro da edição.
        */}
        <AcoesDaLinha>
          <BotaoDeAcao rotulo="Editar" onClick={onEditar}>
            <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
          </BotaoDeAcao>
        </AcoesDaLinha>
      </Td>
    </Tr>
  );
}

function Formulario({
  clienteId,
  dado,
  primeiro,
  podeExcluir,
  onRemover,
  onFechar,
  onSalvou,
}: {
  clienteId: number;
  /** `null` = cadastro novo. */
  dado: DadoBancarioDaPessoa | null;
  primeiro: boolean;
  podeExcluir: boolean;
  onRemover: (id: number) => void;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const [form, setForm] = useState({
    banco: dado?.banco ?? "",
    agencia: dado?.agencia ?? "",
    conta: dado?.conta ?? "",
    tipo: dado?.tipo ?? "corrente",
    titular: dado?.titular ?? "",
    documento: dado?.documento ?? "",
    pixTipo: dado?.pixTipo ?? "",
    pixChave: dado?.pixChave ?? "",
    principal: primeiro,
  });

  const set = (campo: keyof typeof form, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  return (
    /*
      ⚠️ DRAWER próprio, e não um formulário embaixo da tabela. São oito campos:
      abertos na lista, empurravam a tabela para fora da tela e quem corrigia uma
      agência perdia de vista qual das contas tinha clicado.
    */
    <FormDrawer
      aberto
      nivel={2}
      larguraDrawer={460}
      titulo={dado ? "Editar conta" : "Nova conta"}
      onClose={onFechar}
      aoSalvar={onSalvou}
      url={
        dado
          ? `/api/v1/clientes/${clienteId}/bancarios/${dado.id}`
          : `/api/v1/clientes/${clienteId}/bancarios`
      }
      metodo={dado ? "PUT" : "POST"}
      valores={() => ({
        banco: form.banco.trim() || null,
        agencia: form.agencia.trim() || null,
        conta: form.conta.trim() || null,
        tipo: form.tipo || null,
        titular: form.titular.trim() || null,
        documento: form.documento.trim() || null,
        // Sem chave não há tipo: o par só faz sentido junto, e gravar o tipo
        // sozinho deixaria "PIX CPF" escrito sem CPF nenhum embaixo.
        pixTipo: form.pixChave.trim() ? form.pixTipo || null : null,
        pixChave: form.pixChave.trim() || null,
        /*
         * ⚠️ O `principal` só vai no CADASTRO. Ele é exclusivo entre as contas da
         * pessoa, e mexer nele por aqui exigiria derrubar a anterior no mesmo
         * salvar.
         */
        ...(dado ? {} : { principal: form.principal }),
      })}
    >
      <Field label="Banco">
        <input
          style={inputStyle}
          value={form.banco}
          onChange={(e) => set("banco", e.target.value)}
          placeholder="Nome ou número do banco"
          autoFocus
        />
      </Field>

      <Field label="Agência">
        <input
          style={inputStyle}
          value={form.agencia}
          onChange={(e) => set("agencia", e.target.value)}
          placeholder="Com o dígito, quando tiver"
        />
      </Field>

      <Field label="Conta">
        <input
          style={inputStyle}
          value={form.conta}
          onChange={(e) => set("conta", e.target.value)}
          placeholder="Com o dígito"
        />
      </Field>

      <Field label="Tipo de conta">
        <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} style={selectStyle}>
          <option value="corrente">Corrente</option>
          <option value="poupanca">Poupança</option>
        </select>
      </Field>

      <Field label="Tipo da chave PIX">
        <select
          value={form.pixTipo}
          onChange={(e) => set("pixTipo", e.target.value)}
          style={selectStyle}
        >
          <option value="">Não informado</option>
          {PIX.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Chave PIX">
        <input
          style={inputStyle}
          value={form.pixChave}
          onChange={(e) => set("pixChave", e.target.value)}
          placeholder="A chave, do jeito que ela é registrada"
        />
      </Field>

      {/*
        ⚠️ Titular só quando é OUTRA pessoa, e a dica diz por quê. Banco recusa
        depósito com titular diferente do que está na ordem, e essa é a hora de
        registrar a diferença — não a hora de repetir o nome do cadastro.
      */}
      <Field
        label="Titular"
        hint="Só quando a conta é de outra pessoa. Em branco, o titular é o próprio cadastro."
      >
        <input
          style={inputStyle}
          value={form.titular}
          onChange={(e) => set("titular", e.target.value)}
          placeholder="Nome do titular"
        />
      </Field>

      <Field label="Documento do titular">
        <input
          style={inputStyle}
          value={form.documento}
          onChange={(e) => set("documento", e.target.value)}
          placeholder="CPF ou CNPJ"
        />
      </Field>

      {!primeiro && !dado && (
        <Field label="Principal">
          {/*
            ⚠️ A mesma marca da coluna da tabela, e nao a caixa do navegador.
            A nativa vinha com a cor e o tamanho do sistema operacional, e ficava
            de outra familia no meio de campos que o kit desenha.
          */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: "var(--h-input)" }}>
            <MarcaDeUso
              marcado={form.principal}
              rotulo={form.principal ? "Deixa de ser o principal" : "Usar como principal"}
              onClick={() => setForm((f) => ({ ...f, principal: !f.principal }))}
            />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              É para esta conta que o pagamento vai
            </span>
          </div>
        </Field>
      )}


      {/*
        ⚠️ Excluir no FIM do formulário, e não ao lado do salvar do cabeçalho.

        É a única ação daqui que não dá para desfazer. No topo, colada no
        "Salvar", ela vira erro de mira; no fim, ela é a última coisa que se
        encontra, o que é exatamente a frequência com que deve ser usada.
      */}
      {dado && podeExcluir && (
        <div style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <Button size="sm" variant="ghost" onClick={() => onRemover(dado.id)}>
            <span style={{ color: "var(--danger-text)" }}>Excluir conta</span>
          </Button>
        </div>
      )}
    </FormDrawer>
  );
}
