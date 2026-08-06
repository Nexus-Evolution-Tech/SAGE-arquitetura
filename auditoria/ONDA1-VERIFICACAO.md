# Onda 1 — verificação do orquestrador

Data: 2026-08-06

Status: concluída e pronta para checkpoint.

## Base verificada

- `SAGE-API`: `9e3eaba3475c3e9755f341d29bada059cc6fc5db`
- `SAGE`: `06c1ed4e948236c44926ed13fdb96521dd81d269`
- Branch nos dois repositórios: `wip/recuperacao-local-pre-auditoria`
- Método: análise estática; nenhuma escrita nos repositórios auditados.
- Testes não executados: o host tem Node `v18.16.1` e o backend exige `>=24 <25`.

Os relatórios de fatia preservam a classificação proposta por cada auditor. As decisões e
severidades abaixo são as do orquestrador, após releitura das evidências e aplicação literal
da régua do projeto.

## Calibração e independência

- Fatia A: aprovada, 1/1 fato conhecido redescoberto independentemente.
- Fatia C: aprovada, 5/5 fatos conhecidos redescobertos independentemente.
- Primeira execução da fatia B: reprovada, 1/2; relatório integral arquivado em
  `descartados/fatia-b-primeira-passagem-nao-confiavel.md` e nenhum achado aproveitado.
- Segunda execução da fatia B: descartada antes da entrega. O orquestrador mencionou por
  engano uma configuração do gabarito ao responder a um checkpoint, contaminando a
  independência. Nenhuma conclusão dessa execução será usada.
- Terceira execução da fatia B: aprovada, 2/2 fatos conhecidos redescobertos
  independentemente; foi isolada de arquitetura, handoffs, gabarito e relatórios anteriores.

## Verificação das fatias A e C

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| A-001 | aceito | SEV2 | Chaves de `req.body` viram identificadores SQL; consolidar C-012 aqui. |
| A-002 | aceito | SEV2 | Credenciais reutilizáveis são persistidas e retornadas; consolidar C-004 aqui. |
| A-003 | aceito | SEV2 | `Presenca` é mutável/apagável e não há cadeia append-only; consolidar C-010 aqui. |
| A-004 | aceito | SEV1 | O fluxo apaga todos os usuários da catraca e pode apagar tabelas globais; consolidar C-011 aqui. |
| A-005 | aceito | SEV2 | `Date` serializado pelo pool `-03:00` e string UTC coexistem em `Acesso.data_hora`. |
| A-006 | aceito | SEV2 | Importação confirma linhas anteriores e continua após erro por linha, sem transação do lote. |
| A-007 | aceito | SEV2 | Promoção captura falhas individuais e ainda pode gravar o checkpoint anual. |
| A-008 | aceito | SEV1 | O baseline de instalação falha no evento anual depois de DDL parcial. |
| A-009 | aceito | SEV2 | Normalização pré-ledger executa `DROP COLUMN` destrutivo. |
| A-010 | aceito | SEV3 | Ignorar `Duplicate column name` do `ALTER` inteiro pode deixar outra coluna ausente. |
| A-011 | aceito | SEV2 | Pessoa, subtipo e outbox são gravados por passos independentes. |
| A-012 | aceito | SEV2 | `Acesso` é confirmado antes da derivação de `Presenca`. |
| A-013 | aceito | SEV2 | O cursor final avança sobre logs sem pessoa e impede recuperação automática. |
| A-014 | aceito | SEV2 | Falha da outbox é registrada, mas não propagada ao chamador. |
| A-015 | aceito | SEV2 | Importação da catraca cria `Pessoa.tipo='ALUNO'` sem linha em `Aluno`. |
| A-016 | aceito | SEV2 | `CREATE TABLE IF NOT EXISTS` não converge tabelas legadas para os campos usados pela API. |
| A-017 | aceito | SEV2 | Validação e substituição de horários não são atômicas nem protegidas por unicidade suficiente. |
| A-018 | aceito | SEV2 | CPF/RFID têm índices não únicos e o serviço usa check-then-insert. |
| A-019 | aceito | SEV3 | Índice/consulta anual incompatíveis; impacto de escala depende da base real. |
| A-020 | aceito | SEV2 | Ordem entre filesystem e banco pode perder a foto anterior ou deixar referência quebrada. |
| A-021 | aceito | SEV2 | `Responsavel.aluno_id` aceita vínculo órfão por ausência de FK e validação. |
| C-001 | aceito | SEV2 | `GET /escolas` público inclui hash de senha, login e contato. |
| C-002 | aceito | SEV2 | JWT identifica só unidade; não há operador, papel nem autorização por ação. |
| C-003 | aceito | SEV2 | Token de uma unidade alcança registros globais por id/unidade informada no corpo. |
| C-004 | duplicata de A-002 | — | Mesma credencial em claro, observada pela superfície HTTP. |
| C-005 | aceito | SEV2 | Dez rotas declaradas sem autenticação; exatamente uma muta estado. |
| C-006 | aceito | SEV2 | Callback falha aberto sem configuração e confia em `x-forwarded-for` do cliente. |
| C-007 | aceito | SEV2 | Falha total ou parcial do callback recebe HTTP 200 e pode não ser repetida. |
| C-008 | aceito | SEV2 | Em produção, chave ausente libera diagnóstico com PII e `card_value`. |
| C-009 | aceito | SEV2 | WebSocket anônimo pode assinar eventos globais de acesso. |
| C-010 | duplicata de A-003 | — | Mesma mutabilidade/exclusão de presença, observada pelas rotas. |
| C-011 | duplicata de A-004 | — | Mesmo fluxo destrutivo, observado pela superfície HTTP. |
| C-012 | duplicata de A-001 | — | Mesma interpolação de identificadores SQL, observada pelo CRUD HTTP. |
| C-013 | aceito | SEV2 | Multer grava antes da autenticação, sem limite ou validação de conteúdo. |
| C-014 | aceito | SEV2 | Fotos de pessoas, inclusive menores, são públicas e enumeráveis por id. |
| C-015 | aceito | SEV2 | Login sem rate limit diferencia unidade inexistente de senha incorreta. |
| C-016 | aceito | SEV3 | Erro global devolve `err.message` em produção. |
| C-017 | aceito | SEV2 | `originalUrl` registra segredos em query e o middleware registra origem. |
| C-018 | aceito com escopo reduzido | SEV2 | Pessoa duplica A-011; permanece o replace não transacional de `FuncionarioHorario`. |
| C-019 | aceito | SEV2 | Falha do loader é engolida e `/health` continua positivo com rotas parciais. |
| C-020 | aceito | SEV2 | GET de status reconfigura Monitor sem aguardar e pode ocultar perda do callback. |
| C-021 | aceito | SEV3 | Paginação e intervalo sem teto permitem carga excessiva, mas exigem provocação. |
| C-022 | aceito | SEV3 | Há colisões de método/caminho e montagem dupla de `monitoringRoutes`. |

