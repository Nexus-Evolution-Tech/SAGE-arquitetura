# Fatia D — infraestrutura e operação

## Cobertura

Leitura estática do código atual de configuração de caminhos e logs, WebSocket e interfaces
operacionais, sanitização e bundle de suporte, readiness, jobs, backup, migrations e scripts,
além do instalador e empacotamento Windows. Foram seguidos os fluxos de boot, execução
concorrente, backup/restauração, atualização, rollback e shutdown. Evidências foram reduzidas
a trechos sem dados pessoais, credenciais, endereços de rede, nomes de instituição, dados de carga ou
configuração real.

## Consolidação com a fatia C

- **D-04 é duplicata de C-01:** mesma falha aberta do callback; D registra o efeito operacional.
- **D-16 é duplicata de C-09:** mesmo upload executado antes da autenticação.
- **D-18 é duplicata de C-17:** mesma exposição de mensagens internas.
- **D-01 sobrepõe parcialmente C-04:** C detalha as rotas de monitoring; D consolida também
  WebSocket e notificação como uma única superfície operacional anônima.

As duplicatas devem virar uma única correção por causa na consolidação geral, preservando as
duas perspectivas e sem somar o mesmo defeito duas vezes.

## Resumo

| Severidade | Quantidade | IDs |
|---|---:|---|
| SEV1 | 2 | D-09, D-10 |
| SEV2 | 11 | D-01 a D-05, D-11 a D-14, D-16, D-18 |
| SEV3 | 5 | D-06 a D-08, D-15, D-17 |
| SEV4 | 0 | — |

Total bruto da fatia: **18 achados**; três são duplicatas diretas de C e uma tem sobreposição
parcial. D-09 e D-10 permanecem SEV1 porque uma instalação/atualização parcial pode deixar a
instalação inteira parada sem operador técnico local. D-01, D-02, D-04 e D-05 são SEV2 pela
régua estrita: expõem ou perdem dado enquanto o processo pode continuar aparentemente ativo.

## Achados

### [D-01] Interfaces operacionais anônimas expõem dados pessoais

- **Arquivo e linhas:** `SAGE-API/src/websocket/wsServer.js:27-76,101-120`; `SAGE-API/src/routes/monitoringRoutes.js:13-39,97-124,155-215`; `SAGE-API/src/services/notificationService.js:23-31`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Socket sem token é aceito e pode assinar canais globais; monitoring é público e consulta
acessos/fila com identificação e horário. Notificações também podem ser emitidas globalmente.

**Evidência real sanitizada**
```js
if (!token) {
  socket.userId = null;
  return next();
}
socket.on('subscribe:acessos', () => socket.join('acessos'));
```

**Impacto no dado**
Divulga movimentação e estado operacional em tempo real, inclusive dados de menores. Não
altera o banco, mas dados já transmitidos não podem ser recolhidos retroativamente.

**Como reproduzir**
Análise estática: conectar sem token, assinar o canal e seguir `emit`/consultas até o payload.

**Direção de correção, sem código**
Exigir identidade em produção, autorizar canal/rota por papel e unidade e limitar payloads a
dados técnicos indispensáveis.

**Regra/ADR violado**
AGENTS.md 4.3 e 4.6. Sobreposição parcial com C-04.

### [D-02] Logs de produção incluem nome e QR code

- **Arquivo e linhas:** `SAGE-API/src/services/controlIdService.js:77-119`; `SAGE-API/src/services/accessService.js:393`; `SAGE-API/src/jobs/scheduledJobs.js:64-89,128-141`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Fluxos de sincronização interpolam nome de pessoa e valor de QR em `info`; outros fluxos
repetem nomes de equipamento e pessoa sem uma camada de redação no logger.

**Evidência real sanitizada**
```js
logger.info(`Iniciando criação paralela de ${novaPessoa.nome} em equipamentos\nQRCODE: ${novaPessoa.qr_code}`);
logger.debug(`[SYNC] Acesso registrado: ${pessoa.nome} (pessoa_id=${pessoa_id})`);
```

