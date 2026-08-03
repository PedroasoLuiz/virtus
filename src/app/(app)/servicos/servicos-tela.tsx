"use client";

import { useState } from "react";
import { CadastroSimples } from "../cadastro-simples";
import { FormDrawer } from "@/components/ui/form-drawer";
import { ActiveToggle, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import { deTexto, formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import type { CentroCusto, Servico } from "@/modules/cadastros/cadastros.types";

export function ServicosTela({
  servicos,
  centros,
}: {
  servicos: Servico[];
  centros: CentroCusto[];
}) {
  const nomeDoCentro = new Map(centros.map((c) => [c.id, c.descricao]));

  return (
    <CadastroSimples
      titulo="Serviços"
      itens={servicos}
      colunas={[
        {
          rotulo: "Descrição",
          celula: (s) => s.descricao || "—",
          busca: (s) => s.descricao,
        },
        {
          rotulo: "Centro de custo",
          largura: 180,
          celula: (s) => (s.centroCustoId ? (nomeDoCentro.get(s.centroCustoId) ?? "—") : "—"),
          busca: (s) => (s.centroCustoId ? (nomeDoCentro.get(s.centroCustoId) ?? "") : ""),
        },
        { rotulo: "CNAE", largura: 110, celula: (s) => s.cnae || "—", busca: (s) => s.cnae ?? "" },
        {
          rotulo: "Valor",
          largura: 120,
          alinhamento: "right",
          celula: (s) => formatarSemSimbolo(s.valor),
        },
      ]}
      drawer={(servico, fechar) => (
        <ServicoDrawer
          key={servico?.id ?? "novo"}
          servico={servico}
          centros={centros}
          onClose={fechar}
        />
      )}
    />
  );
}

function ServicoDrawer({
  servico,
  centros,
  onClose,
}: {
  servico: Servico | null;
  centros: CentroCusto[];
  onClose: () => void;
}) {
  const editando = servico !== null;

  const [descricao, setDescricao] = useState(servico?.descricao ?? "");
  const [cnae, setCnae] = useState(servico?.cnae ?? "");
  const [centroId, setCentroId] = useState(String(servico?.centroCustoId ?? ""));
  const [ativo, setAtivo] = useState(servico?.ativo ?? true);
  // Valor fica como TEXTO no formulario: converter a cada tecla impediria
  // digitar "12," — o parse acontece so no envio.
  const [valor, setValor] = useState(
    servico ? formatarSemSimbolo(servico.valor) : "",
  );

  const valorEmCentavos = deTexto(valor);

  return (
    <FormDrawer
      aberto
      onClose={onClose}
      titulo={editando ? descricao || "Serviço" : "Novo serviço"}
      subtitulo={editando ? `#${servico.id}` : undefined}
      url={editando ? `/api/v1/servicos/${servico.id}` : "/api/v1/servicos"}
      metodo={editando ? "PATCH" : "POST"}
      podeSalvar={descricao.trim().length > 0 && valorEmCentavos !== null}
      valores={() => ({
        descricao: descricao.trim(),
        valor: (valorEmCentavos ?? 0) as Centavos,
        cnae: cnae.trim() || null,
        centroCustoId: centroId ? Number(centroId) : null,
        ativo,
      })}
    >
      <Field label="Descrição" required>
        <input
          style={inputStyle}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Nome do serviço"
          autoFocus
        />
      </Field>

      <Field
        label="Valor"
        required
        error={valor && valorEmCentavos === null ? "Valor inválido" : undefined}
      >
        <input
          style={inputStyle}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
        />
      </Field>

      <Field label="Centro de custo">
        <select style={selectStyle} value={centroId} onChange={(e) => setCentroId(e.target.value)}>
          <option value="">Nenhum</option>
          {centros
            .filter((c) => c.ativo || String(c.id) === centroId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao}
              </option>
            ))}
        </select>
      </Field>

      <Field label="CNAE">
        <input
          style={inputStyle}
          value={cnae}
          onChange={(e) => setCnae(e.target.value)}
          placeholder="0000-0/00"
        />
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
