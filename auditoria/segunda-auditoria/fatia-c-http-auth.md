# Fatia C — HTTP, autenticação e autorização

## Cobertura

Leitura estática do código atual de `SAGE-API/src/routes/**`, `src/controllers/**`,
`src/middlewares/**`, `src/config/loadRoutes.js` e `src/app.js`, seguindo cada rota até o
serviço ou utilitário que executa a operação. A revisão cobriu autenticação, autorização por
papel e unidade, callbacks, uploads, arquivos estáticos, validação, SQL construído a partir da
requisição, tratamento de erro e colisões de montagem. Evidências abaixo foram reduzidas a
trechos sem dados pessoais, credenciais, endereços de rede ou configuração real.

## Resumo

| Severidade | Quantidade | IDs |
|---|---:|---|
| SEV1 | 1 | C-14 |
| SEV2 | 16 | C-01 a C-17, exceto C-14 |
| SEV3 | 4 | C-18 a C-21 |
| SEV4 | 0 | — |

Total: **21 achados**. A única SEV1 é a requisição capaz de esvaziar o equipamento e a
base. Callback forjado, falha que perde eventos, exposição de dados, ausência de autorização,
SQL por chaves do JSON e alteração/destruição de registros são SEV2. Falha operacional com
contorno, colisão de rotas, montagem duplicada e consultas sem teto são SEV3.

## Achados

### [C-01] Callback falha aberto e confia em `X-Forwarded-For`

- **Arquivo e linhas:** `SAGE-API/src/middlewares/monitorCallbackAuth.js:8-34`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Sem token e sem lista de origem configurados, a requisição sempre chega ao handler. Quando
existe apenas a lista, o primeiro valor de um header fornecido pelo cliente decide a origem.

**Evidência real sanitizada**
```js
if (token && token.length > 0) { /* valida somente se configurado */ }
const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
next();
```

**Impacto no dado**
Um callback forjado pode criar acessos e presenças falsos. O histórico pode já ter recebido
eventos não autênticos se a interface esteve alcançável nessa configuração.

**Como reproduzir**
Análise estática: seguir o caminho sem as duas configurações; não há ramo de rejeição.

**Direção de correção, sem código**
Exigir autenticação criptográfica no boot, falhar fechado e confiar em origem encaminhada
somente quando houver proxy explicitamente configurado.

**Regra/ADR violado**
AGENTS.md 4.6 — decisão de segurança falha fechada.

### [C-02] Callback devolve HTTP 200 após falha total ou parcial

- **Arquivo e linhas:** `SAGE-API/src/routes/notificationRoutes.js:15-34`; `SAGE-API/src/services/accessService.js:676-709`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Erros por item convivem com `ok: true`; exceção total também recebe status HTTP de sucesso.

**Evidência real sanitizada**
```js
res.status(200).json({ ok: true, ...resultado });
} catch (error) {
  res.status(200).json({ ok: false, error: error.message });
}
```

**Impacto no dado**
O emissor pode confirmar o lote e não reenviá-lo. Acessos e presenças ficam ausentes ou
parciais, com possível necessidade de reconstrução a partir do equipamento.

**Como reproduzir**
Análise estática: causar falha em um item ou exceção no serviço e observar o status 200.

**Direção de correção, sem código**
Definir confirmação idempotente por evento e responder falha quando houver necessidade de
reenvio; sucesso só depois de persistência completa.

**Regra/ADR violado**
AGENTS.md 4.2 — nunca engolir erro nem reportar sucesso parcial.

### [C-03] `GET /escolas` público devolve hash e dados de contato

- **Arquivo e linhas:** `SAGE-API/src/routes/schoolRoutes.js:7-15`; `SAGE-API/src/controllers/schoolController.js:13-17`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
A listagem é explicitamente pública e o controller genérico seleciona inclusive a coluna de
senha e os campos cadastrais/de contato.

**Evidência real sanitizada**
```js
const campos = ['id', 'nome', /* ... */, 'login', 'senha', /* contatos ... */];
autenticarReqs: { listar: false, criar: true }
```

**Impacto no dado**
Expõe dados cadastrais e material para ataque offline à autenticação. Não altera o banco, mas
o vazamento exige troca de credencial se a rota já foi acessada por terceiro.

**Como reproduzir**
Análise estática: seguir a listagem pública até `buscarTodos` usando `campos`.

