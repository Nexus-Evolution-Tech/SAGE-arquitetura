# Auditoria independente — FATIA D: infraestrutura e operação

> **Nota do orquestrador:** este é o relatório bruto da fatia. Aceitação, duplicatas e
> severidades finais estão em `ONDA2-VERIFICACAO.md`; essa verificação prevalece.

## Escopo, base e limitações

- Repositório auditado: `C:\SAGE-WS\SAGE-API`, branch `wip/recuperacao-local-pre-auditoria`, commit `9e3eaba3475c3e9755f341d29bada059cc6fc5db`.
- Worktree correlato conferido: `C:\SAGE-WS\SAGE`, mesma branch, commit `06c1ed4e948236c44926ed13fdb96521dd81d269`.
- Data da auditoria: 2026-08-06. Análise estática, somente leitura; nenhum serviço, job, script operacional ou teste foi executado.
- `npm test` não foi executado: o Node local é `v18.16.1` e `package.json:6-8` exige `>=24 <25`.
- O arquivo indicado `C:\SAGE-WS\SAGE-API\AGENTS.md` não existe neste checkout. Busca nominal por ADR/ADRs/decisions no próprio repositório não encontrou ADR. Portanto, não foi possível atribuir achados a uma norma local numerada sem inventá-la.
- Não foram lidos `C:\SAGE-WS\auditoria`, `C:\SAGE-WS\SAGE-arquitetura\ESTADO-VERIFICADO.md`, handoffs ou relatórios anteriores. Este arquivo é o único artefato escrito.
- Régua aplicada literalmente: SEV1 = catraca parada; SEV2 = perda/corrupção silenciosa; SEV3 = exige contorno operacional; SEV4 = cosmético.

## Regras operacionais usadas para rastreabilidade

Como a norma local indicada está ausente, “regra violada” abaixo referencia apenas invariantes explícitos e verificáveis desta auditoria:

- `OP-TIMER`: configuração de timer deve ser tipada, finita e limitada antes de chegar a `setInterval`/`setTimeout`.
- `OP-ACK`: não confirmar sucesso ao produtor antes de persistir o dado ou sinalizar falha recuperável.
- `OP-PERSIST`: dado persistente deve ficar fora do diretório versionado/substituível do release.
- `OP-JOB`: job deve impedir sobreposição, preservar todos os handles e parar de modo aguardável.
- `OP-SHUTDOWN`: parar agendadores, recusar trabalho novo, drenar trabalho em voo e fechar recursos dentro de limite explícito.
- `OP-LOG`: produção deve usar logging estruturado, com redação, contexto de erro preservado e retenção definida.
- `OP-AUTH`: telemetria, estado interno e eventos com dados pessoais exigem autenticação e menor privilégio.
- `OP-CACHE`: mutação não pode ser declarada coerente quando a invalidação falhou silenciosamente.
- `OP-HEALTH`: health/readiness devem ser verdadeiros, limitados em tempo e baratos o bastante para sondagem.
- `OP-SCRIPT`: script denominado auditor/teste não deve alterar alvo real sem isolamento ou confirmação inequívoca.
- `OP-BACKUP`: arquivo incompleto não pode permanecer elegível como backup recente.
- `OP-ERROR`: falha operacional não pode desaparecer em nível desabilitado, `catch` vazio ou continuação em estado indeterminado.

## Inventário reproduzível

Contagem física: `Get-Content` e propriedade `Count`; “não vazias” filtra `Trim().Length -gt 0`. O escopo obrigatório contém 27 arquivos, 3.593 LOC físicas e 3.221 linhas não vazias.

| Arquivo | LOC | Não vazias |
|---|---:|---:|
| `src/config/logger.js` | 60 | 51 |
| `src/config/paths.js` | 35 | 30 |
| `src/config/redis.js` | 214 | 195 |
| `src/config/env.js` | 23 | 18 |
| `src/config/web.js` | 51 | 43 |
| `src/services/readinessService.js` | 128 | 118 |
| `src/services/notificationService.js` | 55 | 50 |
| `src/cache/cacheKeys.js` | 72 | 57 |
| `src/cache/helpers.js` | 115 | 102 |
| `src/state/globalState.js` | 352 | 303 |
| `src/jobs/scheduledJobs.js` | 333 | 295 |
| `scripts/assemble-api-payload.js` | 182 | 170 |
| `scripts/assemble-windows-layout.js` | 186 | 172 |
| `scripts/audit-api-surface.js` | 80 | 74 |
| `scripts/check-first-run.js` | 28 | 25 |
| `scripts/convert-schedule-seed.js` | 138 | 136 |
| `scripts/diagnostico-acessos.js` | 49 | 44 |
| `scripts/fetch-windows-artifacts.js` | 82 | 78 |
| `scripts/legacy-baseline.js` | 182 | 168 |
| `scripts/migration-runner.js` | 256 | 241 |
| `scripts/renomear-bd-para-antigo.js` | 85 | 68 |
| `scripts/reverter-finalizados.js` | 103 | 88 |
| `scripts/runtime-schema-gate.js` | 27 | 25 |
| `scripts/setup-database.js` | 439 | 386 |
| `scripts/start-with-setup.js` | 116 | 100 |
| `scripts/test-monitoramento.js` | 108 | 98 |
| `scripts/verify-windows-artifacts.js` | 94 | 86 |

