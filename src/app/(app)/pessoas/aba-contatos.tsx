"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  Button,
  EmptyRow,
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
      titulo="Contatos"
      legenda="Todos os telefones e e-mails desta pessoa. O marcado como principal é o que a cobrança usa e o que casa esta pessoa com a conversa no WhatsApp; os demais ficam aqui para quem precisar falar com outro setor."
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
            <EmptyRow colSpan={4} message="Carregando…" />
          ) : itens.length === 0 ? (
            <EmptyRow
              colSpan={4}
              message={
                tipo === "telefone" ? "Nenhum telefone cadastrado." : "Nenhum e-mail cadastrado."
              }
            />
          ) : (
            itens.map((c) => {
              const ehPrincipal = c.valor === principal;

              return (
                <Tr key={c.id}>
                  <Td>{c.valor}</Td>
                  <Td>{c.rotulo || <span style={{ color: "var(--text-disabled)" }}>—</span>}</Td>

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
  const [salvando, setSalvando] = useState(false);

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
        body: JSON.stringify({ tipo, valor: limpo, rotulo: rotulo.trim() || null }),
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

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void salvar();
          if (e.key === "Escape") onFechar();
        }}
        placeholder={tipo === "telefone" ? "(00) 00000-0000" : "financeiro@empresa.com.br"}
        type={tipo === "email" ? "email" : "text"}
        style={{ ...inputStyle, flex: 2 }}
      />

      {/*
        ⚠️ O setor não é obrigatório. "Financeiro", "Comercial", "Portaria" é o
        que faz três telefones da mesma empresa deixarem de ser três números
        iguais. Obrigatório, viraria uma caixa preenchida com qualquer coisa só
        para o botão liberar.
      */}
      <input
        value={rotulo}
        onChange={(e) => setRotulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void salvar();
          if (e.key === "Escape") onFechar();
        }}
        placeholder="Setor (opcional)"
        style={{ ...inputStyle, flex: 1 }}
      />

      {contato && podeExcluir && (
        <BotaoDeAcao rotulo="Remover" perigo onClick={() => void remover()}>
          <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
        </BotaoDeAcao>
      )}

      <Button size="sm" variant="ghost" onClick={onFechar}>
        Cancelar
      </Button>

      <Button
        size="sm"
        variant="secondary"
        disabled={!valor.trim() || salvando}
        onClick={() => void salvar()}
      >
        {contato ? "Salvar" : "Adicionar"}
      </Button>
    </div>
  );
}
