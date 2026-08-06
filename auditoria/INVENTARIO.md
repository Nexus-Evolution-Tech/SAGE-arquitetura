# Inventário final da auditoria SAGE

Data de consolidação: 2026-08-06  
Código auditado: `SAGE-API@9e3eaba3475c3e9755f341d29bada059cc6fc5db` e
`SAGE@06c1ed4e948236c44926ed13fdb96521dd81d269`  
Branch nos dois repositórios: `wip/recuperacao-local-pre-auditoria`

## 1. Sumário executivo

Foram aceitos **99 achados únicos** após releitura das evidências, descarte de uma fatia não
calibrada, repetição independente dessa fatia, uma execução contaminada descartada, uma proposta
falsa rejeitada e consolidação de achados repetidos:

| Severidade SAGE | Quantidade | Significado aplicado |
|---|---:|---|
| SEV1 | **6** | catraca/API pode ficar parada e ninguém entra |
| SEV2 | **50** | funciona, mas perde, corrompe, expõe ou torna irrecuperável dado |
| SEV3 | **42** | falha/risco com contorno operacional |
| SEV4 | **1** | lacuna preventiva sem falha funcional isolada |
| **Total** | **99** | — |

### O que impede instalar hoje

**O software não está apto a uma instalação presencial hoje.** Há quatro bloqueios objetivos:

1. **Fresh install deterministically quebrado:** A-008 mostra que o baseline cria o evento anual
   com DDL inválido depois de já aplicar parte do schema.
2. **Instalador sem rollback real:** H-001, H-002 e H-004 oferecem três caminhos independentes
   para deixar a API parada. `current.json` não é uma junction de ativação e o release anterior
   pode recusar o ledger depois de migration nova.
3. **Artefato ainda é protótipo interno:** H-007/H-008/H-011 confirmam que o `.exe` final não é
   produzido/testado/publicado pelo workflow e que gates de autenticidade/redistribuição do MySQL
   permanecem pendentes.
4. **Risco imediato ao dado e à segurança:** zeragem sem backup recuperável, ACK falso, cursores
   que atravessam eventos rejeitados, identidade Control iD divergente, superfícies públicas com
   PII e ausência de operador/papel tornam uma instalação tecnicamente possível insegura.

O Node 18 desta máquina **não é** o bloqueio do pacote Windows — ele deveria levar Node 24 —,
mas impediu que esta auditoria executasse as suítes. A conclusão de não aptidão é estática e não
depende dessa limitação.

### Onde os defeitos se concentram

Contagem abaixo = achados canônicos cuja evidência cita diretamente o arquivo. Um achado pode
citar mais de um arquivo; portanto esta tabela mede concentração, não soma para 99.

| Módulo | LOC físicas | Achados citando o módulo | Por 100 LOC |
|---|---:|---:|---:|
| `installer/windows/complete-install.ps1` | 75 | 6 | **8,00** |
| `installer/windows/SAGE.iss` | 92 | 7 | **7,61** |
| `src/app.js` | 238 | 12 | **5,04** |
| `src/jobs/scheduledJobs.js` | 333 | 11 | **3,30** |
| `src/services/peopleService.js` | 273 | 7 | **2,56** |
| `src/services/accessService.js` | 741 | 9 | **1,21** |
| `scripts/setup-database.js` | 439 | 6 | **1,37** |
| `src/controllers/deviceController.js` | 832 | 7 | **0,84** |

## 2. Tabela mestra, ordenada por risco ao dado

`Amb.` indica se confirmar impacto/correção depende do ambiente da escola. “Misto” significa
que a falha está comprovada no código, mas a consequência exata depende de configuração/estado.

### SEV1

| ID | Título | Sev | Arquivo principal | Amb. | Confiança |
|---|---|---:|---|---|---|
| A-004 | Começar do zero apaga catraca e tabelas globais sem backup/transação | SEV1 | `src/controllers/deviceController.js:522` | Não | alta |
| A-008 | Baseline de instalação falha no evento anual após DDL parcial | SEV1 | `database/sage.sql:321` | Não | alta |
| D-001 | Timer inválido vira loop mínimo e pode saturar a operação | SEV1 | `src/jobs/scheduledJobs.js:39` | Sim | alta |
| H-001 | Upgrade sobrescreve release/runtime e rollback aponta ao mesmo conteúdo | SEV1 | `installer/windows/complete-install.ps1:9` | Não | alta |
| H-002 | Release anterior recusa ledger após migration nova | SEV1 | `scripts/runtime-schema-gate.js:6` | Não | alta |
| H-004 | Falha ao parar MySQL abandona a API parada | SEV1 | `installer/windows/prepare-install.ps1:7` | Sim | alta |

### SEV2