Chamadores necessários adicionais lidos: 9 arquivos, 2.527 LOC: `index.js` (225), `src/app.js` (238), `src/services/backupBanco.js` (312), `src/services/accessService.js` (741), `src/websocket/wsServer.js` (167), `src/routes/monitoringRoutes.js` (217), `src/routes/notificationRoutes.js` (37), `src/controllers/horarioAulaController.js` (564) e `installer/windows/SAGE-API.xml.template` (26).

Comando equivalente para o inventário obrigatório:

```powershell
$scope = @('src/config/logger.js','src/config/paths.js','src/config/redis.js','src/config/env.js','src/config/web.js','src/services/readinessService.js','src/services/notificationService.js') + (rg --files src/cache src/state src/jobs scripts | Sort-Object)
$scope | ForEach-Object { $l = @(Get-Content -LiteralPath $_); [pscustomobject]@{ File=$_; LOC=$l.Count; NonBlank=($l | Where-Object { $_.Trim().Length -gt 0 }).Count } }
```

## Contagem automática de `console.*` em `src` de produção

Regex: `console\.(log|info|warn|error|debug|trace|dir|table|time|timeEnd|assert)\s*\(` sobre `rg --files src -g '*.js'`. O total lexical é 56 ocorrências em 13 arquivos; 9 estão em linhas iniciadas por comentário. O total executável por essa classificação reproduzível é 47 ocorrências em 10 arquivos.

Risco automático usado apenas para triagem: `alto` para ocorrências executáveis nos dois arquivos que imprimem payload, linha de banco, objeto de erro ou identificador pessoal (`horarioAulaController.js` e `peopleService.js`); `baixo` para mensagens executáveis fixas de boot; `comentado` para linha cujo primeiro token é `//`.

| Método | Risco | Ocorrências | Arquivos distintos |
|---|---|---:|---:|
| `error` | alto | 7 | 1 |
| `log` | alto | 11 | 2 |
| `log` | baixo | 29 | 8 |
| `log` | comentado/não executável | 7 | 4 |
| `warn` | comentado/não executável | 2 | 1 |
| **Total lexical** |  | **56** | **13** |
| **Total executável** |  | **47** | **10** |

Linhas executáveis: `src/app.js:101`; `src/config/database.js:1,3,5,15,29,33`; `src/config/loadRoutes.js:9,12,14`; `src/config/queryBuilder.js:6,8,10`; `src/controllers/horarioAulaController.js:120,171,173,190,192,198,210,257,279,294,311,317,332-333,457,533,558`; `src/middlewares/autenticar.js:1,3`; `src/routes/accessRoutes.js:1,3,5,7,9,11,15`; `src/routes/genericRoutesFactory.js:1,3,5`; `src/services/peopleService.js:68`; `src/utils/jwt.js:1,3,5,14`.

Ocorrências comentadas: `src/services/peopleService.js:179`; `src/utils/controlId-utils.js:160-161,199,205,304`; `src/utils/gerarCardValue.js:19,21`; `src/utils/gerarNumero8Digitos.js:8`.

## Achados

### D-001 — Timer inválido vira loop de aproximadamente 1 ms e pode parar a operação

- **Arquivo:linhas:** `src/config/env.js:4-21`; `src/jobs/scheduledJobs.js:39-52,55-91`; `src/app.js:68-72`.
- **Severidade:** SEV1.
- **Categoria:** timers/configuração/operação on-premise.
- **Depende do ambiente:** SIM — exige valor não numérico ou fora de faixa em variável editável.
- **Confiança:** alta.
- **Sintoma:** typo em intervalo de polling/health ou timeout de requisição é passado como `NaN` ao runtime; timers podem ser normalizados para cadência mínima e requisições podem expirar imediatamente, saturando API, banco e catracas.
- **Evidência sanitizada:** valores entram por `parseInt(...)` sem `Number.isFinite`, mínimo ou máximo; o único teste do polling é `<= 0`, que não rejeita `NaN`.
- **Impacto no dado:** sincronização e gravação de acessos podem ficar indisponíveis durante a saturação; catracas recebem chamadas concorrentes em alta frequência.
- **Reprodução estática:** seguir uma string não numérica de `MONITOR_POLLING_INTERVAL_MS`/`HEALTH_CHECK_INTERVAL` até `setInterval`; para `REQUEST_TIMEOUT`, até `req.setTimeout` e `res.setTimeout`.
- **Correção sugerida:** parser central tipado, `Number.isSafeInteger`, faixas mínimas/máximas e falha de startup antes de criar qualquer timer.
- **Regra violada:** `OP-TIMER`.

