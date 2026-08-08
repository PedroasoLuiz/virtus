"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  EmptyRow,
  Field,
  FormularioDaLista,
  GrupoDeCampos,
  MarcaDePrincipal,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
} from "@/components/ui/kit";
import type { ContatoDaPessoa } from "@/modules/clientes/clientes.types";
import { analisarTelefone, mascararTelefone } from "@/shared/domain/telefone";

/**
 * Telefones e e-mails da pessoa.
 *
 * ⚠️ Lista, e não um campo de cada. Uma empresa tem o e-mail do financeiro, o do
 * comercial e o telefone de cada um. Guardar um só obrigava a escolher qual
 * perder, e quem precisava do outro anotava num papel.
 *
 * ⚠️ O PRINCIPAL é escolhido aqui, numa coluna, e não num campo em Informações.
 * Lá era um segundo lugar dizendo a mesma coisa: a pessoa cadastrava o telefone
 * nesta aba e depois precisava lembrar de voltar na outra para dizer qual usar.
 * Na coluna, cadastrar e escolher são o mesmo gesto.
 */

const TELEFONES = "Telefones";
const EMAILS = "E-mails";

export function AbaDeContatos({
  clienteId,
  contatos,
  principalTelefone,
  principalEmail,
  onMudou,
  onPrincipal,
}: {
  clienteId: number;
  /** `null` enquanto carrega. Vem de fora: o drawer também usa. */
  contatos: ContatoDaPessoa[] | null;
  principalTelefone: string;
  principalEmail: string;
  onMudou: () => void;
  onPrincipal: (tipo: "telefone" | "email", valor: string) => void;
}) {
  const [sub, setSub] = useState<string>(TELEFONES);
  const [aberto, setAberto] = useState<Aberto>(null);

  const tipo: "telefone" | "email" = sub === TELEFONES ? "telefone" : "email";
  const daVez = (contatos ?? []).filter((c) => c.tipo === tipo);
  const principal = tipo === "telefone" ? principalTelefone : principalEmail;

  return (
    <GrupoDeCampos
      primeiro
      titulo="Por onde falar"
      legenda="O marcado como principal é o que a cobrança usa e o que casa esta pessoa com a conversa no WhatsApp. Os demais ficam aqui para quem precisa falar com outro setor, e cada um guarda quem atende do outro lado."
      onIncluir={aberto ? undefined : () => setAberto("novo")}
      rotuloIncluir={tipo === "telefone" ? "Novo telefone" : "Novo e-mail"}
    >
      {/*
        ⚠️ As subguias usam a MESMA anatomia das abas de cima, e não pastilhas.
        São duas listas irmãs, do mesmo jeito que Informações e Endereço são
        duas telas irmãs, e dois desenhos diferentes para o mesmo gesto fazem a
        pessoa aprender duas vezes.
      */}
      <PanelTabs
        tabs={[TELEFONES, EMAILS]}
        active={sub}
        onChange={(t) => {
          setSub(t);
          // O formulário aberto era do OUTRO tipo: seguir aberto faria o campo
          // de telefone pedir um e-mail sem nada dizer que mudou de assunto.
          setAberto(null);
        }}
      />

      <Lista
        key={tipo}
        clienteId={clienteId}
        tipo={tipo}
        itens={contatos == null ? null : daVez}
        principal={principal}
        aberto={aberto}
        onAbrir={setAberto}
        onMudou={onMudou}
        onPrincipal={(valor) => onPrincipal(tipo, valor)}
      />
    </GrupoDeCampos>
  );
}

/**
 * O que o formulário está fazendo: nada, cadastrando, ou corrigindo um id.
 *
 * ⚠️ Um estado só para os dois. Com um `novo` e um `editando` separados, os dois
 * podiam estar ligados ao mesmo tempo e o formulário ficava sem saber se salvava
 * por cima ou criava outro.
 */
type Aberto = null | "novo" | { id: number };

