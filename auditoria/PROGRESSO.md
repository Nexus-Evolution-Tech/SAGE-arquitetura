# Progresso da auditoria SAGE

Atualizado em: 2026-08-06

## Onda 2 — concluída

- Fatia D aprovada na primeira execução: 3/3 fatos privados de calibração redescobertos.
- Fatias E e F concluídas e verificadas.
- 41 propostas brutas; 32 achados únicos acrescentados após duplicatas e reduções.
- Acumulado: 82 achados únicos — 3 SEV1, 47 SEV2, 31 SEV3 e 1 SEV4.
- Dependabot reconciliado: 80 transitivas CRA/build/teste, 17 no bundle e uma unidade
  histórica indeterminada; 70/97 alertas identificáveis ainda reproduzem na lock auditada.
- Próxima etapa: Onda 3 (G/H), seguida da verificação transversal e do `INVENTARIO.md`.

## Onda 3 — concluída

- Fatia G: 49 suítes backend, 232 casos materializados e 12 casos vacuamente verdes sem
  MySQL; cinco achados únicos acrescentados.
- Fatia H: instalador não apto; três caminhos SEV1 de indisponibilidade/rollback e nove
  outros achados únicos.
- 20 propostas brutas; 17 achados únicos acrescentados após consolidação.
- Acumulado: 99 achados únicos — 6 SEV1, 50 SEV2, 42 SEV3 e 1 SEV4.
- Próxima etapa: consolidação final em `INVENTARIO.md`.

## Concluído

- Leitura, na ordem solicitada, de `ESTADO-VERIFICADO.md`, `DOMINIO-E-LACUNAS.md`,
  `ROADMAP-RELEASES.md`, `HANDOFF-CODEX.md` e `HANDOFF-AUDITORIA.md`.
- Leitura da régua obrigatória: `AGENTS.md`, índice, 12 ADRs, sincronização e presença.
- Confirmação das duas branches e worktrees limpas.
- FASE 1: arquivos/LOC, grafo de imports, ciclos, candidatos mortos, rotas,
  schema/escritores e jobs.
- Plano de fatias A–H ajustado e apresentado antes de qualquer despacho.
- Plano aprovado pelo arquiteto; inventário amostrado contra o código.
- LOC recalculado por linhas físicas: 45.231 no total. A contagem anterior usava
  `Measure-Object -Line`, que omitia linhas em branco; `validacao.js` foi corrigido de 132
  linhas não vazias para 153 linhas físicas.
- `SAGE-arquitetura` atualizado até `79d82b537e037645e44ce9854b82069b503b1af7` antes da Onda 1.
- Onda 1 concluída: fatias A (dados), B (Control iD/sincronização) e C (HTTP/auth).
- Calibração privada: A 1/1, B elegível 2/2 e C 5/5.
- Verificação do orquestrador: 58 propostas elegíveis, uma rejeitada e sete consolidações,
  resultando em 50 achados únicos (2 SEV1, 41 SEV2, 7 SEV3, 0 SEV4).
- Primeira passagem B arquivada integralmente por falhar na calibração. Segunda passagem B
  descartada sem uso por contaminação acidental do gabarito. Terceira passagem independente
  aprovada e usada.

## Em andamento

- Fase 4: tabela mestra, separação remoto/ambiente, densidade e ordem de correção.

## Próximo passo

- Publicar o checkpoint da Onda 3 e concluir/publicar `INVENTARIO.md`.

## Decisões e limitações

- Auditoria somente leitura; nenhum código, `docs/`, PR ou issue será alterado/criado.
- Node local `v18.16.1` é incompatível com o requisito `>=24 <25`; não instalar runtime.
- Dependabot do frontend: 98 vulnerabilidades, sendo 2 críticas e 53 altas, como insumo
  obrigatório da fatia F.
- Documentos de campo do `SAGE-API/docs/` prevalecem sobre arquitetura para comportamento
  observado do hardware.