**Impacto no dado**
PII e credencial de acesso entram no stdout e nos arquivos capturados pelo serviço. Exposição
de QR pode exigir revogação/regen; logs já distribuídos precisam de tratamento seguro.

**Como reproduzir**
Análise estática: seguir criação/sincronização com nível padrão `info` até o sink do logger.

**Direção de correção, sem código**
Logar somente ids/códigos técnicos, aplicar redação central antes de qualquer transporte e
testar o build contra campos e padrões sensíveis.

**Regra/ADR violado**
AGENTS.md 4.3; ADR-0012.

### [D-03] Sanitizador não cobre segredos e identificadores dentro de texto livre

- **Arquivo e linhas:** `SAGE-API/src/services/sanitizador.js:18-27,52-76,99-105`; `SAGE-API/src/services/diagnostico.js:129-180`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Campos nomeados são redigidos, mas texto técnico permitido — inclusive mensagem e stack — só
passa por quatro regexes. Não há padrões para RG, JWT/token, QR/cartão e outros identificadores
quando embutidos numa string.

**Evidência real sanitizada**
```js
const PADROES = [
  { nome: 'cpf', re: /* padrão */ },
  { nome: 'email', re: /* padrão */ },
  { nome: 'telefone', re: /* padrão */ },
  { nome: 'caminho_foto', re: /* padrão */ }
];
```

**Impacto no dado**
Erro de driver, mensagem ou stack pode carregar PII/segredo para o bundle de suporte mesmo
quando a chave externa parece técnica. O vazamento depende do conteúdo concreto.

**Como reproduzir**
Análise estática: passar texto técnico contendo identificador não coberto a `sanitizarTexto`.

**Direção de correção, sem código**
Reduzir texto livre por allowlist/códigos estruturados, ampliar padrões defensivos e criar
testes negativos sintéticos para todas as classes proibidas.

**Regra/ADR violado**
AGENTS.md 4.3 e seção 6; ADR-0012.

### [D-04] Callback operacional falha aberto

- **Arquivo e linhas:** `SAGE-API/src/middlewares/monitorCallbackAuth.js:8-34`; `SAGE-API/src/routes/notificationRoutes.js:13-34`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Sem as configurações opcionais de token e lista de origem, o endpoint de ingestão permanece
aberto; a origem encaminhada também pode ser controlada pelo cliente.

**Evidência real sanitizada**
```js
if (token && token.length > 0) { /* valida */ }
if (whitelistRaw && whitelistRaw.trim().length > 0) { /* valida */ }
next();
```

**Impacto no dado**
Eventos falsos entram no pipeline operacional como se viessem do equipamento e podem produzir
acessos/presenças incorretos.

**Como reproduzir**
Análise estática pelo caminho em que ambas as configurações estão ausentes.

**Direção de correção, sem código**
Autenticação obrigatória e falha fechada, com segredo fora de URL e política explícita de proxy.

**Regra/ADR violado**
AGENTS.md 4.6. **Duplicata de C-01.**

### [D-05] Backup parcial pode ser tratado como backup recente e saudável

- **Arquivo e linhas:** `SAGE-API/src/services/backupBanco.js:153-205`; `SAGE-API/index.js:94-114`; `SAGE-API/src/routes/statusRoutes.js:77-99`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O dump escreve diretamente com nome final. Uma interrupção abrupta pode deixar `.sql` parcial;
`listarBackups` aceita qualquer arquivo pelo prefixo/sufixo, e boot/status usam somente data e
tamanho para escolher o “último”.

**Evidência real sanitizada**
```js
const destino = path.join(cfg.diretorio, nomeArquivo());
const saida = fsSync.createWriteStream(destino);
if (!nome.startsWith('sage-backup-') || !nome.endsWith('.sql')) continue;
```

**Impacto no dado**
Um arquivo irrestaurável pode suprimir o catch-up e criar falsa proteção contra perda. Em
desastre, dados posteriores ao último backup válido ficam sem recuperação.

**Como reproduzir**
Análise estática: encerrar o processo após criar/escrever parte do destino e depois listar.

