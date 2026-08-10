"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import { Alert, Button, CampoSecreto, Field, Formulario, GrupoDeCampos } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import type { Acesso } from "@/modules/insights/insights.types";

/**
 * Renova o token de um acesso.
 *
 * ⚠️ Um gesto só, valendo para TODAS as contas daquele acesso. É o ganho central
 * do modelo: antes o segredo era copiado por conta de anúncio, e renovar
 * significava repetir isto conta a conta — na prática, ninguém repetia, e o
 * painel de metade delas parava sem explicação.
 */
export function RenovarAcessoDrawer({
  acesso,
  onClose,
}: {
  acesso: Acesso;
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [token, setToken] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function renovar() {
    setSalvando(true);

    const r = await fetch(`/api/v1/insights/acessos/${acesso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível renovar");
      return;
    }

    // O token some do estado assim que a resposta volta: não tem mais uso aqui,
    // e deixá-lo no formulário o mantém na memória da aba à toa.
    setToken("");
    avisar("sucesso", "Acesso renovado");
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Renovar acesso"
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={salvando || token.trim().length < 20}
          onClick={renovar}
        >
          {salvando ? "Renovando…" : "Renovar"}
        </Button>
      }
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="Novo token"
          legenda="Vale para todas as contas de anúncio ligadas a este acesso."
        >
          <Alert variant="info" title="O token curto vira um de 60 dias">
            Cole o token gerado no Graph API Explorer. Ele dura cerca de uma hora, e o Vpay o
            troca por um de 60 dias antes de guardar. Depois disso, a renovação passa a
            acontecer sozinha.
          </Alert>

          <Field label="Token de acesso" required>
            <CampoSecreto valor={token} placeholder="EAAG…" onMudar={setToken} />
          </Field>
        </GrupoDeCampos>
      </Formulario>
    </Drawer>
  );
}
