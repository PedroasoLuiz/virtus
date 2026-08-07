"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Avatar } from "@/components/ui/avatar";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  Button,
  EmptyRow,
  GrupoDeCampos,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
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
 * ⚠️ Vincular alguém é dar acesso a dado financeiro de terceiro. A lista de
 * candidatos sai de `usuarios_visiveis()`: ninguém consegue dar acesso a um
 * usuário que nem enxerga.
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

  const [escolhido, setEscolhido] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { dados, recarregar: carregar } = useRecursoDaPessoa<Acesso>(
    cache,
    "acesso",
    `/api/v1/clientes/${clienteId}/acesso`,
  );

  const comAcesso = dados?.comAcesso ?? null;
  const disponiveis = dados?.disponiveis ?? [];

  async function gravar(usuarios: string[]) {
    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/acesso`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarios }),
    });

    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", "Não foi possível salvar o acesso");
      return;
    }

    setEscolhido("");
    void carregar();
  }

  const atuais = (comAcesso ?? []).map((u) => u.id);
  const faltam = disponiveis.filter((u) => !atuais.includes(u.id));

  return (
    <>
      <GrupoDeCampos
        primeiro
        titulo="Acesso ao portal"
        legenda={`Quem estiver aqui vê as faturas, os tickets e os documentos de ${nome} pelo portal do cliente. Não é permissão dentro do sistema: é o lado de fora.`}
      >
        <TableArea minWidth={0}>
          <TableHead>
            <Th className="col-avatar" minWidth={26}>
              {" "}
            </Th>
            <Th>Usuário</Th>
            <Th minWidth={200}>E-mail</Th>
            <Th> </Th>
          </TableHead>

          <tbody>
            {comAcesso == null ? (
              <EmptyRow colSpan={4} message="Carregando…" />
            ) : comAcesso.length === 0 ? (
              <EmptyRow colSpan={4} message="Ninguém tem acesso a este cadastro pelo portal." />
            ) : (
              comAcesso.map((u) => (
                <Tr key={u.id}>
                  <Td className="col-avatar">
                    <Avatar nome={u.nome || u.email || "?"} semente={u.id} tamanho={26} />
                  </Td>

                  {/*
                    Sem nome nem e-mail, sai o uuid. É feio e é honesto: o
                    usuário existe, e um traço faria parecer que a linha está
                    quebrada.
                  */}
                  <Td>{u.nome || u.email || u.id}</Td>

                  <Td>
                    {u.nome && u.email ? (
                      u.email
                    ) : (
                      <span style={{ color: "var(--text-disabled)" }}>—</span>
                    )}
                  </Td>

                  <Td>
                    <AcoesDaLinha>
                      <BotaoDeAcao
                        rotulo="Tirar o acesso"
                        perigo
                        desabilitado={salvando}
                        onClick={() => void gravar(atuais.filter((id) => id !== u.id))}
                      >
                        <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableArea>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <select
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
          style={{ ...selectStyle, flex: 1 }}
          aria-label="Usuário"
        >
          <option value="">
            {faltam.length === 0 ? "Nenhum usuário disponível" : "Escolher usuário…"}
          </option>

          {faltam.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome || u.email || u.id}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          variant="secondary"
          disabled={!escolhido || salvando}
          onClick={() => void gravar([...atuais, escolhido])}
        >
            Dar acesso
          </Button>
        </div>
      </GrupoDeCampos>
    </>
  );
}
