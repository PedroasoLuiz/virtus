import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar — VPay" };

export default function LoginPage() {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 20,
          }}
        >
          <span style={{ color: "var(--primary)" }}>V</span>Pay
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
