# 07 — Design tokens do VPAY

Base: `app/globals.css` do SIC (584 linhas), **copiado integralmente**. Muda só a camada de cor de marca. Tipografia, espaçamento, alturas, raios, sombras, larguras de drawer e sidebar ficam **idênticos** — é o que garante que os dois sistemas pareçam da mesma família.

## O que NÃO muda

Copiar sem tocar: escala tipográfica (`--text-2xs: 8px` … `--text-3xl: 22px`, base **12px**), pesos, line-heights, `--space-1..12`, `--h-input/btn/row/header/th`, `--radius-xs..full`, `--drawer-w` (720/480/900), `--toolbar-*`, `--sidebar-w` (220/56), `--shadow-*`, `--kbd-*`, `@media (prefers-reduced-motion)` e o breakpoint de 768px.

Fonte continua **Inter** via `next/font/google`, pesos 300–800, variável `--font`.

> Os badges específicos de equipamento do SIC (`--badge-locavel-*`, `--badge-disponivel-*` etc.) **não existem no VPAY** — remover e criar os do domínio financeiro (ver abaixo).

## A colisão do verde — e como resolver

O verde do VPAY (`#006A28`) é quase o mesmo verde que qualquer design system usa para "sucesso". Num sistema financeiro, verde já significa *pago / recebido / positivo*. Se o botão primário e o badge "PAGO" tiverem a mesma cor, a cor deixa de informar.

**Resolução adotada: a distinção é o tratamento, não o matiz.**

| Papel | Tratamento | Exemplo |
|---|---|---|
| **Ação / marca** | verde **preenchido**, texto branco | botão `+Nova fatura`, item ativo da sidebar, foco de input |
| **Status positivo** | fundo verde **tingido** (10%), texto verde escuro, borda suave | badge `PAGO`, `RECEBIDO`, `CONCILIADO` |

Nunca aparecem verde-preenchido e verde-tingido disputando atenção na mesma linha. Funciona porque o olho separa "superfície sólida" de "pílula clara" antes de separar matiz.

Sobre o `#E41E4C` (secondary do tema Flutter): **não vira `--danger`.** Vermelho de erro continua `#dc2626` — `#E41E4C` é rosa-avermelhado e enfraquece o sinal de perigo. Ele fica reservado como cor de destaque em gráficos.

## Bloco `:root` — o que substituir

Trocar apenas estas linhas no `globals.css` copiado do SIC:

```css
:root {
  /* ── Cores light ────────────────────────────────────────── */
  --bg:             #f0f0f0;   /* era #f1f1f0 — alinha com o legado */
  --surface:        #ffffff;
  --surface-2:      #f9fafb;
  --surface-3:      #f3f4f6;
  --surface-hover:  rgba(0,0,0,0.04);
  --surface-active: rgba(0,106,40,0.06);

  --border:         rgba(0,0,0,0.08);
  --border-strong:  rgba(0,0,0,0.15);
  --border-focus:   #006A28;

  --text-primary:   #181818;   /* do tema legado */
  --text-secondary: #4b5563;
  --text-tertiary:  #828282;   /* do tema legado */
  --text-disabled:  #d1d5db;
  --text-inverse:   #ffffff;

  /* Primary — verde VPAY */
  --primary:        #006A28;
  --primary-hover:  #00551f;
  --primary-fg:     #ffffff;
  --primary-subtle: rgba(0,106,40,0.08);
  --primary-border: rgba(0,106,40,0.20);

  /* Accent — mesmo verde (VPAY é monocromático de marca) */
  --accent:         #006A28;
  --accent-hover:   #00551f;
  --accent-fg:      #ffffff;
  --accent-subtle:  #ecfdf3;
  --accent-border:  #a7e8bf;
  --accent-text:    #00551f;

  /* Status — success: verde TINGIDO, nunca preenchido */
  --success:        #16a34a;
  --success-bg:     #f0fdf4;
  --success-border: #86efac;
  --success-text:   #15803d;
  --success-badge:  #dcfce7;

  /* Status — warning / danger / info / purple / neutral: iguais ao SIC */
  --danger:         #dc2626;   /* NÃO usar #E41E4C aqui */

  --info:           #0369a1;   /* era #2563eb — azul mais frio, não compete com o verde */
  --info-bg:        #f0f9ff;
  --info-border:    #bae6fd;
  --info-text:      #0369a1;
  --info-badge:     #e0f2fe;

  /* Inputs */
  --input-border-focus: #006A28;

  /* Sidebar */
  --sidebar-bg:             #f5f5f3;
  --sidebar-active-fg:      #006A28;
  --sidebar-bar:            #006A28;
  --sidebar-item-active:    #006A28;
  --sidebar-item-bg-active: rgba(0,106,40,0.07);

  /* Seções no drawer */
  --section-title:  #006A28;
  --section-border: rgba(0,106,40,0.18);

  /* Toggle */
  --toggle-on:      #006A28;
}
```

## Bloco `.dark` — o que substituir