### D-002 — Callback do Monitor confirma HTTP 200 mesmo quando acessos falham

- **Arquivo:linhas:** `src/routes/notificationRoutes.js:15-34`; `src/services/accessService.js:676-709`.
- **Severidade:** SEV2.
- **Categoria:** perda silenciosa/acknowledgement.
- **Depende do ambiente:** SIM — fluxo push do Monitor precisa estar habilitado e ocorrer erro total ou por item.
- **Confiança:** alta.
- **Sintoma:** falha lançada responde `200 {ok:false}`; falhas por item ainda chegam ao `200 {ok:true, ...resultado}`. Um produtor que usa status HTTP como confirmação não tem motivo para reenviar.
- **Evidência sanitizada:** o `catch` da rota fixa status 200; no caminho parcial, `resultado.erros` não altera status nem `ok`.
- **Impacto no dado:** evento de acesso pode nunca entrar no banco, desaparecendo de frequência e relatórios.
- **Reprodução estática:** forçar mentalmente uma rejeição da inserção em `processarNotificacaoMonitorDao`; ela é acumulada em `erros`, a função retorna e a rota responde sucesso HTTP.
- **Correção sugerida:** protocolo de ack explícito e documentado; status recuperável não-2xx para falha total e tratamento idempotente/retry para falha por item.
- **Regra violada:** `OP-ACK`.

### D-003 — Sem `SAGE_DATA_DIR`, uploads, backups e exportações ficam dentro do release

- **Arquivo:linhas:** `src/config/env.js:4-19`; `src/config/paths.js:5-20`; `src/app.js:115-120,126-128`.
- **Severidade:** SEV2.
- **Categoria:** paths/cwd/persistência on-premise.
- **Depende do ambiente:** SIM — ocorre quando `SAGE_DATA_DIR` está ausente.
- **Confiança:** alta.
- **Sintoma:** `dataRoot` cai para `appRoot`; uploads caem em subdiretório de `src`, e backups/exports no diretório versionado. Troca/limpeza de release remove estado que parecia persistente.
- **Evidência sanitizada:** fallback explícito `configuredDataDir || appRoot`; produção não exige a variável.
- **Impacto no dado:** perda silenciosa de fotos enviadas, exportações e cópias de segurança numa atualização/reinstalação.
- **Reprodução estática:** remover a variável do raciocínio e expandir cada `path.join` de `paths.js:14-20`.
- **Correção sugerida:** exigir raiz persistente absoluta em produção; recusar startup se cair no release; migrar estado legado de modo transacional.
- **Regra violada:** `OP-PERSIST`.

### D-004 — Script de renomeação derruba o banco original sem verificar a cópia restaurada

- **Arquivo:linhas:** `scripts/renomear-bd-para-antigo.js:13-38,52-70,76-80`.
- **Severidade:** SEV2.
- **Categoria:** script destrutivo/backup/configuração divergente.
- **Depende do ambiente:** SIM — requer execução manual e credencial com DDL.
- **Confiança:** alta.
- **Sintoma:** após dump e import, o script executa `DROP DATABASE` no original sem conferir tabelas/contagens/checksum/restauração; ainda lê apenas `.env` do release e ignora `SAGE_CONFIG_FILE`, podendo operar no alvo default errado no pacote on-premise.
- **Evidência sanitizada:** sequência linear criar destino → dump → importar → apagar origem → recriar vazio; não há verificação entre import e drop.
- **Impacto no dado:** perda ou mistura silenciosa do banco escolar se a cópia estiver incompleta ou se o alvo resolvido não for o esperado.
- **Reprodução estática:** acompanhar `DB_NAME`, `DB_ANTIGO` e os comandos das linhas 52-67; observar ausência de comparação antes do drop.
- **Correção sugerida:** reutilizar o contrato de `env.js`, exigir confirmação digitada do alvo, destino novo, restauração verificada e contagens antes de qualquer drop; preferir operação reversível.
- **Regra violada:** `OP-SCRIPT`, `OP-BACKUP`.

