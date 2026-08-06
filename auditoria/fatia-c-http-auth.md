# Auditoria independente — FATIA C: HTTP, autenticação e autorização

> **Nota do orquestrador:** este é o relatório bruto do auditor. Duplicatas e severidades
> foram revistas; para conclusões factuais da onda, prevalece `ONDA1-VERIFICACAO.md`.

## Resumo de cobertura

Auditoria estática e independente realizada nos repositórios `SAGE-API` e `SAGE`, ambos confirmados na branch `wip/recuperacao-local-pre-auditoria`. Foram lidos integralmente os 26 arquivos de `src/routes` (25 módulos carregáveis mais a factory genérica), os 23 arquivos de `src/controllers` (incluindo o arquivo vazio), os quatro middlewares, `src/config/loadRoutes.js`, `web.js`, `paths.js`, `src/app.js`, `index.js`, `src/websocket/wsServer.js`, `src/utils/jwt.js`, `criptografia.js`, os serviços chamados necessários para seguir os fluxos HTTP, o DDL relevante de `database/sage.sql`, os quatro arquivos frontend solicitados e os ADRs 0005, 0006, 0007 e 0012 permitidos.

Foram registrados **22 achados**: **8 SEV1**, **12 SEV2**, **2 SEV3** e **0 SEV4**.

Não foi executado `npm test`: o ambiente local tem Node `18.16.1`, enquanto `package.json` exige `>=24 <25`. Assim, reproduções dinâmicas não foram tentadas; todas as reproduções abaixo são por análise estática.

### Superfície HTTP real

Legenda: **JWT** = somente `autenticar`, sem papel/perfil; **público** = sem autenticação; **local** = decisão por endereço loopback no controller; **ad hoc** = validação manual parcial. Nenhuma rota usa o middleware Joi de `src/middlewares/validacao.js`.

O loader lê todo arquivo terminado em `Routes.js` e monta cada router em `/`. `monitoringRoutes.js` também é montado manualmente em `/monitoring`, antes do loader.

