import type { Metadata } from "next";
import { LogotipoVope } from "@/components/layout/marca";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Vope" };

export default function LoginPage() {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        {/* O logotipo inteiro, e nao a marca escrita: esta e a unica tela onde a
            identidade aparece sozinha, grande, e sem nada em volta que diga de
            quem e o sistema. */}
        <div style={{ marginBottom: 20 }}>
          <LogotipoVope altura={34} />
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
          Use o e-mail e a senha da sua conta.
        </p>
      </div>

      <LoginForm />
    </>
  );
}