| ID | Título | Sev | Arquivo principal | Amb. | Confiança |
|---|---|---:|---|---|---|
| A-001 | Chaves do corpo viram identificadores SQL | SEV2 | `src/config/queryBuilder.js:74` | Não | alta |
| A-002 | Credenciais de catraca são persistidas/devolvidas em claro | SEV2 | `src/controllers/deviceController.js:26` | Não | alta |
| A-003 | Presença legal é sobrescritível e apagável, sem cadeia de correção | SEV2 | `src/services/presenceService.js:152` | Não | alta |
| A-005 | Acesso manual e de catraca usam convenções de fuso distintas | SEV2 | `src/services/accessService.js:49` | Misto | alta |
| A-006 | Importação de planilha confirma lotes parciais | SEV2 | `src/services/importService.js:236` | Não | alta |
| A-007 | Promoção anual fica parcial e ainda marca ano concluído | SEV2 | `src/services/promocaoAlunosService.js:179` | Sim | alta |
| A-009 | Normalização fora do ledger executa `DROP COLUMN` | SEV2 | `scripts/setup-database.js:177` | Sim | alta |
| A-011 | Pessoa, subtipo e outbox são gravados por passos independentes | SEV2 | `src/services/peopleService.js:56` | Não | alta |
| A-012 | Acesso é confirmado antes da derivação de presença | SEV2 | `src/services/accessService.js:493` | Não | alta |
| A-013 | Cursor avança sobre logs sem pessoa e impede recuperação | SEV2 | `src/services/accessService.js:327` | Sim | alta |
| A-014 | Falha ao gravar outbox é engolida | SEV2 | `src/services/sync.js:5` | Não | alta |
| A-015 | Importação cria `Pessoa.tipo=ALUNO` sem linha em `Aluno` | SEV2 | `src/services/catracaImportService.js:76` | Não | alta |
| A-016 | Schemas legados de Sala/HorarioAula não convergem | SEV2 | `database/melhorias_sistema.sql:67` | Sim | alta |
| A-017 | Regras de horário usam check-then-write e replace sem transação | SEV2 | `src/controllers/horarioAulaController.js:254` | Não | alta |
| A-018 | CPF/RFID dependem de unicidade por consulta prévia | SEV2 | `src/services/peopleService.js:29` | Não | alta |
| A-020 | Fotos e referências de banco mudam em ordem não compensável | SEV2 | `src/services/peopleService.js:189` | Não | alta |
| A-021 | `Responsavel.aluno_id` não tem integridade referencial | SEV2 | `database/sage.sql:138` | Não | alta |
| B-001 | Defaults de offset quebram a bijeção de identidade | SEV2 | `src/services/controlIdService.js:11` | Sim | alta |
| B-003 | UPDATE parcial é sucesso e sai da outbox | SEV2 | `src/services/controlIdService.js:128` | Não | alta |
| B-004 | DELETE remoto falho elimina a única pendência | SEV2 | `src/services/controlIdService.js:227` | Não | alta |
| B-005 | Primeiro lote offline bloqueia toda a outbox posterior | SEV2 | `src/jobs/scheduledJobs.js:94` | Não | alta |
| B-006 | Piso global e cursor atravessam eventos rejeitados | SEV2 | `src/services/accessService.js:131` | Sim | alta |
| B-008 | `control_id_device_id` exigido pelo push não é cadastrável | SEV2 | `src/services/accessService.js:569` | Sim | alta |
| B-011 | Backup Control iD aceita conteúdo parcial e não tem restore | SEV2 | `src/services/deviceService.js:361` | Misto | alta |
| B-012 | Dump reprovado continua “recente” e deixa status verde | SEV2 | `src/services/backupBanco.js:153` | Não | alta |
| B-013 | Importação perde a identidade externa necessária aos acessos | SEV2 | `src/services/catracaImportService.js:30` | Misto | alta |
| C-001 | `GET /escolas` público devolve hash e contato | SEV2 | `src/controllers/schoolController.js:13` | Não | alta |
| C-002 | JWT não identifica operador/papel | SEV2 | `src/middlewares/autenticar.js:5` | Não | alta |
| C-003 | Token de uma unidade alcança dados de outras | SEV2 | `src/controllers/genericControllerFactory.js:70` | Misto | alta |
| C-005 | Monitoring público expõe acessos e limpa cache | SEV2 | `src/routes/monitoringRoutes.js:13` | Não | alta |
| C-006 | Callback falha aberto e confia em endereço encaminhado | SEV2 | `src/middlewares/monitorCallbackAuth.js:8` | Sim | alta |
| C-007 | Callback confirma HTTP 200 após falha total/parcial | SEV2 | `src/routes/notificationRoutes.js:15` | Não | alta |
| C-008 | Diagnóstico fica público se chave faltar e expõe amostras | SEV2 | `src/app.js:103` | Sim | alta |
| C-009 | WebSocket anônimo entrega eventos globais | SEV2 | `src/websocket/wsServer.js:27` | Não | alta |
| C-013 | Upload grava antes de autenticar, sem limite/tipo | SEV2 | `src/routes/peopleRoutes.js:11` | Não | alta |
| C-014 | Fotos de pessoas são públicas e enumeráveis | SEV2 | `src/app.js:126` | Não | alta |
| C-015 | Login sem rate limit enumera unidade | SEV2 | `src/controllers/schoolController.js:145` | Não | alta |
| C-017 | Log HTTP grava segredo em query e origem | SEV2 | `src/app.js:75` | Não | alta |
| C-018 | Replace de horário de funcionário não é transacional | SEV2 | `src/controllers/funcionarioHorarioController.js:53` | Não | alta |
| C-019 | Loader engole erro e `/health` segue positivo com rotas parciais | SEV2 | `src/app.js:134` | Não | alta |
| C-020 | GET de status reconfigura Monitor e ignora falha | SEV2 | `src/controllers/deviceController.js:30` | Não | alta |
| D-003 | Sem `SAGE_DATA_DIR`, estado persistente fica no release | SEV2 | `src/config/paths.js:5` | Sim | alta |
| D-004 | Script apaga banco original sem validar cópia restaurada | SEV2 | `scripts/renomear-bd-para-antigo.js:52` | Sim | alta |
| D-005 | Auditor de superfície executa verbos mutáveis reais | SEV2 | `scripts/audit-api-surface.js:9` | Sim | alta |
| E-004 | Logout não limpa caches/stores com PII entre usuários | SEV2 | `src/contexts/ReactQueryProvider.js:9` | Sim | alta |
| E-005 | WebSocket retém token/identidade e Monitoring omite Bearer | SEV2 | `src/contexts/WebSocketContext.js:19` | Sim | média-alta |
| E-007 | Troca obrigatória inexiste e senha aceita seis caracteres | SEV2 | `src/components/pages/Login/Login.js:99` | Não | alta |
| G-003 | Backup JSONL não converge quando Q3 ignora paginação | SEV2 | `src/services/deviceService.js:409` | Sim | alta |
| G-005 | Criação não reconcilia resposta perdida e fica parcial | SEV2 | `src/services/controlIdService.js:49` | Não | alta |
| H-003 | Migration ocorre sem backup verificado/restauração | SEV2 | `installer/windows/complete-install.ps1:26` | Não | alta |