**Direção de correção, sem código**
Retirar credenciais de todo DTO e restringir a seleção pública a identificadores mínimos, se
a listagem pública for realmente necessária.

**Regra/ADR violado**
AGENTS.md 4.3 e 4.6 — não expor dado pessoal/segredo; segurança falha fechada.

### [C-04] Monitoramento público expõe movimentação e permite limpar cache

- **Arquivo e linhas:** `SAGE-API/src/app.js:97-100`; `SAGE-API/src/routes/monitoringRoutes.js:13-39,111-123,155-215`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O router é montado sem autenticação. Ele consulta acessos recentes com identificação e
horário, expõe fila operacional e oferece um POST de limpeza de cache sem guarda.

**Evidência real sanitizada**
```js
app.use('/monitoring', monitoringRoutes);
router.post('/monitoring/cache/clear', async (req, res) => {
  await redis.flush();
});
```

**Impacto no dado**
Divulga movimentação de pessoas e permite degradação operacional. A limpeza não apaga o
banco, mas pode servir estado transitório inconsistente e facilitar abuso repetido.

**Como reproduzir**
Análise estática: percorrer a montagem e confirmar ausência de middleware antes dos handlers.

**Direção de correção, sem código**
Separar health mínimo de diagnóstico; exigir identidade, papel e escopo de unidade para
consultas sensíveis e mutações.

**Regra/ADR violado**
AGENTS.md 4.3 e princípio de atribuição de ações relevantes.

### [C-05] Diagnóstico privilegiado falha aberto quando a chave não existe

- **Arquivo e linhas:** `SAGE-API/src/app.js:103-113`; `SAGE-API/src/controllers/deviceController.js:145-177`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Em produção, a rota só rejeita se a chave estiver definida; ausência de configuração libera o
diagnóstico, cuja resposta contém amostras de acesso e dados técnicos sensíveis.

**Evidência real sanitizada**
```js
if (!isDev && key !== undefined && req.query.key !== key) {
  return res.status(401).json({ message: 'Acesso negado' });
}
return dispositivosController.diagnosticoAcessos(req, res);
```

**Impacto no dado**
Configuração ausente converte uma ferramenta privilegiada em fonte pública de dados de
movimentação e equipamento. É vazamento, sem alteração direta do banco.

**Como reproduzir**
Análise estática com ambiente de produção e chave ausente.

**Direção de correção, sem código**
Exigir JWT e papel operacional; qualquer chave técnica adicional deve ser obrigatória e nunca
trafegar em URL.

**Regra/ADR violado**
AGENTS.md 4.6 — decisão de segurança falha fechada.

### [C-06] Não há identidade de operador nem autorização por perfil

- **Arquivo e linhas:** `SAGE-API/src/controllers/schoolController.js:145-169`; `SAGE-API/src/middlewares/autenticar.js:5-15`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O JWT identifica somente a unidade. O único middleware valida o token e não existe papel,
permissão ou ator individual para ações críticas.

**Evidência real sanitizada**
```js
const token = gerarToken({ id: unidade.id, nome: unidade.nome });
req.user = verificarToken(tokenRecebido);
next();
```

**Impacto no dado**
Qualquer portador do token possui capacidade administrativa ampla; aprovações, alterações e
exclusões não são atribuíveis a uma pessoa. Correção retroativa de autoria é inviável sem
outra fonte.

**Como reproduzir**
Análise estática: buscar middlewares de papel/permissão e usos de identidade individual.

**Direção de correção, sem código**
Modelar operador individual, papéis e permissões no servidor, negar por padrão e persistir
ator, instante e motivo em ações relevantes.

**Regra/ADR violado**
AGENTS.md — toda ação relevante deve ser atribuível; ADR-0007.

### [C-07] Token de uma unidade lê e altera dados de outra unidade

- **Arquivo e linhas:** `SAGE-API/src/controllers/peopleController.js:16-23`; `SAGE-API/src/controllers/genericControllerFactory.js:70-86,116-147`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Listagens e CRUDs usam ids globais sem combinar `req.user.id` com `unidade_id`; corpos podem
trazer vínculos arbitrários.

**Evidência real sanitizada**
```js
const pessoas = await buscarTodasPessoas(limit, offset);
const id = req.params.id;
const result = await crud.buscarPorId(id, tabela, campos);
```

