# FASE 1 — Inventário do terreno

Data: 2026-08-05  
Modo: somente leitura; nenhum arquivo dos repositórios foi alterado.

## 1. Snapshot auditado

| Repositório | Branch | Commit | Worktree |
|---|---|---|---|
| `SAGE-API` | `wip/recuperacao-local-pre-auditoria` | `9e3eaba3475c3e9755f341d29bada059cc6fc5db` | limpo |
| `SAGE` | `wip/recuperacao-local-pre-auditoria` | `06c1ed4e948236c44926ed13fdb96521dd81d269` | limpo |

Ambiente local: Node `v18.16.1`, npm `9.5.1`. O backend declara Node `>=24 <25`.
Não será instalado outro Node. A suíte pode ser inspecionada estaticamente, mas a execução
completa de `npm test` neste host fica registrada como limitação de cobertura.

## 2. Tamanho do terreno

A contagem abaixo cobre fontes e configuração textual rastreadas pelo Git. Exclui
`package-lock.json`, documentação, imagens, planilhas, arquivos compactados e outros binários.
A lista completa, arquivo a arquivo, está em `FASE1-ARQUIVOS.md`.

| Repositório | Arquivos | Linhas | Concentração |
|---|---:|---:|---|
| `SAGE-API` | 208 | 23.090 | `src/` 11.628; `test/` 5.476; `scripts/` 1.969; `database/` 1.561; `installer/` 1.511 |
| `SAGE` | 132 | 17.496 | `src/` 17.286, dos quais 10.416 JS/JSX e 5.909 CSS |
| **Total** | **340** | **40.586** | — |

Detalhes do harness: backend com 49 suítes `*.test.js` e 5 arquivos de suporte/fake
(54 JS no total); frontend com 7 suítes. O número real difere da referência histórica de
“51 arquivos”.

## 3. Mapa de dependências

Análise estática de `require`, `import`, `export ... from` e `import()` com resolução de
arquivos relativos `.js`, `.jsx`, `.cjs` e `index.*`.

| Repositório | Módulos JS/JSX/CJS | Arestas internas | Ciclos estáticos | Imports relativos não resolvidos |
|---|---:|---:|---:|---:|
| `SAGE-API` | 172 | 334 | 0 | 5 |
| `SAGE` | 76 | 103 | 0 | 65 |

No frontend, 63 dos 65 “não resolvidos” são CSS ou imagens, portanto são resolvidos pelo
bundler. As duas exceções apontam para um módulo `CacheContext` inexistente, a partir de
`CacheDebugger.js` e `useCachedApi.js`; ambos estão fora do grafo alcançável do entrypoint e
seguem como candidatos para a fatia E, não como achados confirmados nesta fase.

No backend, três não resolvidos são imports JSON esperados. Os dois restantes estão em
`test/recuperacao-apos-queda.test.js` e apontam para `./src/...` a partir de `test/`; seguem
para validação da fatia G.

### Dependências dominantes do backend

- `index.js` carrega configuração, `app`, jobs, cache, WebSocket e estado global.
- `src/app.js` carrega configuração/web/readiness, registra rotas dinamicamente e referencia
  diretamente monitoramento e `deviceController`.
- `routes` dependem principalmente de `controllers` (21 arestas), `middlewares` (21),
  outros módulos de rota (14) e `services` (8).
- `controllers` dependem principalmente de `config` (26), `utils` (15), `services` (14),
  outros controllers via factories (13) e `cache` (5).
- `services` dependem principalmente de `config` (25), outros services (13) e `utils` (10).
- Os maiores pontos de fan-in são `logger.js` (39 importadores), `database.js` (29),
  `autenticar.js` (16), `paths.js` (14), `genericRoutesFactory.js` (14) e
  `genericControllerFactory.js` (13).
- Os maiores pontos de fan-out de produção são `deviceController.js` (14 dependências),
  `index.js` e `app.js` (11 cada), `accessController.js`, `scheduledJobs.js` e
  `accessService.js` (9 cada).

### Dependências dominantes do frontend

- `src/index.js` carrega `App`; `App.js` registra 24 caminhos de UI e quatro providers.
- `components` concentram 33 dependências entre componentes, 20 para `services`, 5 para
  hooks, 4 para stores e 3 para contexts.
- `src/services/api.js` é o maior ponto de fan-in, com 22 importadores.
- Não foi encontrado ciclo de importação estático em nenhum dos dois repositórios.

## 4. Candidatos a código morto