### SEV3

| ID | Título | Sev | Arquivo principal | Amb. | Confiança |
|---|---|---:|---|---|---|
| A-010 | `Duplicate column` pode mascarar outra coluna ausente | SEV3 | `scripts/setup-database.js:141` | Sim | alta |
| A-019 | Consulta anual não usa índice compatível | SEV3 | `src/controllers/relatorioController.js:712` | Sim | alta |
| B-014 | Clientes/schedulers não têm orçamento e lock uniformes | SEV3 | `src/config/axios.js:4` | Sim | alta |
| B-015 | Monitoring não recebe snapshot/eventos corretos | SEV3 | `src/components/pages/Monitoring/Monitoring.js:17` | Não | alta |
| C-016 | Erro interno é devolvido ao cliente em produção | SEV3 | `src/app.js:153` | Não | alta |
| C-021 | Paginação/intervalo sem teto permitem carga excessiva | SEV3 | `src/controllers/genericControllerFactory.js:36` | Misto | alta |
| C-022 | Colisões e montagem dupla dependem da ordem do filesystem | SEV3 | `src/config/loadRoutes.js:4` | Não | alta |
| D-006 | Jobs e tarefas de boot podem se sobrepor | SEV3 | `src/jobs/scheduledJobs.js:16` | Sim | alta |
| D-007 | Falha tardia perde handles de jobs já ativos | SEV3 | `src/jobs/scheduledJobs.js:291` | Sim | alta |
| D-008 | Shutdown para jobs tarde e força saída | SEV3 | `index.js:140` | Não | alta |
| D-009 | Logger descarta metadata/stack e não retém fora do WinSW | SEV3 | `src/config/logger.js:24` | Misto | alta |
| D-010 | PII/payload/SQL chegam a stdout sem redação | SEV3 | `src/controllers/horarioAulaController.js:120` | Sim | alta |
| D-013 | Invalidação falha, mutação retorna sucesso com cache velho | SEV3 | `src/cache/helpers.js:43` | Sim | alta |
| D-014 | Redis falho continua em retry enquanto cai para LRU | SEV3 | `src/config/redis.js:9` | Sim | alta |
| D-015 | `KEYS` bloqueia Redis e glob LRU diverge | SEV3 | `src/config/redis.js:122` | Sim | alta |
| D-016 | `/ready` é caro e não tem deadline próprio | SEV3 | `src/services/readinessService.js:20` | Não | alta |
| D-017 | Falha de polling/health fica invisível em `debug` | SEV3 | `src/jobs/scheduledJobs.js:44` | Sim | alta |
| D-018 | `unhandledRejection` mantém processo desconhecido | SEV3 | `index.js:208` | Não | alta |
| D-020 | `postinstall` silencia falha de preparação | SEV3 | `scripts/check-first-run.js:7` | Sim | alta |
| E-001 | “Liberar acesso” mostra sucesso sem request/trilha | SEV3 | `src/components/pages/Home/Home.js:130` | Não | alta |
| E-003 | 403 é tratado como 401 e encerra sessão válida | SEV3 | `src/services/api.js:14` | Não | alta |
| E-006 | UI ADMINISTRADOR aparece para qualquer token | SEV3 | `src/components/ProtectedRoute/ProtectedRoute.js:4` | Misto | alta |
| E-008 | Requests falhos viram vazio/OFFLINE ou somem | SEV3 | `src/components/pages/Dispositivos/Dispositivos.js:42` | Não | alta |
| E-010 | Cargas em massa, N+1 e keys por índice | SEV3 | `src/components/pages/Inicio/Inicio.js:67` | Sim | alta |
| F-001 | 70 faixas vulneráveis permanecem na lock auditada | SEV3 | `SAGE/package-lock.json` | Misto | alta/média no alerta ausente |
| F-003 | 39 de 93 envs da API não estão no exemplo | SEV3 | `.env.example:1` | Sim | alta |
| F-004 | Sete chaves SMTP não têm consumidor | SEV3 | `.env.example:117` | Misto | alta |
| F-005 | Dependências build/teste/sem uso estão em runtime | SEV3 | `SAGE/package.json:10` | Misto | alta |
| F-006 | Smoke Windows não acompanha `main` e usa SHA antigo | SEV3 | `.github/workflows/windows-native.yml:3` | Sim | alta |
| F-008 | Defaults de jobs divergem entre exemplo/código/Windows | SEV3 | `src/jobs/scheduledJobs.js:94` | Sim | alta |
| F-009 | Script `prod` usa sintaxe POSIX no Windows | SEV3 | `package.json:11` | Sim | alta |
| G-006 | 12 testes MySQL podem ficar vacuamente verdes | SEV3 | `test/diagnostico.test.js:33` | Sim | alta |
| G-007 | Integrações não exercitam Q3/Q4 adversos | SEV3 | `test/fakes/controlid/index.js:12` | Sim | média-alta |
| G-008 | Fixtures têm PII aparente e IP interno | SEV3 | `test/sanitizador.test.js:113` | Não | alta na aparência |
| H-005 | Falta preflight completo e ledger de instalação | SEV3 | `installer/windows/SAGE.iss:14` | Sim | alta |
| H-006 | Caminhos do wizard/scripts divergem e shutdown fixa `C:` | SEV3 | `installer/windows/stop-mysql.ps1:1` | Sim | alta |
| H-007 | Workflow não produz/testa/publica o `.exe` final | SEV3 | `.github/workflows/windows-native.yml:83` | Não | alta |
| H-008 | Builder não autentica layout nem `ISCC.exe` usado | SEV3 | `installer/windows/build-installer.ps1:8` | Sim | alta |
| H-009 | Pareamento web/API não tem contrato de compatibilidade | SEV3 | `.github/workflows/windows-native.yml:24` | Sim | alta |
| H-010 | Reinstall após uninstall preservador falha nas ACLs | SEV3 | `installer/windows/initialize-state.ps1:22` | Sim | alta |
| H-011 | MySQL empacotado contradiz ADR/gates aceitos | SEV3 | `installer/windows/artifacts.json:18` | Sim | alta |
| H-012 | Assistente/erros não são acionáveis à usuária-alvo | SEV3 | `installer/windows/SAGE.iss:29` | Não | alta |