**Impacto no dado**
Numa instalação multiunidade, um token acessa PII e modifica registros fora do próprio
escopo. Pode haver corrupção cruzada que demanda auditoria e restauração seletiva.

**Como reproduzir**
Análise estática: seguir uma rota por id e observar que o predicado não inclui unidade.

**Direção de correção, sem código**
Aplicar escopo no repositório/serviço, ignorar `unidade_id` do cliente e testar IDOR em todas
as rotas de leitura e escrita.

**Regra/ADR violado**
AGENTS.md 4.6 — segurança falha fechada.

### [C-08] Chaves arbitrárias do JSON são interpoladas em SQL

- **Arquivo e linhas:** `SAGE-API/src/controllers/genericControllerFactory.js:93-131`; `SAGE-API/src/utils/generic-db-utils.js:15-38`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Criação e edição encaminham o corpo inteiro; nomes das chaves viram identificadores SQL sem
allowlist. Apenas valores recebem placeholders.

**Evidência real sanitizada**
```js
const campos = Object.keys(dados);
const query = `INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${placeholders})`;
```

**Impacto no dado**
Permite alterar colunas não expostas pelo contrato, provocar SQL controlado e abre superfície
de injeção por identificador. Registros podem ser corrompidos silenciosamente.

**Como reproduzir**
Análise estática: enviar a um CRUD genérico uma chave não documentada ou sintaxe de
identificador.

**Direção de correção, sem código**
Definir schema e allowlist por operação, rejeitar campos desconhecidos e montar SQL somente
com metadados internos.

**Regra/ADR violado**
AGENTS.md 4.6; regra de validação estrita de entrada.

### [C-09] Upload grava antes de autenticar e não limita tamanho ou tipo

- **Arquivo e linhas:** `SAGE-API/src/routes/peopleRoutes.js:11-16`; `SAGE-API/src/middlewares/uploadFoto.js:7-19`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O Multer executa antes do middleware de autenticação. O upload de imagem não possui limite nem
filtro de conteúdo e renomeia qualquer entrada com extensão de imagem.

**Evidência real sanitizada**
```js
routerExtra.post('/pessoas/upload/:id', upload.single('foto'), autenticar, handler);
module.exports = multer({ storage });
```

**Impacto no dado**
Cliente anônimo pode encher o disco e persistir conteúdo arbitrário antes de receber 401,
parando API, banco e registro de presença na mesma máquina.

**Como reproduzir**
Análise estática: enviar multipart grande sem credencial e seguir a ordem dos middlewares.

**Direção de correção, sem código**
Autenticar e autorizar antes de ler o corpo; impor limites, validar assinatura do formato,
reencodar imagens e limpar temporários em todo caminho.

**Regra/ADR violado**
AGENTS.md 4.6 — segurança falha fechada.

### [C-10] Caminho persistido permite apagar arquivo fora de uploads

- **Arquivo e linhas:** `SAGE-API/src/services/peopleService.js:189-196,232-256`; `SAGE-API/src/controllers/peopleController.js:132-150`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O caminho de foto vem do banco e é unido à raiz sem teste de contenção antes de `unlinkSync`.
O fluxo de edição aceita campos de pessoa, permitindo persistir referência manipulada.

**Evidência real sanitizada**
```js
const caminhoFoto = path.join(baseUploads, pessoa[0].foto);
if (fs.existsSync(caminhoFoto)) fs.unlinkSync(caminhoFoto);
```

**Impacto no dado**
Uma referência com segmentos de subida pode apagar arquivo acessível ao processo fora da pasta
de mídia. Configuração, release ou dado operacional pode ser perdido.

**Como reproduzir**
Análise estática: persistir caminho relativo com subida e acionar remoção/substituição de foto.

**Direção de correção, sem código**
Persistir apenas identificadores gerados no servidor, resolver caminho canônico e recusar
qualquer alvo fora da raiz permitida.

**Regra/ADR violado**
AGENTS.md 4.6 e 4.8; atualização/arquivos de dado devem respeitar fronteiras explícitas.

### [C-11] `/uploads` público expõe fotos previsíveis e planilhas retidas

