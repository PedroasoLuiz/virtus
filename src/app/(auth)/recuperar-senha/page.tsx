import type { Metadata } from "next";
import { RecuperarForm } from "./recuperar-form";

export const metadata: Metadata = { title: "Recuperar senha — VPay" };

export default function RecuperarSenhaPage() {
  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 4,
          }}
        >
          Recuperar senha
        </h1>
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
          Enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <RecuperarForm />
    </>
  );
}