function Lista({
  clienteId,
  tipo,
  itens,
  principal,
  aberto,
  onAbrir,
  onMudou,
  onPrincipal,
}: {
  clienteId: number;
  tipo: "telefone" | "email";
  itens: ContatoDaPessoa[] | null;
  principal: string;
  aberto: Aberto;
  onAbrir: (a: Aberto) => void;
  onMudou: () => void;
  onPrincipal: (valor: string) => void;
}) {
  const rotuloDoValor = tipo === "telefone" ? "Número" : "E-mail";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TableArea minWidth={0}>
        <TableHead>
          {/*
            ⚠️ "Número", e não "Telefone". A aba já se chama Contatos e a subguia
            já se chama Telefones: a terceira repetição não informa nada e ainda
            faz a coluna parecer de outro assunto.
          */}
          <Th>{rotuloDoValor}</Th>
          <Th minWidth={110}>Setor</Th>
          {/*
            ⚠️ O responsável é do CONTATO, e não do cadastro. Quem atende o
            telefone do financeiro não é quem lê o e-mail do comercial, e um
            nome só na ficha mandava todo mundo falar com a mesma pessoa.
          */}
          <Th minWidth={140}>Responsável</Th>
          {/*
            ⚠️ A coluna é clicável, e o cabeçalho não diz "marcar". O que se lê
            é o estado; o clique se descobre no hover, como em toda linha
            clicável do sistema.
          */}
          <Th align="center" minWidth={90}>
            Principal
          </Th>
          <Th> </Th>
        </TableHead>

        <tbody>
          {itens == null ? (
            <EmptyRow colSpan={5} message="Carregando…" />
          ) : itens.length === 0 ? (
            <EmptyRow
              colSpan={5}
              message={
                tipo === "telefone" ? "Nenhum telefone cadastrado." : "Nenhum e-mail cadastrado."
              }
            />
          ) : (
            itens.map((c) => {
              const ehPrincipal = c.valor === principal;

              return (
                <Tr key={c.id}>
                  <Td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {c.valor}
                      {/*
                        ⚠️ Colado no e-mail, e não numa coluna própria.

                        A marca é sobre AQUELE endereço: é por ele que a pessoa
                        entra no portal. Numa coluna à parte, ela viraria mais um
                        atributo da linha, e uma coluna quase sempre vazia.
                      */}
                      {c.usuario && <MarcaDeUsuario nome={c.usuario} />}
                    </span>
                  </Td>
                  <Td>{c.rotulo || <span style={{ color: "var(--text-disabled)" }}>—</span>}</Td>
                  <Td>
                    {c.responsavel || <span style={{ color: "var(--text-disabled)" }}>—</span>}
                  </Td>

                  <Td style={{ textAlign: "center" }}>
                    <MarcaDePrincipal
                      marcado={ehPrincipal}
                      rotulo={ehPrincipal ? "É o principal" : `Usar ${c.valor} como principal`}
                      onClick={() => !ehPrincipal && onPrincipal(c.valor)}
                    />
                  </Td>

                  <Td>
                    {/*
                      ⚠️ A linha tem EDITAR, e não a lixeira. Excluir é a ação
                      rara e a irreversível; deixá-la à mão numa lista que se
                      abre para conferir um número é convidar o clique errado.
                      Ela mora dentro da edição, ao lado do que se ia corrigir.
                    */}
                    <AcoesDaLinha>
                      <BotaoDeAcao rotulo="Editar" onClick={() => onAbrir({ id: c.id })}>
                        <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              );
            })
          )}
        </tbody>
      </TableArea>

      {aberto && (
        <Editor
          // Trocar de linha remonta o editor, então os campos já nascem do
          // registro certo sem efeito para sincronizar.
          key={aberto === "novo" ? "novo" : aberto.id}
          clienteId={clienteId}
          tipo={tipo}
          contato={aberto === "novo" ? null : ((itens ?? []).find((c) => c.id === aberto.id) ?? null)}
          /*
           * ⚠️ Só dá para excluir com mais de um cadastrado. Zerando a lista, a
           * cobrança fica sem destino e a tela não tem onde avisar disso. Quem
           * quer trocar o único que existe corrige o que está ali.
           */
          podeExcluir={(itens ?? []).length > 1}
          ehPrincipal={
            aberto !== "novo" &&
            (itens ?? []).find((c) => c.id === aberto.id)?.valor === principal
          }
          onFechar={() => onAbrir(null)}
          onMudou={onMudou}
          onPrincipal={onPrincipal}
          principalVazio={!principal}
        />
      )}
    </div>
  );
}

/**
 * Cadastra ou corrige um contato.
 *
 * ⚠️ Os campos só existem depois do mais ou do lápis. Abertos o tempo todo, eles
 * pareciam parte da lista: uma linha de tabela em branco esperando ser
 * preenchida, embaixo das que já existem. A aba é para consultar quem já está
 * cadastrado; cadastrar é o gesto de vez em quando.
 */