- **Arquivo e linhas:** `SAGE-API/src/app.js:126-128`; `SAGE-API/src/services/peopleService.js:199-209`; `SAGE-API/src/routes/dataRoutes.js:13-35,59-85`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Toda a raiz de uploads é estática e anônima. Fotos usam id previsível; planilhas importadas e
as enviadas ao endpoint de teste ficam na mesma raiz, sem remoção após sucesso ou falha.

**Evidência real sanitizada**
```js
app.use('/uploads', express.static(paths.uploads));
const novoNome = `pessoa_${pessoa_id}.png`;
const filePath = req.file?.path;
const resultado = await importarPlanilha(filePath, unidadeIdDefault);
```

**Impacto no dado**
Fotos e planilhas com dados pessoais podem ser enumeradas ou descobertas sem sessão. Arquivos
já retidos exigem inventário e descarte seguro, além da correção futura.

**Como reproduzir**
Análise estática: combinar os nomes/destino com o static e observar ausência de `unlink` nas
rotas de importação e ping.

**Direção de correção, sem código**
Separar mídia pública de arquivos privados, servir privados por handler autorizado, usar nomes
opacos e aplicar descarte garantido e retenção documentada.

**Regra/ADR violado**
AGENTS.md 4.3 — nunca expor dado pessoal.

### [C-12] Acesso e presença aceitam sobrescrita e exclusão

- **Arquivo e linhas:** `SAGE-API/src/routes/presenceRoutes.js:1-5`; `SAGE-API/src/routes/genericRoutesFactory.js:20-24`; `SAGE-API/src/services/presenceService.js:152-181`; `SAGE-API/src/controllers/accessController.js:10-13`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Factories publicam PATCH/DELETE para fatos de acesso/presença, e o cálculo de presença atualiza
o registro existente sem cadeia de correção, ator ou justificativa.

**Evidência real sanitizada**
```js
router.patch(`/${nomeRota}/:id`, autenticar, controller.editar);
router.delete(`/${nomeRota}/:id`, autenticar, controller.remover);
await db.query(`UPDATE Presenca SET /* campos */ WHERE id = ?`, valores);
```

**Impacto no dado**
Fatos que alimentam folha de ponto e presença podem mudar ou desaparecer sem trilha. Pode exigir
reconstrução retroativa a partir de logs externos, se ainda existirem.

**Como reproduzir**
Análise estática: expandir as rotas genéricas e seguir o ramo de presença existente.

**Direção de correção, sem código**
Tornar fatos append-only e representar correção como novo evento ligado ao original, com ator,
instante, motivo e leitura da versão vigente.

**Regra/ADR violado**
ADR-0007 — dado com peso legal exige auditoria e preservação do original.

### [C-13] Escritas HTTP multi-etapa não usam transação

- **Arquivo e linhas:** `SAGE-API/src/services/peopleService.js:56-111`; `SAGE-API/src/controllers/funcionarioHorarioController.js:53-111`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Criação completa de pessoa grava base, subtipo e fila em queries separadas. Salvamento de
horário apaga a grade, reinsere linha a linha e altera outro registro, sem transação comum.

**Evidência real sanitizada**
```js
const pessoa = await criarPessoaBase(dados);
await criarFuncionarioBase(pessoa.id, extras);
await registrarSyncPendente(pessoa.id, 'CREATE');
```

**Impacto no dado**
Falha intermediária deixa pessoa sem subtipo/fila ou grade vazia/parcial. O estado pode já ter
sido corrompido e requer reconciliação entre tabelas.

**Como reproduzir**
Análise estática: provocar falha de constraint/conexão depois da primeira escrita.

**Direção de correção, sem código**
Validar antes de escrever e executar cada operação lógica numa única conexão/transação; emitir
efeitos externos apenas após commit.

**Regra/ADR violado**
AGENTS.md 4.7 — escrita multi-passo usa transação.

### [C-14] Uma requisição pode zerar catraca e base inteira

- **Arquivo e linhas:** `SAGE-API/src/routes/deviceRoutes.js:20-28`; `SAGE-API/src/controllers/deviceController.js:502-569`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Rotas protegidas apenas pelo JWT amplo executam destruição imediata no equipamento. O fluxo
“começar do zero” pode depois apagar em sequência tabelas globais, sem transação, backup
restaurado, confirmação forte ou escopo de unidade.

**Evidência real sanitizada**
```js
await deviceService.zerarTudoNaCatraca(dispositivo);
await db.query('DELETE FROM Presenca');
await db.query('DELETE FROM Acesso');
await db.query('DELETE FROM Pessoa');
```

