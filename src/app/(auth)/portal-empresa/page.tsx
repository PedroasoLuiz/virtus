import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SeletorEmpresa } from "../selecionar-empresa/seletor-empresa";
import { carteira } from "@/modules/portal/portal.service";
import { usuarioLogado } from "@/modules/sessao/sessao.service";
import { emitenteEscolhido, escolherEmitente } from "@/app/portal/emitente";

export const metadata: Metadata = { title: "Escolher empresa — VPay" };

/**
 * De qual empresa o cliente quer ver a cobrança.
 *
 * Mora em `(auth)` e usa o MESMO seletor do sistema, de propósito: é o mesmo
 * gesto, com o mesmo desenho e no mesmo layout de tela cheia. O que muda é o que
 * se escolhe — lá o tenant que se administra, aqui quem está cobrando — e isso é
 * um parâmetro, não uma tela nova.
 *
 * Uma por vez, sem "todas": cobrança da Virtus e cobrança da PMX são acordos
 * separados, com documento e conta bancária próprios. Somadas, o total não
 * corresponde a nada que ele possa pagar de uma vez.
 */
export default async function PortalEmpresaPage() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect("/login");
  if (!usuario.externo) redirect("/selecionar-empresa");

  const { emitentes } = await carteira(await emitenteEscolhido());

  // Com um emitente só não há decisão a tomar, e a tela seria um beco.
  if (emitentes.length <= 1) redirect("/portal");

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 4,
          }}
        >
          Escolha a empresa
        </h1>
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
          Você é atendido por mais de uma. Escolha de qual quer ver as cobranças.
        </p>
      </div>

      <SeletorEmpresa
        empresas={emitentes.map((e) => ({ id: e.id, nome: e.nome, razaoSocial: null, logo: null }))}
        acao={escolherEmitente}
        campo="emitenteId"
      />
    </>
  );
}