| Superfície efetiva | Autenticação / autorização | Validação | Controller / efeito |
|---|---|---|---|
| `GET /health`, `GET /ready` | público / nenhuma | nenhuma | estado interno/readiness |
| `/docs/*`, `/uploads/*` | público / nenhuma | apenas resolução de arquivo estático | Swagger e arquivos enviados |
| `GET /diagnostico-acessos/:id` | chave opcional; falha aberta se ausente | id ad hoc | `deviceController.diagnosticoAcessos`; lê catraca, acessos e pessoas |
| `GET /status`, `GET /diagnostico` | público / nenhuma | `download` ad hoc | `statusRoutes`; estado operacional e bundle sanitizado |
| `POST /api/notifications/dao` | callback opcional por token/IP; nenhuma autorização | parcial no serviço | grava `Acesso`/`Presenca`, emite WS |
| `GET /monitoring/{state,stats,devices,sync,cache,users,slow-queries,sync-db}`, `POST /monitoring/cache/clear`, `GET /sync-db` | público / nenhuma | nenhuma | estado, PII operacional, fila e mutação de cache |
| aliases `/monitoring/monitoring/{state,stats,devices,sync,cache,users,slow-queries,sync-db}`, `/monitoring/monitoring/cache/clear` e colisão em `/monitoring/sync-db` | público / nenhuma | nenhuma | mesmo router montado pela segunda vez |
| Socket.IO `/socket.io/*`; eventos `subscribe:{acessos,dispositivos,sync,stats}` | token opcional / nenhuma | nenhuma | inscrição em rooms e recepção de eventos |
| `GET /setup/status` | público / nenhuma | nenhuma | informa se onboarding é necessário |
| `POST /setup/initialize` | público + local / nenhuma autorização individual | ad hoc | cria a primeira unidade em transação |
| `POST /escolas/recuperar-acesso` | público + local / nenhuma | ad hoc e bloqueio por conta | troca senha e chave de recuperação |
| `POST /escolas/login/:id` | público | ad hoc incompleta; sem rate limit | autentica unidade e emite JWT |
| `GET /escolas` | público / nenhuma | paginação sem teto | CRUD genérico; lista unidades |
| `POST /escolas`, `GET/PATCH/DELETE /escolas/:id` | JWT / nenhum papel ou escopo | body/params sem schema | CRUD genérico de unidades |
| `GET /config`, `GET/PATCH /unidade`, `PATCH /unidade/trocar-senha` | JWT / próprio id apenas nessas rotas | ad hoc | configuração e mutações da unidade do token |
| `POST /unidade/upload-logo` | upload antes do JWT / nenhum papel | Multer sem limite/tipo | arquivo + atualização da unidade |
| `GET/POST /pessoas`, `GET/PATCH/DELETE /pessoas/:id` | JWT / nenhum papel ou escopo | ad hoc incompleta | CRUD, PII, soft delete e sincronização |
| `GET /pessoas/url[/:id]`, `GET /pessoas/tipo/:tipo` | JWT / nenhum papel ou escopo | ad hoc incompleta | PII/URLs |
| `POST /pessoas/upload/:id` | upload antes do JWT | Multer sem limite/tipo | arquivo + atualização da pessoa |
| `POST /pessoas/gerar_qrcode/:id`, `POST /pessoas/sincronizar-banco` | JWT / nenhum papel | ad hoc incompleta | credencial de acesso e sincronização externa |
| `GET/POST /acessos`, `GET/PATCH/DELETE /acessos/:id` | JWT / nenhum papel ou escopo | só presença de quatro campos no POST; genérico sem schema | grava, altera e apaga acessos; POST está registrado duas vezes |
| `POST /acessos/sincronizar/:dispositivo_id`, `POST /acessos/sincronizar-todos` | JWT / nenhum papel | id sem schema | sincronização com catraca |
| `GET /solicitacoes-acessos`, `GET/DELETE /solicitacoes-acessos/:id`, `PATCH .../aprovar/:id`, `PATCH .../negar/:id` | JWT / nenhum papel | nenhuma | lê, apaga e decide solicitações de menor |
| `GET /presencas`, `GET/DELETE /presencas/:id` | JWT / nenhum papel ou escopo | nenhuma | leitura e exclusão genérica de presença |
| `GET /relatorios/turmas`, `GET /relatorios/acesso/{resumo,detalhes}`, `GET /relatorios/pessoa/:id/historico` | JWT / nenhum papel ou escopo | query ad hoc sem limite de intervalo | lê PII e presença |
| `POST /relatorios/acesso/backfill-presenca` | JWT / nenhum papel | datas ad hoc | cria ou sobrescreve presença em lote |
| CRUD5 `/areas` + `POST /areas/upload/:id` | JWT; upload roda antes do JWT | CRUD sem schema; Multer sem limite/tipo | banco + arquivo |
| CRUD5 `/turmas`, `/empresas`, `/cursos`, `/sala`, `/salas` | JWT / nenhum papel ou escopo | CRUD genérico sem schema | mutações genéricas |
| `/materias`: `GET`, `POST`, `GET/PATCH/DELETE /:id` | JWT / nenhum papel | validação varia por handler duplicado | `materiaController` e CRUD genérico de `subjectController` concorrem |
| `GET/POST /foto_escolas`, `GET/PATCH/DELETE /foto_escolas/:id`, `GET /foto_escolas/url[/:id]` | JWT; upload roda antes do JWT | genérico sem schema; Multer sem limite/tipo | banco + arquivo; POST duplicado |
| CRUD5 `/dispositivos` | JWT / nenhum papel ou escopo | genérico; criação parcial | inclui credenciais e mutações de cadastro |
| `GET /dispositivos/{status,discover,catraca/objetos-tipos}` | JWT / nenhum papel | query ad hoc | leitura; `status` também reconfigura catraca |
| `GET /dispositivos/:id/{status,diagnostico-acessos,logs-info}`, `GET .../catraca/objetos/:objectType` | JWT / nenhum papel ou escopo | ad hoc | lê equipamento, objetos e PII |
| `POST /dispositivos/quick-add`, `POST .../{import-from-catraca,configurar-monitor,toggle-sync}` | JWT / nenhum papel | ad hoc incompleta | banco e equipamento externo |
| `POST .../catraca/backup/:objectType`, `POST .../{backup-logs,backup-completo}` | JWT / nenhum papel | ad hoc | cria e baixa backups |
| `DELETE .../catraca/objetos/:objectType/:objectId`, `POST .../catraca/zerar/:objectType`, `POST .../{zerar-tudo,comecar-do-zero,zerar-logs}`, `DELETE /dispositivos` | JWT / nenhum papel | ad hoc incompleta | operações destrutivas locais/externas |
| `GET/PUT /pessoas/:id/horario-fixo` | JWT / nenhum papel ou escopo | ad hoc; itens inválidos são ignorados | substituição multi-passo de horários |
| `GET/POST /aulas`, `PUT/DELETE /aulas/:id`, `GET /aulas/horarios/:turma_id/:divisao` | JWT / nenhum papel | ad hoc | catálogo e exclusões encadeadas |
| `GET/POST /horarios-aulas`, `POST /horarios-aulas/validar`, `PUT/DELETE /horarios-aulas/:id` | JWT por `router.use` / nenhum papel | ad hoc | grade escolar |
| qualquer método em `/horarios/*` | JWT / nenhum papel | nenhuma | responde rota descontinuada |
| `GET/POST/DELETE /materias[/:id]` | JWT / nenhum papel | ad hoc | segundo conjunto concorrente de handlers |
| `POST /promocao/{executar,reverter}` | JWT / nenhum papel | query ad hoc | mutação em lote; executar aplica por padrão |

`CRUD5 /x` significa `GET /x`, `POST /x`, `GET /x/:id`, `PATCH /x/:id` e `DELETE /x/:id`.

Verificações sem achado separado: `JWT_SECRET` ausente interrompe o carregamento de `jwt.js` (falha fechada); o frontend trata tanto 401 quanto 403 removendo o token, portanto o 403 usado para JWT inválido não quebra o contrato atual; o upload de planilha autentica antes do Multer e possui limite/extensões; o bundle de `/diagnostico` passa pelo sanitizador e pela allowlist de configuração. Essas constatações não neutralizam os achados das superfícies públicas adjacentes.

