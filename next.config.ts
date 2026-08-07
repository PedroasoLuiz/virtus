import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { version } from "./package.json";

// Versionamento — mesmo padrão do SIC.
//   NEXT_PUBLIC_APP_VERSION -> semver do package.json ("qual release e esta")
//   NEXT_PUBLIC_APP_COMMIT  -> sha curto        ("e exatamente este codigo?")
//   NEXT_PUBLIC_APP_ENV     -> production | preview | local

function commitSha(): string {
  const naVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (naVercel) return naVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "sem-git";
  }
}

const nextConfig: NextConfig = {
  /*
   * O modulo de clientes virou PESSOAS: ali dentro ha cliente, fornecedor e
   * colaborador, e o nome antigo escondia dois tercos do cadastro.
   *
   * ⚠️ O endereco antigo continua respondendo. Ele esta em favorito de gente,
   * em aba aberta e em link colado em conversa; quebrar tudo isso para trocar
   * uma palavra seria caro pelo motivo errado.
   */
  async redirects() {
    return [{ source: "/clientes", destination: "/pessoas", permanent: false }];
  },
  // Ha um package-lock.json solto em C:\Users\pedro que faz o Turbopack
  // inferir a raiz errada. Fixar aqui evita o aviso a cada build.
  turbopack: { root: __dirname },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_COMMIT: commitSha(),
    NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV ?? "local",
  },
};

export default nextConfig;
