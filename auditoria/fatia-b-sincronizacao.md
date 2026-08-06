# Auditoria independente — Onda 1 / FATIA B — Control iD e sincronização

> **Nota do orquestrador:** este é o relatório bruto do auditor. B-002 foi rejeitado e
> B-006/B-015 tiveram escopo reduzido; para conclusões factuais e severidades da onda,
> prevalece `ONDA1-VERIFICACAO.md`.

Data: 2026-08-06
Repositórios: `SAGE-API` e `SAGE`
Branch observada nos dois: `wip/recuperacao-local-pre-auditoria`

## Resultado executivo

Foram encontrados **15 achados únicos**: **1 SEV1, 12 SEV2, 2 SEV3 e 0 SEV4**. O risco dominante é de convergência falsa: a API confirma ou remove trabalho da outbox mesmo quando a mutação na catraca falhou ou foi apenas parcial. Há ainda rotas autenticadas capazes de apagar todos os usuários/objetos do equipamento sem backup obrigatório, verificável ou restaurável.

Esta auditoria foi independente e somente leitura nos dois repositórios. O único arquivo criado foi este relatório. Não foram lidos `SAGE-arquitetura`, outros arquivos de `auditoria` nem handoffs/relatórios anteriores.

## Método, universo e limitação

- Manifesto fechado analisado por script: **56 arquivos**, **11.100 LOC físicas** (inclui linhas vazias/comentários) e **69 nomes únicos de `process.env`**.
- Seleção: implementação e configuração diretamente participantes de Control iD, acessos, dispositivos, push/pull, outbox, cursores, jobs, backup/restauração, WebSocket e consumidores frontend. Não entram testes na contagem.
- A busca de variáveis foi automática, por regex `process\.env\.([A-Z][A-Z0-9_]*)`, sobre o manifesto; a contagem de LOC foi `Get-Content(...).Count`.
- Não foi executado `npm test`: `node --version` retornou **v18.16.1**, enquanto `SAGE-API/package.json` exige **`>=24 <25`**. Logo, as reproduções abaixo são estáticas e a confiança considera essa limitação.
- Severidade aplicada estritamente: SEV1 = catraca parada/ninguém entra; SEV2 = funciona, mas perde ou corrompe dado; SEV3 = incômodo com contorno; SEV4 = cosmético.

## Regras auditadas

- **R1 — convergência durável:** toda mudança local destinada à catraca deve chegar a cada dispositivo habilitado ou permanecer pendente.
- **R2 — cursor conservador:** cursor só pode ultrapassar evento persistido ou explicitamente quarentenado de forma recuperável.
- **R3 — idempotência:** retry, concorrência e retomada não podem duplicar, bloquear permanentemente nem desfazer estado mais novo.
- **R4 — confiança de origem:** callback que grava acesso deve autenticar a origem por padrão e não confiar em cabeçalho forjável.
- **R5 — irreversibilidade:** apagar dado operacional exige backup completo, verificado e com restauração exercitável.
- **R6 — ACK verdadeiro:** sucesso/remoção de outbox somente após comprovação do efeito requerido.
- **R7 — identidade canônica:** a conversão de IDs e seus defaults deve ser única e reversível em todas as bordas.
- **R8 — observabilidade verdadeira:** status e telas não podem indicar sincronização/backup saudável sem evidência correspondente.
- **R9 — exclusão por dispositivo:** cron, boot, polling e endpoint manual devem coordenar trabalho concorrente do mesmo dispositivo.
- **R10 — contrato ponta a ponta:** rota, evento e nomes de campos devem coincidir entre backend e frontend.

## Fluxos reconstruídos e gates em ordem exata

### Pull completo (boot, cron de 10 min e endpoint manual)

| Ordem | Gate/transformação | Estado |
|---:|---|---|
| 1 | Boot/jobs: `JOBS_ENABLED != 'false'`; boot/cron: `CATRACA_SYNC_ENABLED != 'false'`. O endpoint manual ignora ambos. | global |
| 2 | Listagem bulk: `COALESCE(sync_enabled,1)=1`. | por dispositivo |
| 3 | Bulk pula `globalState.isDeviceZerando(id)`; chamada direta manual não passa por esse gate. | por dispositivo, apenas memória do processo |
| 4 | `sincronizarAcessos` reaplica `isSyncEnabled(sync_enabled)`. | por dispositivo |
| 5 | `endereco:porta` → `login.fcgi`; ausência de sessão encerra o dispositivo. | por dispositivo |
| 6 | Se há cursor, `load_objects` recebe `access_logs.id > ultimo_log_id_sincronizado`; caso contrário usa timestamp derivado do último `Acesso` menos 1 h. | por dispositivo |
| 7 | `deviceService` reaplica `log.time > timestampInicial`; com cursor, timestamp é zerado. | por evento |
| 8 | Em monitor: limita a 50..500 e ordena recente→antigo; em full: ordena `id` antigo→novo. | global da execução / por evento |
| 9 | Evento deve ser objeto; `id` e `time` devem ser inteiros positivos seguros. | por evento |
| 10 | `id > CATRACA_MIN_LOG_ID` (um único valor para todos os equipamentos) e `time > effectiveTimestampInicial`. | global aplicado por evento |
| 11 | `user_id` → número; se `>= CATRACA_USER_ID_OFFSET`, subtrai offset; depois remove zeros e conserva só os últimos 7 dígitos. | por evento, conversão de identidade |
| 12 | `pessoa_id` deve ser inteiro seguro positivo e existir em `Pessoa`. | por evento |
| 13 | `portal_id` → ENTRADA/SAIDA; tamanho de `card_value` 8 → QR_CODE, demais → CARTAO_RFID. | por evento |
| 14 | `INSERT ... WHERE NOT EXISTS ... ON DUPLICATE KEY`; unicidade efetiva depende de `(dispositivo_id,catraca_log_id)`. | por evento |
| 15 | Ponteiro intermediário a cada `SYNC_PASSO_PONTEIRO`; no fim, ponteiro salta para o maior `id` **buscado**, inclusive rejeitado nos gates 9–12. | por dispositivo |