### SEV4

| ID | Título | Sev | Arquivo principal | Amb. | Confiança |
|---|---|---:|---|---|---|
| F-010 | API sem lint e supressão ampla de source-map | SEV4 | `SAGE-API/package.json:9` | Não | alta |

### Dependabot: duas decisões, não uma fila única

O snapshot fornecido tinha 98 alertas (2 críticos, 53 altos, 37 médios, 6 baixos). Na coleta
de 2026-08-06, a API retornou 97 abertos (2/52/37/6). A unidade faltante é exatamente um alerta
alto, mas pacote/GHSA/caminho já não são observáveis; ela foi mantida como indeterminada.

| Destino do código vulnerável | Crítico | Alto | Médio | Baixo | Total | Decisão |
|---|---:|---:|---:|---:|---:|---|
| CRA/build/teste, não entregue ao browser | 2 | 43 | 29 | 6 | **80** | sanear toolchain; não confundir com runtime escolar |
| Bundle de produção (`react-router`, `lodash`) | 0 | 9 | 8 | 0 | **17** | priorizar por exposição real; só 3 `lodash` ainda satisfazem faixa nesta branch |
| Snapshot histórico sem identidade atual | 0 | 1 | 0 | 0 | **1** | manter como limitação, sem inventar pacote |
| **Total** | **2** | **53** | **37** | **6** | **98** | — |

