"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  GrupoDeCampos,
  MarcaDePrincipal,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
} from "@/components/ui/kit";
import type { EnderecoDaPessoa } from "@/modules/clientes/clientes.types";
import { useRecursoDaPessoa, type CacheDoDrawer } from "./cache-do-drawer";

/**
 * Os endereços da pessoa.
 *
 * ⚠️ Lista, e não um endereço só. Obra tem canteiro, empresa tem matriz e filial,
 * e a entrega raramente é no mesmo lugar da cobrança. O principal é o que a nota
 * fiscal usa.
 */
export function AbaDeEndereco({
  clienteId,
  cache,
}: {
  clienteId: number;
  cache: CacheDoDrawer;
}) {
  const { avisar } = useAvisos();
  const [novo, setNovo] = useState(false);

  const { dados: itens, recarregar: carregar } = useRecursoDaPessoa<EnderecoDaPessoa[]>(
    cache,
    "enderecos",
    `/api/v1/clientes/${clienteId}/enderecos`,
  );

  async function promover(id: number) {
    const r = await fetch(`/api/v1/clientes/${clienteId}/enderecos/${id}`, { method: "PATCH" });

    if (!r.ok) {
      avisar("atencao", "Não foi possível marcar como principal");
      return;
    }

    void carregar();
  }

  async function remover(id: number) {
    const r = await fetch(`/api/v1/clientes/${clienteId}/enderecos/${id}`, { method: "DELETE" });

    if (!r.ok) {
      avisar("atencao", "Não foi possível remover");
      return;
    }

    void carregar();
  }

  return (
    <>
      <GrupoDeCampos
        primeiro
        titulo="Endereços"
        legenda="O principal é o que sai na nota fiscal. Os demais servem para entrega, obra ou filial — o primeiro cadastrado já nasce principal."
      >
        <TableArea minWidth={0}>
          <TableHead>
            <Th>Endereço</Th>
            <Th minWidth={150}>Cidade</Th>
            <Th align="center" minWidth={90}>
              Principal
            </Th>
            <Th> </Th>
          </TableHead>

          <tbody>
            {itens == null ? (
              <EmptyRow colSpan={4} message="Carregando…" />
            ) : itens.length === 0 ? (
              <EmptyRow colSpan={4} message="Nenhum endereço cadastrado." />
            ) : (
              itens.map((e) => <Linha key={e.id} endereco={e} onPrincipal={() => void promover(e.id)} onRemover={() => void remover(e.id)} />)
            )}
          </tbody>
        </TableArea>

        {!novo && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <Button size="sm" variant="secondary" onClick={() => setNovo(true)}>
              Novo endereço
            </Button>
          </div>
        )}
      </GrupoDeCampos>

      {novo && (
        <Formulario
          clienteId={clienteId}
          primeiro={(itens ?? []).length === 0}
          onFechar={() => setNovo(false)}
          onSalvou={() => {
            setNovo(false);
            void carregar();
          }}
        />
      )}
    </>
  );
}

function Linha({
  endereco,
  onPrincipal,
  onRemover,
}: {
  endereco: EnderecoDaPessoa;
  onPrincipal: () => void;
  onRemover: () => void;
}) {
  const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  const cidade = [endereco.cidade, endereco.uf].filter(Boolean).join(" / ");

  return (
    <Tr>
      <Td style={{ maxWidth: 260 }}>
        <div
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {rua || <span style={{ color: "var(--text-disabled)" }}>Sem logradouro</span>}
        </div>

        {/* Bairro e complemento na linha de apoio: são o que distingue dois
            endereços na mesma rua, e não o que se procura primeiro. */}
        {(endereco.bairro || endereco.complemento) && (
          <div
            style={{
              marginTop: 1,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {[endereco.bairro, endereco.complemento].filter(Boolean).join(" · ")}
          </div>
        )}
      </Td>

      <Td>
        <div>{cidade || <span style={{ color: "var(--text-disabled)" }}>—</span>}</div>
        {endereco.cep && (
          <div style={{ marginTop: 1, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {endereco.cep}
          </div>
        )}
      </Td>

      <Td style={{ textAlign: "center" }}>
        <MarcaDePrincipal
          marcado={endereco.principal}
          rotulo={endereco.principal ? "É o principal" : "Tornar principal"}
          onClick={() => !endereco.principal && onPrincipal()}
        />
      </Td>

      <Td>
        <AcoesDaLinha>
          <BotaoDeAcao rotulo="Remover" perigo onClick={onRemover}>
            <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
          </BotaoDeAcao>
        </AcoesDaLinha>
      </Td>
    </Tr>
  );
}

function Formulario({
  clienteId,
  primeiro,
  onFechar,
  onSalvou,
}: {
  clienteId: number;
  /** Primeiro da pessoa: ele nasce principal, e a tela diz isso. */
  primeiro: boolean;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();

  const [form, setForm] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    principal: primeiro,
  });

  const [salvando, setSalvando] = useState(false);

  const set = (campo: keyof typeof form, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch(`/api/v1/clientes/${clienteId}/enderecos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cep: form.cep.trim() || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        // Vazio vai como null: o schema exige exatamente duas letras, e "" seria
        // recusado com uma mensagem sobre tamanho que não ajuda ninguém.
        uf: form.uf.trim().toUpperCase() || null,
        principal: form.principal,
      }),
    });

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

    onSalvou();
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Field label="CEP">
        <input
          style={inputStyle}
          value={form.cep}
          onChange={(e) => set("cep", e.target.value)}
          placeholder="00000-000"
          autoFocus
        />
      </Field>

      <Field label="Logradouro">
        <input
          style={inputStyle}
          value={form.logradouro}
          onChange={(e) => set("logradouro", e.target.value)}
          placeholder="Rua, avenida, estrada"
        />
      </Field>

      {/* Número e complemento na mesma linha: os dois são curtos, e separados
          gastavam duas linhas para dizer meia. */}
      <Field label="Número">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={form.numero}
            onChange={(e) => set("numero", e.target.value)}
            placeholder="Número"
          />
          <input
            style={{ ...inputStyle, flex: 2 }}
            value={form.complemento}
            onChange={(e) => set("complemento", e.target.value)}
            placeholder="Complemento"
          />
        </div>
      </Field>

      <Field label="Bairro">
        <input
          style={inputStyle}
          value={form.bairro}
          onChange={(e) => set("bairro", e.target.value)}
          placeholder="Bairro"
        />
      </Field>

      <Field label="Cidade / UF">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 3 }}
            value={form.cidade}
            onChange={(e) => set("cidade", e.target.value)}
            placeholder="Cidade"
          />
          <input
            style={{ ...inputStyle, flex: 1, textTransform: "uppercase" }}
            value={form.uf}
            onChange={(e) => set("uf", e.target.value.slice(0, 2))}
            placeholder="UF"
            maxLength={2}
          />
        </div>
      </Field>

      {!primeiro && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.principal}
            onChange={(e) => setForm((f) => ({ ...f, principal: e.target.checked }))}
          />
          Usar como principal
        </label>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}