Evidência-base: `SAGE-API/index.js:67-132`, `src/jobs/scheduledJobs.js:14-53`, `src/routes/accessRoutes.js:18-39`, `src/services/accessService.js:131-199,205-323,325-424,449-490`.

### Pull leve (monitor polling)

Gates: `CATRACA_SYNC_ENABLED` global → intervalo `MONITOR_POLLING_INTERVAL_MS > 0` → lista **todos** os dispositivos → `isSyncEnabled` por dispositivo → sessão → `load_objects` descendente limitado → os mesmos gates por evento 9–14 acima. Não atualiza cursor. Não consulta `isDeviceZerando`, e `setInterval(async...)` não impede sobreposição. Evidência: `src/jobs/scheduledJobs.js:37-53`; `src/services/accessService.js:162-167,222-227,470-490`.

### Push Monitor

| Ordem | Gate/transformação | Estado |
|---:|---|---|
| 1 | Se `MONITOR_CALLBACK_TOKEN` não vazio, token query/header deve coincidir; se ausente na configuração, gate inexiste. | global por request |
| 2 | Se whitelist não vazia, primeiro `x-forwarded-for` ou IP Express deve coincidir; o cabeçalho é aceito sem proxy confiável comprovado. | global por request |
| 3 | Payload deve ser objeto; `object_changes` deve ser array não vazio. | por request |
| 4 | `device_id` deve ser inteiro positivo; resolve por `control_id_device_id`, ou usa fallback somente se houver exatamente um dispositivo. | por request, conversão de identidade |
| 5 | Cada change: objeto=`access_logs`, tipo=`inserted`, `values` objeto. | por evento |
| 6 | `id`, `time`, `user_id` e `portal_id` passam por inteiros positivos; cartão é truncado a 64 caracteres. | por evento |
| 7 | Idade: `now-time <= MONITOR_MAX_EVENT_AGE_SECONDS` e `time <= now+60`. | global aplicado por evento |
| 8 | `user_id` passa pela mesma conversão dos últimos 7 dígitos; pessoa deve existir. | por evento |
| 9 | Insert idempotente por `(dispositivo,catraca_log_id)`; depois presença, cache e WebSocket. | por evento |
| 10 | Qualquer exceção externa é respondida como HTTP 200 `{ok:false}`. | por request |

Evidência-base: `src/middlewares/monitorCallbackAuth.js:8-34`, `src/routes/notificationRoutes.js:15-34`, `src/services/accessService.js:542-732`.

### Outbox de pessoas

Origem efetiva: edição e soft delete chamam `registrarSyncPendente`; criação não chama. O produtor lê CREATE/UPDATE existentes, aplica redução parcial e insere por dispositivo. O consumidor, a cada cron, seleciona os 50 mais antigos sem claim/lease; testa dispositivo; busca Pessoa; executa CREATE/UPDATE/DELETE; então apaga a linha. Offline incrementa retry sem backoff; desabilitado conserva a linha e a posição original. Evidência: `src/controllers/peopleController.js:37-65,129-176`; `src/services/sync.js:5-88`; `src/jobs/scheduledJobs.js:94-198`.

## Catálogo automático de ambiente e comparação de defaults

Todos os 69 nomes encontrados no manifesto estão abaixo. “Sem default” significa que o consumidor trata ausência como vazio/undefined ou exige provisionamento externo.