**Direção de correção, sem código**
Escrever em nome parcial exclusivo, sincronizar/fechar, verificar por restauração, registrar o
resultado e renomear atomicamente só após sucesso.

**Regra/ADR violado**
Regra operacional “backup não verificado não é backup”; ADR-0011.

### [D-06] Backup de boot e cron podem executar concorrentemente

- **Arquivo e linhas:** `SAGE-API/index.js:94-114`; `SAGE-API/src/jobs/scheduledJobs.js:248-287`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O catch-up é disparado por `setImmediate` e o cron chama a mesma rotina; não há mutex, flag em
processo nem lock de banco que impeça duas gerações/restaurações simultâneas.

**Evidência real sanitizada**
```js
setImmediate(async () => {
  await executarBackupComVerificacao('subida');
});
return cron.schedule(cronVal, async () => {
  await executarBackupComVerificacao('agendado');
});
```

**Impacto no dado**
Duas restaurações de verificação competem por disco/banco e podem disparar retenção enquanto a
outra execução ainda trabalha. Há contorno operacional; corrupção não foi demonstrada.

**Como reproduzir**
Análise estática: alinhar o boot ao minuto do cron ou chamar a rotina duas vezes.

**Direção de correção, sem código**
Serializar por lock com validade/owner e tornar retenção consciente apenas de backups concluídos.

**Regra/ADR violado**
Nenhuma — é confiabilidade operacional.

### [D-07] `/ready` pode ficar positivo sem jobs ativos

- **Arquivo e linhas:** `SAGE-API/src/services/readinessService.js:68-107`; `SAGE-API/index.js:117-138`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Falha ao iniciar jobs é capturada e o processo continua. O readiness verifica banco, schema,
rotas, diretórios e frontend, mas não se jobs essenciais foram criados/estão vivos.

**Evidência real sanitizada**
```js
} catch (error) {
  logger.error(`Erro ao iniciar jobs: ${error.message}`);
}
ready: Object.values(checks).every(({ ok }) => ok)
```

**Impacto no dado**
A API parece pronta enquanto sincronização, health, promoção ou backup não executam. O defeito
é detectável por suporte/reinício, mas pode atrasar dado silenciosamente.

**Como reproduzir**
Análise estática: fazer `iniciarJobs` lançar e observar que os checks continuam independentes.

**Direção de correção, sem código**
Definir jobs essenciais por modo de operação, registrar seus estados e incluí-los no readiness
ou falhar o boot.

**Regra/ADR violado**
AGENTS.md 4.2 — não esconder falha operacional atrás de sucesso.

### [D-08] Jobs periódicos podem sobrepor a própria execução

- **Arquivo e linhas:** `SAGE-API/src/jobs/scheduledJobs.js:16-34,37-52,55-91,94-198,201-235`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Callbacks assíncronos de `setInterval` e cron não possuem guarda de execução. Se uma rodada
durar mais que o intervalo, outra começa sobre o mesmo dispositivo, fila ou promoção.

**Evidência real sanitizada**
```js
return setInterval(async () => {
  await accessService.sincronizarTodosAcessosMonitor();
}, MONITOR_POLLING_INTERVAL_MS);
```

**Impacto no dado**
Amplifica carga e corridas; a sincronização pode repetir trabalho e disputar ponteiros/filas.
Existem barreiras de idempotência em partes do sistema, portanto o achado fica SEV3.

**Como reproduzir**
Análise estática: fazer uma rodada exceder o intervalo configurado.

**Direção de correção, sem código**
Usar agendamento após conclusão ou mutex por job/dispositivo, com tempo máximo e métrica de
rodada omitida.

**Regra/ADR violado**
Regra de escrita idempotente na catraca; nenhuma ADR específica.

### [D-09] Instalador não possui preflight nem ledger transacional

- **Arquivo e linhas:** `SAGE-API/installer/windows/prepare-install.ps1:1-18`; `SAGE-API/installer/windows/SAGE.iss:31-69`
- **Severidade:** SEV1
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Antes de copiar, o “prepare” somente para serviços. Não verifica porta, espaço, versão do
sistema, permissões, estado/compatibilidade existente nem capacidade de rollback; também não
persiste um ledger de etapas concluídas para recuperação após queda.