Grau de entrada zero não basta para declarar código morto: as 25 rotas do backend são
carregadas por leitura de diretório, testes são entrypoints do runner e vários scripts são
entrypoints operacionais ou de npm. Após retirar esses falsos positivos, ficam:

### Backend

- `src/controllers/dataController.js` — arquivo vazio, sem importadores.
- `src/middlewares/validacao.js` — 132 linhas, sem importadores.

### Frontend

- Cinco implementações stub paralelas às versões `.jsx` explicitamente usadas:
  `FiltrosAcesso.js`, `GraficosLinha.js`, `GraficosPizza.js`, `MetricasCard.js`,
  `TabelaDetalhes.js`.
- `src/components/common/index.js`.
- `src/components/examples/ExemploComponente.js`.
- `Footer.js`, `LinkButton.js`, `Loading.js` e `Message.js`.
- `DepartamentosExample.js`, `DispositivosRealTime.js` e
  `pages/Relatorios/Relatorios.jsx`.
- `form/Input/Input.js`, `form/Select/Select.js` e
  `form/SubmitButton/SubmitButton.js`.

Todos continuam apenas como candidatos até a validação semântica da fatia E.

## 5. Registro de rotas HTTP

`loadRoutes.js` registra dinamicamente todo arquivo cujo nome termina em `Routes.js`, sob
`/`. Foram encontrados 25 arquivos. A notação `CRUD5 /x` significa:
`GET /x`, `POST /x`, `GET /x/:id`, `PATCH /x/:id`, `DELETE /x/:id`.

| Arquivo | Controller/handler | Rotas registradas |
|---|---|---|
| `accessRoutes.js` | `accessController`, `accessService` | `CRUD5 /acessos`; outro `POST /acessos`; `POST /acessos/sincronizar/:dispositivo_id`; `POST /acessos/sincronizar-todos` |
| `acessSolicitationRoutes.js` | `accessSolicitationController` | `GET /solicitacoes-acessos`; `GET /solicitacoes-acessos/:id`; `DELETE /solicitacoes-acessos/:id`; `PATCH .../aprovar/:id`; `PATCH .../negar/:id` |
| `areaRoutes.js` | `areaController` | `CRUD5 /areas`; `POST /areas/upload/:id` |
| `classRoutes.js` | `classController` | `CRUD5 /turmas` |
| `companyRoutes.js` | `companyController` | `CRUD5 /empresas` |
| `courseRoutes.js` | `courseController` | `CRUD5 /cursos` |
| `dataRoutes.js` | `importService`, `exportService` | `GET /dados/planilha-modelo`; `POST /dados/importar`; `POST /dados/importar/ping`; `GET /dados/exportar` |
| `deviceRoutes.js` | `deviceController` | `CRUD5 /dispositivos`; status, discovery, quick-add, inspeção/remoção/backup/zeragem por tipo, importação, zeragem total, recomeço, backups, configuração de monitor, limpeza e toggle de sync — 20 rotas explícitas |
| `funcionarioHorarioRoutes.js` | `funcionarioHorarioController` | `GET` e `PUT /pessoas/:id/horario-fixo` |
| `horarioAulaRoutes.js` | `horarioAulaController` | `GET /horarios-aulas`; `POST /horarios-aulas/validar`; `POST /horarios-aulas`; `PUT` e `DELETE /horarios-aulas/:id` |
| `horarioRoutes.js` | `horarioController.descontinuado` | middleware terminal em `/horarios*` |
| `lessonRoutes.js` | `lessonController` | `GET/POST /aulas`; `PUT/DELETE /aulas/:id`; `GET /aulas/horarios/:turma_id/:divisao` |
| `materiaRoutes.js` | `materiaController` | `GET/POST /materias`; `DELETE /materias/:id` |
| `monitoringRoutes.js` | handlers inline | 10 rotas: state, stats, devices, sync, cache, users, cache clear, slow queries, sync-db e `/sync-db` |
| `notificationRoutes.js` | `accessService` | `POST /api/notifications/dao` |
| `peopleRoutes.js` | `peopleController` | `CRUD5 /pessoas`; URL, upload, filtro por tipo, QR e sincronização — 6 rotas explícitas |
| `presenceRoutes.js` | `presenceController` | `GET /presencas`; `GET /presencas/:id`; `DELETE /presencas/:id` |
| `promocaoRoutes.js` | `promocaoController` | `POST /promocao/executar`; `POST /promocao/reverter` |
| `relatorioRoutes.js` | `relatorioController` | 5 rotas sob `/relatorios`: turmas, resumo, detalhes, histórico e backfill |
| `roomRoutes.js` | `roomController` | `CRUD5 /sala` |
| `salaRoutes.js` | `salaController` | `CRUD5 /salas` |
| `schoolPhotoRoutes.js` | `schoolPhotoController` | `CRUD5 /foto_escolas`; duas rotas URL; outro `POST /foto_escolas` |
| `schoolRoutes.js` | `schoolController` | `CRUD5 /escolas` com autenticação por operação; setup, recuperação, config, unidade e login — 9 rotas explícitas |
| `statusRoutes.js` | handlers inline | `GET /status`; `GET /diagnostico` |
| `subjectRoutes.js` | `subjectController` | `CRUD5 /materias` |