## Achados

### [C-001] Listagem pública de escolas devolve hash de senha e dados de contato
- **Arquivo:** `SAGE-API/src/routes/schoolRoutes.js:7-15`; `SAGE-API/src/controllers/schoolController.js:13-17`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`GET /escolas` é público e o controller genérico seleciona todos os campos declarados, incluindo `senha`, login, endereço e contatos.

**Evidência**
```js
const campos = ['id', 'nome', 'numero_unidade', 'cnpj', 'login', 'senha',
  'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
  'cep', 'telefone_contato', 'email', 'logo'];

autenticarReqs: {
  listar: false,
  criar: true,
```

**Impacto no dado**
Expõe material de autenticação para ataque offline e dados cadastrais da escola sem credencial.

**Como reproduzir**
Análise estática: seguir `GET /escolas` até `genericControllerFactory.listar` e `crud.buscarTodos`.

**Correção sugerida**
Criar DTO público mínimo para seleção de unidade, excluir sempre credenciais de qualquer resposta e revisar se a listagem precisa ser pública.

**Regra violada**
Nunca registrar/reproduzir PII, segredo ou token.

### [C-002] JWT identifica apenas a unidade e não existe autorização por operador ou papel
- **Arquivo:** `SAGE-API/src/controllers/schoolController.js:145-169`; `SAGE-API/src/middlewares/autenticar.js:5-15`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O login gera JWT somente com id/nome da unidade. O único middleware verifica validade e atribui o payload; não há identidade individual, papel, permissão nem middleware de autorização. O mesmo token alcança aprovação de saída de menor, promoção, importação, CRUD e destruição de dados/catracas.

**Evidência**
```js
const token = gerarToken({ id: unidade.id, nome: unidade.nome });

const payload = verificarToken(token);
if (!payload) return res.status(403).json({ message: 'Token inválido ou expirado' });
req.user = payload;
next();
```

**Impacto no dado**
Não é possível saber qual pessoa aprovou, alterou ou apagou algo, nem restringir ações críticas a perfis autorizados. Um token de unidade equivale a acesso administrativo total.

**Como reproduzir**
Análise estática: buscar `req.user`, `role`, `perfil` e middlewares de autorização; só quatro handlers de `/unidade` usam `req.user.id`, e nenhum verifica papel.

**Correção sugerida**
Introduzir identidade individual de operador, papéis/permissões no servidor e auditoria persistente de ator, instante, motivo e alteração. Negar por padrão quando identidade/permissão faltar.

**Regra violada**
Toda ação relevante deve ser atribuível; decisão de segurança falha fechada quando configuração falta; ADR-0007.

### [C-003] Token de uma unidade acessa e altera dados de outras unidades
- **Arquivo:** `SAGE-API/src/controllers/peopleController.js:16-23`; `SAGE-API/src/controllers/genericControllerFactory.js:70-86`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Consultas e CRUDs não aplicam `req.user.id` como escopo. Pessoas são listadas globalmente e os handlers genéricos buscam/alteram qualquer id. Corpos também podem informar `unidade_id` arbitrário.

**Evidência**
```js
const pessoas = await buscarTodasPessoas(limit, offset);
const [[{ total }]] = await db.query(
  'SELECT COUNT(*) as total FROM Pessoa WHERE visivel = 1'
);

const id = req.params.id;
const result = await crud.buscarPorId(id, tabela, campos);
```

**Impacto no dado**
Em instalação com mais de uma unidade, um login pode ler PII, horários, presenças, dispositivos e relatórios de outra unidade, além de modificá-los ou apagá-los.

**Como reproduzir**
Análise estática: usar um JWT de uma unidade e observar que ids e consultas não são combinados com `unidade_id = req.user.id`.

**Correção sugerida**
Aplicar escopo de unidade no repositório/serviço, nunca confiar em `unidade_id` do corpo, e testar horizontal privilege escalation em toda rota por id.

**Regra violada**
Decisão de segurança falha fechada quando configuração/identidade falta; nunca reproduzir PII.

### [C-004] Credenciais das catracas são armazenadas e devolvidas em claro
- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:26-28`; `SAGE-API/src/controllers/deviceController.js:705-725`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`senha` e `usuario` fazem parte do conjunto de campos de leitura/retorno. A criação insere a senha recebida sem `criptografia.js` e responde com o objeto completo. CRUD5 também lista e busca esses campos.

**Evidência**
```js
const campos = ['id', 'nome', 'modelo', 'endereco', 'porta', 'usuario', 'senha',
  'status', 'sync_enabled', 'last_health_check', 'area_id', 'numero_serial',
  'created_at', 'updated_at'];