Dos 97 identificáveis, 70 ainda satisfazem a faixa vulnerável na lock auditada e 27 já não.
Os dois críticos são transitivos de build e estão fora da faixa nesta branch pelos overrides;
continuavam abertos porque o Dependabot observa a default branch.

## 3. Corrigível remotamente

“Remotamente” aqui significa que a implementação e seus testes sintéticos não dependem de ler
o equipamento ou a base da escola. Não significa autorização para corrigir durante esta
auditoria — nenhuma correção foi feita.

| Frente remota | Achados principais | Resultado exigido antes de merge |
|---|---|---|
| Baseline e migrations | A-008, A-009, A-010, A-016, H-002, H-003 | fresh DB e upgrade A→B→rollback A em MySQL descartável; migrations expand-only e backup restaurado-prova |
| Instalador/ativação | H-001, H-004–H-012, F-006 | release imutável, ponteiro atômico, fault injection por etapa, `.exe` real testado e hash/proveniência publicados |
| Autenticação e exposição | C-001–C-003, C-005–C-009, C-013–C-017, E-003–E-007 | negar por padrão, separar 401/403, autenticar HTTP/WS/monitoring, remover PII/hash/foto pública e limpar sessão |
| Escritas atômicas no banco | A-001–A-003, A-006, A-011, A-012, A-014, A-015, A-017, A-018, A-020, A-021, C-018 | transações, constraints e ledger/auditoria; falha parcial nunca 2xx/sucesso |
| Outbox e Control iD | B-003–B-005, C-007, G-003, G-005 | estado por dispositivo/etapa, idempotência após resposta perdida, retry/backoff e ACK recuperável |
| Rotas destrutivas/backup | A-004, B-011, B-012, D-004, D-005 | backup completo em staging, restore provado, confirmação forte e nenhuma mutação após falha |
| Operação/log/cache/jobs | D-001, D-006–D-018, D-020, F-003, F-004, F-008, F-009 | config tipada/fail-fast, shutdown drenado, mutex, redação, readiness limitada e cache coerente |
| Frontend | B-015, E-001, E-003–E-010 | sessão reativa por usuário, papel na UI, 403 sem logout, mutations reais, erro fiel e paginação server-side |
| Harness | G-006–G-008 e expansões G-001/G-002/G-004 | zero verde vacuamente; matriz Q3/Q4; fixtures sintéticas; testes atravessando controller→service→fake |
| Dependências/toolchain | F-001, F-005, F-010 | separar build/runtime, atualizar `lodash`, levar overrides à default branch e substituir CRA 5 de forma planejada |

## 4. Bloqueado no ambiente

Estes itens têm trabalho remoto possível, mas **não podem ser fechados** sem resposta de campo.
Cada pergunta abaixo deve entrar literalmente no checklist presencial.