| Grupo | Variável | Default/semântica nos consumidores |
|---|---|---|
| Control iD | `CATRACA_TIMEOUT` | 10000 ms (`config/axios.js:7`) |
| Control iD | `CATRACA_RETRY_ATTEMPTS` | 3 (`config/axios.js:46`) |
| Control iD | `CATRACA_RETRY_DELAY` | 1000 ms linear (`config/axios.js:66`) |
| Control iD | `CATRACA_RETRY_DELAY_1_MS` | 2000 (`deviceService.js:28`) |
| Control iD | `CATRACA_RETRY_DELAY_2_MS` | 5000 (`deviceService.js:29`) |
| Control iD | `CATRACA_RETRY_DELAY_3_MS` | 10000 (`deviceService.js:30`) |
| Control iD | `CATRACA_LOAD_LOGS_TIMEOUT` | 60000 em todos os cinco consumidores (`deviceService.js:143,227,264,377,424`) |
| Control iD | `CATRACA_ZERAR_LOGS_TIMEOUT_MS` | 180000 (`deviceService.js:478`) |
| Control iD | `CATRACA_BACKUP_CHUNK_SIZE` | 2000 (`deviceService.js:10`) |
| Control iD | `CATRACA_LOGS_INFO_THRESHOLD` | 5000 (`deviceService.js:220`) |
| Control iD | `CATRACA_DELAY_APOS_BACKUP_MS` | 15000 nos dois consumidores (`deviceController.js:302,450`) |
| Identidade | `CATRACA_USER_ID_OFFSET` | **111000000** em ingestão/diagnóstico (`accessService.js:8`; `deviceController.js:105`) e `.env.example:54-56`, mas **110000000** no provisionamento (`controlIdService.js:11`) |
| Identidade | `CATRACA_ENTRADA_PORTAL_ID` | 1 (`accessService.js:12`) |
| Identidade | `CATRACA_SAIDA_PORTAL_ID` | 2 (`accessService.js:13`) |
| Identidade | `CATRACA_MIN_LOG_ID` | 0, porém global a todos os dispositivos (`accessService.js:134`) |
| Control iD | `CATRACA_ADMIN_USER` | sem default (`controlIdService.js:146`) |
| Control iD | `CATRACA_ADMIN_PASSWORD` | sem default (`controlIdService.js:147`) |
| Control iD | `CATRACA_SKIP_USER_IMAGE` | só desliga para string `true` ou `1`; ausência tenta upload (`controlIdService.js:167`) |
| Sync | `CATRACA_SYNC_ENABLED` | true no boot e jobs, consistente (`index.js:118`; `scheduledJobs.js:14`) |
| Sync | `SYNC_PARALLEL_LIMIT` | 3 (`controlIdService.js:12`) |
| Sync | `SYNC_CHECK_INTERVAL` | código: `*/1 * * * *`; `.env.example:101`: `*/5 * * * *` — divergente |
| Sync | `SYNC_BATCH_SIZE` | 50 no código e `.env.example:102` |
| Sync | `SYNC_PASSO_PONTEIRO` | 25 (`accessService.js:304`) |
| Sync | `JOBS_ENABLED` | habilitado salvo string `false` (`index.js:70`) |
| Sync | `HEALTH_CHECK_INTERVAL` | 60000 (`scheduledJobs.js:58`) |
| Monitor | `MONITOR_USE_PUSH` | false salvo string exata `true`; UI/config e dispositivo consistentes (`schoolController.js:249`; `deviceService.js:673`) |
| Monitor | `MONITOR_POLLING_INTERVAL_MS` | 20000 em job, endpoint de config e frontend (`scheduledJobs.js:39`; `schoolController.js:250`; `Settings.js:87,132-133`) |
| Monitor | `MONITOR_SYNC_LIMIT` | 200, clamp 50..500 (`accessService.js:137,166,223`) |
| Monitor | `MONITOR_CALLBACK_URL` | sem default; precede HOST/PORT (`deviceService.js:650-657`) |
| Monitor | `MONITOR_CALLBACK_HOST` | `HOST` ou localhost (`deviceService.js:659`) |
| Monitor | `MONITOR_CALLBACK_PORT` | `PORT` ou 3000 (`deviceService.js:660`) |
| Monitor | `MONITOR_CALLBACK_TOKEN` | sem default no código; middleware fica aberto; instalador gera segredo (`monitorCallbackAuth.js:9-18`; `initialize-state.ps1:203-214`) |
| Monitor | `MONITOR_IP_WHITELIST` | sem default, gate desligado (`monitorCallbackAuth.js:10,20-32`) |
| Monitor | `MONITOR_MAX_EVENT_AGE_SECONDS` | 300 (`accessService.js:598`) |
| Backup | `BACKUP_CRON` | job usa `0 3 * * *`; catch-up só desliga com `false` (`scheduledJobs.js:249`; `index.js:97`) |
| Backup | `BACKUP_MAX_HORAS` | 24 (`index.js:106`) |
| Backup | `BACKUP_VERIFICAR` | verificação ligada salvo `false` (`scheduledJobs.js:271`) |
| Backup | `BACKUP_DIR` | `paths.backups` (`backupBanco.js:82`) |
| Backup | `BACKUP_RETER_DIAS` | 14 (`backupBanco.js:86`) |
| Backup | `BACKUP_RETER_MINIMO` | 3 (`backupBanco.js:87`) |
| Backup | `MYSQLDUMP_PATH` | `mysqldump` (`backupBanco.js:84`) |
| Backup | `MYSQL_PATH` | `mysql` (`backupBanco.js:85`) |
| Backup | `MYSQL_DEFAULTS_EXTRA_FILE` | sem default; obrigatório no Windows (`backupBanco.js:71,91-105`) |
| Backup | `SAGE_MAINTENANCE_CONFIG_FILE` | sem default (`backupBanco.js:34`) |
| Backup | `SAGE_REQUIRE_MAINTENANCE_DB` | false salvo `true` (`backupBanco.js:72`) |
| Runtime | `SAGE_DATA_DIR` | `appRoot`; se definido deve ser absoluto (`paths.js:5-10`) |
| Runtime | `SAGE_REQUIRE_WEB` | false salvo `true`; produção também exige web (`app.js:201`) |
| Runtime | `PORT` | 3000 (`index.js:14`; callback herda em `deviceService.js:660`) |
| Runtime | `HOST` | servidor: 0.0.0.0; callback: localhost se ausente — usos deliberadamente distintos (`index.js:27`; `deviceService.js:659`) |
| Runtime | `NODE_ENV` | development no boot (`index.js:15`) |
| Runtime | `REQUEST_TIMEOUT` | 30000 (`app.js:70-71`) |
| Runtime | `API_VERSION` | package version/null conforme endpoint (`app.js:182,205`; `statusRoutes.js:118`) |
| Runtime | `DIAGNOSTICO_KEY` | sem default (`app.js:106`) |
| CORS/WS | `CORS_ORIGINS` | HTTP adiciona origens locais; Socket.IO usa lista vazia diretamente (`app.js:40-54`; `wsServer.js:17`) |
| CORS/WS | `CORS_ALLOW_ALL` | false salvo `true` (`app.js:41`) |
| CORS/WS | `WS_PING_INTERVAL` | 30000 (`wsServer.js:22`) |
| CORS/WS | `WS_PING_TIMEOUT` | 60000 (`wsServer.js:23`) |
| Banco | `DB_CONNECTION_LIMIT` | 10 (`database.js:8`) |
| Banco | `DB_QUEUE_LIMIT` | 100 (`database.js:9`) |
| Banco | `DB_HOST` | localhost (`database.js:17`; backup herda ambiente quando não há maintenance config) |
| Banco | `DB_PORT` | 3306 (`database.js:18`; `backupBanco.js:77`) |
| Banco | `DB_USER` | root (`database.js:19`; `backupBanco.js:78`) |
| Banco | `DB_PASSWORD` | sem default/`''` no backup (`database.js:20`; `backupBanco.js:79`) |
| Banco | `DB_NAME` | sage (`database.js:21`; `backupBanco.js:80`) |
| Banco | `DB_TIMEZONE` | -03:00 (`database.js:22`) |
| Frontend | `REACT_APP_API_URL` | origem atual quando vazio (`api.js:3`; `Settings.js:21`; `.env.production:1-4`) |
| Frontend | `REACT_APP_SOCKET_URL` | origem atual quando vazio (`WebSocketContext.js:24`; `.env.production:1-4`) |
| Fora do fluxo B, mas no manifesto | `PROMOCAO_CRON` | execução: vazio; mensagem log usa 10h10 — divergente (`scheduledJobs.js:207,308`) |
| Fora do fluxo B, mas no manifesto | `PROMOCAO_NA_SUBIDA` | true salvo `false` (`index.js:76`) |

