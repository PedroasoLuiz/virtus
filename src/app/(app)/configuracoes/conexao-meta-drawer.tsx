"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoBloqueado,
  Field,
  Formulario,
  GrupoDeCampos,
  SeletorBuscavel,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import type { Conexao } from "@/modules/insights/insights.types";

/**
 * Diz de quem é uma conta de anúncio já ligada.
 *
 * ⚠️ Só o cliente se edita aqui, e o resto é leitura. A conta é a chave da
 * ligação; o nome vem da Meta e se atualiza sozinho ao buscar contas; e o token
 * nem mora nesta linha — ele é do ACESSO, e se renova lá, de uma vez para todas
 * as contas. Um campo de token aqui daria a entender que existe um por conta,
 * que foi exatamente o modelo que causou o problema.
 */
export function ConexaoMetaDrawer({
  conexao,
  onClose,
}: {
  conexao: Conexao;
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [clienteId, setClienteId] = useState<number | null>(conexao.clienteId);
  const [nomeDoCliente, setNomeDoCliente] = useState<string | null>(conexao.clienteNome);
  const [salvando, setSalvando] = useState(false);

  const buscarClientes = useCallback(async (termo: string) => {
    const p = new URLSearchParams({ perPage: "15", papel: "cliente", ativo: "true" });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();
    return ((corpo.data ?? []) as { id: number; razao: string; nomeFantasia: string | null }[]).map(
      (c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }),
    );
  }, []);

  async function salvar() {
    setSalvando(true);

    const r = await fetch(`/api/v1/insights/conexoes/${conexao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível salvar");
      return;
    }

    avisar("sucesso", "Conta atualizada");
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Conta de anúncio"
      acoes={
        <Button size="xs" variant="primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <Formulario>
        <GrupoDeCampos primeiro titulo="Na Meta" legenda="Vem do Facebook e não se edita aqui.">
          <Field label="Nome">
            <CampoBloqueado
              valor={conexao.nome || "Sem nome"}
              titulo="Atualiza sozinho ao buscar contas."
            />
          </Field>

          <Field label="Conta de anúncio">
            <CampoBloqueado
              valor={conexao.adAccountId}
              titulo="Identifica a conta na Meta. Para ligar outra, use Buscar contas."
            />
          </Field>
        </GrupoDeCampos>

        <GrupoDeCampos titulo="No Vope" legenda="De quem são estas métricas.">
          <Field label="Cliente">
            <SeletorBuscavel
              valor={clienteId}
              rotulo={nomeDoCliente}
              buscar={buscarClientes}
              aoEscolher={(c) => {
                setClienteId(c?.id ?? null);
                setNomeDoCliente(c?.nome ?? null);
              }}
            />
          </Field>
        </GrupoDeCampos>
      </Formulario>
    </Drawer>
  );
}
