"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  Field,
  Formulario,
  GrupoDeCampos,
  PanelTabs,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import {
  carregarEmpresaAction,
  enviarCertificadoAction,
  removerCertificadoAction,
  removerLogoAction,
  salvarEmpresaAction,
  trocarLogoAction,
} from "@/modules/empresa/empresa.actions";
import type {
  ArmazenamentoDaEmpresa,
  CadastroDaEmpresa,
  EdicaoDaEmpresa,
} from "@/modules/empresa/empresa.types";
import { UFS } from "@/shared/domain/brasil";
import { buscarCep, cepCompleto, mascararCep } from "@/shared/domain/cep";
import { buscarCnpj } from "@/shared/domain/cnpj";
import { mascararDocumento } from "@/shared/domain/documento";
import { mascararTelefone } from "@/shared/domain/telefone";

const ABA_CONTATO = "Contato";
const ABA_ENDERECO = "Endereço";
const ABA_DOCUMENTOS = "Documentos";

/** O lado da marca dentro da gaveta. Mesmo encaixe da foto do perfil. */
const LADO_DA_MARCA = 88;
const ALTURA_DA_FAIXA = 56;
const COR_DA_CAPA = "var(--primary-subtle)";

/**
 * O cadastro da propria empresa.
 *
 * ⚠️ Abre do cartao do USUARIO, e nao do cartao da empresa na barra.
 *
 * O cartao da barra responde "com qual empresa estou trabalhando?" e troca de
 * tenant com um clique — pendurar ali uma opcao que ABRE um formulario faria o
 * mesmo cartao servir a duas perguntas, e a de trocar e a que se usa todo dia.
 * No menu do usuario ela fica junto de "editar perfil": o cadastro de quem
 * opera, e o da casa em que se opera.
 *
 * ⚠️ A IDENTIFICACAO fica fixa no topo, e so o resto tem abas — a mesma divisao
 * do perfil. Razao social, CNPJ e inscricoes sao o que a empresa E, e o que a
 * pessoa veio conferir. Numa aba, elas precisariam de um clique para aparecer.
 *
 * ⚠️ Carrega ao ABRIR, e nao com a pagina. O cadastro se mexe uma vez por mes;
 * trazido pelo layout, toda navegacao do sistema pagaria a leitura dele.
 */