function Editor({
  clienteId,
  tipo,
  contato,
  podeExcluir,
  ehPrincipal,
  principalVazio,
  onFechar,
  onMudou,
  onPrincipal,
}: {
  clienteId: number;
  tipo: "telefone" | "email";
  /** `null` = cadastro novo. */
  contato: ContatoDaPessoa | null;
  podeExcluir: boolean;
  ehPrincipal: boolean;
  principalVazio: boolean;
  onFechar: () => void;
  onMudou: () => void;
  onPrincipal: (valor: string) => void;
}) {
  const { avisar } = useAvisos();

  const [valor, setValor] = useState(contato?.valor ?? "");
  const [rotulo, setRotulo] = useState(contato?.rotulo ?? "");
  const [responsavel, setResponsavel] = useState(contato?.responsavel ?? "");
  const [salvando, setSalvando] = useState(false);

  /*
   * ⚠️ O erro do telefone só aparece DEPOIS que o campo perde o foco.
   *
   * Conferindo a cada tecla, "(35) 9" já acusava "faltam dígitos" na segunda
   * letra digitada: a tela reclamava do número enquanto a pessoa ainda o estava
   * escrevendo. O servidor confere de novo de qualquer jeito.
   */
  const [tocado, setTocado] = useState(false);

  const erro =
    tocado && tipo === "telefone" && valor.trim() ? analisarTelefone(valor).erro : null;

  async function salvar() {
    const limpo = valor.trim();
    if (!limpo || salvando) return;

    setSalvando(true);

    const r = await fetch(
      contato
        ? `/api/v1/clientes/${clienteId}/contatos/${contato.id}`
        : `/api/v1/clientes/${clienteId}/contatos`,
      {
        method: contato ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          valor: limpo,
          rotulo: rotulo.trim() || null,
          responsavel: responsavel.trim() || null,
        }),
      },
    );

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      const detalhe = corpo?.error?.details?.[0];

      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível salvar"),
      );
      return;
    }

    /*
     * ⚠️ O principal acompanha a correção.
     *
     * Ele é guardado em `clientes` pelo VALOR, e não pelo id do contato: sem
     * isto, corrigir um dígito do número principal deixava o cadastro apontando
     * para um valor que não existe mais em lugar nenhum.
     *
     * O primeiro cadastrado também vira principal sozinho: sem isso, quem
     * cadastra um telefone e fecha o drawer sai com a cobrança ainda sem
     * destino, e nada na tela dizia que faltava um segundo clique.
     */
    if (ehPrincipal || (!contato && principalVazio)) onPrincipal(limpo);

    onFechar();
    onMudou();
  }

  async function remover() {
    if (!contato) return;

    const r = await fetch(`/api/v1/clientes/${clienteId}/contatos/${contato.id}`, {
      method: "DELETE",
    });

    if (!r.ok) {
      avisar("atencao", "Não foi possível remover");
      return;
    }

    onFechar();
    onMudou();
  }

  const rotuloDoValor = tipo === "telefone" ? "Número" : "E-mail";

  return (
    <FormularioDaLista
      titulo={
        contato
          ? `Editar ${tipo === "telefone" ? "telefone" : "e-mail"}`
          : `Novo ${tipo === "telefone" ? "telefone" : "e-mail"}`
      }
      onExcluir={contato && podeExcluir ? () => void remover() : undefined}
      onCancelar={onFechar}
      onSalvar={() => void salvar()}
      rotuloSalvar={contato ? "Salvar" : "Adicionar"}
      podeSalvar={Boolean(valor.trim()) && !erro}
      salvando={salvando}
    >
      <Field label={rotuloDoValor} error={erro ?? undefined} required>
        <input
          autoFocus
          value={valor}
          onChange={(e) =>
            // ⚠️ A máscara só formata o que já foi digitado, e nunca completa: uma
            // que insere o que falta empurra o cursor de quem está apagando.
            setValor(tipo === "telefone" ? mascararTelefone(e.target.value) : e.target.value)
          }
          onBlur={() => setTocado(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") onFechar();
          }}
          placeholder={tipo === "telefone" ? "(00) 00000-0000" : "financeiro@empresa.com.br"}
          type={tipo === "email" ? "email" : "text"}
          style={inputStyle}
        />
      </Field>

      {/*
        ⚠️ Setor e responsável são OPCIONAIS. "Financeiro", "Comercial",
        "Portaria" é o que faz três telefones da mesma empresa deixarem de ser
        três números iguais, e o responsável é quem atende ali. Obrigatórios,
        virariam caixas preenchidas com qualquer coisa só para o botão liberar.
      */}
      <Field label="Setor">
        <input
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") onFechar();
          }}
          placeholder="Financeiro, comercial, portaria"
          style={inputStyle}
        />
      </Field>

      <Field label="Quem atende">
        <input
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") onFechar();
          }}
          placeholder="Nome de quem responde por este contato"
          style={inputStyle}
        />
      </Field>
    </FormularioDaLista>
  );
}

/**
 * O e-mail que também é porta de entrada no portal.
 *
 * ⚠️ Verde, e não cinza. Não é um aviso nem um estado a resolver: é uma coisa boa
 * que aconteceu, o cliente tem gente vendo as próprias faturas.
 *
 * ⚠️ SEM fundo. A bolinha atrás dele fazia a marca parecer uma pastilha de
 * status, do mesmo naipe das siglas de papel da listagem, e ela não é um estado:
 * é um traço do endereço ao lado.
 */
function MarcaDeUsuario({ nome }: { nome: string }) {
  return (
    <span
      title={`${nome} entra no portal com este e-mail`}
      aria-label={`${nome} entra no portal com este e-mail`}
      style={{
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
        color: "var(--success-text)",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 19.5c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5" />
      </svg>
    </span>
  );
}