## Verbos Control iD, retry e idempotência

| Endpoint Control iD | HTTP | Chamador | Retry/timeout | Idempotência observada |
|---|---|---|---|---|
| `login.fcgi` | POST | `deviceService.obterSessao` | axios instance (até 3 retries) dentro de `withRetryOnUnavailable` (até 3 novamente para 502/503/504): até 16 tentativas; 10 s | cria sessões repetidas; efeito não reconciliado |
| `session_is_valid.fcgi` | POST | `verificarSessao` | axios instance; 10 s; até 3 retries | leitura |
| `load_objects.fcgi` | POST | logs, objetos, backups, import | axios instance usa 60 s; utilitário legado usa axios cru sem timeout | leitura; paginação sem snapshot/ordem em backups |
| `create_objects.fcgi` | POST | users, cards, user_groups | axios cru, timeout padrão infinito e sem retry coordenado | **não idempotente**; CREATE parcial não vira upsert |
| `modify_objects.fcgi` | POST | users | axios cru, timeout infinito | update por ID, mas HTTP 400 sem body de erro é tratado como sucesso |
| `destroy_objects.fcgi` | POST | user/card/objetos/logs | misto: axios cru ou instance; delete de logs tem retry aninhado | delete por filtro tende a repetir, mas ACKs não comprovam todos os efeitos |
| `user_set_image_list.fcgi` | POST | imagem de usuário | axios cru; toda falha é ignorada | não verificada |
| `user_destroy_image.fcgi` | POST | imagem | axios cru; toda falha é ignorada | não verificada |
| `set_configuration.fcgi` | POST | Monitor | axios instance, timeout explícito 10 s e retry global | repetição substitui config; aceitável |

## Operações irreversíveis e prova de restauração

| Operação | Evidência | Backup antes? | Restauração verificada? |
|---|---|---|---|
| Apagar um objeto Control iD | `deviceController.js:365-395` | não | não existe consumidor de restore |
| Zerar um tipo, inclusive `access_logs` | `deviceController.js:438-470` | não | não |
| Zerar todos os objetos (inclui users e logs) | `deviceController.js:502-515`; `deviceService.js:338-358` | não | não |
| “Começar do zero” (catraca + tabelas SAGE) | `deviceController.js:518-569` | não | não |
| Limpar todos users com prefixo 11 em todas as catracas | `deviceRoutes.js:30`; `controlId-utils.js:308-354` | não | não |
| Zerar logs pelo fluxo principal | `deviceController.js:217-335` | JSONL antes | arquivo não é validado nem há importador/restore |
| Substituir cartão em UPDATE | `controlIdService.js:150-164` | não | não; falha após delete é ACK parcial |
| Apagar item da outbox | `scheduledJobs.js:165-190` | não | só backup periódico do banco |
| Retenção de dumps SQL | `backupBanco.js:288-298` | mantém mínimo de 3 | o arquivo removido não tem marcador persistido de verificação |
| Dump SQL diário | `backupBanco.js:166-285` | é o próprio backup | sim, por restore temporário, salvo `BACKUP_VERIFICAR=false`; não há restore operacional para produção neste escopo |

## Achados

### B-001 — Defaults incompatíveis quebram a bijeção de identidade a partir de 1.000.000

- **Arquivo:linhas:** `SAGE-API/src/services/controlIdService.js:11,90-92,191-193,256-258`; `src/services/accessService.js:7-27`; `src/controllers/deviceController.js:105-109,153-165`; `.env.example:54-56`
- **Severidade:** SEV2
- **Categoria:** identidade/configuração
- **Depende do ambiente:** SIM
- **Confiança:** alta
- **Sintoma:** pessoa provisionada com ID `110000000 + pessoa.id`, mas ingestão/diagnóstico assumem `111000000`; para `pessoa.id=1000000`, o acesso converte para 0, e acima disso colide com IDs baixos.
- **Evidência:** o produtor defaulta 110000000; os dois consumidores e o exemplo defaultam 111000000. A função ainda conserva apenas os últimos sete dígitos.
- **Impacto no dado:** acesso é descartado ou atribuído à pessoa errada.
- **Reprodução estática:** substitua `pessoa.id=1000000`: produtor gera 111000000; consumidor subtrai 111000000 e rejeita 0. Com 1000001, resolve para pessoa 1.
- **Correção sugerida:** módulo único de identidade, offset obrigatório validado no boot e coluna explícita de mapeamento; remover truncamento por sete dígitos e migrar IDs existentes.
- **Regra violada:** R7.

### B-002 — Criação de pessoa anuncia sincronização, mas não cria trabalho nem chama a catraca