export function EmpresaDrawer({
  aberto,
  onClose,
  nome,
  logo: logoInicial,
}: {
  aberto: boolean;
  onClose: () => void;
  /** O que ja se sabe da empresa, para a marca nao piscar enquanto carrega. */
  nome: string | null;
  logo: string | null;
}) {
  const { avisar } = useAvisos();

  const [form, setForm] = useState<EdicaoDaEmpresa | null>(null);
  /* O que veio do banco, para saber se ha alteracao pendente sem gravar nada. */
  const [original, setOriginal] = useState("");
  const [logo, setLogo] = useState<string | null>(logoInicial);
  const [certificado, setCertificado] = useState("");
  const [espaco, setEspaco] = useState<ArmazenamentoDaEmpresa | null>(null);
  const [aba, setAba] = useState(ABA_CONTATO);
  const [salvando, setSalvando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [ocupadoComArquivo, setOcupadoComArquivo] = useState(false);

  const [menuDaMarca, setMenuDaMarca] = useState(false);
  const campoDaMarca = useRef<HTMLInputElement>(null);
  const campoDoCertificado = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;

    let vivo = true;

    /* ⚠️ O "carregando" nao e estado: e a ausencia do formulario. Um segundo
       sinalizador ligado aqui dentro seria uma renderizacao a mais para dizer o
       que `form == null` ja diz, e teria de ser desligado em todos os caminhos
       de saida — inclusive nos que falham. */
    void carregarEmpresaAction().then(({ empresa, armazenamento, erro }) => {
      if (!vivo) return;

      if (erro || !empresa) {
        avisar("atencao", erro ?? "Não foi possível abrir o cadastro.");
        onClose();
        return;
      }

      const inicial = paraFormulario(empresa);
      setForm(inicial);
      setOriginal(JSON.stringify(inicial));
      setLogo(empresa.logo || null);
      setCertificado(empresa.certificado);
      setEspaco(armazenamento);
    });

    return () => {
      vivo = false;
    };
    /* Roda na ABERTURA. `onClose` e `avisar` mudam de identidade a cada render do
       pai e trariam o cadastro de novo do servidor a cada um deles. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const mexeu = form != null && JSON.stringify(form) !== original;

  function mudar<K extends keyof EdicaoDaEmpresa>(campo: K, valor: EdicaoDaEmpresa[K]) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
  }

  /**
   * O CEP preenche o resto do endereco.
   *
   * ⚠️ Busca assim que o OITAVO digito entra, e nao ao sair do campo.
   *
   * Preso ao `blur`, quem digitava o CEP e ia direto clicar em Salvar nunca via
   * o endereco chegar — e quem clicava em outro campo via a tela mudar sozinha
   * um instante depois, sem ligar uma coisa a outra. Com oito digitos o CEP esta
   * completo e nao ha mais o que esperar.
   *
   * ⚠️ Ele MANDA em logradouro, bairro, cidade e UF, em vez de so preencher o
   * que estava em branco. Esses quatro sao o proprio CEP escrito por extenso:
   * trocar o CEP e nao ver o endereco mudar faz a pessoa achar que a busca nao
   * funciona — e foi exatamente o que aconteceu.
   *
   * ⚠️ Numero e complemento NAO sao tocados. O ViaCEP nao os conhece, e sao os
   * unicos dois que a pessoa digitou a mao.
   */
  async function buscarPeloCep(valor: string) {
    if (!cepCompleto(valor)) return;

    setBuscandoCep(true);
    const achado = await buscarCep(valor);
    setBuscandoCep(false);

    if (!achado) {
      avisar("atencao", "Não encontrei este CEP.");
      return;
    }

    setForm((f) =>
      f
        ? {
            ...f,
            logradouro: achado.logradouro || f.logradouro,
            bairro: achado.bairro || f.bairro,
            cidade: achado.cidade || f.cidade,
            estado: achado.uf || f.estado,
          }
        : f,
    );
  }

  /**
   * O CNPJ traz o que a Receita ja sabe.
   *
   * ⚠️ Tambem so preenche o vazio, e pelo mesmo motivo. Quem tem o cadastro
   * pronto e digita o CNPJ que faltava nao pode ver o proprio endereco trocado
   * pelo da matriz.
   */
  async function consultarReceita() {
    if (!form) return;

    setConsultando(true);
    const achado = await buscarCnpj(form.cnpj);
    setConsultando(false);

    if (!achado) {
      avisar("atencao", "Não encontrei este CNPJ na base pública.");
      return;
    }

    setForm((f) =>
      f
        ? {
            ...f,
            razaoSocial: f.razaoSocial || achado.razaoSocial,
            fantasia: f.fantasia || achado.nomeFantasia,
            email: f.email || achado.email,
            contato: f.contato || achado.telefone,
            cep: f.cep || achado.endereco.cep,
            logradouro: f.logradouro || achado.endereco.logradouro,
            numero: f.numero || achado.endereco.numero,
            complemento: f.complemento || achado.endereco.complemento,
            bairro: f.bairro || achado.endereco.bairro,
            cidade: f.cidade || achado.endereco.cidade,
            estado: f.estado || achado.endereco.uf,
          }
        : f,
    );

    avisar("sucesso", "Preenchi o que estava em branco.");
  }

  async function salvar() {
    if (!form) return;

    setSalvando(true);
    const { erro } = await salvarEmpresaAction(form);
    setSalvando(false);

    if (erro) return void avisar("atencao", erro);

    avisar("sucesso", "Cadastro da empresa salvo.");
    setOriginal(JSON.stringify(form));
    onClose();
  }

  async function enviarMarca(arquivo: File | null) {
    if (!arquivo) return;

    setOcupadoComArquivo(true);
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    const { erro } = await trocarLogoAction(dados);
    setOcupadoComArquivo(false);

    if (erro) return void avisar("atencao", erro);

    /* Lê o arquivo local em vez de esperar o servidor devolver a URL: a marca
       aparece no mesmo instante em que a pessoa escolheu. */
    setLogo(URL.createObjectURL(arquivo));
    avisar("sucesso", "Marca atualizada.");
  }

  async function tirarMarca() {
    setOcupadoComArquivo(true);
    const { erro } = await removerLogoAction();
    setOcupadoComArquivo(false);

    if (erro) return void avisar("atencao", erro);
    setLogo(null);
  }

  async function enviarCertificado(arquivo: File | null) {
    if (!arquivo) return;

    setOcupadoComArquivo(true);
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    const { erro } = await enviarCertificadoAction(dados);
    setOcupadoComArquivo(false);

    if (erro) return void avisar("atencao", erro);

    setCertificado(arquivo.name);
    avisar("sucesso", "Certificado guardado.");
  }

  async function tirarCertificado() {
    setOcupadoComArquivo(true);
    const { erro } = await removerCertificadoAction(certificado);
    setOcupadoComArquivo(false);

    if (erro) return void avisar("atencao", erro);
    setCertificado("");
  }

  return (
    <Drawer
      open={aberto}
      onClose={onClose}
      title="Cadastro da empresa"
      capa={COR_DA_CAPA}
      /*
        ⚠️ O salvar no CABECALHO. O formulario passa da altura da tela: com o
        botao so no rodape, corrigir a razao social obrigaria a rolar ate o fim
        para gravar.
      */
      acoes={
        <Button
          variant="primary"
          size="xs"
          onClick={() => void salvar()}
          disabled={salvando || !form}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
      /* Com alteracao pendente o X passa a DESCARTAR, no mesmo pixel: fechar
         calado levaria embora o que a pessoa acabou de digitar. */
      fecharPersonalizado={mexeu ? { rotulo: "Descartar alterações", onClick: onClose } : undefined}
    >
      {!form ? (
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
          Carregando o cadastro…
        </p>
      ) : (
        <Formulario>
          {/*
            ⚠️ A marca vem ACIMA do titulo do primeiro grupo, sobre uma faixa —
            o mesmo encaixe da foto do perfil, e pelo mesmo motivo. Ela e a cara
            da empresa, nao um dado a preencher: numa linha de formulario, com
            rotulo a esquerda, "marca" pareceria irma de "razao social".

            ⚠️ A faixa SANGRA ate as bordas (`margin` negativa de 16). Respeitando
            o recuo do corpo, ela viraria um retangulo colorido flutuando com
            folga dos dois lados — um cartao. Encostada, ela le como cabecalho da
            ficha, que e o que ela e.
          */}
          <div style={{ margin: "-16px -16px 0" }}>
            <div style={{ height: ALTURA_DA_FAIXA, background: COR_DA_CAPA }} />

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                padding: "0 16px",
                marginTop: -(LADO_DA_MARCA / 2),
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
              <span
                aria-hidden
                style={{
                  width: LADO_DA_MARCA,
                  height: LADO_DA_MARCA,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  borderRadius: "var(--radius-md)",
                  /* A borda da cor do fundo recorta a marca contra a capa. Sem
                     ela, os dois tons se encostam e a imagem parece colada. */
                  border: "3px solid var(--surface)",
                  background: "var(--surface)",
                  color: "var(--primary)",
                  fontSize: 22,
                  fontWeight: "var(--fw-bold)",
                }}
              >
                {logo ? (
                  /* `img` e nao `next/image`: a URL vem do storage com um `?v=`
                     que muda a cada troca, e o otimizador exigiria cadastrar o
                     host e ainda guardaria a versao antiga. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                ) : (
                  (form.apelido || form.fantasia || form.razaoSocial || nome || "?")
                    .trim()
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </span>

              {/*
                ⚠️ UMA camera na quina da marca, e nao dois botoes de texto ao
                lado. Mesmo gesto da foto do perfil, e pelo mesmo motivo:
                "Trocar marca" e "Remover" ocupavam a linha inteira para duas
                acoes que so existem por causa da imagem ao lado. Na quina dela,
                a camera diz o assunto sem palavra nenhuma.
              */}
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuDaMarca}
                aria-label="Alterar a marca"
                title="Alterar a marca"
                disabled={ocupadoComArquivo}
                onClick={() => setMenuDaMarca((v) => !v)}
                className="redondo"
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--radius-full)",
                  border: "2px solid var(--surface)",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  cursor: ocupadoComArquivo ? "wait" : "pointer",
                  padding: 0,
                }}
              >
                <IconeCamera />
              </button>

              {menuDaMarca && (
                <>
                  {/* Camada que fecha ao clicar fora. O cartao e pequeno e vive
                      dentro da gaveta: nao precisa de portal. */}
                  <div
                    onClick={() => setMenuDaMarca(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 1 }}
                  />

                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      zIndex: 2,
                      minWidth: 180,
                      padding: 4,
                      borderRadius: "var(--radius-md)",
                      /* SEM borda: a sombra ja separa o cartao do que esta
                         atras. Ver `07-DESIGN-TOKENS`, cartao flutuante. */
                      background: "var(--surface)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {/* O `input` fica escondido dentro do rotulo: o campo nativo
                        traz "Nenhum arquivo escolhido" e um botao com o visual
                        do sistema operacional. */}
                    <label style={ITEM_DO_CARTAO}>
                      <input
                        ref={campoDaMarca}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        hidden
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0] ?? null;
                          /* Zera o campo: escolhendo o MESMO arquivo de novo, o
                             `change` nao dispararia e a tela nao reagiria. */
                          e.target.value = "";
                          setMenuDaMarca(false);
                          void enviarMarca(arquivo);
                        }}
                      />
                      {logo ? "Trocar a marca" : "Escolher uma marca"}
                    </label>

                    {logo && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuDaMarca(false);
                          void tirarMarca();
                        }}
                        style={{ ...ITEM_DO_CARTAO, color: "var(--danger-text)" }}
                      >
                        Remover a marca
                      </button>
                    )}
                  </div>
                </>
              )}
              </div>

              {/*
                ⚠️ Encostada a DIREITA, na mesma linha do pe da marca.

                Ela nao e campo do cadastro e nao entra no formulario: e um
                indicador da conta, do mesmo tipo do plano. Posta entre os campos
                ela viraria mais uma coisa a preencher; aqui em cima ela fecha a
                faixa da identidade sem custar linha nenhuma.
              */}
              {espaco && <EspacoUsado espaco={espaco} />}
            </div>
          </div>

          <GrupoDeCampos
            titulo="Identificação"
            legenda="A razão social é o nome que assina o cabeçalho de todo PDF do sistema."
          >
            <Field label="Razão social" required>
              <input
                style={inputStyle}
                value={form.razaoSocial}
                onChange={(e) => mudar("razaoSocial", e.target.value)}
              />
            </Field>

            <Field label="Nome fantasia">
              <input
                style={inputStyle}
                value={form.fantasia}
                onChange={(e) => mudar("fantasia", e.target.value)}
              />
            </Field>

            <Field
              label="Apelido"
              hint="O nome curto. É este que aparece no cartão da empresa, no menu."
            >
              <input
                style={inputStyle}
                value={form.apelido}
                onChange={(e) => mudar("apelido", e.target.value)}
              />
            </Field>

            <Field label="CNPJ">
              {/*
                ⚠️ A lupa mora DENTRO do campo, e nao num botao ao lado.

                Ao lado, ela era um segundo alvo do mesmo tamanho de um botao de
                acao, disputando peso com o Salvar do cabecalho para fazer uma
                consulta opcional. Dentro, ela le como o que e: um atalho do
                proprio campo, que so faz sentido depois de digitar ali.
              */}
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 30 }}
                  value={form.cnpj}
                  onChange={(e) => mudar("cnpj", mascararDocumento(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => void consultarReceita()}
                  disabled={consultando}
                  title="Buscar na base pública da Receita"
                  aria-label="Buscar na base pública da Receita"
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    border: "none",
                    borderRadius: "var(--radius-xs)",
                    background: "transparent",
                    color: consultando ? "var(--text-disabled)" : "var(--primary)",
                    cursor: consultando ? "wait" : "pointer",
                  }}
                >
                  <IconeLupa />
                </button>
              </div>
            </Field>

            {/* Uma por linha: as duas inscrições são números longos, e lado a
                lado o campo ficava mais curto que o próprio número. */}
            <Field label="Inscrição estadual">
              <input
                style={inputStyle}
                value={form.ie}
                onChange={(e) => mudar("ie", e.target.value)}
              />
            </Field>

            <Field label="Inscrição municipal">
              <input
                style={inputStyle}
                value={form.inscricaoMunicipal}
                onChange={(e) => mudar("inscricaoMunicipal", e.target.value)}
              />
            </Field>
          </GrupoDeCampos>

          {/*
            ⚠️ As abas ficam DEPOIS da identificacao, e nao no topo da gaveta.

            No topo, elas obrigariam a escolher uma antes de ver o que a gaveta
            tem — e o que ela tem de mais importante nao esta em aba nenhuma.
          */}
          <div>
            <PanelTabs
              tabs={[ABA_CONTATO, ABA_ENDERECO, ABA_DOCUMENTOS]}
              active={aba}
              onChange={setAba}
            />

            {aba === ABA_CONTATO && (
              <GrupoDeCampos
                primeiro
                titulo="Como falam com a empresa"
                legenda="Sai no rodapé do e-mail de cobrança, e é para onde o cliente responde."
              >
                <Field label="E-mail">
                  <input
                    type="email"
                    style={inputStyle}
                    value={form.email}
                    onChange={(e) => mudar("email", e.target.value)}
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    style={inputStyle}
                    value={form.contato}
                    onChange={(e) => mudar("contato", mascararTelefone(e.target.value))}
                  />
                </Field>
              </GrupoDeCampos>
            )}

            {aba === ABA_ENDERECO && (
              /* Um campo por linha. Numero e UF estavam dividindo linha com o
                 vizinho, e o rotulo do `Field` reserva 130px fixos: no que sobrava
                 da coluna estreita, o campo de digitar sumia. */
              <GrupoDeCampos
                primeiro
                titulo="Onde a empresa fica"
                legenda="Vai no cabeçalho dos documentos. Identifica quem cobra, para o cliente e para o filtro de spam."
              >
                <Field label="CEP" hint="Com os oito dígitos, o endereço vem sozinho.">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      inputMode="numeric"
                      style={{ ...inputStyle, width: 120 }}
                      value={form.cep}
                      onChange={(e) => {
                        const cep = mascararCep(e.target.value);
                        mudar("cep", cep);
                        /* Dispara no oitavo digito. O `blur` continua como rede:
                           colar um CEP e clicar fora sem soltar o teclado tambem
                           passa por aqui. */
                        void buscarPeloCep(cep);
                      }}
                      onBlur={(e) => void buscarPeloCep(e.target.value)}
                    />
                    {buscandoCep && (
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                        buscando…
                      </span>
                    )}
                  </div>
                </Field>

                <Field label="Logradouro">
                  <input
                    style={inputStyle}
                    value={form.logradouro}
                    onChange={(e) => mudar("logradouro", e.target.value)}
                  />
                </Field>

                <Field label="Número">
                  <input
                    style={{ ...inputStyle, width: 120 }}
                    value={form.numero}
                    onChange={(e) => mudar("numero", e.target.value)}
                  />
                </Field>

                <Field label="Complemento">
                  <input
                    style={inputStyle}
                    value={form.complemento}
                    onChange={(e) => mudar("complemento", e.target.value)}
                  />
                </Field>

                <Field label="Bairro">
                  <input
                    style={inputStyle}
                    value={form.bairro}
                    onChange={(e) => mudar("bairro", e.target.value)}
                  />
                </Field>

                <Field label="Cidade">
                  <input
                    style={inputStyle}
                    value={form.cidade}
                    onChange={(e) => mudar("cidade", e.target.value)}
                  />
                </Field>

                <Field label="Estado">
                  <select
                    style={{ ...selectStyle, width: 90 }}
                    value={form.estado}
                    onChange={(e) => mudar("estado", e.target.value)}
                  >
                    <option value="">—</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Código IBGE" hint="Do município. É o que a emissão de nota pede.">
                  <input
                    style={{ ...inputStyle, width: 120 }}
                    value={form.codigoIbge}
                    onChange={(e) => mudar("codigoIbge", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              </GrupoDeCampos>
            )}

            {aba === ABA_DOCUMENTOS && (
              <GrupoDeCampos
                primeiro
                titulo="Certificado digital A1"
                legenda="O arquivo .pfx ou .p12 que assina em nome da empresa. É com ele que a emissão de nota fiscal vai funcionar."
              >
                <input
                  ref={campoDoCertificado}
                  type="file"
                  accept=".pfx,.p12"
                  hidden
                  onChange={(e) => void enviarCertificado(e.target.files?.[0] ?? null)}
                />

                {certificado ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-3)",
                    }}
                  >
                    <span style={{ color: "var(--primary)", display: "flex" }}>
                      <IconeCadeado />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "var(--text-base)",
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Certificado guardado
                    </span>
                    <Button
                      size="sm"
                      disabled={ocupadoComArquivo}
                      onClick={() => campoDoCertificado.current?.click()}
                    >
                      Substituir
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={ocupadoComArquivo}
                      onClick={() => void tirarCertificado()}
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Button
                      disabled={ocupadoComArquivo}
                      onClick={() => campoDoCertificado.current?.click()}
                    >
                      {ocupadoComArquivo ? "Enviando…" : "Escolher arquivo"}
                    </Button>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                      Nenhum certificado enviado.
                    </span>
                  </div>
                )}

                {/*
                  ⚠️ Isto nao e recado de rodape: e a explicacao de uma ausencia.
                  Quem envia um A1 procura o campo da senha logo em seguida, e
                  nao achando vai supor que o sistema esqueceu.
                */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    lineHeight: "var(--lh-snug)",
                  }}
                >
                  O arquivo fica guardado em área privada, acessível só a esta empresa. A senha do
                  certificado não é pedida aqui e não fica gravada: arquivo mais senha é a
                  assinatura completa, e guardar os dois juntos seria guardar a empresa inteira num
                  lugar só. Ela será pedida na hora de assinar.
                </p>
              </GrupoDeCampos>
            )}
          </div>
        </Formulario>
      )}
    </Drawer>
  );
}