**Impacto no dado**
Uma chamada pode deixar a catraca sem cadastros e destruir o histórico/cadastro de toda a
instalação, parando a operação. Falha no meio produz divergência irreversível entre hardware e
banco; recuperação depende de backup realmente restaurável.

**Como reproduzir**
Análise estática do POST de reinicialização com as opções destrutivas habilitadas.

**Direção de correção, sem código**
Exigir papel privilegiado, reautenticação e confirmação não ambígua; verificar restauração de
backup antes; transacionar a parte local e prever compensação do equipamento.

**Regra/ADR violado**
AGENTS.md 4.2, 4.7 e armadilha `destroy_objects` — operação irreversível exige backup verificado.

### [C-15] Token e chave em query entram nos logs de requisição

- **Arquivo e linhas:** `SAGE-API/src/app.js:75-94`; `SAGE-API/src/middlewares/monitorCallbackAuth.js:12-16`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O logger usa a URL original, que contém query string; callback e diagnóstico aceitam segredo
na query. A origem da requisição também é registrada.

**Evidência real sanitizada**
```js
logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
const providedToken = req.query.token || req.headers['x-monitor-token'] || '';
```

**Impacto no dado**
Credenciais técnicas e dados de rede ficam em stdout/arquivos do serviço e podem seguir para
suporte. Segredos expostos precisam ser revogados, não apenas apagados do log.

**Como reproduzir**
Análise estática: enviar a credencial pela query e seguir o middleware global.

**Direção de correção, sem código**
Aceitar segredo apenas em header apropriado; logar pathname normalizado e aplicar redação
central a URL, headers e mensagens.

**Regra/ADR violado**
AGENTS.md 4.3 e 4.4; ADR-0012.

### [C-16] Login não tem rate limit e enumera unidade

- **Arquivo e linhas:** `SAGE-API/src/app.js:34-35`; `SAGE-API/src/controllers/schoolController.js:145-169`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Não há limitador global nem específico no login, e respostas distintas separam unidade
inexistente de credencial inválida.

**Evidência real sanitizada**
```js
if (!unidade) return res.status(401).json({ message: 'Usuário não encontrado' });
if (!senhaCorreta || unidade.login !== usuario)
  return res.status(401).json({ message: 'Credenciais inválidas' });
```

**Impacto no dado**
Facilita enumeração e força bruta contra a credencial que concede o amplo acesso descrito em
C-06. Comprometimento permite leitura e corrupção de dados.

**Como reproduzir**
Análise estática: comparar respostas e buscar uso efetivo do pacote de rate limiting.

**Direção de correção, sem código**
Aplicar limite por conta e origem, atraso progressivo, resposta uniforme e alerta sem bloquear
legitimamente toda a escola.

**Regra/ADR violado**
AGENTS.md 4.6 — segurança falha fechada.

### [C-17] Erros internos são expostos ao cliente

- **Arquivo e linhas:** `SAGE-API/src/app.js:153-169`; `SAGE-API/src/controllers/schoolController.js:170-172`; `SAGE-API/src/routes/statusRoutes.js:134-149`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O middleware global e vários handlers devolvem `error.message` sem condição de ambiente; uma
rota chega a devolver detalhe do erro do bundle.

**Evidência real sanitizada**
```js
res.status(500).json({
  error: 'Erro interno no servidor',
  detalhe: err.message,
  traceId
});
```

**Impacto no dado**
Mensagens de banco, filesystem e rede podem revelar estrutura, consultas e valores do request.
É exposição, não corrupção direta.

**Como reproduzir**
Análise estática: lançar erro em middleware/controller e observar a resposta 500.

**Direção de correção, sem código**
Responder código público estável e id de correlação; manter detalhe somente em log sanitizado.

**Regra/ADR violado**
AGENTS.md 4.3; ADR-0012. Duplicata transversal de D-18.

### [C-18] Falha de rota não impede boot nem saúde positiva

- **Arquivo e linhas:** `SAGE-API/src/app.js:134-151,172-206`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Exceção no loader é registrada, mas o servidor continua com rotas parciais; `/health` não usa
`routesReady` e segue respondendo `ok`.

