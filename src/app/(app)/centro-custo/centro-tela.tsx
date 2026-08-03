"use client";

import { useState } from "react";
import { CadastroSimples } from "../cadastro-simples";
import { FormDrawer } from "@/components/ui/form-drawer";
import { ActiveToggle, Badge, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import {
  TIPOS_CENTRO_CUSTO,
  type CentroCusto,
  type TipoCentroCusto,
} from "@/modules/cadastros/cadastros.types";

export function CentroCustoTela({ centros }: { centros: CentroCusto[] }) {
  return (
    <CadastroSimples
      titulo="Centro de custo"
      itens={centros}
      colunas={[
        { rotulo: "Descrição", celula: (c) => c.descricao || "—", busca: (c) => c.descricao },
        {
          rotulo: "Tipo",
          largura: 140,
          alinhamento: "center",
          celula: (c) => (
            // Receita e credito, despesa e debito — mesma convencao de cor do
            // resto do sistema.
            <Badge tom={c.tipo === "RECEITA" ? "success" : "danger"}>{c.tipo}</Badge>
          ),
          busca: (c) => c.tipo,
        },
      ]}
      drawer={(centro, fechar) => (
        <CentroDrawer key={centro?.id ?? "novo"} centro={centro} onClose={fechar} />
      )}
    />
  );
}

function CentroDrawer({ centro, onClose }: { centro: CentroCusto | null; onClose: () => void }) {
  const editando = centro !== null;

  const [descricao, setDescricao] = useState(centro?.descricao ?? "");
  const [tipo, setTipo] = useState<TipoCentroCusto>(centro?.tipo ?? "DESPESA");
  const [ativo, setAtivo] = useState(centro?.ativo ?? true);

  return (
    <FormDrawer
      aberto
      onClose={onClose}
      titulo={editando ? descricao || "Centro de custo" : "Novo centro de custo"}
      subtitulo={editando ? `#${centro.id}` : undefined}
      url={editando ? `/api/v1/centro-custo/${centro.id}` : "/api/v1/centro-custo"}
      metodo={editando ? "PATCH" : "POST"}
      podeSalvar={descricao.trim().length > 0}
      valores={() => ({ descricao: descricao.trim(), tipo, ativo })}
    >
      <Field label="Descrição" required>
        <input
          style={inputStyle}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Nome do centro de custo"
          autoFocus
        />
      </Field>

      <Field label="Tipo" required hint="Define de que lado do DRE o valor entra">
        <select
          style={selectStyle}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCentroCusto)}
        >
          {TIPOS_CENTRO_CUSTO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Situação">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ActiveToggle active={ativo} onChange={() => setAtivo(!ativo)} />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {ativo ? "Ativo" : "Inativo"}
          </span>
        </div>
      </Field>
    </FormDrawer>
  );
}