await db.query(`INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${placeholders})`, values);
res.status(201).json({ message: 'Dispositivo criado com sucesso', data: dispositivo });
```

**Impacto no dado**
Qualquer token válido obtém credenciais de administração dos equipamentos; vazamento da API/banco compromete também a catraca.

**Como reproduzir**
Análise estática: seguir `GET /dispositivos`, `GET /dispositivos/:id`, POST de criação e quick-add.

**Correção sugerida**
Criptografar a credencial reversível com chave fora do banco, nunca incluí-la em DTOs, redigir logs/backups e restringir operações a papel específico.

**Regra violada**
Nunca registrar/reproduzir segredo; toda ação relevante deve ser atribuível.

### [C-005] Monitoramento público expõe acessos e permite limpar cache sem autenticação
- **Arquivo:** `SAGE-API/src/routes/monitoringRoutes.js:13-38`; `SAGE-API/src/routes/monitoringRoutes.js:111-123`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O router não usa autenticação. `/monitoring/state` devolve os 50 acessos recentes com identificadores, nome, horário e decisão; `/monitoring/sync-db` inclui nomes e mensagens de erro; o POST de limpeza de cache é público apesar do comentário “admin only”.

**Evidência**
```js
router.get('/monitoring/state', async (req, res) => {
  const [acessos] = await db.query(
    `SELECT a.id, a.pessoa_id, a.dispositivo_id, a.status, a.permitido,
            a.data_hora, p.nome AS pessoa_nome
       FROM Acesso a LEFT JOIN Pessoa p ON p.id = a.pessoa_id
       ORDER BY a.id DESC LIMIT 50`
  );
});

