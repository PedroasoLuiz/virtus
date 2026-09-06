import type { Metadata } from "next";
import { Marca } from "@/components/layout/marca";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar — Vope" };

export default function LoginPage() {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <Marca tamanho="var(--text-2xl)" />
        </div>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 4,
          }}
        >
          Entrar
        </h1>
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
          Acesse com as credenciais da sua empresa.
        </p>
      </div>

      <LoginForm />
    </>
  );
}