| Tema/IDs | Pergunta exata a responder na escola |
|---|---|
| Offset de identidade — B-001 | Para cada catraca, quais `users.id` existem para uma amostra controlada de pessoas e há registros nas faixas `110…` e `111…`? Existem dois usuários para a mesma matrícula/registration? |
| Piso/cursor — A-013, B-006 | Qual é o valor efetivo de `CATRACA_MIN_LOG_ID`, a faixa min/max de `access_logs.id` por dispositivo e o `ultimo_log_id_sincronizado` persistido para cada um? |
| Filtro/paginação — G-003, G-007 | Em cada firmware, `load_objects access_logs` honra `where`, `limit` e `offset`? Repetir a mesma consulta devolve exatamente a mesma primeira/última ID? |
| Relógio/fuso — A-005 | Qual timezone está configurado no Windows, MySQL e em cada catraca; qual desvio existe; e há linhas de `Acesso.data_hora` com convenções misturadas? |
| Mapeamento push — B-008 | Qual `device_id` cada equipamento envia no Monitor e ele corresponde a qual linha `Dispositivo.control_id_device_id`? |
| Identidade importada — B-013 | Quais pessoas vieram da catraca, qual `users.id/registration` original foi perdido e existe fonte confiável para reconstruir o mapa sem homônimos? |
| Backup/restore — B-011, B-012, H-003 | Qual é o backup mais recente que foi efetivamente restaurado em base isolada, com data, contagens e hash, e onde está a cópia fora do PC? |
| Promoção/esquema legado — A-007, A-016 | A promoção anual já rodou em produção? Qual checkpoint/ano está gravado? Quais colunas/índices existem hoje em Sala, HorarioAula, Presenca e Acesso? |
| Rede/callback — C-006, C-008 | O Monitor push está habilitado? Qual proxy existe, quem define `X-Forwarded-For`, quais IPs/VLANs alcançam a API e quais chaves/whitelists estão realmente configuradas? |
| Grupo fixo Control iD — observação Fase 3 | Quais permissões efetivas o grupo `1` recebe, quais `access_rules`/portais o referenciam e a política é igual para aluno, funcionário, visitante e saída de menor? |
| Catraca e retry — B-014 | Qual modelo/firmware de cada dispositivo, latência p50/p95 para login/logs/escrita, limite observado e comportamento após resposta perdida/sessão expirada? |
| Windows/layout — D-003, H-004, H-006, H-010 | Onde a instalação atual guarda código, ProgramData, config, datadir e logs; serviços/ACLs antigos existem; Program Files/ProgramData estão em `C:`; quais portas estão ocupadas? |
| Política de TI — H-008, H-011 | A escola permite executável sem Authenticode, download de runtime, serviço LocalService e regra de firewall LocalSubnet? Há proxy/Defender/GPO bloqueando? |
| Papéis R1 — C-002, E-006, E-007 | Quem serão os ADMINISTRADORES e SECRETARIAS iniciais, quais ações cada pessoa realmente exerce e quem recebe/guarda a credencial migrada no primeiro login? |

## 5. Candidatos a reescrita

A densidade usa os 99 achados canônicos e conta citações diretas. Ela não prova sozinha que
reescrever é melhor; a recomendação considera também número de invariantes e custo de testar
remendos sobre efeitos parciais.

| Candidato | LOC | Achados | /100 LOC | Recomendação |
|---|---:|---:|---:|---|
| Ativação Windows: `complete-install.ps1` + `SAGE.iss` | 167 | 13 | **7,78** | **reescrever contra ADR-0011**; o desenho atual não possui a primitiva de junction/rollback exigida |
| Bootstrap HTTP: `src/app.js` | 238 | 12 | **5,04** | **decompor/reconstruir wiring** de auth, rotas, health e arquivos; não remendar mais aliases/middlewares no mesmo arquivo |
| Coordenador de jobs: `scheduledJobs.js` | 333 | 11 | **3,30** | **reescrever como scheduler com lifecycle/mutex** e contratos de erro comuns |
| Escrita de pessoa: `peopleService.js` | 273 | 7 | **2,56** | **reescrever o boundary transacional** Pessoa→subtipo→foto→outbox; preservar API externa durante migração |
| Sync/ingestão: `accessService.js` | 741 | 9 | **1,21** | **extrair e reescrever o núcleo por dispositivo** (cursor, dedupe, ACK, presença); manter adaptadores HTTP separados |

`deviceController.js` (832 LOC, 7 achados, 0,84/100) é grande e perigoso, mas ainda não há
evidência numérica suficiente para reescrita integral: separar primeiro operações destrutivas,
backup e diagnóstico em serviços pequenos.

## 6. Ordem de correção sugerida

| Ordem | Entrega | Depende de | Achados que fecha/desbloqueia |
|---:|---|---|---|
| 0 | Congelar release presencial e preservar estado/config atual | nenhuma | evita materializar A-008/H-001/H-004 enquanto a fila é preparada |
| 1 | Laboratório reproduzível: Node 24, MySQL descartável, VMs Windows, jobs separados | nenhuma | G-006, H-005, H-007; torna todo o restante verificável |
| 2 | Corrigir baseline/migration e contrato de schema compatível com rollback | 1 | A-008–A-010, A-016, H-002, H-003 |
| 3 | Reescrever ativação Windows com release imutável, junction e fault injection | 2 | H-001, H-004–H-012, F-006 |
| 4 | Contenção de superfície e destruição: auth fail-closed, PII, uploads, backups e confirmação | 1; backup provado antes de zeragem | A-004, B-011/B-012, C-001/C-005–C-009/C-013–C-017, D-004/D-005 |
| 5 | Captura presencial somente leitura dos offsets, cursores, firmware, regras e layout | checklist da seção 4; sistema ainda congelado para mutações | B-001, B-006, B-008, B-013/B-014, G-003/G-007 e observação do grupo 1 |
| 6 | Núcleo de sync/outbox idempotente por dispositivo | 5; simulador Q3/Q4; identidade externa definida | A-012–A-014, B-003–B-006, C-007, G-003/G-005 |
| 7 | Transações/constraints e ledger de presença/pessoa | 2; política de correção retroativa aprovada | A-001–A-003, A-005–A-007, A-011/A-015/A-017/A-018/A-020/A-021, C-018 |
| 8 | R1 usuário/papel no backend e frontend | 4; contrato 401/403; migração de credencial definida | C-002/C-003, E-003–E-007; depois E-001/E-008/E-010 |
| 9 | Operação: scheduler, shutdown, logs/redação, Redis e readiness | 3 e 6 para lifecycle comum | D-001, D-006–D-018, D-020, F-003/F-008/F-009 |
| 10 | Toolchain/dependências e performance | release funcional e testes verdes | F-001/F-004/F-005/F-010, C-021/C-022, E-010 |