### D-005 — “Audit API surface” executa POST/PUT/PATCH/DELETE reais

- **Arquivo:linhas:** `scripts/audit-api-surface.js:9-39,42-59`.
- **Severidade:** SEV2.
- **Categoria:** script de auditoria com mutação.
- **Depende do ambiente:** SIM — depende de rota não autenticada ou operação que aceite corpo vazio/defaults.
- **Confiança:** alta.
- **Sintoma:** o script percorre toda operação Swagger e chama o método real; qualquer resposta abaixo de 500 pode ser marcada como aprovada, inclusive mutação bem-sucedida.
- **Evidência sanitizada:** conjunto inclui todos os verbos mutáveis; `call(operation.method, ...)` usa o alvo fornecido e payload vazio, sem sandbox nem confirmação.
- **Impacto no dado:** criação, alteração ou remoção silenciosa em ambiente apontado por engano.
- **Reprodução estática:** inserir uma operação mutável sem autenticação no Swagger e seguir o loop até `call`.
- **Correção sugerida:** restringir a OPTIONS/HEAD/GET seguros ou executar apenas contra fixture descartável identificada, com bloqueio explícito de host real.
- **Regra violada:** `OP-SCRIPT`.

### D-006 — Jobs e tarefas de boot podem se sobrepor sem mutex

- **Arquivo:linhas:** `src/jobs/scheduledJobs.js:16-34,37-52,55-91,94-198,206-235,248-287`; `index.js:74-130`; `src/services/accessService.js:449-490`; `src/services/backupBanco.js:126-129,167-205,214-285`.
- **Severidade:** SEV3.
- **Categoria:** concorrência de jobs/promises/backup.
- **Depende do ambiente:** SIM — depende da duração ultrapassar a cadência ou coincidir com boot/chamada manual.
- **Confiança:** alta.
- **Sintoma:** callbacks `async` de cron/interval não usam `noOverlap`, lock ou flag em voo. Boot dispara promoção, sync e catch-up além dos agendamentos; polling leve e sync pesado acessam os mesmos dispositivos.
- **Evidência sanitizada:** todos os agendadores chamam serviços diretamente; não há guarda global. Backup usa nome com resolução de segundos, aumentando colisão quando sobreposto.
- **Impacto no dado:** efeitos externos repetidos, pressão simultânea na catraca, atualizações de fila concorrentes e arquivos de backup concorrentes; o contorno é reiniciar/pausar jobs e reconciliar.
- **Reprodução estática:** comparar cadências com operações sem limite de duração e localizar ausência de lock do início ao `finally`.
- **Correção sugerida:** mutex por tipo/dispositivo, `noOverlap`, lock persistente para efeitos críticos, e unificar boot catch-up com o mesmo coordenador.
- **Regra violada:** `OP-JOB`, `OP-BACKUP`.

### D-007 — Falha tardia ao iniciar jobs perde handles de jobs já ativos

- **Arquivo:linhas:** `src/jobs/scheduledJobs.js:291-310,313-320`; `index.js:68-72,133-138,156-160`.
- **Severidade:** SEV3.
- **Categoria:** lifecycle/estado parcial.
- **Depende do ambiente:** SIM — por exemplo, cron configurado inválido em propriedade avaliada depois das primeiras.
- **Confiança:** alta.
- **Sintoma:** construção sequencial do objeto inicia jobs antes de retornar. Se um job posterior lança, `iniciarJobs()` não retorna, `jobs` permanece indefinido e os anteriores continuam sem handle para shutdown.
- **Evidência sanitizada:** funções de scheduling são chamadas dentro do literal; o chamador apenas loga e continua no `catch`.
- **Impacto no dado:** jobs continuam concorrendo durante manutenção/shutdown, sem forma de parada ordenada.
- **Reprodução estática:** considerar sucesso nas quatro primeiras propriedades e exceção em `promocaoAlunosJob` ou `backupBancoJob`.
- **Correção sugerida:** validar todas as expressões antes, registrar handles incrementalmente e, em falha, parar em `catch/finally` tudo que já iniciou.
- **Regra violada:** `OP-JOB`.

### D-008 — Shutdown para jobs tarde demais e força saída com recursos ainda ativos