router.post('/monitoring/cache/clear', async (req, res) => {
  await redis.flush();
```

**Impacto no dado**
Expõe presença/movimentação de pessoas e detalhes operacionais; terceiros podem degradar desempenho invalidando cache repetidamente.

**Como reproduzir**
Análise estática; as mesmas rotas existem ainda sob aliases decorrentes da montagem dupla.

**Correção sugerida**
Separar status público mínimo de diagnóstico autenticado, exigir papel operacional para dados/mutações e remover aliases.

**Regra violada**
Nunca reproduzir PII; toda ação relevante deve ser atribuível.

### [C-006] Callback da catraca falha aberto e a whitelist aceita endereço encaminhado não confiável
- **Arquivo:** `SAGE-API/src/middlewares/monitorCallbackAuth.js:8-34`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Se token e whitelist não estiverem configurados, o middleware sempre chama `next()`. Quando há somente whitelist, ele prioriza `x-forwarded-for` fornecido pelo cliente, sem cadeia de proxies confiáveis.

**Evidência**
```js
if (token && token.length > 0) {
  const providedToken = req.query.token || req.headers['x-monitor-token'] || '';
  if (providedToken !== token) {
    return res.status(401).json({ ok: false, error: 'Token inválido ou ausente' });
  }
}

const clientIp = (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) || req.ip || req.connection?.remoteAddress || '';

next();
```

**Impacto no dado**
Um cliente de rede pode forjar callbacks que inserem acessos/presenças; uma whitelist isolada pode ser contornada por header.

**Como reproduzir**
Análise estática: ausência das duas variáveis não produz rejeição; com somente whitelist, o primeiro valor de `x-forwarded-for` controla a comparação.

**Correção sugerida**
Exigir segredo/HMAC configurado no boot, rejeitar quando ausente, não aceitar segredo na query e usar endereço do socket ou proxy explicitamente confiável.

**Regra violada**
Decisão de segurança falha fechada quando configuração falta.

### [C-007] Callback confirma HTTP 200 após falha total ou parcial
- **Arquivo:** `SAGE-API/src/routes/notificationRoutes.js:15-34`; `SAGE-API/src/services/accessService.js:676-709`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Erros por item são acumulados depois de inserções parciais, mas a rota responde `ok: true`. Exceção total também responde HTTP 200 com `ok: false`.

**Evidência**
```js
const resultado = await processarNotificacaoMonitorDao(payload);
res.status(200).json({ ok: true, ...resultado });
} catch (error) {
  res.status(200).json({ ok: false, error: error.message });
}
```

**Impacto no dado**
O emissor pode considerar o lote entregue e não repetir; acessos/presenças ficam ausentes ou parcialmente gravados enquanto o protocolo sinaliza sucesso.

**Como reproduzir**
Análise estática: provocar erro após pelo menos um item inserido ou uma exceção no serviço e seguir o status retornado.

**Correção sugerida**
Definir semântica atômica/idempotente por evento, retornar status não-2xx em falha que exige retry e nunca marcar `ok: true` quando `erros` não estiver vazio.

**Regra violada**
Nunca engolir erro nem retornar sucesso após falha parcial.

### [C-008] Diagnóstico de acessos fica público quando a chave não existe e expõe amostras sensíveis
- **Arquivo:** `SAGE-API/src/app.js:103-113`; `SAGE-API/src/controllers/deviceController.js:145-177`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Em produção, a checagem só rejeita quando `DIAGNOSTICO_KEY !== undefined`; chave ausente libera a rota. Em não-produção ela é sempre pública. A resposta inclui nomes, ids de pessoas, horários e valor de credencial da catraca.

**Evidência**
```js
const key = process.env.DIAGNOSTICO_KEY;
const isDev = process.env.NODE_ENV !== 'production';
if (!isDev && key !== undefined && req.query.key !== key) {
  return res.status(401).json({ message: 'Use ?key=... (configure DIAGNOSTICO_KEY no .env)' });
}
return dispositivosController.diagnosticoAcessos(req, res);
```

**Impacto no dado**
Configuração ausente transforma diagnóstico privilegiado em fonte pública de movimentação e identificadores de acesso.

**Como reproduzir**
Análise estática com `NODE_ENV=production` e `DIAGNOSTICO_KEY` ausente.

**Correção sugerida**
Remover a rota direta ou exigir JWT + papel. Se mantida chave técnica, abortar o boot quando ausente e recebê-la somente por header.

**Regra violada**
Decisão de segurança falha fechada quando configuração falta; nunca reproduzir PII/segredo.

### [C-009] WebSocket aceita anônimos e entrega eventos de acesso/notificações globais
- **Arquivo:** `SAGE-API/src/websocket/wsServer.js:27-76`; `SAGE-API/src/controllers/accessController.js:45-60`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Conexões sem token são aceitas e podem entrar nas mesmas rooms que usuários autenticados. Eventos de acesso carregam id, nome, horário e decisão; notificações globais usam `io.emit`.

**Evidência**
```js
if (!token) {
  socket.userId = null;
  return next();
}

socket.on('subscribe:acessos', () => {
  socket.join('acessos');
});
```

**Impacto no dado**
Qualquer cliente alcançando Socket.IO pode acompanhar movimentação de pessoas em tempo real e notificações operacionais.

**Como reproduzir**
Análise estática: conectar sem `handshake.auth.token` e emitir `subscribe:acessos`.

**Correção sugerida**
Rejeitar conexão sem JWT, validar audiência/expiração, autorizar cada room por papel/unidade e filtrar payloads por escopo.

**Regra violada**
Nunca reproduzir PII; decisão de segurança falha fechada quando configuração falta.

### [C-010] Registros de presença e acesso podem ser sobrescritos ou apagados
- **Arquivo:** `SAGE-API/src/routes/presenceRoutes.js:1-5`; `SAGE-API/src/routes/genericRoutesFactory.js:20-24`; `SAGE-API/src/services/presenceService.js:152-181`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O CRUD genérico publica `DELETE /presencas/:id`, além de PATCH/DELETE em acessos. O cálculo de presença faz `UPDATE` direto do registro existente. Não há `criado_por`, justificativa nem cadeia de correção.

**Evidência**
```js
const router = gerarRotas(presenceController, 'presencas',
  { criar: false, editar: false });

await db.query(`
  UPDATE Presenca
  SET dia_semana = ?, aulas_perdidas = ?, horario_previsto = ?,
      horario_chegada = ?, atrasado = ?
  WHERE id = ?
`, [
  diaSemana,
  aulasPerdidas,
  horarioPrevistoSql,
  horarioChegadaSql,
  atrasado,
  registroExistente.id
]);
```

**Impacto no dado**
Fatos com peso escolar/trabalhista podem desaparecer ou mudar sem preservar original, ator, instante e motivo.

**Como reproduzir**
Análise estática: expandir o factory da rota de presença e seguir o ramo de registro existente do serviço.

**Correção sugerida**
Remover UPDATE/DELETE públicos de fatos legais; modelar correção append-only com referência ao original, ator e justificativa, e ler relatórios pela versão vigente.

**Regra violada**
ADR-0007 — dado com peso legal exige auditoria; toda ação relevante deve ser atribuível.

### [C-011] Endpoints apagam catraca e tabelas globais sem confirmação, backup verificado ou transação
- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:502-515`; `SAGE-API/src/controllers/deviceController.js:522-569`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`zerar-tudo` apaga o equipamento imediatamente. `comecar-do-zero` primeiro zera a catraca e depois pode executar uma sequência global de UPDATE/DELETE no SAGE, sem confirmação explícita, backup, transação ou escopo de unidade. Há inclusive catch vazio ao apagar a fila.

**Evidência**
```js
const result = await deviceService.zerarTudoNaCatraca(dispositivo);

if (apagarPessoasNoSistema) {
  await db.query('DELETE FROM Presenca');
  await db.query('DELETE FROM SolicitacaoAcesso');
  await db.query('DELETE FROM HorarioAula');
  await db.query('DELETE FROM Aula');
  await db.query('DELETE FROM Professor');
  await db.query('DELETE FROM Administrador');
  await db.query('DELETE FROM Terceirizado');
  await db.query('DELETE FROM Funcionario');
  await db.query('DELETE FROM Aluno');
  await db.query('DELETE FROM Responsavel');
  await db.query('DELETE FROM Acesso');
  try { await db.query('DELETE FROM sync_pendente'); } catch (_) {}
  const [r] = await db.query('DELETE FROM Pessoa');
}
```

**Impacto no dado**
Uma chamada autenticada pode destruir cadastros e histórico de toda a instalação. Falha intermediária deixa catraca e banco divergentes e parcialmente apagados.

**Como reproduzir**
Análise estática do POST `/dispositivos/:id/comecar-do-zero` com flags verdadeiras.

**Correção sugerida**
Exigir papel privilegiado, reautenticação e confirmação não ambígua; gerar e verificar backup restaurável antes; usar transação para a parte local, escopo de unidade e plano explícito de compensação para o equipamento externo.

**Regra violada**
Operação irreversível exige backup verificado; escrita multi-passo usa transação; nunca engolir erro; toda ação relevante deve ser atribuível.

### [C-012] CRUD genérico interpola chaves arbitrárias do corpo em SQL
- **Arquivo:** `SAGE-API/src/controllers/genericControllerFactory.js:93-126`; `SAGE-API/src/utils/generic-db-utils.js:15-38`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Criação e edição copiam todo `req.body`. As chaves viram nomes de coluna interpolados, sem allowlist ou Joi. Só os valores usam placeholders.

**Evidência**
```js
const dados = { ...req.body };
async () => crud.criarRegistro(tabela, dados)

const campos = Object.keys(dados);
const query = `INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${placeholders})`;
```