**Evidência real sanitizada**
```powershell
foreach ($name in @('SAGEAPI', 'SAGEMySQL')) {
  Stop-Service -Name $name -ErrorAction Stop
}
```

**Impacto no dado**
Uma incompatibilidade descoberta depois da parada/cópia deixa toda a instalação inoperante
para uma operadora não técnica. Uma queda no meio não possui estado durável para retomar ou
reverter com segurança.

**Como reproduzir**
Análise estática: listar todas as ações anteriores à cópia; só há parada de serviços.

**Direção de correção, sem código**
Criar preflight sem escrita com todos os requisitos, ledger durável de fase/versão e rollback
idempotente testado para interrupção em cada etapa.

**Regra/ADR violado**
ADR-0013 exige preflight de porta antes de qualquer escrita; postura operacional do AGENTS.md.

### [D-10] Atualização não é assinada e sobrescreve arquivos de forma não atômica

- **Arquivo e linhas:** `SAGE-API/installer/windows/SAGE.iss:14-32,43-81`; `SAGE-API/installer/windows/build-installer.ps1:8-21`; `SAGE-API/installer/windows/complete-install.ps1:42-73`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O builder chama o compilador sem etapa de assinatura. Como atualização, o Inno copia
recursivamente para a pasta instalada com `ignoreversion`, sobrescrevendo arquivos antes da
validação final. O marcador JSON posterior não torna a cópia anterior atômica nem implementa
o canal Ed25519/junction definido pela arquitetura.

**Evidência real sanitizada**
```ini
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
```
```powershell
& $iscc '/Qp' /* defines */ (Join-Path $PSScriptRoot 'SAGE.iss')
```

**Impacto no dado**
Pacote adulterado pode executar com privilégio administrativo. Queda/falha durante overwrite
pode misturar versões e deixar API e banco indisponíveis; não há técnico local para recompor.

**Como reproduzir**
Análise estática: buscar `SignTool`/Ed25519/junction e seguir a ordem cópia → scripts → ready.

**Direção de correção, sem código**
Assinar instalador e canal; baixar/verificar em staging, manter releases lado a lado e ativar
por ponteiro atômico somente após hash, backup, migrations e readiness, com rollback automático.

**Regra/ADR violado**
ADR-0011 — pacote assinado, release lado a lado e troca atômica; AGENTS.md 4.8.

### [D-11] Script de migração derruba o banco original antes de provar restauração

- **Arquivo e linhas:** `SAGE-API/scripts/renomear-bd-para-antigo.js:52-70`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O script cria destino, faz dump/import e executa `DROP DATABASE` no original sem comparar
schema/contagens nem restaurar/verificar o dump; depois cria uma base vazia.

