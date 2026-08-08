"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import {
  ActiveToggle,
  EmptyRow,
  GrupoDeCampos,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import type { UsuarioDaPessoa } from "@/modules/clientes/clientes.types";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Quem enxerga os dados desta pessoa pelo portal.
 *
 * ⚠️ É acesso ao PORTAL, e não permissão de sistema. Quem está aqui vê as
 * faturas, os tickets e os documentos deste cadastro do lado de fora; não ganha
 * nada dentro do sistema da empresa.
 *
 * ⚠️ Aqui só se DESLIGA. Dar acesso é entregar dado financeiro de terceiro a
 * alguém, e esse gesto mora no cadastro de usuários, junto do resto do que aquela
 * pessoa pode ver. Esta aba responde "quem está entrando hoje", e a única ação
 * que ela precisa é cortar quem não devia mais.
 */
type Acesso = { comAcesso: UsuarioDaPessoa[]; disponiveis: UsuarioDaPessoa[] };

export function AbaDeAcesso({
  clienteId,
  nome,
  cache,
}: {
  clienteId: number;
  nome: string;
  cache: CacheDoDrawer;
}) {
  const { avisar } = useAvisos();
  const [salvando, setSalvando] = useState(false);

  const { dados, recarregar: carregar } = useRecursoDaPessoa<Acesso>(
    cache,
    "acesso",
    `/api/v1/clientes/${clienteId}/acesso`,
  );

  const comAcesso = dados?.comAcesso ?? null;
  const atuais = (comAcesso ?? []).map((u) => u.id);

  async function desligar(usuarioId: string) {
    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/acesso`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarios: atuais.filter((id) => id !== usuarioId) }),
    });

    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", "Não foi possível tirar o acesso");
      return;
    }

    void carregar();
  }

  return (
    <GrupoDeCampos
      primeiro
      titulo="Acesso ao portal"
      legenda={`Quem estiver aqui vê as faturas, os tickets e os documentos de ${nome} pelo portal do cliente. Não é permissão dentro do sistema: é o lado de fora, e dar acesso a alguém novo se faz no cadastro de usuários.`}
    >
      <TableArea minWidth={0}>
        <TableHead>
          {/*
            ⚠️ Sem a coluna do avatar. Ela existe na listagem de pessoas para
            reconhecer a linha certa sem ler, entre dezenas de nomes parecidos;
            aqui são dois ou três usuários com nome e e-mail ao lado, e a bolinha
            só gastava uma coluna repetindo a primeira letra do que está escrito.
          */}
          <Th>Usuário</Th>
          <Th minWidth={200}>E-mail</Th>
          <Th align="center" minWidth={90}>
            Acesso
          </Th>
        </TableHead>

        <tbody>
          {comAcesso == null ? (
            <EmptyRow colSpan={3} message="Carregando…" />
          ) : comAcesso.length === 0 ? (
            <EmptyRow colSpan={3} message="Ninguém tem acesso a este cadastro pelo portal." />
          ) : (
            comAcesso.map((u) => (
              <Tr key={u.id}>
                {/*
                  Sem nome nem e-mail, sai o uuid. É feio e é honesto: o usuário
                  existe, e um traço faria parecer que a linha está quebrada.
                */}
                <Td>{u.nome || u.email || u.id}</Td>

                <Td>
                  {u.nome && u.email ? (
                    u.email
                  ) : (
                    <span style={{ color: "var(--text-disabled)" }}>—</span>
                  )}
                </Td>

                <Td style={{ textAlign: "center" }}>
                  {/*
                    ⚠️ Interruptor, e não lixeira.

                    Lixeira diz "apagar", e ninguém está apagando usuário nenhum:
                    ele continua existindo, só deixa de ver este cadastro. O
                    interruptor é o desenho de ligado e desligado, que é
                    exatamente o que acontece.

                    ⚠️ Desligando, a linha SAI da lista, porque a lista é de quem
                    tem acesso. Religar se faz onde o acesso é dado.
                  */}
                  <div style={{ display: "inline-flex" }}>
                    <ActiveToggle
                      active
                      onChange={() => {
                        if (!salvando) void desligar(u.id);
                      }}
                    />
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </TableArea>
    </GrupoDeCampos>
  );
}