- **Arquivo:linhas:** `index.js:140-196`; `src/jobs/scheduledJobs.js:313-320`; `src/state/globalState.js:42-44,291-304`; `scripts/start-with-setup.js:81-99`.
- **Severidade:** SEV3.
- **Categoria:** timers/shutdown/promises.
- **Depende do ambiente:** NÃO.
- **Confiança:** alta.
- **Sintoma:** jobs só são parados dentro do callback de `server.close`; WebSockets/keep-alive podem retardá-lo, enquanto jobs continuam. O interval do singleton não tem handle nem `stop`. Após cinco segundos, `process.exit(1)` corta tudo. O wrapper filho envia sinal e encerra o pai imediatamente.
- **Evidência sanitizada:** ordem literal é fechar servidor → callback → parar jobs → espera fixa curta → fechar DB/Redis; o timer forçado não é cancelado e não há guarda contra sinal duplicado.
- **Impacto no dado:** operação de sync/backup/promoção pode ser interrompida no meio; exige verificação/reconciliação após reinício.
- **Reprodução estática:** manter uma conexão longa durante sinal e seguir o caminho em que o callback de `server.close` não ocorre antes do timeout.
- **Correção sugerida:** shutdown idempotente; parar novos agendamentos primeiro, aguardar tarefas em voo com deadline, fechar Socket.io/HTTP, DB e Redis, limpar todos os timers e só então definir exit code.
- **Regra violada:** `OP-SHUTDOWN`, `OP-JOB`.

### D-009 — Logger descarta metadata e stack exatamente no formato de produção

- **Arquivo:linhas:** `src/config/logger.js:24-45,47-57`; `installer/windows/SAGE-API.xml.template:21-25`.
- **Severidade:** SEV3.
- **Categoria:** observabilidade/retenção/rotação.
- **Depende do ambiente:** NÃO para perda de metadata; SIM para retenção fora do WinSW.
- **Confiança:** alta.
- **Sintoma:** `printf` serializa somente timestamp, nível e `info.message`; o objeto `meta`, inclusive `stack` de `errorWithStack`, não é emitido. Há apenas transporte console. No pacote WinSW existe rotação por tamanho (8 arquivos de 10 MiB), mas qualquer execução fora desse wrapper não tem retenção própria.
- **Evidência sanitizada:** `errorWithStack` passa stack no segundo argumento, ausente da função de formatação.
- **Impacto no dado:** sem impacto direto no registro escolar; aumenta tempo de diagnóstico e contorno de falhas críticas.
- **Reprodução estática:** substituir mentalmente um `Error` e aplicar o `printf`: a stack não aparece na string final.
- **Correção sugerida:** formato JSON sem colorização em arquivo/serviço, inclusão explícita de stack/cause/código, redação central e política de rotação também documentada para execução não-WinSW.
- **Regra violada:** `OP-LOG`.

### D-010 — PII, segredo em query e objetos inteiros chegam a stdout/log

- **Arquivo:linhas:** `src/app.js:75-93,153-162`; `src/controllers/horarioAulaController.js:120,171-173,190-192,198,210,257,279,294,311,317,332-333,457,533,558`; `src/services/peopleService.js:68`; `scripts/setup-database.js:155-163`; `scripts/diagnostico-acessos.js:20-38`; `scripts/test-monitoramento.js:64-89`; `scripts/reverter-finalizados.js:38-39,96-99`.
- **Severidade:** SEV3.
- **Categoria:** logs/stdout/PII/segredos/redação.
- **Depende do ambiente:** SIM — os valores sensíveis aparecem quando esses fluxos são usados.
- **Confiança:** alta.
- **Sintoma:** request logger usa URL original, incluindo query; a rota diagnóstica aceita segredo na query. Outro logger registra endereço de origem. Controlador imprime payload/linha completa e stacks. Scripts imprimem resposta diagnóstica, nomes/horários e SQL completo em falha; prompt de senha usa entrada visível.
- **Evidência sanitizada:** foram confirmidos os campos e sinks, mas nenhum valor real é reproduzido neste relatório.
- **Impacto no dado:** exposição de dado pessoal, segredo operacional e estrutura interna nos arquivos rotacionados ou terminal.
- **Reprodução estática:** seguir `req.originalUrl`, `req.ip`, rows/payloads e respostas até interpolação/`console.*`.
- **Correção sugerida:** allowlist de campos, remover query do log, mascarar identificadores, nunca imprimir rows/payload/SQL integral, prompt oculto e testes estáticos de redação.
- **Regra violada:** `OP-LOG`.

### D-011 — WebSocket anônimo recebe canais e notificações globais

