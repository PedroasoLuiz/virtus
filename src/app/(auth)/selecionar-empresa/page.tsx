import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { empresasDisponiveis, usuarioLogado } from "@/modules/sessao/sessao.service";
import { SeletorEmpresa } from "./seletor-empresa";

export const metadata: Metadata = { title: "Escolher empresa — VPay" };

export default async function SelecionarEmpresaPage() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect("/login");

  const empresas = await empresasDisponiveis(usuario.id);

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
          {usuario.nome ?? usuario.email}
        </p>
      </div>

      <SeletorEmpresa empresas={empresas} />
    </>
  );
}