- **Arquivo:linhas:** `SAGE-API/src/controllers/peopleController.js:37-65`; `src/services/sync.js:5-88`; `src/utils/sync_catracas.js:4-19`; `src/controllers/peopleController.js:251-258`
- **Severidade:** SEV2
- **Categoria:** outbox/provisionamento
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** nova pessoa recebe resposta `sincronizacao: iniciada`, porém não é provisionada; o endpoint manual alternativo engole falhas individuais e gerais e sempre responde concluído.
- **Evidência:** chamada direta está comentada e não há `registrarSyncPendente(id,'CREATE')`; o sincronizador manual tem `catch` vazios.
- **Impacto no dado:** cadastro local e catraca divergem; a credencial da nova pessoa não funciona no equipamento.
- **Reprodução estática:** siga `criar`: após `res.status(201)`, linhas 58–63 são comentários e a função termina; não há produtor CREATE.
- **Correção sugerida:** na mesma transação do cadastro, inserir outbox CREATE por dispositivo; resposta deve expor estado durable; sincronização em massa deve retornar falhas e ser idempotente.
- **Regra violada:** R1, R6, R8.

### B-003 — UPDATE parcial é marcado como sucesso e removido da outbox

- **Arquivo:linhas:** `SAGE-API/src/services/controlIdService.js:128-185,191-219`; `src/utils/controlId-utils.js:34-66,203-222`; `src/jobs/scheduledJobs.js:172-190`
- **Severidade:** SEV2
- **Categoria:** outbox/ACK/idempotência
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** edição pode parar no cartão e retornar `sucesso:true, aviso:'Update parcial'`; o job então apaga a pendência.
- **Evidência:** no ramo sem RFID válido, `deletarCartao` recebe `resultados` como `tipo`; nenhum cartão casa, retorna null e `cartao.id` lança. O catch externo converte qualquer erro em sucesso.
- **Impacto no dado:** nome/cartões/QR/foto ficam em versões diferentes; apagar cartão antes de recriar pode retirar credencial válida sem retry.
- **Reprodução estática:** use pessoa com `cartao_rfid=null`; linha 157 chama `deletarCartao(..., resultados)`, linhas 56–63 retornam null, linha 210 acessa `cartao.id`, e linhas 174–184 ACKam parcial.
- **Correção sugerida:** nunca converter exceção em sucesso; operação de cartão deve ser upsert/reconcile; só deletar outbox após pós-condições consultadas no dispositivo.
- **Regra violada:** R1, R3, R6.

### B-004 — DELETE remoto falho retorna sucesso e elimina a única pendência

- **Arquivo:linhas:** `SAGE-API/src/utils/controlId-utils.js:138-155`; `src/services/controlIdService.js:227-250,256-294`; `src/jobs/scheduledJobs.js:179-190`
- **Severidade:** SEV2
- **Categoria:** outbox/segurança de acesso
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** falha de rede/HTTP ao apagar usuário é capturada como `false`, mas o chamador ignora o retorno, declara sucesso e o job apaga a outbox.
- **Evidência:** `deletarUsuario` não lança; `processarDelecaoDispositivo` não testa `userSuccess`.
- **Impacto no dado:** pessoa ocultada/removida no SAGE pode continuar entrando pela catraca indefinidamente.
- **Reprodução estática:** faça `axios.post(destroy_objects)` rejeitar; fluxo segue das linhas 150–155 para o log/sucesso nas linhas 243–244 e depois DELETE da outbox.
- **Correção sugerida:** propagar falha; verificar `changes`/ausência do usuário; conservar pendência com backoff e alerta.
- **Regra violada:** R1, R6.

### B-005 — Primeiro lote offline/desabilitado bloqueia indefinidamente toda a outbox posterior

- **Arquivo:linhas:** `SAGE-API/src/jobs/scheduledJobs.js:94-198`; `database/melhorias_sistema.sql:15-26`; `src/services/sync.js:9-21,62-80`
- **Severidade:** SEV2
- **Categoria:** fila/retry/concorrência
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** as mesmas 50 linhas antigas são relidas a cada execução; registros de dispositivos saudáveis depois delas nunca chegam à catraca.
- **Evidência:** seleção ordena apenas `data_tentativa` e limita antes de considerar `last_attempt/retry_count`; offline/desabilitado mantém `data_tentativa`. Não há claim, lease, máximo, dead-letter nem unique key (a unicidade está comentada).
- **Impacto no dado:** atualizações/criações posteriores ficam pendentes indefinidamente; execuções sobrepostas também podem processar a mesma linha.
- **Reprodução estática:** coloque 50 pendências antigas de dispositivo offline e uma 51ª saudável; toda rodada seleciona novamente as primeiras 50.
- **Correção sugerida:** claim transacional (`FOR UPDATE SKIP LOCKED` ou status/lease), `next_attempt_at` com backoff, DLQ, índice/unique e fairness por dispositivo.
- **Regra violada:** R1, R3, R9.

### B-006 — Cursor final atravessa eventos rejeitados e o filtro global pode perdê-los para sempre

- **Arquivo:linhas:** `SAGE-API/src/services/accessService.js:131-140,300-323,325-375,405-423`; `.env.example:66-70`
- **Severidade:** SEV2
- **Categoria:** cursor/filtros
- **Depende do ambiente:** SIM
- **Confiança:** alta
- **Sintoma:** log com pessoa ainda ausente, identidade inválida, timestamp inválido ou bloqueado por `CATRACA_MIN_LOG_ID` não entra no banco; ao fim, o cursor avança para o maior ID buscado mesmo assim.
- **Evidência:** `maiorLogIdGravado` existe, mas o update final usa `Math.max(...logIds)` da resposta bruta; a própria observação admite avançar sobre pessoa inexistente.
- **Impacto no dado:** acesso rejeitado deixa de ser recuperável em full sync; o filtro global pode zerar a ingestão de uma catraca com faixa menor.
- **Reprodução estática:** resposta com ids 101 (pessoa existe) e 102 (pessoa ausente): só 101 insere, mas cursor vira 102; cadastrar a pessoa depois não relê 102.
- **Correção sugerida:** cursor até último evento persistido/quarentenado; DLQ de evento com motivo; remover `CATRACA_MIN_LOG_ID` global ou torná-lo estado por dispositivo migrado.
- **Regra violada:** R2, R7.