**Evidência real sanitizada**
```js
run(`${mysqldumpCmd()} > ${dumpQuoted}`);
run(`${mysqlCmd(DB_ANTIGO)} < ${dumpQuoted}`);
run(`${mysqlCmd()} -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;"`);
```

**Impacto no dado**
Importação truncada mas aceita pode substituir o único banco íntegro. A perda exige restaurar
backup externo e pode afetar folha/presença.

**Como reproduzir**
Análise estática: seguir a sequência e confirmar ausência de verificação antes do DROP.

**Direção de correção, sem código**
Proibir uso em produção, exigir confirmação de alvo e backup restaurado/verificado, comparar
integridade e realizar troca com plano de rollback explícito.

**Regra/ADR violado**
Regra “backup não verificado não é backup”; ADR-0011.

### [D-12] Distribuição e supervisão do MySQL dependem de pendências arquiteturais

- **Arquivo e linhas:** `SAGE-API/installer/windows/artifacts.json:23-32`; `SAGE-API/installer/windows/initialize-mysql.ps1:242-245`; `SAGE-API/installer/windows/SAGE-MySQL.xml.template:1-18`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
A implementação embute o runtime, usa porta dedicada diferente da decisão original e cria
serviço Windows. O próprio manifesto mantém verificação de assinatura e revisão de
redistribuição como pendentes; a colisão da porta é descoberta tarde porque falta D-09.

**Evidência real sanitizada**
```json
"signatureVerification": "pending",
"redistribution": "legal-review-required"
```
```powershell
'--port=3307'
```

**Impacto no dado**
Colisão/impedimento de distribuição pode bloquear instalação e suporte; divergência de
supervisão afeta shutdown e recuperação. Não há corrupção comprovada por si só.

**Como reproduzir**
Análise estática: comparar manifesto, bootstrap e template com ADR-0001 e sua superação.

**Direção de correção, sem código**
Fechar revisão jurídica/assinatura antes de distribuição, implementar o preflight obrigatório
e manter documentação, testes e instalador alinhados à decisão vigente.

**Regra/ADR violado**
ADR-0001 foi contrariado; ADR-0013 o supera, mas mantém preflight e revisão de distribuição
como pendências explícitas.

### [D-13] Falha ao encerrar MySQL é engolida no cleanup

- **Arquivo e linhas:** `SAGE-API/installer/windows/initialize-mysql.ps1:235-260`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
No `finally`, falha de `mysqladmin shutdown`/espera do processo é capturada por bloco vazio; o
script continua removendo temporários e libera o mutex sem registrar que o engine ficou vivo.

**Evidência real sanitizada**
```powershell
if ($null -ne $server -and -not $server.HasExited) {
  try { Stop-Root $rootClient $server } catch { }
}
```

**Impacto no dado**
O instalador pode prosseguir sobre processo em estado desconhecido; parada posterior forçada ou
conflito de arquivos aumenta risco de corrupção do InnoDB.

**Como reproduzir**
Análise estática: fazer `Stop-Root` lançar dentro do `finally`.

**Direção de correção, sem código**
Registrar e propagar falha de shutdown, preservar artefatos necessários ao diagnóstico e
impedir qualquer etapa destrutiva/ativação enquanto o processo não tiver encerrado.

**Regra/ADR violado**
AGENTS.md 4.2; ADR-0013 exige encerramento seguro do serviço.

### [D-14] Ausência de `SAGE_DATA_DIR` coloca estado dentro do release

- **Arquivo e linhas:** `SAGE-API/src/config/paths.js:5-25`; `SAGE-API/src/app.js:115-120`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Sem configuração, `dataRoot` vira `appRoot`, uploads vão para `src/uploads` e backups/exports/
logs ficam na árvore de código. Falha ao criar diretórios é apenas warning e o boot continua.

**Evidência real sanitizada**
```js
const dataRoot = configuredDataDir || appRoot;
uploads: configuredDataDir ? path.join(dataRoot, 'uploads') : path.join(appRoot, 'src', 'uploads')
```

**Impacto no dado**
Atualização, limpeza ou rollback do release pode apagar fotos, planilhas, exports e backups. É
necessário inventariar instalações existentes antes de mover dados.

**Como reproduzir**
Análise estática: avaliar `paths` com a variável ausente.

**Direção de correção, sem código**
Exigir raiz de dados absoluta em produção, falhar o boot quando ausente/inacessível e migrar
estado legado com cópia verificada e rollback.

**Regra/ADR violado**
AGENTS.md 4.8; ADR-0011 — atualização nunca toca dados/config/logs.

### [D-15] Toolchain de build não é completamente reproduzível

- **Arquivo e linhas:** `SAGE-API/installer/windows/build-release.ps1:53-59,93-113`; `SAGE-API/installer/windows/build-installer.ps1:8-21`; `SAGE-API/package.json:19-46`
- **Severidade:** SEV3
- **Categoria:** manutenibilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Dependências npm são instaladas pelo lock, mas o builder fixa apenas a versão major do Node e
aceita qualquer compilador encontrado nos caminhos conhecidos; versão de npm/compilador não é
validada nem gravada no manifesto. O package ainda contém várias faixas com `^`.

**Evidência real sanitizada**
```powershell
if ($runtime.major -ne 24) { throw 'Builder exige Node 24' }
$iscc = @(/* caminhos conhecidos */) | Select-Object -First 1
```

**Impacto no dado**
Dois builds do mesmo commit podem divergir e dificultar diagnóstico/rollback. Não há perda de
dado demonstrada; o contorno é reconstruir no ambiente original.

**Como reproduzir**
Análise estática: executar com versões minor/patch diferentes aceitas pelos checks.

**Direção de correção, sem código**
Fixar e registrar toolchain completa, produzir em ambiente imutável, comparar hashes e publicar
proveniência do artefato.

**Regra/ADR violado**
ADR-0004 — runtime congelado; nenhuma regra adicional para estilo de dependência.

### [D-16] Upload consome disco antes da autenticação

- **Arquivo e linhas:** `SAGE-API/src/routes/peopleRoutes.js:11-16`; `SAGE-API/src/middlewares/uploadFoto.js:7-19`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O parser multipart com armazenamento em disco vem antes de `autenticar` e não possui limite
nem filtro de conteúdo.

**Evidência real sanitizada**
```js
routerExtra.post('/pessoas/upload/:id', upload.single('foto'), autenticar, handler);
```

**Impacto no dado**
Requisição anônima pode esgotar o volume compartilhado por aplicação e banco, interrompendo
registro de acesso/presença.

**Como reproduzir**
Análise estática: enviar multipart grande sem token e acompanhar a ordem dos middlewares.

**Direção de correção, sem código**
Autenticar antes do corpo, impor limites e limpeza garantida e validar conteúdo real.

**Regra/ADR violado**
AGENTS.md 4.6. **Duplicata de C-09.**

### [D-17] Observabilidade perde stack/metadata e o bundle omite evidência operacional

- **Arquivo e linhas:** `SAGE-API/src/config/logger.js:24-57`; `SAGE-API/src/services/diagnostico.js:103-180`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O `printf` serializa apenas mensagem; stack e metadata passadas por `errorWithStack` não entram
na linha. O bundle reúne snapshot/configuração sanitizada, mas não inclui trechos rotacionados,
estado dos jobs, ledger de instalação/migration ou histórico de readiness.

**Evidência real sanitizada**
```js
(info) => `${info.timestamp} ${info.level}: ${info.message}`
logger.error(`${message}: ${error.message}`, { stack: error.stack, ...error });
```

**Impacto no dado**
Não corrompe registro diretamente, mas prolonga falhas remotas e impede distinguir causa e
extensão de incidentes sem nova coleta presencial.

**Como reproduzir**
Análise estática: passar um `Error` ao helper e aplicar o formatter; inspecionar as seções do
bundle.

**Direção de correção, sem código**
Adotar log estruturado sanitizado com rotação/teto e incluir no bundle somente evidências
allowlisted, estados de jobs/versão/migrations e códigos de falha.

**Regra/ADR violado**
AGENTS.md 4.2 e 4.3; ADR-0012.

### [D-18] Mensagem interna atravessa respostas operacionais

- **Arquivo e linhas:** `SAGE-API/src/app.js:153-169`; `SAGE-API/src/routes/statusRoutes.js:134-149`; `SAGE-API/src/routes/monitoringRoutes.js:35-37,120-122`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Handlers operacionais e middleware global devolvem a mensagem bruta de exceções, sem redação e
sem restrição ao ambiente de desenvolvimento.

**Evidência real sanitizada**
```js
return res.status(500).json({
  message: 'Não foi possível concluir a operação.',
  detalhe: erro.message
});
```

**Impacto no dado**
Erros podem revelar caminhos, SQL, configuração e valores de request. Não há alteração direta,
mas o vazamento pode incluir PII/segredo e ampliar ataques.

**Como reproduzir**
Análise estática: provocar exceção em rota operacional e seguir o JSON de erro.

**Direção de correção, sem código**
Responder código público e correlação; manter detalhe somente em log estruturado e sanitizado.

**Regra/ADR violado**
AGENTS.md 4.3; ADR-0012. **Duplicata de C-17.**