Dependências que não podem ser invertidas:

- não escolher/unificar `CATRACA_USER_ID_OFFSET` antes de mapear usuários existentes;
- não mover cursor/piso antes de capturar faixas por dispositivo e planejar replay;
- não reabrir zeragem antes de provar restore completo, inclusive no modo Q3;
- não declarar rollback Windows antes de testar migration nova seguida de volta ao release anterior;
- não entregar frontend R1 antes de o backend distinguir 401 de 403 e devolver identidade/papel;
- não habilitar diagnóstico/telemetria antes de autenticação e redação.

## 7. Cobertura e confiança

### Superfície auditada

| Repositório | Arquivos de fonte inventariados | LOC físicas |
|---|---:|---:|
| SAGE-API | 208 | 25.822 |
| SAGE | 132 | 19.409 |
| **Total** | **340** | **45.231** |

- Grafo de 248 módulos JS/JSX/CJS: nenhum ciclo detectado; rotas carregadas por filesystem
  foram tratadas como entradas, não como código morto.
- 25 arquivos de rota backend mapeados até controller/service.
- Backend: 49 suítes `*.test.js` + cinco arquivos JS de fake/suporte; frontend: sete arquivos
  de teste. A fatia G materializou 232 casos backend.
- Frontend: 21 telas roteadas; 18 fazem HTTP; zero trata 403 explicitamente além de 401 e
  zero trata apenas 401; 108 callsites, sendo nove `fetch` diretos.
- Dependabot: snapshot 98, coleta atual 97, lock cruzada alerta a alerta.
- Instalador: 19 arquivos/2.648 LOC no escopo principal, mais chamadores de schema/readiness.

### Calibração

| Fatia | Resultado | Observação |
|---|---:|---|
| A | **1/1** | ausência de `RegistroPresenca` redescoberta |
| B, 1ª passagem | **1/2 — reprovada** | relatório integral descartado |
| B, 2ª passagem | **não elegível** | independência contaminada pelo orquestrador antes da entrega; nada usado |
| B, 3ª passagem | **2/2 — aprovada** | offset divergente e piso global distinguidos como causas independentes |
| C | **5/5 obrigatórios + V4** | auth/papéis, destruição, usuário, monitoring público/duplicado; `catch` vazio como achado compartilhado |
| D | **3/3** | console em produção, ausência de redação central e ausência de rotação intrínseca, com nuance WinSW correta |
| E–H | sem gabarito privado | verificadas por evidência, duplicatas e segunda leitura |

Os 12 fatos conhecidos foram redescobertos por relatórios aceitos; V4 era de propriedade
compartilhada C/D e foi encontrado por C. O placar importa mais que o volume de achados.

### Onde a confiança é menor

- Nenhuma suíte/build foi executada por Node 18 versus requisito Node 24.
- MySQL real, catracas e scripts destrutivos não foram acionados; transações/DDL foram lidos
  estaticamente.
- Instalador/rollback/ACL precisam de matriz de VMs; severidade está baseada no fluxo de código.
- Q4 (`where` honrado ou ignorado) segue incerto por firmware.
- Um alerta alto do snapshot Dependabot não é mais identificável.
- A fixture G-008 viola a regra por aparência; não se tentou confirmar identidade real.
- Impacto retroativo de fuso, offsets, cursores, promoção e schema exige consultas sanitizadas
  no local antes de qualquer migração.

## 8. Achados descartados e consolidados