### B-007 — Callback confirma HTTP 200 quando não persistiu o evento

- **Arquivo:linhas:** `SAGE-API/src/routes/notificationRoutes.js:15-34`; `src/services/accessService.js:598-640,676-709`
- **Severidade:** SEV2
- **Categoria:** push/ACK/retry
- **Depende do ambiente:** SIM
- **Confiança:** alta
- **Sintoma:** erro de banco/processamento recebe 200 `{ok:false}`; remetente não tem sinal HTTP para retry. Reentrega após cinco minutos é descartada pelo gate de idade.
- **Evidência:** catch externo responde 200; erros por evento são absorvidos em `result.erros`, e a rota também responde `{ok:true,...}`.
- **Impacto no dado:** evento pode sumir no modo push sem polling de recuperação ou após logs serem apagados.
- **Reprodução estática:** faça o INSERT rejeitar; serviço acumula erro, rota retorna 200; repetir após `MONITOR_MAX_EVENT_AGE_SECONDS` incrementa ignorados.
- **Correção sugerida:** 5xx quando nenhum commit durable ocorreu; ACK por evento; inbox persistente idempotente antes do processamento; política de replay baseada em ID, não só relógio.
- **Regra violada:** R2, R6.

### B-008 — Mapeamento obrigatório do push não pode ser cadastrado pela API/interface

- **Arquivo:linhas:** `SAGE-API/src/services/accessService.js:569-595`; `src/controllers/deviceController.js:26-28,704-725,780-813`; `database/migration_control_id_device_id.sql:1-9`; `SAGE/src/components/pages/Dispositivos/Dispositivos.js:140-149,475-526`
- **Severidade:** SEV2
- **Categoria:** push/configuração por dispositivo
- **Depende do ambiente:** SIM
- **Confiança:** alta
- **Sintoma:** com mais de uma catraca, todo callback sem `control_id_device_id` gravado é rejeitado; o campo não pertence a `campos/camposInsert`, quick-add nem formulário.
- **Evidência:** somente SQL/migrations/testes escrevem a coluna; busca global de produção não encontrou endpoint de atualização.
- **Impacto no dado:** push de todos os dispositivos fica sem ingestão/mapeamento; polling pode mascarar o defeito.
- **Reprodução estática:** cadastre dois dispositivos pela API; ambos ficam sem coluna mapeada; qualquer `device_id` entra no ramo de erro/return.
- **Correção sugerida:** expor/validar campo único no CRUD, descobrir `device_id` do equipamento e bloquear ativação do push enquanto o mapeamento não estiver completo.
- **Regra violada:** R1, R7, R8.

### B-009 — Callback é fail-open e whitelist aceita `X-Forwarded-For` não confiável

- **Arquivo:linhas:** `SAGE-API/src/middlewares/monitorCallbackAuth.js:8-34`; `src/app.js:64-66,89-95`; `installer/windows/initialize-state.ps1:199-219`
- **Severidade:** SEV2
- **Categoria:** segurança/integridade
- **Depende do ambiente:** SIM
- **Confiança:** alta
- **Sintoma:** fora do instalador ou com segredo/whitelist omitidos, qualquer cliente alcançável pode postar acessos; com só whitelist, pode forjar o primeiro `X-Forwarded-For`.
- **Evidência:** ambos os gates só existem se env não vazia; middleware prioriza cabeçalho sem verificar proxy confiável. O instalador mitiga com token, mas o default da aplicação não.
- **Impacto no dado:** inserção forjada de acesso/presença e estatísticas incorretas.
- **Reprodução estática:** ausência das duas env leva diretamente a `next()`; ou envie header igual a IP permitido.
- **Correção sugerida:** exigir token/assinatura em produção e falhar readiness; usar `req.ip` com `trust proxy` restrito ou ignorar XFF; rotação por dispositivo.
- **Regra violada:** R4.

### B-010 — Rotas autenticadas podem apagar todos os usuários/objetos sem backup: ninguém entra

- **Arquivo:linhas:** `SAGE-API/src/routes/deviceRoutes.js:19-30`; `src/controllers/deviceController.js:365-395,438-470,502-569,732-740`; `src/services/deviceService.js:315-358,589-609`; `src/utils/controlId-utils.js:308-354`
- **Severidade:** SEV1
- **Categoria:** operação irreversível
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** `zerar-tudo`, `comecar-do-zero`, zerar por tipo e `DELETE /dispositivos` executam deletes massivos sem backup obrigatório, confirmação forte, trava completa ou restore.
- **Evidência:** `ORDEM_ZERAR_CATRACA` inclui `users` e `access_logs`; limpeza por prefixo apaga todo ID iniciado em 11 em todas as catracas e ainda captura erro global, enquanto controller responde 204.
- **Impacto no dado:** todos os usuários provisionados podem desaparecer do equipamento; até reprovisionar manualmente, ninguém entra. `comecar-do-zero` também apaga tabelas locais sem transação.
- **Reprodução estática:** siga POST `/:id/zerar-tudo` → loop de `destroy_objects`; nenhuma chamada de backup precede a primeira destruição. Ou DELETE `/dispositivos` → limpeza prefixo 11.
- **Correção sugerida:** remover/segregar rotas de produção; confirmação multifator e escopo explícito; lock por dispositivo; backup completo validado + restore ensaiado; transação/compensação local.
- **Regra violada:** R5, R9.