- **Arquivo:linhas:** `src/websocket/wsServer.js:14-52,54-76,101-120`; `src/services/notificationService.js:23-31`; `src/services/accessService.js:691-702`.
- **Severidade:** SEV3.
- **Categoria:** autenticação/PII/notificações.
- **Depende do ambiente:** NÃO no comportamento; exploração depende de alcance de rede.
- **Confiança:** alta.
- **Sintoma:** ausência de token é aceita; qualquer socket pode entrar nas rooms de acessos, dispositivos, sync e stats. `emitNotification` transmite a todos, e eventos de acesso carregam identificador, nome e horário.
- **Evidência sanitizada:** middleware define usuário nulo e chama `next`; handlers de subscribe não verificam identidade/role.
- **Impacto no dado:** divulgação de eventos escolares e estado operacional; não altera o banco.
- **Reprodução estática:** percorrer handshake sem token → subscribe → `emitToRoom`/`io.emit`.
- **Correção sugerida:** autenticação obrigatória em produção, autorização por room/role e notificações segmentadas por escola/usuário.
- **Regra violada:** `OP-AUTH`.

### D-012 — Monitoramento e diagnóstico sem autenticação expõem PII e permitem limpar cache

- **Arquivo:linhas:** `src/app.js:97-113`; `src/routes/monitoringRoutes.js:13-39,68-80,97-124,155-215`.
- **Severidade:** SEV3.
- **Categoria:** readiness/monitoramento/autorização/estado global.
- **Depende do ambiente:** NÃO para ausência de middleware; alcance depende da rede.
- **Confiança:** alta.
- **Sintoma:** rotas são montadas sem autenticação. Snapshot e fila consultam nomes, identificadores, horários e mensagens de erro. POST de limpeza de cache está comentado como “admin only”, mas não possui guarda. Diagnóstico em produção fica aberto quando a chave nem sequer foi configurada.
- **Evidência sanitizada:** nenhum middleware de autenticação aparece entre `router` e handlers; condição diagnóstica só bloqueia se a chave existe.
- **Impacto no dado:** divulgação de PII e estado; limpeza de cache causa perda transitória de desempenho/consistência.
- **Reprodução estática:** seguir montagem em `app.use` até os handlers e observar ausência de middleware.
- **Correção sugerida:** autenticação/role obrigatórias, desabilitar diagnóstico em produção por padrão e separar health mínimo de endpoints administrativos.
- **Regra violada:** `OP-AUTH`.

### D-013 — Falha de invalidação é engolida e a mutação retorna sucesso com cache velho

- **Arquivo:linhas:** `src/config/redis.js:108-148`; `src/cache/helpers.js:43-62,89-103`; `src/controllers/genericControllerFactory.js:93-147`.
- **Severidade:** SEV3.
- **Categoria:** cache/promises/erros engolidos.
- **Depende do ambiente:** SIM — exige falha do backend de cache/invalidação.
- **Confiança:** alta.
- **Sintoma:** `delPattern` transforma erro em zero; `invalidate` captura e não relança; `invalidateMultiple` prossegue, e `cacheMutation` devolve o resultado da escrita. Leituras seguintes podem servir estado anterior pelo TTL.
- **Evidência sanitizada:** há três camadas de captura sem propagação de falha de consistência.
- **Impacto no dado:** banco permanece correto, mas telas/consumidores observam dado obsoleto silenciosamente e operadores precisam contornar limpando cache.
- **Reprodução estática:** fazer `cache.delPattern` rejeitar e seguir o retorno até a resposta 2xx do CRUD.
- **Correção sugerida:** invalidar por chave/versionamento; em falha, bypass de cache e alarme explícito; não somar `undefined`; definir contrato de consistência.
- **Regra violada:** `OP-CACHE`, `OP-ERROR`.

### D-014 — Cliente Redis com ping falho continua vivo e o fallback pode ficar divergente

- **Arquivo:linhas:** `src/config/redis.js:9-53,56-61,66-101,191-213`; `index.js:21-24,173-182`.
- **Severidade:** SEV3.
- **Categoria:** cache/vazamento de recursos/reconexão.
- **Depende do ambiente:** SIM — Redis habilitado e indisponível/intermitente.
- **Confiança:** alta.
- **Sintoma:** cliente é atribuído antes do ping e possui retry infinito; no `catch`, apenas a flag é desativada, sem `disconnect/quit` ou nulificação. Eventos posteriores alternam a flag global enquanto operações usam LRU local, criando cache dividido e tempestade de logs/reconexões.
- **Evidência sanitizada:** `retryStrategy` sempre devolve atraso; caminho de falha retorna `false` deixando `redisClient` referenciado.
- **Impacto no dado:** leituras obsoletas/inconsistentes entre processos e pressão de memória/conexão; banco não é diretamente corrompido.
- **Reprodução estática:** seguir falha de `ping` até o `catch` e verificar que o cliente não é encerrado.
- **Correção sugerida:** estado de conexão explícito, circuit breaker, encerramento do cliente falho, política de reconexão limitada e invalidação/versionamento ao alternar backend.
- **Regra violada:** `OP-CACHE`, `OP-SHUTDOWN`.