**Impacto no dado**
Clientes alteram colunas que a API não pretendia expor (inclusive ids, flags e vínculos), provocam erros SQL controlados e ampliam a superfície para injeção por identificador conforme configuração do driver.

**Como reproduzir**
Análise estática: enviar campo não documentado em qualquer CRUD5, por exemplo turma/área/escola/dispositivo.

**Correção sugerida**
Definir schemas por operação com allowlist estrita, rejeitar campos desconhecidos e construir SQL somente a partir de metadados internos.

**Regra violada**
Nunca inventar dado; decisão de segurança falha fechada quando configuração/entrada falta.

### [C-013] Upload de imagem grava em disco antes de autenticar e não limita tamanho ou tipo
- **Arquivo:** `SAGE-API/src/routes/peopleRoutes.js:11-16`; `SAGE-API/src/middlewares/uploadFoto.js:7-19`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Nas rotas de pessoa, área, foto da escola e logo, `upload.single(...)` vem antes de `autenticar`. O Multer de imagem não define `limits` nem `fileFilter` e força apenas o nome temporário a terminar em `.png`.

**Evidência**
```js
routerExtra.post('/pessoas/upload/:id',
  upload.single('foto'), autenticar, peopleController.uploadFoto);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pasta),
  filename: (req, file, cb) => cb(null, `temp_${uuidv4()}.png`)
});
module.exports = multer({ storage });
```

**Impacto no dado**
Requisições anônimas podem consumir disco e gravar conteúdo arbitrário mesmo terminando em 401; falhas/abandono deixam temporários. Conteúdo não-imagem pode depois ser servido publicamente.

**Como reproduzir**
Análise estática: multipart sem Authorization é processado pelo Multer antes do middleware JWT.

**Correção sugerida**
Autenticar/autorizar antes do upload, limitar tamanho/contagem, validar assinatura real do arquivo, decodificar/reencodar imagem e limpar temporários em todos os caminhos.

**Regra violada**
Decisão de segurança falha fechada quando configuração/identidade falta.

### [C-014] Fotos de pessoas ficam públicas em nomes previsíveis
- **Arquivo:** `SAGE-API/src/app.js:126-128`; `SAGE-API/src/services/peopleService.js:189-209`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Toda pasta de uploads é servida sem autenticação. Fotos de pessoas são renomeadas usando o id numérico previsível e armazenadas em subpasta pública.

**Evidência**
```js
app.use('/uploads', express.static(paths.uploads));

const novoNome = `pessoa_${pessoa_id}.png`;
const novoCaminho = path.join(pastaDestino, novoNome);
fs.renameSync(antigoCaminho, novoCaminho);
```

**Impacto no dado**
Fotos, inclusive de menores, podem ser enumeradas e acessadas sem sessão.

**Como reproduzir**
Análise estática: combinar o padrão de nome com a montagem pública de arquivos.

**Correção sugerida**
Servir mídia sensível por handler autenticado/autorizado, com ids não enumeráveis, escopo de unidade e cache controlado; manter somente ativos realmente públicos no static.

**Regra violada**
Nunca reproduzir PII.

### [C-015] Login não tem rate limiting e revela existência da unidade
- **Arquivo:** `SAGE-API/src/app.js:34-35`; `SAGE-API/src/controllers/schoolController.js:145-169`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O rate limiting foi removido globalmente. O login público não tem limitação própria e distingue unidade inexistente de credencial inválida.

**Evidência**
```js
// Rate limiting removido em dev para evitar 429; se precisar em prod, reativar aqui.

if (!unidade) return res.status(401).json({ message: 'Usuário não encontrado' });
if (!senhaCorreta || unidade.login !== usuario)
  return res.status(401).json({ message: 'Credenciais inválidas' });
```

**Impacto no dado**
Facilita enumeração e tentativas automatizadas contra a única credencial que concede controle administrativo total.

**Como reproduzir**
Análise estática: não há uso de `express-rate-limit` apesar da dependência instalada.