### B-011 — “Backups” da catraca aceitam conteúdo parcial e não possuem restauração

- **Arquivo:linhas:** `SAGE-API/src/services/deviceService.js:361-401,404-459,551-587`; `src/controllers/deviceController.js:288-327,573-627`; `src/config/syncOrder.js:6-23`; busca de produção por `restore|restaur` sem consumidor de JSON/JSONL
- **Severidade:** SEV2
- **Categoria:** backup/restauração Control iD
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** backup completo grava array vazio para cada tipo que falhar e ainda retorna sucesso; não pagina o completo. JSONL/JSON são baixáveis, mas nenhuma rota/serviço os restaura.
- **Evidência:** catch por tipo apenas preenche `result.erros` e continua; controller não testa erros; o fluxo de zerar logs confia apenas no término da escrita.
- **Impacto no dado:** após delete, dados ausentes/parciais não podem ser recolocados pelo sistema; backup não prova recuperabilidade.
- **Reprodução estática:** faça um `load_objects users` falhar: arquivo contém `users:[]`, endpoint baixa como sucesso; não existe caminho que consuma esse arquivo.
- **Correção sugerida:** manifesto com contagens/checksums, paginação ordenada/snapshot, falha atômica se tipo obrigatório falhar e restore real em equipamento de teste antes de habilitar delete.
- **Regra violada:** R5, R8.

### B-012 — Backup SQL reprovado continua “recente” e pode deixar o status verde

- **Arquivo:linhas:** `SAGE-API/src/jobs/scheduledJobs.js:263-287`; `index.js:94-114`; `src/routes/statusRoutes.js:77-105`; `src/services/backupBanco.js:153-163,214-285`
- **Severidade:** SEV2
- **Categoria:** backup/observabilidade
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** se restore de verificação falha, o `.sql` permanece; catch-up e status olham apenas arquivo/mtime, não resultado persistido. O boot pode esperar 24 h e `/status` dizer “Tudo funcionando normalmente”.
- **Evidência:** caminho `!v.ok` retorna sem apagar/quarentenar; `listarBackups` não mantém metadado verificado; os consumidores escolhem o arquivo mais recente por mtime.
- **Impacto no dado:** operador acredita estar protegido, mas a cópia mais nova comprovadamente não restaura.
- **Reprodução estática:** `verificarBackup` retorna `{ok:false}`; siga retorno em 273–279, depois `listarBackups` inclui o mesmo arquivo e calcula idade recente.
- **Correção sugerida:** mover falhos para quarentena, persistir sidecar/registro de verificação, status/catch-up considerar somente último verificado e alertar explicitamente.
- **Regra violada:** R5, R8.

### B-013 — Importação “catraca → SAGE” perde a identidade necessária para importar acessos

- **Arquivo:linhas:** `SAGE-API/src/services/catracaImportService.js:30-108`; `src/services/deviceService.js:258-279`; `src/services/accessService.js:20-27,320-333`
- **Severidade:** SEV2
- **Categoria:** restauração/identidade/paginação
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** users importados recebem novo auto-ID local e são deduplicados só por nome; o `u.id` Control iD não é armazenado. A ingestão posterior calcula pessoa pelo ID da catraca e não encontra o auto-ID.
- **Evidência:** INSERT de Pessoa contém nome/unidade/QR/tipo, sem ID/mapeamento; `loadObjectsFromCatraca(...,{})` também não pagina.
- **Impacto no dado:** restauração pode perder usuários além do limite e descartar seus acessos; homônimos são colapsados.
- **Reprodução estática:** em banco vazio, importe user Control iD 110000123; Pessoa vira id 1; acesso converte para 123 e falha no gate de existência.
- **Correção sugerida:** tabela de mapeamento `(dispositivo_id, control_user_id, pessoa_id)`, import paginado ordenado, chave estável (registration/ID) e validação de referencial antes de declarar conclusão.
- **Regra violada:** R5, R7.

### B-014 — Clientes HTTP e schedulers não têm orçamento/lock uniforme

- **Arquivo:linhas:** `SAGE-API/src/config/axios.js:4-89`; `src/utils/controlId-utils.js:7-23,69-95,98-178`; `src/services/deviceService.js:24-58,469-548`; `src/jobs/scheduledJobs.js:21-34,42-53,99-198`; `src/routes/accessRoutes.js:18-39`
- **Severidade:** SEV3
- **Categoria:** retry/concorrência
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** operações de pessoa usam axios cru (timeout 0/infinito), enquanto outras têm retry global e algumas retry aninhado; cron, polling e manual podem sobrepor o mesmo dispositivo sem mutex.
- **Evidência:** `setInterval(async...)` não aguarda a rodada anterior; cron não reivindica execução; endpoint manual chama o mesmo serviço; retries de login/zerar podem chegar a 16 tentativas.
- **Impacto no dado:** sobrecarga, jobs presos e latência; unicidade dos logs oferece contorno parcial, mas mutações de pessoa não são idempotentes.
- **Reprodução estática:** mantenha uma promise axios de CREATE pendente por mais de um minuto; nova rodada cron seleciona novamente as mesmas linhas.
- **Correção sugerida:** cliente único com timeout/deadline, política por verbo, AbortSignal, mutex/lease por dispositivo e jitter/backoff observável.
- **Regra violada:** R3, R9.

### B-015 — Tela de monitoramento não recebe snapshot nem eventos das rooms

