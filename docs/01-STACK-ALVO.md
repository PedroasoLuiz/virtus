# 01 — Stack alvo (espelhada do SIC)

Base: `C:\Users\pedro\Pedro\Projetos DEV\SIC` (projeto `locasystem` v1.1.1).
Versões abaixo são as **instaladas** em `node_modules`, não só o range do `package.json`.

## Runtime / framework

| Pacote | Range no package.json | Instalado |
|---|---|---|
| `next` | `16.1.6` (pin) | **16.1.6** |
| `react` | `19.2.3` (pin) | **19.2.3** |
| `react-dom` | `19.2.3` (pin) | **19.2.3** |
| `typescript` | `^5` | **5.9.3** |
| `tailwindcss` | `^4` | **4.2.1** |
| `@tailwindcss/postcss` | `^4` | — |
| `eslint` | `^9` | **9.39.4** |
| `eslint-config-next` | `16.1.6` (pin) | — |
| `@types/node` | `^20` | — |
| `@types/react` / `@types/react-dom` | `^19` | — |

## Dados / estado

| Pacote | Range | Instalado | Uso |
|---|---|---|---|
| `@supabase/supabase-js` | `^2.99.1` | **2.99.1** | client core |
| `@supabase/ssr` | `^0.9.0` | **0.9.0** | `createBrowserClient` / `createServerClient` com cookies |
| `zustand` | `^5.0.12` | **5.0.12** | store global (drawers, prefs) |

## UI / utilitários

| Pacote | Range | Instalado | Uso |
|---|---|---|---|
| `next-themes` | `^0.4.6` | **0.4.6** | dark mode via `attribute="class"` |
| `recharts` | `^3.8.0` | **3.8.0** | gráficos do dashboard |
| `@dnd-kit/core` + `sortable` + `utilities` | `^6.3.1` / `^10.0.0` / `^3.2.2` | — | drag & drop |
| `exceljs` | `^4.4.0` | — | export XLSX |
| `xlsx` | `^0.18.5` | — | import/leitura de planilha |

> Sem lib de componentes (shadcn/Radix/MUI). Tudo é componente próprio em `components/ui/`.
> Sem lib de formulário (react-hook-form/zod). Estado de form é `useState` puro.
> Sem lib de data (date-fns/dayjs). Formatação manual.

## tsconfig (copiar literalmente)

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

Pontos relevantes: `strict: true`, alias `@/*` apontando para a **raiz** (não `src/`), e o projeto **não usa `src/`** — `app/`, `components/`, `lib/`, `hooks/`, `types/` ficam na raiz.

## Outros arquivos de config

- `eslint.config.mjs` — flat config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, com `globalIgnores` reescrito.
- `postcss.config.mjs` — plugin único `@tailwindcss/postcss` (Tailwind v4, sem `tailwind.config.js`).
- `vercel.json` — `framework: nextjs`, `buildCommand: next build`, `installCommand: npm install`, `outputDirectory: .next`.
- `next.config.ts` — injeta `NEXT_PUBLIC_APP_VERSION` (semver do package.json), `NEXT_PUBLIC_APP_COMMIT` (`VERCEL_GIT_COMMIT_SHA` ou `git rev-parse --short=7 HEAD`) e `NEXT_PUBLIC_APP_ENV` (`VERCEL_ENV ?? "local"`). Vale replicar no VPAY — dá rastreabilidade de release sem esforço.

## Convenções de arquitetura a herdar

**Estrutura de pastas**
```
app/
  (auth)/          login, reset-password, auth/callback/route.ts
  (dashboard)/     uma pasta por módulo + layout.tsx com sidebar
  api/             route handlers
  globals.css      design system inteiro em CSS vars (584 linhas)
  layout.tsx       ThemeProvider + next/font
components/
  ui/              primitivas próprias (button, badge, panel, toast, pagination…)
  drawers/         um drawer por entidade + drawer-base + drawer-root
  layout/          sidebar, global-header, theme-provider
  charts/
  providers/
lib/               supabase-client.ts, supabase-server.ts, hooks e helpers
hooks/
types/database.ts  tipos do schema
```

**Supabase**
- `lib/supabase-client.ts`: `createBrowserClient` com `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/supabase-server.ts`: `createServerClient` async lendo `cookies()` do `next/headers`, com `getAll`/`setAll` e `try/catch` no set.
- Ambos tipados como `<any>` hoje. **No VPAY vale gerar tipos de verdade** (`supabase gen types typescript`) em vez de repetir o `any`.

**Design system** — `app/globals.css` com `@import "tailwindcss"` e um bloco `:root` de tokens. **Decisão fechada: copiar integralmente, trocando só a camada de cor de marca para o verde do VPAY — ver [07-DESIGN-TOKENS.md](07-DESIGN-TOKENS.md).**
- tipografia densa (base **12px**, mínimo 8px, escala `--text-2xs` a `--text-3xl`), fonte única Inter via `next/font/google` com variável `--font`;
- espaçamento `--space-1..12`, alturas fixas (`--h-input: 36px`, `--h-row: 46px`, `--h-header: 54px`), raios `--radius-xs..full`;
- larguras de drawer (`--drawer-w: 720px` / `-sm: 480px` / `-lg: 900px`), sidebar (`220px` / `56px` recolhida), toolbar e sombras;
- paleta light/dark completa em vars semânticas (`--bg`, `--surface`, `--border`, `--text-primary`, `--primary`, `--success/warning/danger` com variantes `-bg/-border/-text/-badge`).

**Padrão de UI**
- `components/ui/page-components.tsx` é o "kit de página": `PageLayout`, `PageHeader`, `TableWrapper/TableContainer/TableHead/Th/Tr/Td`, `SkeletonRows`, `EmptyRow`, `Section`, `Field`, `Row2/Row3`, `SearchInput`, `PanelTabs`, `FilterButton`, `inputStyle/selectStyle/textareaStyle`. Toda página nova é montada com esse kit — é o que garante consistência visual sem lib externa.
- **Drawers, não páginas de detalhe.** Store zustand (`lib/use-drawer.ts`) com `open(type, id, payload?)`; um `drawer-root` renderiza o drawer certo. Qualquer lugar do app (inclusive o chat) abre qualquer detalhe sem navegar.
- Máscaras próprias em `components/ui/masks.ts` + `masked-input.tsx`.
- Confirmações via `confirm.tsx`, feedback via `toast.tsx` — nada de `window.alert`.