**Evidência real sanitizada**
```js
} catch (error) {
  logger.error(`Erro ao carregar rotas: ${error.message}`);
  // Continuar mesmo com erro de rotas
}
res.json({ status: 'ok', /* ... */ });
```

**Impacto no dado**
Fluxos multi-request podem completar só a primeira etapa e falhar depois. Há contorno por
reinício/diagnóstico, mas o monitoramento mascara a causa.

**Como reproduzir**
Análise estática: fazer um módulo de rota falhar depois de outros já montados.

**Direção de correção, sem código**
Falhar o boot quando rota essencial não carrega e alinhar health/readiness ao estado real.

**Regra/ADR violado**
AGENTS.md 4.2 — nunca engolir erro nem sinalizar sucesso parcial.

### [C-19] Rotas de matérias colidem conforme ordem do filesystem

- **Arquivo e linhas:** `SAGE-API/src/config/loadRoutes.js:4-16`; `SAGE-API/src/routes/materiaRoutes.js:7-14`; `SAGE-API/src/routes/subjectRoutes.js:1-5`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O loader não ordena `readdirSync`; dois módulos registram os mesmos métodos/caminhos de
`/materias` com controllers e validações diferentes. O primeiro montado vence.

**Evidência real sanitizada**
```js
const files = fs.readdirSync(routesFolder);
routeFiles.forEach((file) => app.use('/', require(path.join(routesFolder, file))));
```

**Impacto no dado**
Comportamento varia entre filesystem/empacotamento; uma implementação inesperada pode aceitar
ou rejeitar alterações. O contorno é reiniciar/ajustar implantação, sem corrupção demonstrada.

**Como reproduzir**
Análise estática: inverter a ordem dos dois arquivos e observar qual handler responde.

**Direção de correção, sem código**
Manter uma única definição por rota, declarar ordem determinística e reprovar duplicatas no
boot/teste.

**Regra/ADR violado**
Nenhuma — é confiabilidade.

### [C-20] Router de monitoramento é montado duas vezes com URLs diferentes

- **Arquivo e linhas:** `SAGE-API/src/app.js:97-100`; `SAGE-API/src/config/loadRoutes.js:4-16`; `SAGE-API/src/routes/monitoringRoutes.js:13-215`
- **Severidade:** SEV3
- **Categoria:** manutenibilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`app.js` monta o módulo sob `/monitoring`, e o loader automático volta a montá-lo em `/`.
Como o próprio router já contém caminhos com `/monitoring`, surgem aliases e prefixos duplos.

**Evidência real sanitizada**
```js
app.use('/monitoring', monitoringRoutes);
// loadRoutes inclui todo arquivo terminado em Routes.js
app.use('/', route);
```

**Impacto no dado**
Amplia a superfície anônima de C-04 e torna proteção futura fácil de aplicar em apenas um alias.
O defeito isolado tem contorno e não corrompe registro.

**Como reproduzir**
Análise estática: concatenar prefixo de montagem e caminhos internos nas duas montagens.

**Direção de correção, sem código**
Escolher uma única montagem explícita e testar inventário de rotas por método/caminho.

**Regra/ADR violado**
Nenhuma — é manutenibilidade e defesa em profundidade.

### [C-21] Paginação e intervalos de relatório não têm teto

- **Arquivo e linhas:** `SAGE-API/src/controllers/genericControllerFactory.js:36-49`; `SAGE-API/src/controllers/relatorioController.js:46-82`
- **Severidade:** SEV3
- **Categoria:** desempenho
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
CRUDs aceitam `limit` sem máximo e relatórios customizados aceitam datas sem limitar ordem ou
extensão; a implementação materializa dias e executa trabalho proporcional ao intervalo.

**Evidência real sanitizada**
```js
const limit = parseInt(req.query.limit) || 50;
while (cur <= end) {
  list.push(fn(new Date(cur)));
  cur.setDate(cur.getDate() + 1);
}
```

**Impacto no dado**
Uma consulta autenticada pode consumir banco, memória e CPU e atrasar registros. Há contorno
por cancelamento/reinício; não foi demonstrada perda persistente.

**Como reproduzir**
Análise estática: usar limite muito alto ou intervalo de muitos anos.

**Direção de correção, sem código**
Validar query, impor máximos, paginar/agregar no banco e limitar endpoints caros.

**Regra/ADR violado**
Nenhuma — é desempenho e confiabilidade.