### D-015 — Invalidação por `KEYS` bloqueia Redis e fallback não preserva semântica do glob

- **Arquivo:linhas:** `src/config/redis.js:122-148`; `src/cache/cacheKeys.js:44-49`.
- **Severidade:** SEV3.
- **Categoria:** cache/desempenho/concorrência.
- **Depende do ambiente:** SIM — Redis habilitado e quantidade relevante de chaves.
- **Confiança:** alta.
- **Sintoma:** cada mutação por padrão usa `KEYS pattern`, operação bloqueante; no LRU, o padrão vira regex sem escape, sem âncoras e substitui apenas o primeiro `*`, logo os backends não são semanticamente equivalentes.
- **Evidência sanitizada:** chamada direta a `redisClient.keys`; construção `new RegExp(pattern.replace('*', '.*'))`.
- **Impacto no dado:** pausa global do cache/latência da API e invalidação excessiva ou insuficiente, exigindo contorno.
- **Reprodução estática:** aplicar padrão com metacaractere ou mais de um `*`; comparar com glob Redis.
- **Correção sugerida:** `SCAN` paginado ou conjuntos de tags/versões; compilador de glob escapado e ancorado no fallback.
- **Regra violada:** `OP-CACHE`.

### D-016 — `/health` afirma “ok” sem testar dependências; `/ready` é caro e sem deadline próprio

- **Arquivo:linhas:** `src/app.js:172-206`; `src/services/readinessService.js:20-43,45-61,75-107`.
- **Severidade:** SEV3.
- **Categoria:** health/readiness/operação on-premise.
- **Depende do ambiente:** NÃO.
- **Confiança:** alta.
- **Sintoma:** `/health` sempre responde status lógico `ok` e nem chama DB/Redis health. `/ready` executa duas consultas de catálogo e quatro probes com criação, escrita, `fsync` e remoção por chamada; queries não têm deadline local. Sem rate limit/autenticação, sondagem agressiva pesa em HD mecânico.
- **Evidência sanitizada:** status fixo em `/health`; `Promise.all` de diretórios chama `handle.sync` e schema completo a cada request.
- **Impacto no dado:** monitor pode manter instância incapaz em serviço; sondagem excessiva compete com gravações e sincronização.
- **Reprodução estática:** considerar DB indisponível: `/health` continua 200/ok; contar operações de I/O em uma única `/ready`.
- **Correção sugerida:** liveness mínimo separado; readiness com deadline, cache curto e invalidação por mudança; métricas sem PII e proteção contra abuso.
- **Regra violada:** `OP-HEALTH`.

### D-017 — Falhas recorrentes de polling/health ficam invisíveis no nível padrão

- **Arquivo:linhas:** `src/jobs/scheduledJobs.js:44-52,60-91`; `src/config/logger.js:41-45`.
- **Severidade:** SEV3.
- **Categoria:** erros engolidos/observabilidade.
- **Depende do ambiente:** SIM — ocorre quando dispositivo, banco ou serviço falha e `LOG_LEVEL` permanece no padrão `info`.
- **Confiança:** alta.
- **Sintoma:** polling e health capturam erros e registram apenas `debug`; produção padrão não emite `debug`. O loop continua e o status anterior pode permanecer aparente.
- **Evidência sanitizada:** catches internos e externo usam `logger.debug`; logger padrão é `info`.
- **Impacto no dado:** acessos podem atrasar até outro mecanismo de sync; status de catraca fica obsoleto sem alarme, exigindo diagnóstico manual.
- **Reprodução estática:** comparar nível dos catches com a ordem de níveis customizados.
- **Correção sugerida:** erro agregado/rate-limited em `warn/error`, contador de falhas consecutivas e estado degradado exposto no readiness.
- **Regra violada:** `OP-ERROR`, `OP-LOG`.

### D-018 — `unhandledRejection` registra e mantém processo em estado desconhecido

- **Arquivo:linhas:** `index.js:208-218`.
- **Severidade:** SEV3.
- **Categoria:** promises/estado de processo.
- **Depende do ambiente:** NÃO.
- **Confiança:** alta.
- **Sintoma:** qualquer promise órfã é convertida em erro e logada, mas o processo continua sem saber qual transação, lock ou flag ficou incompleto.
- **Evidência sanitizada:** handler não inicia shutdown nem marca readiness degradado.
- **Impacto no dado:** possível estado parcial de job/request e necessidade de reinício/reconciliação; a ocorrência em si fica logada, portanto não foi classificada SEV2.
- **Reprodução estática:** seguir o handler até o fim e observar ausência de recuperação, isolamento ou encerramento.
- **Correção sugerida:** eliminar promises órfãs; em rede de segurança, marcar not-ready e executar shutdown controlado/restart supervisionado.
- **Regra violada:** `OP-ERROR`, `OP-SHUTDOWN`.

