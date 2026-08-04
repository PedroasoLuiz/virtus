"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, CampoNumerico, Field, inputStyle, selectStyle } from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { TIPOS_DE_CONTA, type ContaBancaria } from "@/modules/contas/contas.types";

/**
 * Cadastro de conta bancaria.
 *
 * Um componente para incluir e editar: os campos e as regras sao os mesmos, e
 * dois arquivos divergiriam no primeiro campo novo. O que muda e para onde o
 * salvar aponta.
 */

export function ContaDrawer({
  conta,
  aoSalvar,
  onClose,
}: {
  /** Nulo = incluindo. */
  conta: ContaBancaria | null;
  aoSalvar: () => void;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();

  const [apelido, setApelido] = useState(conta?.apelido ?? "");
  const [banco, setBanco] = useState(conta?.banco ?? "");
  const [agencia, setAgencia] = useState(conta?.agencia ?? "");
  const [numero, setNumero] = useState(conta?.conta ?? "");
  const [tipo, setTipo] = useState(conta?.tipo ?? "");
  const [ativo, setAtivo] = useState(conta?.ativo ?? true);
  const [limite, setLimite] = useState(conta?.limite ?? 0);
  const [saldoInicial, setSaldoInicial] = useState(conta?.saldoInicial ?? 0);
  const [salvando, setSalvando] = useState(false);

  const identificavel = Boolean(apelido.trim() || banco.trim() || numero.trim());

  async function salvar() {
    setSalvando(true);

    const r = await fetch(conta ? `/api/v1/contas/${conta.id}` : "/api/v1/contas", {
      method: conta ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apelido: apelido.trim() || null,
        banco: banco.trim() || null,
        agencia: agencia.trim() || null,
        conta: numero.trim() || null,
        tipo: tipo || null,
        ativo,
        limite,
        saldoInicial,
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível salvar a conta",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    avisar("sucesso", conta ? "Conta atualizada" : "Conta criada");
    aoSalvar();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={conta ? `Conta ${conta.apelido?.trim() || conta.nome}` : "Nova conta"}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* O saldo de hoje fica visível durante a edição porque mexer no saldo
              inicial o move: sem ver a consequência, quem corrige a partida
              descobre o efeito só depois de salvar. */}
          {conta && (
            <div>
              <div className="rotulo" style={{ fontSize: "var(--text-xs)" }}>
                Saldo atual
              </div>
              <div
                style={{
                  fontSize: "var(--text-md)",
                  fontWeight: "var(--fw-semi)",
                  fontVariantNumeric: "tabular-nums",
                  color: conta.saldo < 0 ? "var(--debito)" : "var(--text-primary)",
                }}
              >
                {formatarSemSimbolo(conta.saldo)}
              </div>
            </div>
          )}

          <span style={{ flex: 1 }} />
          <Button
            size="sm"
            variant="primary"
            disabled={salvando || !identificavel}
            title={
              !identificavel
                ? "Informe ao menos o apelido, o banco ou o número da conta"
                : undefined
            }
            onClick={salvar}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Field
          label="Apelido"
          hint="Como esta conta aparece na hora de escolher onde o dinheiro caiu."
        >
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder="Ex.: Cresol movimento"
            maxLength={120}
            style={inputStyle}
          />
        </Field>

        <Field label="Banco">
          <input
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            maxLength={120}
            style={inputStyle}
          />
        </Field>

        <Field label="Agência">
          <input
            value={agencia}
            onChange={(e) => setAgencia(e.target.value)}
            maxLength={120}
            style={inputStyle}
          />
        </Field>

        <Field label="Conta">
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            maxLength={120}
            style={inputStyle}
          />
        </Field>

        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={selectStyle}>
            <option value="">Escolher…</option>
            {TIPOS_DE_CONTA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Saldo inicial"
          hint="O que havia na conta antes do primeiro lançamento no sistema. Muda o saldo de hoje inteiro."
        >
          <div style={{ width: 160 }}>
            <CampoNumerico valor={saldoInicial} escala={100} aoMudar={setSaldoInicial} />
          </div>
        </Field>

        <Field label="Limite" hint="Cheque especial. Não entra no saldo, só serve de referência.">
          <div style={{ width: 160 }}>
            <CampoNumerico valor={limite} escala={100} aoMudar={setLimite} />
          </div>
        </Field>

        {/* Desativar é o caminho para conta que não se usa mais: excluir levaria
            junto o "onde" de todo lançamento que já passou por ela. */}
        <Field label="Ativa" hint="Conta inativa some das listas de escolha e sai do consolidado.">
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: "var(--h-input)",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              style={{ accentColor: "var(--primary)", cursor: "pointer" }}
            />
            {ativo ? "Em uso" : "Fora de uso"}
          </label>
        </Field>
      </div>
    </Drawer>
  );
}