- **Arquivo:linhas:** `SAGE-API/src/app.js:97-101`; `src/routes/monitoringRoutes.js:13-39`; `src/websocket/wsServer.js:54-77,101-108`; `src/state/globalState.js:130-160`; `SAGE/src/components/pages/Monitoring/Monitoring.js:17-41`; `src/hooks/useWebSocket.js:72-99`; `src/stores/monitoringStore.js:38-45`
- **Severidade:** SEV3
- **Categoria:** frontend/WebSocket/observabilidade
- **Depende do ambiente:** NÃO
- **Confiança:** alta
- **Sintoma:** frontend busca `/monitoring/state`, mas o router já montado em `/monitoring` declara `/monitoring/state` (rota real `/monitoring/monitoring/state`). O hook emite `join`, enquanto backend só escuta `subscribe:*`; dispositivos usam ainda `dispositivoId` no snapshot e `dispositivo_id` na UI.
- **Evidência:** três contratos independentes não coincidem. Além disso, nenhum produtor chama os métodos de fila/status de `globalState` fora do próprio módulo.
- **Impacto no dado:** não altera persistência, mas esconde acessos, fila e saúde; há contorno por telas/rotas CRUD e status.
- **Reprodução estática:** componha `app.use('/monitoring', router)` com `router.get('/monitoring/state')`; compare eventos `join` vs `subscribe:acessos`.
- **Correção sugerida:** rotas relativas (`/state`), protocolo único de subscribe, tipos compartilhados e teste de contrato ponta a ponta; alimentar estado a partir da outbox/DB real.
- **Regra violada:** R8, R10.

## Contagens finais

| Severidade | Quantidade |
|---|---:|
| SEV1 | 1 |
| SEV2 | 12 |
| SEV3 | 2 |
| SEV4 | 0 |
| **Total** | **15** |

Checagem final por `git status --porcelain`: **0 entradas em `SAGE-API` e 0 entradas em `SAGE`**; ambos permanecem na branch `wip/recuperacao-local-pre-auditoria`. A criação deste relatório fica fora dos dois worktrees auditados.

## Apêndice A — Manifesto fechado usado nas contagens

Os caminhos são relativos a `C:\SAGE-WS`. Esta lista, sem expansão por glob, foi a entrada do script que produziu 56 arquivos, 11.100 LOC físicas e 69 nomes únicos de `process.env`.

1. `SAGE-API/.env.example`
2. `SAGE-API/index.js`
3. `SAGE-API/installer/windows/initialize-state.ps1`
4. `SAGE-API/database/sage.sql`
5. `SAGE-API/database/melhorias_sistema.sql`
6. `SAGE-API/database/migration_acesso_catraca_log_id.sql`
7. `SAGE-API/database/migration_dispositivo_sync_enabled.sql`
8. `SAGE-API/database/migration_control_id_device_id.sql`
9. `SAGE-API/database/migration_ultimo_log_id_sincronizado.sql`
10. `SAGE-API/src/app.js`
11. `SAGE-API/src/config/axios.js`
12. `SAGE-API/src/config/database.js`
13. `SAGE-API/src/config/paths.js`
14. `SAGE-API/src/config/syncOrder.js`
15. `SAGE-API/src/controllers/accessController.js`
16. `SAGE-API/src/controllers/deviceController.js`
17. `SAGE-API/src/controllers/peopleController.js`
18. `SAGE-API/src/controllers/schoolController.js`
19. `SAGE-API/src/jobs/scheduledJobs.js`
20. `SAGE-API/src/middlewares/monitorCallbackAuth.js`
21. `SAGE-API/src/routes/accessRoutes.js`
22. `SAGE-API/src/routes/deviceRoutes.js`
23. `SAGE-API/src/routes/monitoringRoutes.js`
24. `SAGE-API/src/routes/notificationRoutes.js`
25. `SAGE-API/src/routes/peopleRoutes.js`
26. `SAGE-API/src/routes/schoolRoutes.js`
27. `SAGE-API/src/routes/statusRoutes.js`
28. `SAGE-API/src/services/accessService.js`
29. `SAGE-API/src/services/backupBanco.js`
30. `SAGE-API/src/services/catracaImportService.js`
31. `SAGE-API/src/services/controlIdService.js`
32. `SAGE-API/src/services/deviceService.js`
33. `SAGE-API/src/services/protecaoLogs.js`
34. `SAGE-API/src/services/readinessService.js`
35. `SAGE-API/src/services/saudeDispositivos.js`
36. `SAGE-API/src/services/sync.js`
37. `SAGE-API/src/state/globalState.js`
38. `SAGE-API/src/utils/controlId-utils.js`
39. `SAGE-API/src/utils/converterPngBase64.js`
40. `SAGE-API/src/utils/gerarCardValue.js`
41. `SAGE-API/src/utils/people-db-utils.js`
42. `SAGE-API/src/utils/photo-user-utils.js`
43. `SAGE-API/src/utils/sync_catracas.js`
44. `SAGE-API/src/utils/syncFlags.js`
45. `SAGE-API/src/websocket/wsServer.js`
46. `SAGE/.env.example`
47. `SAGE/.env.production`
48. `SAGE/src/services/api.js`
49. `SAGE/src/components/pages/Settings/Settings.js`
50. `SAGE/src/components/pages/Dispositivos/Dispositivos.js`
51. `SAGE/src/components/pages/Dispositivos/DispositivosRealTime.js`
52. `SAGE/src/components/pages/Monitoring/Monitoring.js`
53. `SAGE/src/components/pages/Relatorios/RelatoriosAcesso.js`
54. `SAGE/src/stores/monitoringStore.js`
55. `SAGE/src/contexts/WebSocketContext.js`
56. `SAGE/src/hooks/useWebSocket.js`

### Comando lógico de reprodução

Para cada caminho acima, o script: (1) falha se o arquivo não existir; (2) soma `(Get-Content -LiteralPath $path).Count`; e (3) aplica `[regex]::Matches($raw, 'process\.env\.([A-Z][A-Z0-9_]*)')`, acumulando o grupo 1 em `HashSet[string]`. O próprio relatório não integra o manifesto nem as contagens.