```css
.dark {
  --bg:             #141414;   /* do tema legado */
  --surface:        #1f1f1f;   /* do tema legado */
  --surface-2:      #272725;
  --surface-3:      #313130;
  --surface-hover:  rgba(255,255,255,0.04);
  --surface-active: rgba(0,187,71,0.10);

  --border:         rgba(255,255,255,0.07);
  --border-strong:  rgba(255,255,255,0.14);
  --border-focus:   #00BB47;

  --text-primary:   #ffffff;
  --text-secondary: #b8b2ac;
  --text-tertiary:  #95A1AC;   /* do tema legado */
  --text-disabled:  #3d3d3a;

  --primary:        #00BB47;
  --primary-hover:  #33cc6b;
  --primary-fg:     #141414;   /* verde claro pede texto escuro */

  --accent:         #00BB47;
  --accent-hover:   #33cc6b;
  --accent-fg:      #141414;
  --accent-subtle:  rgba(0,187,71,0.10);
  --accent-border:  rgba(0,187,71,0.30);
  --accent-text:    #00BB47;

  --success:        #4ade80;
  --success-bg:     rgba(74,222,128,0.10);
  --success-border: rgba(74,222,128,0.28);
  --success-text:   #4ade80;
  --success-badge:  rgba(74,222,128,0.14);

  --info:           #38bdf8;
  --info-bg:        rgba(56,189,248,0.10);
  --info-border:    rgba(56,189,248,0.28);
  --info-text:      #38bdf8;
  --info-badge:     rgba(56,189,248,0.14);

  --input-border-focus: #00BB47;

  --sidebar-active-fg:      #00BB47;
  --sidebar-bar:            #00BB47;
  --sidebar-item-active:    #00BB47;
  --sidebar-item-bg-active: rgba(0,187,71,0.10);

  --section-title:  #00BB47;
  --section-border: rgba(0,187,71,0.22);

  --toggle-on:      #00BB47;
}
```

> No dark, `--primary-fg` é **escuro** (`#141414`), não branco: `#00BB47` é claro demais para carregar texto branco (contraste ~2:1, reprova em WCAG AA). Com texto escuro passa folgado.

## Badges de domínio financeiro

Substituem os badges de equipamento do SIC:

```css
:root {
  /* Status de fatura / parcela */
  --badge-paga-bg:        #f0fdf4;  --badge-paga-text:        #15803d;  --badge-paga-border:        #86efac;
  --badge-aberta-bg:      #f0f9ff;  --badge-aberta-text:      #0369a1;  --badge-aberta-border:      #bae6fd;
  --badge-avencer-bg:     #fffbeb;  --badge-avencer-text:     #92400e;  --badge-avencer-border:     #fde68a;
  --badge-vencida-bg:     #fef2f2;  --badge-vencida-text:     #dc2626;  --badge-vencida-border:     #fca5a5;
  --badge-cancelada-bg:   #f9fafb;  --badge-cancelada-text:   #6b7280;  --badge-cancelada-border:   #e5e7eb;
  --badge-parcial-bg:     #f5f3ff;  --badge-parcial-text:     #6d28d9;  --badge-parcial-border:     #ddd6fe;

  /* Conciliação */
  --badge-conciliado-bg:  #f0fdf4;  --badge-conciliado-text:  #15803d;
  --badge-pendente-bg:    #fffbeb;  --badge-pendente-text:    #92400e;

  /* Natureza do lançamento */
  --credito: #15803d;
  --debito:  #dc2626;
}
```

Regra de uso: **valor a receber/crédito em verde, a pagar/débito em vermelho, e nunca o contrário** — mesmo que o total seja negativo.

## Paleta de gráficos (recharts)

Séries categóricas, começando pelo verde da marca e abrindo para matizes que não colidem com os semânticos:

```css
:root {
  --chart-1: #006A28;  /* verde VPAY */
  --chart-2: #0369a1;  /* azul */
  --chart-3: #E41E4C;  /* rosa VPAY — aqui sim */
  --chart-4: #d97706;  /* âmbar */
  --chart-5: #7c3aed;  /* roxo */
  --chart-6: #0d9488;  /* teal */
}
.dark {
  --chart-1: #00BB47;
  --chart-2: #38bdf8;
  --chart-3: #f472a0;
  --chart-4: #fbbf24;
  --chart-5: #a78bfa;
  --chart-6: #2dd4bf;
}
```

No DRE, receita usa `--chart-1` (verde) e despesa `--chart-3` — não usar verde × vermelho em barras empilhadas, fica ilegível para daltônicos deutan/protan, que é ~8% dos homens.

## Identidade

- Favicon / PWA: `_legado/vpay/assets/images/app_launcher_icon.png` e `adaptive_foreground_icon.png` (fundo `#006A28`).
- `theme-color` do manifest: `#006A28` (light) / `#141414` (dark).
- **Descartar** o `customBackgroundLight/Dark` do `FFAppState` — eram gradientes radiais verdes em HTML renderizados num WebView. Se o efeito for desejado, vira uma classe CSS com `radial-gradient`, sem WebView e sem persistir markup em secure storage.

## Checklist de verificação

- [ ] Contraste de `--primary-fg` sobre `--primary` ≥ 4.5:1 nos dois temas
- [ ] Badge "PAGO" e botão primário não coexistem visualmente confusos na mesma linha da tabela
- [ ] `--danger` continua `#dc2626`, não `#E41E4C`
- [ ] Gráficos legíveis em escala de cinza
- [ ] Todos os tokens de tamanho/espaço vieram do SIC sem edição