Rotas diretas em `app.js`: `GET /diagnostico-acessos/:id`, `GET /health` e `GET /ready`,
além de Swagger e arquivos estáticos.

Nota estrutural para verificação: `monitoringRoutes` é montado diretamente em
`/monitoring` e também pelo loader dinâmico em `/`. Isso cria dois conjuntos de caminhos.
Da mesma forma, há superfícies duplicadas para `/materias`, `/sala(s)`, `/acessos` e
`/foto_escolas`. A existência está inventariada aqui; impacto e severidade serão decididos
na fatia C e confirmados pelo orquestrador.

## 6. Schema e escritores

Foram encontrados 27 nomes de tabela persistentes, contando o ledger de migrations. Há
definições repetidas em SQL para `Sala`, `HorarioAula`, `Presenca` e `ConfigSistema`.

| Tabela | Definição | Escritores estáticos detectados |
|---|---|---|
| `UnidadeEscolar` | `sage.sql` | `setup-database`, `schoolController`, `importService` |
| `UnidadeFoto` | `sage.sql` | `schoolPhotoController` |
| `Area` | `sage.sql` | `setup-database`, `areaController`, `deviceController`, `catracaImportService` |
| `Dispositivo` | `sage.sql` + migrations | `deviceController`, `scheduledJobs`, `accessService`, `importService` |
| `Curso` | `sage.sql` | `courseController`, `importService` |
| `Turma` | `sage.sql` | `classController`, `importService` |
| `Pessoa` | `sage.sql` | `peopleController`, `peopleService`, `people-db-utils`, `deviceController`, `catracaImportService` |
| `Presenca` | `sage.sql`, `melhorias_sistema.sql` | `presenceController`, `presenceService`, `deviceController` |
| `Responsavel` | `sage.sql` | `people-db-utils`, `deviceController` |
| `Aluno` | `sage.sql` | `people-db-utils`, `promocaoAlunosService`, `deviceController` |
| `Funcionario` | `sage.sql` | `people-db-utils`, `deviceController` |
| `Professor` | `sage.sql` | `people-db-utils`, `funcionarioHorarioController`, `deviceController` |
| `Materia` | `sage.sql` | `materiaController`, `subjectController` |
| `Administrador` | `sage.sql` | `people-db-utils`, `deviceController` |
| `Sala` | `sage.sql`, `melhorias_sistema.sql` | `roomController`, `salaController` |
| `Empresa` | `sage.sql` | `companyController` |
| `Terceirizado` | `sage.sql` | `people-db-utils`, `deviceController` |
| `Aula` | `sage.sql` | `lessonController`, `deviceController`, `convert-schedule-seed` |
| `HorarioAula` | `sage.sql`, `melhorias_sistema.sql` + migration | `horarioAulaController`, `lessonController`, `deviceController`, `convert-schedule-seed` |
| `Acesso` | `sage.sql` + migration | `accessService`, `accessController`, `deviceController` |
| `SolicitacaoAcesso` | `sage.sql` | `accessSolicitationController`, `deviceController` |
| `sync_pendente` | `sage.sql` | `sync.js`, `sync_catracas.js`, `scheduledJobs`, `deviceController` |
| `ConfigSistema` | `sage.sql`, `melhorias_sistema.sql`, migration | `promocaoAlunosService` |
| `FuncionarioHorario` | `melhorias_sistema.sql` | `funcionarioHorarioController` |
| `system_logs` | `melhorias_sistema.sql` | nenhum escritor estático detectado |
| `session_cache` | `melhorias_sistema.sql` | nenhum escritor estático detectado |
| `schema_migrations` | `migration-runner`, `legacy-baseline` | ambos os scripts |

