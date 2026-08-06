# Onda 3 — verificação do orquestrador

Data: 2026-08-06

Status: concluída e pronta para checkpoint.

## Base e método

- `SAGE-API`: `9e3eaba3475c3e9755f341d29bada059cc6fc5db`
- `SAGE`: `06c1ed4e948236c44926ed13fdb96521dd81d269`
- Branch nos dois repositórios auditados: `wip/recuperacao-local-pre-auditoria`
- Método: análise estática. Nenhum teste, instalador, build, serviço, download ou script de
  release foi executado.
- Limitação: Node local `v18.16.1`; backend exige `>=24 <25`. Nenhuma troca de runtime foi
  tentada.

Os relatórios G/H são evidência bruta. As decisões, duplicatas e severidades desta verificação
prevalecem.

## Verificação da fatia G

### Contagem fechada

- 49 arquivos que casam com `test/**/*.test.js`, portanto 49 suítes backend — não 51.
- 63 blocos `describe/suite` e 232 casos materializados.
- Sem MySQL: seis `describe.skip` cobrem dez casos; 11 casos usam `skip(...)` corretamente;
  **12 casos retornam antes das asserções e aparecem verdes**.
- 56 arquivos/6.433 LOC no escopo completo, incluindo fake, helper, README e config.

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| G-001 | expansão de A-004 | — | Confirma que as rotas destrutivas conhecidas não atravessam backup/proteção em teste; a causa de produção já é A-004. |
| G-002 | expansão de B-011 | — | Mesmo backup completo que converte falha de leitura em `[]` e publica artefato parcial. |
| G-003 | aceito | SEV2 | Com Q3, o firmware ignora `limit/offset`; backup JSONL repete a mesma página indefinidamente, duplica o artefato e pode esgotar disco. |
| G-004 | expansão de B-003 | — | Mesmo UPDATE parcial reportado como sucesso; G demonstra que o teste não atravessa o serviço real. |
| G-005 | aceito | SEV2 | A “prova de idempotência” testa só o fake; criação real não relê/reconcilia após resposta perdida e pode deixar usuário sem credenciais/grupo. |
| G-006 | aceito | SEV3 | Doze casos MySQL terminam por `return` e são contabilizados como passed, não skipped. |
| G-007 | aceito | SEV3 | Integrações dos consumidores usam defaults favoráveis; Q3 e os dois modos Q4 ficam confinados ao autoteste do fake. |
| G-008 | aceito | SEV3 | Fixtures têm PII de aparência real e IPs internos; o relatório sanitizou os valores e não tentou identificar pessoas. |

A fatia G acrescenta **5 achados únicos: 2 SEV2 e 3 SEV3**. As três expansões de
achados anteriores permanecem valiosas como lacunas de teste, mas não ganham um segundo ID na
tabela mestra.

## Verificação da fatia H

### Contrato versus implementação

O contrato aceito exige releases imutáveis, junction atômica, backup verificado antes de
migration, rollback automático e estado fora do ciclo de release. A implementação tem controles
positivos importantes — estado em ProgramData, ACLs privadas, LocalService, hashes dos runtimes,
firewall restrito e `/ready` — porém o `.exe` copia o layout inteiro para Program Files,
reescreve runtime/service compartilhados e usa `current.json` apenas como registro. Ele não é o
ponteiro pelo qual o serviço inicia.

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| H-001 | aceito | SEV1 | Upgrade sobrescreve release/runtime/service em uso; versão permanece `1.0.0` e o fallback pode apontar aos mesmos arquivos novos. |
| H-002 | aceito | SEV1 | Após migration nova, o release anterior recusa o ledger por `MISSING_LOCAL_FILE`; rollback de código não sobe. |
| H-003 | aceito | SEV2 | Migration roda no banco vivo sem backup restaurado-prova; rollback de DDL parcial não existe. |
| H-004 | aceito | SEV1 | Se parar API funciona e parar MySQL falha, o flag de recuperação não é armado e a API permanece parada. |
| H-005 | aceito | SEV3 | Não há preflight completo nem ledger durável com desfazimento por etapa. |
| H-006 | aceito | SEV3 | Wizard permite `{app}` divergente enquanto scripts recalculam Program Files; shutdown fixa caminhos em `C:`. |
| H-007 | aceito | SEV3 | Workflow não compila, testa, publica nem calcula hash do `.exe` final. É distinto de F-006, que trata gatilho/pareamento antigo. |
| H-008 | aceito | SEV3 | Builder aceita `ISCC.exe` encontrado localmente e não revalida compilador nem inventário do layout. |
| H-009 | aceito | SEV3 | Qualquer SHA web pode ser pareado; readiness só comprova `index.html`, não compatibilidade API↔web. |
| H-010 | aceito | SEV3 | Uninstall preserva ACEs de service SIDs removidos; reinstalação valida ACL antes de recriar serviços e pode abortar. |
| H-011 | aceito | SEV3 | MySQL empacotado/serviço/porta/layout contradizem ADR-0001 e os próprios gates de assinatura/redistribuição. |
| H-012 | aceito | SEV3 | Fluxo oculto, sem preflight visível/códigos/atalhos, não dá ação segura à secretária em falha. |

A fatia H acrescenta **12 achados únicos: 3 SEV1, 1 SEV2 e 8 SEV3**.

## Passada transversal do orquestrador

A passada exigida pela Fase 3 revisitou arquivos críticos, vazios/não importados, integração
Control iD, wiring HTTP e instalador:

- `dataController.js` permanece com 0 bytes; `validacao.js` tem 153 linhas físicas e nenhum
  importador de produção. Isso já estava no inventário de terreno e não produz novo ID sem um
  consumidor/contrato quebrado demonstrável.
- A busca confirmou novamente `group_id: 1` para toda pessoa, comentado como grupo que libera
  todos. A consequência depende das `access_rules`, portais e política efetiva do equipamento;
  sem o estado de campo, isso vira pergunta presencial obrigatória, não achado factual novo.
- Logging por nome/identificador em caminhos Control iD amplia D-010, sem novo ID.
- Nenhum arquivo grande/critical marcado como “nada encontrado” ficou sem uma segunda leitura.
- Não surgiu achado adicional com confiança suficiente além dos 17 itens únicos da onda.

### Pergunta de campo criada nesta passada

> No equipamento de cada portão, quais permissões efetivas o grupo `1` recebe, quais
> `access_rules`/portais o referenciam e essa política é igual para aluno, funcionário,
> visitante e saída de menor?

Até essa resposta existir, não se deve declarar que o grupo fixo é seguro nem alterar o vínculo
remotamente.

## Totais da Onda 3 e acumulado

- Propostas brutas: 20 (G: 8; H: 12).
- Três propostas G foram consolidadas como expansão de achados anteriores.
- Achados únicos acrescentados: **17 — 3 SEV1, 3 SEV2 e 11 SEV3**.
- Acumulado das três ondas: **99 achados únicos — 6 SEV1, 50 SEV2, 42 SEV3 e 1 SEV4**.

## Limitações

- O harness não foi executado; as contagens de casos são estáticas e reproduzíveis.
- Instalador/rollback/ACL/serviços foram avaliados estaticamente; os cenários H exigem VMs
  descartáveis antes de qualquer release.
- Q4 continua sendo incerteza real de firmware; o achado é a falta de matriz de consumo, não a
  existência dos dois modos intencionais do simulador.
- Não se confirmou se a PII de aparência real pertence a pessoa real; a regra já proíbe esse
  tipo de fixture.