**Correção sugerida**
Aplicar limite por conta e origem, atraso progressivo, resposta uniforme e alertas; manter recuperação com bloqueio separado.

**Regra violada**
Decisão de segurança falha fechada quando configuração falta.

### [C-016] Erros internos são devolvidos ao cliente também em produção
- **Arquivo:** `SAGE-API/src/app.js:153-169`
- **Severidade:** SEV3
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O primeiro middleware global de erro inclui `err.message` em `detalhe` sem condicionar ao ambiente. Diversos controllers também devolvem `error.message` diretamente.

**Evidência**
```js
if (!res.headersSent) {
  res.status(500).json({
    error: 'Erro interno no servidor',
    detalhe: err.message,
    traceId
  });
}
```

**Impacto no dado**
Mensagens de banco, filesystem, rede ou bibliotecas revelam estrutura interna e podem conter dados do request/ambiente.

**Como reproduzir**
Análise estática: fazer qualquer middleware/handler chamar `next(err)`.

**Correção sugerida**
Responder mensagem pública estável + id de correlação; manter detalhe somente em log sanitizado, sem stack/PII/segredos.

**Regra violada**
Nunca registrar/reproduzir PII, segredo, token ou IP interno.

### [C-017] Logging HTTP registra query string, token de callback e endereço de origem
- **Arquivo:** `SAGE-API/src/app.js:75-94`; `SAGE-API/src/middlewares/monitorCallbackAuth.js:12-16`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Todas as requests são logadas com `req.originalUrl`, que inclui query string. O callback aceita token na query, e o middleware adicional registra explicitamente o endereço da origem.

**Evidência**
```js
logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);

const providedToken = req.query.token || req.headers['x-monitor-token'] || '';
logger.warn(`[MONITOR AUTH] Token inválido ou ausente (origem: ${req.ip || req.connection?.remoteAddress || '?'})`);
```

**Impacto no dado**
Segredos passados em query e endereços internos entram em logs locais/telemetria e podem ser copiados em diagnósticos ou suporte.

**Como reproduzir**
Análise estática: chamar callback ou diagnóstico usando chave na query e seguir o middleware global de logging.

**Correção sugerida**
Nunca aceitar segredo em URL; logar somente pathname normalizado, redigir headers/query e remover endereços internos ou transformá-los de forma irreversível quando indispensável.

**Regra violada**
Nunca registrar/reproduzir PII, segredo, token ou IP interno; ADR-0012 exige redação de PII na saída.

### [C-018] Escritas multi-passo deixam registros órfãos ou estado parcial
- **Arquivo:** `SAGE-API/src/services/peopleService.js:56-111`; `SAGE-API/src/controllers/funcionarioHorarioController.js:53-111`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Criar pessoa insere a base, depois subtabelas e fila em queries independentes. Salvar horário apaga tudo, insere linha a linha e depois altera Professor, também sem transação. Falha intermediária preserva apenas parte.

**Evidência**
```js
const pessoa = await criarPessoaBase({
  nome, foto, rg, cpf, telefone, email, tipo,
  unidade_id: camposExtras.unidade_id || null,
  qr_code: camposExtras.qr_code || gerarNumero8Digitos(),
  cartao_rfid: camposExtras.cartao_rfid || null,
  senha_acesso: camposExtras.senha_acesso ? await hashSenha(camposExtras.senha_acesso) : null,
  data_nascimento
});

const idPessoa = pessoa.id;
if (tiposFuncionario.includes(tipo)) {
  await criarFuncionarioBase(idPessoa, camposExtras);
}
await registrarSyncPendente(idPessoa, 'CREATE');
```

```js
await db.query('DELETE FROM FuncionarioHorario WHERE funcionario_id = ?', [funcionarioId]);
for (const h of horarios) {
  await db.query(
    `INSERT INTO FuncionarioHorario (funcionario_id, dia_semana, hora_entrada, hora_saida)
     VALUES (?, ?, ?, ?)`,
    [funcionarioId, dia, entrada, saida]
  );
}
```

**Impacto no dado**
Pode existir pessoa sem subtipo/fila, ou funcionário com grade vazia/parcial, embora a intenção fosse uma única operação lógica.

**Como reproduzir**
Análise estática: considerar falha de constraint/conexão depois da primeira escrita.

**Correção sugerida**
Usar uma conexão e transação por operação lógica, validar tudo antes de apagar e só publicar eventos/sucesso após commit.

**Regra violada**
Escrita multi-passo usa transação; nunca retornar sucesso após falha parcial.

### [C-019] Falha ao carregar rotas é engolida e o servidor continua parcial
- **Arquivo:** `SAGE-API/src/app.js:134-151`; `SAGE-API/src/app.js:172-188`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Qualquer exceção do loader é registrada, mas o boot continua. Rotas montadas antes da falha permanecem ativas. `/health` ainda responde `status: 'ok'` sem consultar `routesReady`.

