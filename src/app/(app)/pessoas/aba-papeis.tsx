"use client";

import {
  Formulario,
  GrupoDeCampos,
  MarcaDeUso,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import type { PapelPessoa } from "@/modules/clientes/clientes.types";

/**
 * Em que telas esta pessoa aparece.
 *
 * ⚠️ Os papeis moram na mesma tabela, em colunas booleanas — por isso a tela pede
 * papel em vez de existirem cinco cadastros separados. Uma transportadora que
 * tambem vende e UMA pessoa com dois papeis, e nao duas fichas para manter em
 * sincronia.
 */
const PAPEIS: { valor: PapelPessoa; rotulo: string; explica: string }[] = [
  { valor: "cliente", rotulo: "Cliente", explica: "aparece em faturas e recebimentos" },
  { valor: "fornecedor", rotulo: "Fornecedor", explica: "aparece em contas a pagar" },
  { valor: "colaborador", rotulo: "Colaborador", explica: "aparece em despesas de equipe" },
  { valor: "transportadora", rotulo: "Transportadora", explica: "leva a entrega, e cobra frete" },
  { valor: "corretor", rotulo: "Corretor", explica: "traz negócio, e recebe comissão" },
];

export function AbaDePapeis({
  papeis,
  onAlternar,
}: {
  papeis: PapelPessoa[];
  onAlternar: (papel: PapelPessoa) => void;
}) {
  return (
    <Formulario>
      <GrupoDeCampos
        primeiro
        titulo="Papéis"
        legenda="Decidem em que telas esta pessoa aparece. Uma transportadora que também compra é um cadastro só, com dois papéis marcados. É preciso ao menos um: sem papel, a pessoa não aparece em lugar nenhum."
      >
        <TableArea minWidth={0}>
          <TableHead>
            <Th>Papel</Th>
            <Th>Onde aparece</Th>
            <Th align="center" minWidth={70}>
              Usa
            </Th>
          </TableHead>

          <tbody>
            {PAPEIS.map((p) => {
              const marcado = papeis.includes(p.valor);

              return (
                <Tr key={p.valor}>
                  <Td>{p.rotulo}</Td>
                  <Td style={{ color: "var(--text-tertiary)" }}>{p.explica}</Td>

                  <Td style={{ textAlign: "center" }}>
                    <MarcaDeUso
                      marcado={marcado}
                      rotulo={marcado ? `Tirar ${p.rotulo}` : `Marcar ${p.rotulo}`}
                      onClick={() => onAlternar(p.valor)}
                    />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableArea>
      </GrupoDeCampos>
    </Formulario>
  );
}