O mapa considera SQL literal e bindings de tabela em controllers genéricos. Escritas com
nome de tabela completamente dinâmico serão revistas pela fatia A.

## 7. Jobs e disparos

| Job | Cadência/gatilho | Disparo principal |
|---|---|---|
| Sync de acessos | cron a cada 10 min | `accessService.sincronizarTodosAcessos()` |
| Polling de monitor | intervalo, default 20 s | `accessService.sincronizarTodosAcessosMonitor()` |
| Health check das catracas | intervalo, default 60 s | testa dispositivo e atualiza status |
| Sync de pendências | cron, default a cada minuto | processa `sync_pendente` via `controlIdService` |
| Promoção de alunos | cron configurável; desabilitado sem valor | `promocaoAlunosService.executarPromocaoSeAnoMudou()` |
| Backup do banco | cron, default 03:00 | gerar, restaurar/verificar e aplicar retenção |
| Promoção catch-up | boot, salvo desabilitação | verifica mudança de ano |
| Backup catch-up | boot, se backup exceder idade máxima | backup verificado |
| Sync catch-up | boot, se sync habilitada | importa o acumulado enquanto o PC esteve desligado |
| Health check inicial | timeout de 2 s no boot | `db.healthCheck()` |

## 8. Plano de fatias ajustado

As letras e a calibração permanecem intactas. Os acréscimos abaixo fecham lacunas de
cobertura encontradas no inventário.

| Fatia | Escopo ajustado | Foco | Sobreposição deliberada |
|---|---|---|---|
| A — dados | SQL e migrations; `database`, query builder, CRUD genérico; migration/setup scripts; serviços de importação, exportação, presença, promoção e escritores multi-tabela | integridade, schema, transações, índices, tipos/FKs/timezone | controllers escritores também vistos por C |
| B — catraca | services de device/control-id/access/import/sync/discovery/proteção; utils e ordem/flags; caminhos correspondentes em jobs e controllers | idempotência, paginação, retry, estado parcial, relógio, operações irreversíveis | wrappers HTTP vistos por C; jobs por D |
| C — HTTP/auth | todas as rotas, controllers e middlewares; `app.js`, `index.js`, loader; factory CRUD; uploads/WebSocket exposto | superfície registrada real, autenticação/autorização, validação, falha aberta, vazamento | persistência profunda fica com A/B |
| D — infra/operação | logger/env/paths/redis/web; cache/state/WebSocket; readiness, backup, diagnóstico, sanitização, notificações, saúde; todos os jobs e scripts operacionais | boot, readiness, logs, PII, concorrência, timers, cwd/caminhos, recuperação | build/release fica com F/H |
| E — frontend | `SAGE/src/**` inteiro, inclusive CSS, 24 rotas UI e candidatos mortos | sessão, 401/403, PII, estados de erro, formulários, desempenho e acessibilidade operacional | testes do frontend também verificados por G |
| F — config/build | packages e locks dos dois repos; env apenas por nomes/defaults, sem expor valores; ESLint/CRACO/Docker/nginx/CI/setup e superfície completa de `process.env` | versões, dependências, defaults divergentes, scripts e build; inclui o insumo Dependabot de 98 vulnerabilidades (2 críticas, 53 altas) | artefatos Windows ficam com H |
| G — testes/simulador | 49 suítes + 5 suportes do backend, 7 suítes do frontend, configs de teste e fake Control iD; comparação com documentos de campo | vacuidade, mocks, caminhos de erro, ordem, divergência simulador/campo, fixtures | cobertura por fatia será reportada |
| H — Windows | `installer/windows/**`, scripts de montagem/release/artefatos, workflow Windows e contratos correspondentes | preflight, rollback, ACL, serviço, integridade, dados/config, diagnóstico acionável | dependências/build também vistos por F |

Execução prevista em ondas por limite de concorrência, sem reduzir independência:

1. A, B e C em paralelo; o orquestrador acompanha cobertura e prepara referências.
2. D, E e F em paralelo.
3. G e H em paralelo, com o orquestrador já verificando evidências das ondas anteriores.
4. Fatia que falhar na calibração privada é descartada integralmente e refeita por outro
   auditor antes da consolidação.

Cada auditor receberá apenas as regras e ADRs aplicáveis, a lista fechada de arquivos e o
formato obrigatório. Passagens da documentação que revelam o gabarito conhecido serão
retiradas dos prompts para preservar a calibração.