| Material | Decisão | Motivo |
|---|---|---|
| Fatia B — primeira passagem, 38 propostas | **descartada integralmente** | falhou calibração 1/2; nenhum trecho foi reaproveitado, mesmo quando outra execução depois encontrou fato semelhante |
| Fatia B — segunda passagem | **descartada antes da entrega** | o orquestrador expôs acidentalmente informação do gabarito; independência ficou impossível de provar |
| B-002 da terceira passagem | **rejeitado** | falso positivo: `peopleService.js` chama `registrarSyncPendente(idPessoa, 'CREATE')`; o título amplo não se sustentou |
| C-004/C-010/C-011/C-012 | consolidados em A-002/A-003/A-004/A-001 | mesmas causas vistas pela superfície HTTP |
| B-007/B-009/B-010 | consolidados em C-007/C-006/A-004 | mesmo ACK, callback fail-open e destruição sem backup |
| D-002/D-011/D-012/D-019 | consolidados em C-007/C-009/C-005+C-008/B-012 | mesmas causas; D acrescentou evidência operacional |
| E-002/E-009/E-011 | consolidados em C-002/D-010/F-005 | identidade/papel, logging sem redação e dependências misturadas |
| F-002/F-007 | consolidados em B-001/D-020 | mesmo offset divergente e mesmo `postinstall` silencioso |
| G-001/G-002/G-004 | expansões de A-004/B-011/B-003 | lacuna de teste é prova adicional do mesmo defeito de produção, não novo ID |
| C-018, B-006, B-015, D-010, D-016, E-005 | aceitos com escopo reduzido | partes duplicadas foram removidas; só a causa independente permaneceu |
| `F-001` (reclassificação) | aceito com severidade reduzida | CVSS crítico não equivale a SEV1; dois críticos não reproduzem na branch e são build-only |
| `dataController.js` vazio / `validacao.js` sem importador | não viraram achado final | fatos de inventário, mas nenhum contrato/efeito de produção adicional foi demonstrado |
| Grupo Control iD fixo `1` | não contado como achado | vínculo está comprovado; permissão efetiva depende das regras/portais do equipamento e virou pergunta presencial |

## 9. Recomendação: contenção mínima antes da visita versus saneamento profundo

### Contenção mínima antes da visita

Esta é a menor faixa que reduz risco imediato. Não transforma o sistema em “pronto”; apenas
cria uma base segura para a visita.

| Prioridade | Contenção | Achados cobertos |
|---:|---|---|
| 1 | **Não levar o instalador atual.** Corrigir fresh DB e construir ativação rollbackável; passar VM clean/upgrade/falha/uninstall/reinstall com o `.exe` final. | A-008, H-001–H-012, F-006 |
| 2 | **Desabilitar/bloquear fluxos irreversíveis** até backup completo + restore provado + confirmação administrativa. Remover scripts destrutivos do runbook comum. | A-004, B-011/B-012, D-004/D-005, G-003 |
| 3 | **Fechar superfícies públicas e vazamentos**: auth/role em monitoring/diagnóstico/WS/uploads/fotos, callback fail-closed, rate limit e logs sem segredo/PII. | C-001, C-005–C-009, C-013–C-017, D-010 |
| 4 | **Parar falsos sucessos e perdas silenciosas**: falha parcial deve falhar; não remover outbox; não avançar cursor sobre rejeitados; ACK recuperável. | A-012–A-014, B-003–B-006, C-007, G-005 |
| 5 | **Config fail-fast**: validar timers/paths/env; gravar explicitamente defaults seguros. Não escolher offset/piso sem levantamento de campo. | D-001/D-003, F-003/F-008, B-001/B-006 |
| 6 | **Compatibilidade mínima R1** se R1 entrar antes da visita: 403 preserva sessão, cache/WS limpam por identidade, ações ADMINISTRADOR ficam ocultas e login força troca. | E-003–E-007 |
| 7 | **Gate de teste honesto**: job Node 24 + MySQL obrigatório, zero pass vacuamente, Q3/Q4 e installer fault-injection. | G-003, G-005–G-007, H-007 |

Para B-001/B-006, a contenção é **não migrar nem “corrigir” o valor no escuro**. O código pode
ser preparado para exigir configuração e gerar diagnóstico sanitizado, mas a mudança de dados
fica bloqueada até a visita.

### Pode esperar o saneamento profundo depois

- Ledger append-only completo de presença e política retroativa de correção: A-003, A-005,
  A-007 e parte de A-012.
- Reescrita total do núcleo de sincronização por dispositivo, depois de capturar offset, cursor,
  firmware e regras reais: A-013, B-001/B-006/B-008/B-013/B-014, G-003/G-007.
- R1 completa de usuários/gestão/auditoria além da compatibilidade mínima: C-002/C-003,
  E-006/E-007.
- Decomposição de `app.js`, scheduler, people service e telas grandes conforme seção 5.
- Substituição do CRA 5 e saneamento dos 80 alertas build-only; antes disso, corrigir os três
  `lodash` ainda vulneráveis no bundle e integrar os overrides já presentes.
- Otimizações de cache/Redis/paginação/N+1 e quality gates: C-021, D-013–D-016, E-010,
  F-004/F-005/F-010.

Nenhum item SEV1 pode esperar. Itens listados como “depois” que dependem de campo devem ficar
desabilitados ou sob contenção até o saneamento, não operar silenciosamente no estado atual.
