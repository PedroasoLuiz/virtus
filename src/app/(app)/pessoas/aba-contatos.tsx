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
 * comercial e o telefone de cada um — guardar um só obrigava a escolher qual
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

  const tipo: "telefone" | "email" = sub === TELEFONES ? "telefone" : "email";
  const daVez = (contatos ?? []).filter((c) => c.tipo === tipo);
  const principal = tipo === "telefone" ? principalTelefone : principalEmail;

  return (
    <>
      <GrupoDeCampos
        primeiro
        titulo="Contatos"
        legenda="Todos os telefones e e-mails desta pessoa. O marcado como principal é o que a cobrança usa e o que casa esta pessoa com a conversa no WhatsApp; os demais ficam aqui para quem precisar falar com outro setor."
      >
        {/*
          ⚠️ As subguias usam a MESMA anatomia das abas de cima, e não pastilhas.
          São duas listas irmãs, do mesmo jeito que Informações e Endereço são
          duas telas irmãs — e dois desenhos diferentes para o mesmo gesto fazem
          a pessoa aprender duas vezes.
        */}
        <PanelTabs tabs={[TELEFONES, EMAILS]} active={sub} onChange={setSub} />

        <Lista
          key={tipo}
          clienteId={clienteId}
          tipo={tipo}
          itens={contatos == null ? null : daVez}
          principal={principal}
          onMudou={onMudou}
          onPrincipal={(valor) => onPrincipal(tipo, valor)}
        />
      </GrupoDeCampos>
    </>
  );
}

function Lista({
  clienteId,
  tipo,
  itens,
  principal,
  onMudou,
  onPrincipal,
}: {
  clienteId: number;
  tipo: "telefone" | "email";
  itens: ContatoDaPessoa[] | null;
  principal: string;
  onMudou: () => void;
  onPrincipal: (valor: string) => void;
}) {
  const { avisar } = useAvisos();

  const [valor, setValor] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    const limpo = valor.trim();
    if (!limpo || salvando) return;

    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/contatos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, valor: limpo, rotulo: rotulo.trim() || null }),
    });

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      const detalhe = corpo?.error?.details?.[0];

      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível adicionar"),
      );
      return;
    }

    /*
     * ⚠️ O primeiro cadastrado vira PRINCIPAL sozinho.
     *
     * Sem isso, quem cadastra um telefone e fecha o drawer sai com a cobrança
     * ainda sem destino — e nada na tela dizia que faltava um segundo clique.
     */
    if (!principal) onPrincipal(limpo);

    setValor("");
    setRotulo("");
    onMudou();
  }

  async function remover(id: number) {
    const r = await fetch(`/api/v1/clientes/${clienteId}/contatos/${id}`, { method: "DELETE" });

    if (!r.ok) {
      avisar("atencao", "Não foi possível remover");
      return;
    }

    onMudou();
  }

  const rotuloDoTipo = tipo === "telefone" ? "Telefone" : "E-mail";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TableArea minWidth={0}>
        <TableHead>
          <Th>{rotuloDoTipo}</Th>
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
                  <Td>
                    {c.rotulo || <span style={{ color: "var(--text-disabled)" }}>—</span>}
                  </Td>

                  <Td style={{ textAlign: "center" }}>
                    <MarcaDePrincipal
                      marcado={ehPrincipal}
                      rotulo={
                        ehPrincipal
                          ? "É o principal"
                          : `Usar ${c.valor} como principal`
                      }
                      onClick={() => !ehPrincipal && onPrincipal(c.valor)}
                    />
                  </Td>

                  <Td>
                    <AcoesDaLinha>
                      <BotaoDeAcao rotulo="Remover" perigo onClick={() => void remover(c.id)}>
                        <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              );
            })
          )}
        </tbody>
      </TableArea>

      {/*
        ⚠️ O rótulo fica ao lado, e não é obrigatório.

        "Financeiro", "Comercial", "Portaria" é o que faz três telefones da mesma
        empresa deixarem de ser três números iguais. Obrigatório, viraria uma
        caixa preenchida com qualquer coisa só para o botão liberar.
      */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void adicionar();
          }}
          placeholder={tipo === "telefone" ? "(00) 00000-0000" : "financeiro@empresa.com.br"}
          type={tipo === "email" ? "email" : "text"}
          style={{ ...inputStyle, flex: 2 }}
        />

        <input
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void adicionar();
          }}
          placeholder="Setor (opcional)"
          style={{ ...inputStyle, flex: 1 }}
        />

        <Button
          size="sm"
          variant="secondary"
          disabled={!valor.trim() || salvando}
          onClick={() => void adicionar()}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