**Evidência**
```js
try {
  const loadedRoutes = loadRoutes(app);
  routesReady = essentialRoutes.every((route) => loadedRoutes.includes(route));
  if (!routesReady) throw new Error('Rotas essenciais não foram carregadas');
} catch (error) {
  logger.error(`Erro ao carregar rotas: ${error.message}`);
  // Continuar mesmo com erro de rotas
}

res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  environment: process.env.NODE_ENV,
  version: process.env.API_VERSION,
  cache: redis.getStats(),
  stats: globalState.getStats(),
  connections: {
    websocket: global.io ? global.io.engine.clientsCount : 0
  }
});
```

**Impacto no dado**
O processo aceita tráfego com superfície incompleta e sinaliza saúde positiva; clientes podem executar parte de um fluxo e falhar depois, gerando estado inconsistente.

**Como reproduzir**
Análise estática: fazer um módulo de rota falhar no `require` após outros já terem sido montados.

**Correção sugerida**
Falhar o boot quando rota essencial não carrega, ou montar em estágio isolado; alinhar `/health`/`/ready` e impedir tráfego antes da prontidão.

**Regra violada**
Nunca engolir erro nem retornar sucesso após falha parcial.

### [C-020] GET de status reconfigura catracas e ignora falha da mutação
- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:30-63`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Ao verificar status, um GET chama `configurarMonitorNaCatraca` em background. A Promise não é aguardada; falha vira apenas debug e a resposta de status segue como sucesso.

**Evidência**
```js
if (sessaoValida) {
  statusDispositivos.push({ id: dispositivo.id, nome: dispositivo.nome, status: 'ONLINE' });
  deviceService.configurarMonitorNaCatraca(dispositivo).catch((err) =>
    logger.debug(`[MONITOR] Config ao listar status ${dispositivo.nome}: ${err.message}`)
  );
}
res.json(statusDispositivos);
```

**Impacto no dado**
Uma leitura causa mudança externa não atribuída; falha na configuração do callback fica invisível ao chamador e pode interromper recebimento de acessos.

**Como reproduzir**
Análise estática do GET `/dispositivos/status` com sessão válida e falha na configuração do Monitor.

**Correção sugerida**
Separar leitura de configuração, usar método mutante explícito, aguardar o resultado e retornar falha real; auditar ator e dispositivo.

**Regra violada**
Nunca engolir erro nem retornar sucesso após falha parcial; toda ação relevante deve ser atribuível.

### [C-021] Query sem limites permite paginação gigante e intervalos de relatório arbitrários
- **Arquivo:** `SAGE-API/src/controllers/genericControllerFactory.js:36-49`; `SAGE-API/src/controllers/relatorioController.js:46-82`
- **Severidade:** SEV2
- **Categoria:** desempenho
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
CRUDs aceitam `limit` sem teto/sinal e relatórios CUSTOM aceitam datas sem validar formato, ordem ou extensão. `iterarDatas` cria um array e executa consultas por dia no resumo.

**Evidência**
```js
const limit = parseInt(req.query.limit) || 50;
const offset = (page - 1) * limit;
const registros = await crud.buscarTodos(tabela, campos, limit, offset);

while (cur <= end) {
  list.push(fn(new Date(cur)));
  cur.setDate(cur.getDate() + 1);
}
```

**Impacto no dado**
Um usuário autenticado pode provocar consumo excessivo de banco, memória e CPU, afetando registro de acesso/presença no mesmo processo.

**Como reproduzir**
Análise estática: enviar `limit` muito alto ou intervalo CUSTOM de muitos anos.

**Correção sugerida**
Aplicar schemas de query, limites máximos, validação de datas/ordem e agregação SQL paginada; rate-limit endpoints pesados.

**Regra violada**
Nenhuma — é qualidade.

### [C-022] Rotas duplicadas dependem da ordem não ordenada do filesystem
- **Arquivo:** `SAGE-API/src/config/loadRoutes.js:4-16`; `SAGE-API/src/routes/materiaRoutes.js:7-14`; `SAGE-API/src/routes/subjectRoutes.js:1-5`
- **Severidade:** SEV3
- **Categoria:** manutenibilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O loader não ordena `readdirSync`. Dois módulos registram os mesmos métodos/caminhos de `/materias` com controllers e validações diferentes. Há ainda POST duplicado de `/acessos`, POST duplicado de `/foto_escolas` e montagem dupla de monitoring.

**Evidência**
```js
const files = fs.readdirSync(routesFolder);
routeFiles.forEach((file) => {
  const route = require(path.join(routesFolder, file));
  app.use('/', route);
});

router.get('/materias', autenticar, materiaController.listar);
```

```js
const router = gerarRotas(subjectController, 'materias');
```

**Impacto no dado**
O handler efetivo pode variar com ordem de diretório/plataforma; validação, formato da resposta e efeitos mudam sem alteração aparente da URL.

**Como reproduzir**
Análise estática: comparar `materiaRoutes.js` com `subjectRoutes.js` e observar que o primeiro handler que encerra a resposta vence.

**Correção sugerida**
Declarar montagem explícita e ordenada, manter uma única definição por método/caminho e adicionar teste que falhe em duplicidade de rota.

**Regra violada**
Nenhuma — é qualidade.