### D-019 — Falha de dump deixa arquivo parcial elegível como “último backup”

- **Arquivo:linhas:** `src/services/backupBanco.js:153-163,167-205`; `src/jobs/scheduledJobs.js:263-288`; `index.js:97-114`.
- **Severidade:** SEV3.
- **Categoria:** backup/retenção/promises.
- **Depende do ambiente:** SIM — exige falha de subprocesso ou stream.
- **Confiança:** alta.
- **Sintoma:** se o subprocesso falha após criar o destino, a promise rejeita antes da checagem de tamanho e não remove o `.sql` parcial. `listarBackups` aceita qualquer nome compatível; no boot, o arquivo parcial recente pode impedir catch-up por até o limite configurado.
- **Evidência sanitizada:** limpeza só existe para arquivo de zero byte após sucesso do subprocesso; não há `catch/finally` removendo destino incompleto.
- **Impacto no dado:** janela sem backup restaurável e falsa impressão operacional de backup recente; o banco vivo não é alterado.
- **Reprodução estática:** considerar `close(code != 0)` depois de bytes escritos, seguir rejeição e depois a listagem por prefixo/sufixo.
- **Correção sugerida:** escrever com `wx` em nome `.partial`, aguardar `finish/close`, remover em todo caminho de falha e renomear atomicamente apenas após verificação.
- **Regra violada:** `OP-BACKUP`.

### D-020 — Postinstall silencia completamente falha de preparação

- **Arquivo:linhas:** `scripts/check-first-run.js:7-25`; `package.json:9-11`.
- **Severidade:** SEV3.
- **Categoria:** scripts/erros engolidos/primeira execução.
- **Depende do ambiente:** SIM — falha de permissão, disco ou configuração.
- **Confiança:** alta.
- **Sintoma:** qualquer erro ao criar diretórios/copiar configuração é capturado por `catch` vazio; `postinstall` termina sem sinalizar instalação incompleta.
- **Evidência sanitizada:** bloco de captura contém apenas comentário.
- **Impacto no dado:** instalação sobe sem diretórios/config esperados ou falha mais tarde; exige intervenção manual.
- **Reprodução estática:** considerar `mkdirSync` ou `copyFileSync` falhando e seguir até término com código de sucesso.
- **Correção sugerida:** erro claro e exit code não zero; se alguma falha for deliberadamente tolerável, tratá-la por código específico e registrar caminho de recuperação.
- **Regra violada:** `OP-ERROR`, `OP-SCRIPT`.

## Contagens por script

Contagem lexical executável de sinks diretos por arquivo (`console.*`, `process.stdout.write`, ignorando linhas iniciadas por `//`):

| Script | LOC | `console.*` | `stdout.write` |
|---|---:|---:|---:|
| `assemble-api-payload.js` | 182 | 3 | 0 |
| `assemble-windows-layout.js` | 186 | 3 | 0 |
| `audit-api-surface.js` | 80 | 1 | 1 |
| `check-first-run.js` | 28 | 3 | 0 |
| `convert-schedule-seed.js` | 138 | 1 | 0 |
| `diagnostico-acessos.js` | 49 | 9 | 0 |
| `fetch-windows-artifacts.js` | 82 | 3 | 0 |
| `legacy-baseline.js` | 182 | 0 | 0 |
| `migration-runner.js` | 256 | 0 | 0 |
| `renomear-bd-para-antigo.js` | 85 | 17 | 0 |
| `reverter-finalizados.js` | 103 | 12 | 0 |
| `runtime-schema-gate.js` | 27 | 0 | 0 |
| `setup-database.js` | 439 | 0 | 0 |
| `start-with-setup.js` | 116 | 3 | 0 |
| `test-monitoramento.js` | 108 | 21 | 0 |
| `verify-windows-artifacts.js` | 94 | 3 | 0 |
| **Total** | **2.155** | **79** | **1** |

## Síntese de severidade

| Severidade | Quantidade | IDs |
|---|---:|---|
| SEV1 | 1 | D-001 |
| SEV2 | 4 | D-002 a D-005 |
| SEV3 | 15 | D-006 a D-020 |
| SEV4 | 0 | — |

Não foi aberta issue/PR e nenhuma correção foi aplicada.