/**
 * Quanto a empresa ja ocupa.
 *
 * ⚠️ O teto vem do PLANO (`planos.max_storage_mb`): Free 500 MB, Starter 2 GB,
 * Pro 10 GB. E por essa coluna que espaco extra vai ser vendido, e um numero
 * cravado na tela faria a primeira venda exigir deploy.
 *
 * ⚠️ Teto nulo e ILIMITADO (o Enterprise de hoje), e nao "nao sei": ali some a
 * barra e fica so o usado. Uma barra sem fim para onde correr nao mede nada —
 * ficaria sempre no comeco, dizendo a quem tem espaco infinito que esta vazio.
 */
function EspacoUsado({ espaco }: { espaco: ArmazenamentoDaEmpresa }) {
  const limiteBytes = espaco.limiteMb == null ? null : espaco.limiteMb * 1024 * 1024;
  const fracao = limiteBytes ? Math.min(espaco.usadoBytes / limiteBytes, 1) : 0;
  /* A partir de 80% o numero fica vermelho: e o aviso de que vai faltar, e
     antes disso o vermelho seria alarme constante. */
  const apertado = fracao >= 0.8;

  return (
    <div
      title="Espaço ocupado pelos arquivos desta empresa"
      style={{
        marginLeft: "auto",
        paddingBottom: 8,
        /* `inline-flex` com `stretch`: a largura sai do texto mais longo, e a
           barra abaixo herda exatamente essa medida sem ninguem cravar pixel. */
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 3,
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        Seu espaço:
      </span>

      <span
        style={{
          fontSize: "var(--text-sm)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {/* ⚠️ So o USADO tem cor. Ele e o que muda e o que se vem olhar; o teto
            e referencia parada, e em cor os dois brigariam pela atencao. */}
        <b
          style={{
            fontWeight: "var(--fw-semi)",
            color: apertado ? "var(--danger-text)" : "var(--primary)",
          }}
        >
          {emTamanho(espaco.usadoBytes)}
        </b>
        {limiteBytes ? (
          <>
            <span style={{ color: "var(--text-tertiary)" }}> / </span>
            <span style={{ color: "var(--text-primary)" }}>{emTamanho(limiteBytes)}</span>
          </>
        ) : (
          /*
            ⚠️ "ilimitado" e nao "usados".
            O Enterprise tem `max_storage_mb` nulo, que aqui significa sem teto.
            Escrito so "7,6 mb usados", o numero parecia estar sem par por falha
            de leitura do plano — e a primeira reacao foi procurar o limite que
            tinha sumido. A palavra fecha a conta.
          */
          <span style={{ color: "var(--text-primary)" }}> / ilimitado</span>
        )}
      </span>

      {limiteBytes && (
        <span
          aria-hidden
          style={{
            height: 4,
            borderRadius: "var(--radius-full)",
            background: "var(--surface-3)",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "block",
              /* Um fio visivel mesmo quase zerado: com 0,3% a barra sumia e a
                 empresa que acabou de comecar parecia estar sem medicao. */
              width: `${Math.max(fracao * 100, espaco.usadoBytes > 0 ? 3 : 0)}%`,
              height: "100%",
              background: apertado ? "var(--danger)" : "var(--primary)",
            }}
          />
        </span>
      )}
    </div>
  );
}

/**
 * Bytes na unidade que se le: 1,2 mb, 340 kb, 2 gb.
 *
 * ⚠️ Unidade em caixa BAIXA. Em maiuscula ela tem a altura do numero e disputa
 * o olho com ele, a ponto de "10 GB" ler como duas informacoes; minuscula, ela
 * vira o sufixo que e. Nao e a notacao do SI, e a decisao e de leitura.
 */
function emTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} b`;

  const unidades = ["kb", "mb", "gb", "tb"];
  let valor = bytes / 1024;
  let i = 0;

  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }

  /* Uma casa decimal so abaixo de dez: "1,4 GB" ajuda, "847,3 MB" e precisao que
     ninguem usa para decidir nada. */
  const casas = valor < 10 && i > 0 ? 1 : 0;
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${unidades[i]}`;
}

/**
 * O item do cartao da camera.
 *
 * ⚠️ Copiado do `perfil-drawer` de proposito, e nao importado dele: sao duas
 * gavetas que nao se conhecem, e o dia em que uma delas mudar de forma nao pode
 * arrastar a outra junto. Se um terceiro cartao aparecer, ai sim isto vira kit.
 */
const ITEM_DO_CARTAO: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 8px",
  border: "none",
  background: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontFamily: "var(--font)",
  fontSize: "var(--text-base)",
  color: "var(--text-primary)",
};

/** Camera: o que se faz com a imagem ao lado. */
function IconeCamera() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function IconeLupa() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.6-4.6" />
    </svg>
  );
}

function IconeCadeado() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** O que veio do banco, na forma que o formulario edita. */
function paraFormulario(e: CadastroDaEmpresa): EdicaoDaEmpresa {
  return {
    razaoSocial: e.razaoSocial,
    fantasia: e.fantasia,
    apelido: e.apelido,
    /* Mascarado na entrada: o banco guarda so os digitos, e ver "12345678000190"
       num campo faz a pessoa achar que o cadastro esta errado. */
    cnpj: e.cnpj ? mascararDocumento(e.cnpj) : "",
    ie: e.ie,
    inscricaoMunicipal: e.inscricaoMunicipal,
    email: e.email,
    contato: e.contato ? mascararTelefone(e.contato) : "",
    cep: e.cep ? mascararCep(e.cep) : "",
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    estado: e.estado,
    codigoIbge: e.codigoIbge,
  };
}