Após quatro duplicatas A/C, permanecem 39 achados únicos: 2 SEV1, 32 SEV2,
5 SEV3 e 0 SEV4.

## Verificação da fatia B

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| B-001 | aceito | SEV2 | Defaults 110.000.000/111.000.000 divergem; a falha emerge a partir do id local 1.000.000 por causa do truncamento. |
| B-002 | rejeitado | — | Falso positivo: `peopleService.js:110` chama `registrarSyncPendente(idPessoa, 'CREATE')`. O endpoint manual silencioso não salva o título amplo. |
| B-003 | aceito | SEV2 | Exceção durante UPDATE remoto vira `sucesso:true`; o consumidor remove a outbox. |
| B-004 | aceito | SEV2 | `deletarUsuario` retorna `false`, o chamador ignora e a pendência DELETE é removida. |
| B-005 | aceito | SEV2 | O lote fixo das 50 linhas mais antigas pode ser monopolizado por dispositivo offline/desabilitado. |
| B-006 | aceito com escopo reduzido | SEV2 | O salto de cursor duplica A-013; permanece como achado novo o piso global de log aplicado antes de identidade/existência/persistência. |
| B-007 | duplicata de C-007 | — | Mesmo ACK HTTP 200 de falha total/parcial do callback. |
| B-008 | aceito | SEV2 | Push multi-dispositivo exige `control_id_device_id`, mas CRUD, quick-add e formulário não o gravam. |
| B-009 | duplicata de C-006 | — | Mesmo callback fail-open e confiança indevida em `x-forwarded-for`. |
| B-010 | duplicata/expansão de A-004 | — | Acrescenta zeragem por tipo e limpeza por prefixo à mesma causa destrutiva sem backup/restore. |
| B-011 | aceito | SEV2 | Backup completo aceita tipos vazios após erro, não pagina e não há restore de JSON/JSONL. |
| B-012 | aceito | SEV2 | Dump reprovado permanece no diretório e é considerado recente por boot/status. |
| B-013 | aceito | SEV2 | Importação da catraca perde o id externo e não estabelece mapeamento recuperável. |
| B-014 | aceito | SEV3 | Clientes e schedulers têm timeout/retry/lock incompatíveis; impacto exige sobreposição/falha de rede. |
| B-015 | aceito com escopo reduzido | SEV3 | `/monitoring/state` funciona pela montagem dinâmica; permanecem `join` vs `subscribe:*`, estado não alimentado e `dispositivoId` vs `dispositivo_id`. |

A fatia B acrescenta 11 achados únicos: 9 SEV2 e 2 SEV3. O total verificado da
Onda 1 é de **50 achados únicos: 2 SEV1, 41 SEV2, 7 SEV3 e 0 SEV4**.

### Totais brutos e decisões

- A: 21 propostas; 21 aceitas, sendo quatro posteriormente consolidadas com duplicatas de C.
- B elegível: 15 propostas; 11 aceitas como itens novos, três consolidadas e uma rejeitada.
- C: 22 propostas; 18 aceitas como itens novos e quatro consolidadas.
- Total bruto elegível: 58 propostas. Após uma rejeição e sete consolidações entre fatias:
  50 achados únicos.

## Precisões factuais incorporadas

- `monitoringRoutes.js` contém 10 declarações de rota sem `autenticar`: nove GET e um POST.
  Somente `POST /monitoring/cache/clear` altera estado; os dois handlers de sync-db fazem
  apenas consultas `SELECT`.
- A montagem direta em `app.js` e a montagem dinâmica em `loadRoutes.js` criam aliases.
  Em particular, o mesmo router é montado em `/monitoring` e em `/`.
- `POST /dispositivos/:id/zerar-tudo` apaga objetos da catraca. O apagamento global do banco
  local está em `POST /dispositivos/:id/comecar-do-zero` quando as flags são habilitadas.
- O total físico da Fase 1 é 45.231 linhas. `validacao.js` tem 153 linhas físicas; a contagem
  anterior de 132 vinha de `Measure-Object -Line`, que não contabilizou linhas em branco.

## Limitações

- Nenhuma suíte foi executada por incompatibilidade deliberadamente não corrigida de Node.
- Não havia instância MySQL descartável autorizada; achados de DDL/transação foram validados
  estaticamente e devem ser reproduzidos em ambiente sintético na etapa de correção.
- Severidade mede consequência segundo a régua SAGE, não facilidade de exploração.
