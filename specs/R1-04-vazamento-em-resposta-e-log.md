# R1-04 — Vazamento em resposta e em log

> Especificação do arquiteto. O implementador executa; não decide arquitetura.
> Dúvida sobre algo aqui: abra issue de decisão e **pare**.
>
> Contexto obrigatório: `specs/R1-usuarios-e-autorizacao.md` (§4 inteira — a barreira de
> autorização é o modelo que esta spec copia), `repo/AGENTS.md` §4.3 e §4.6,
> ADR-0010, ADR-0012, `auditoria/fatia-a-dados.md`, `auditoria/fatia-c-http-auth.md`,
> `auditoria/segunda-auditoria/fatia-c-http-auth.md`.

**Achados cobertos:** `[C-001]` `[C-016]` `[C-017]` `[C-019]` `[A-001]` `[A-002]` `[+2A-C10]`

---

## 1. O problema

A R1-02 fechou **quem pode chamar**. Esta release fecha **o que sai** depois que a chamada
foi legitimamente autorizada. São dois controles distintos, e o segundo não é consequência
do primeiro: `GET /escolas` hoje exige `ADMINISTRADOR` e **ainda assim devolve o hash bcrypt
da senha**, porque a lista de colunas que o controller projeta é a mesma lista de colunas que
a tabela tem.

Os sete achados são um mecanismo só, visto de dois lados:

**Saída sem lista.** Nada declara o que pode aparecer numa resposta ou num log. A projeção é
"todas as colunas" (`C-001`, `A-002`), a mensagem de erro é "o que a biblioteca disse"
(`C-016`), a linha de log é "a URL inteira" (`C-017`), e o `/health` é "tudo que eu sei sobre
mim" (`C-019`).

**Entrada virando estrutura.** Nada declara o que pode entrar como *identificador*. Chave de
`req.body` vira nome de coluna SQL (`A-001`); valor de coluna do banco vira caminho de arquivo
que será apagado (`+2A-C10`).

Nos dois lados a regra é a mesma, e é a mesma da §4 da R1: **lista de permissão declarada,
verificada por teste, e falha fechada quando a declaração não existe.** Lista de bloqueio falha
por omissão — basta alguém acrescentar uma coluna `senha_backup` e o dado escapa sem que nada
reprove.

---

## 2. Decisões de desenho

### 2.1 Duas listas por entidade, nunca uma

Hoje `gerarController(tabela, campos, nome)` usa **um** array para tudo:
`schoolController.js:20` declara `campos` com `'senha'` dentro, e esse mesmo array é a projeção
de `listar` e `listarPorId`. Uma lista não consegue responder a duas perguntas diferentes.

Passa a existir `src/config/projecoes.js`, fonte única, declarando por tabela:

| Conjunto | Significa |
|---|---|
| `leitura` | colunas que **podem** aparecer num corpo de resposta |
| `escrita` | colunas que uma requisição **pode** definir — a allowlist de identificador |
| `segredo` | colunas que são segredo: nunca em `leitura`, nunca em export, nunca em log |

O módulo valida a si mesmo **na carga**: `leitura ∩ segredo ≠ ∅` derruba o processo no boot,
com código de erro próprio. Não é `console.warn` — é falha fechada, na postura do AGENTS.md §4.6.

`escrita` não é `leitura` menos os segredos. São perguntas independentes: `id`, `created_at` e
`updated_at` são legítimos em `leitura` e proibidos em `escrita`; `Dispositivo.senha` é
legítimo em `escrita` (o operador cadastra a catraca) e proibido em `leitura`.

### 2.2 O sanitizador **não** vale para resposta de negócio

`src/services/sanitizador.js` já existe, é bom, e resolve o lado do **log**. Ele redige por
allowlist de chave — e `nome`, `cpf`, `telefone` estão em `CAMPOS_PESSOAIS`.

**Aplicá-lo a corpo de resposta de API destrói o produto.** A secretaria autenticada tem que
ver o nome do aluno; é literalmente para isso que a tela existe. Um implementador com pressa
vai olhar o sanitizador, achar que é a solução geral de vazamento e plugá-lo no `res.json` —
e aí a lista de presença sai `[REDIGIDO]`.

Fica registrado, sem exceção:

- **Resposta de negócio** → projeção por `leitura`. O sanitizador **não** entra.
- **Log, telemetria, diagnóstico, mensagem de erro** → sanitizador. A projeção não entra.

### 2.3 `A-001` aqui é allowlist de identificador — **não** é a migração para Knex

O ADR-0010 decidiu voltar ao Knex. Isso continua valendo e **não é desta release**: trocar a
camada de acesso a banco é ordem de grandeza acima do corte de PR desta fatia, e arrastaria
transações, paginação e ordenação junto.

Medido no código em `23516c6`: o caminho **alcançável pelo cliente** é
`generic-db-utils.js:15-38` — `Object.keys(req.body)` entra direto em `INSERT INTO … (…)` e em
`SET … = ?`. O `queryBuilder.js` interpola identificadores em `buildQuery()`, mas seus cinco
consumidores (`app.js:9` via `global.db`, `sync_catracas.js`, `accessRoutes.js:13`,
`deviceService.js:63`) passam **só literais de código** hoje. É perigo latente, não porta aberta.

R1-04 fecha a porta aberta e tranca a latente com um teste; o ADR-0010 permanece dívida
declarada, com issue própria.

### 2.4 `A-002` aqui corta as saídas — **não** constrói o cofre

A correção completa da credencial de catraca é criptografia autenticada em repouso com chave
fora do banco. Chave fora do banco é problema do instalador, que é **R2**.

R1-04 faz o que dá para fazer sem material de chave: a credencial para de sair. Sai da projeção
de leitura, sai da planilha de exportação, sai da resposta de criação, sai do log. Continua em
claro no banco, e isso fica **escrito** como dívida com issue aberta — não escondido atrás de
um checkbox marcado.

Rotação das credenciais já materializadas é tarefa operacional da visita, fora de escopo.

### 2.5 Identificador estrutural nunca vem de fora

`A-001` e `+2A-C10` são o mesmo defeito em dois substratos. Em `A-001`, texto vindo do cliente
vira **nome de coluna**. Em `+2A-C10`, texto vindo do banco — que o cliente conseguiu gravar lá,
porque `foto` está no caminho de edição de pessoa — vira **caminho de arquivo que será apagado**.

Regra única: **valor que o servidor não gerou nunca é usado como identificador estrutural.**
Coluna vem de `escrita`. Caminho vem de nome gerado no servidor, resolvido canonicamente e
testado por contenção antes de qualquer operação de filesystem.

### 2.6 A fronteira com R1-05 — o que esta release **não** toca

Estes quatro estão no mesmo arquivo, às vezes na mesma função, e **não entram**:

| Achado | Por que fica fora |
|---|---|
| `C-006` `monitorCallbackAuth` falha aberto | é autenticação, não vazamento. Issue #67, R1-05 |
| `C-008` diagnóstico falha aberto | já resolvido em R1-02B pela remoção da montagem duplicada |
| `C-013` upload grava antes de autenticar | é ordem de cadeia, R1-05 |
| `C-015` rate limit e resposta indistinguível no login | é anti-enumeração, R1-05 |

O caso que mais convida a errar é o `C-017` × `C-006`. O callback aceita `?token=`. Esta
release faz **o token não chegar ao log**. Ela **não** decide se o callback pode continuar
aceitando segredo na URL — isso é o desenho de autenticação do callback, e é do `C-006`.
Redigir no log e mudar o contrato de aceitação são duas mudanças; aqui só a primeira.

---

## 3. Contrato por achado

### 3.1 `[C-001]` — projeção de leitura da unidade escolar

**Escopo.** `schoolController.js:20`, `genericControllerFactory.js` (`listar`, `listarPorId`,
`criar`), `schoolRoutes.js:43`.

**Estado verificado em `23516c6`.** O acesso já está fechado: `GET /escolas` e `GET /escolas/:id`
exigem `ADMINISTRADOR`. O conteúdo não: `campos` inclui `'senha'`, `'login'`, endereço e contato,
e é a projeção literal das duas rotas.

**Contrato.** `UnidadeEscolar.senha` e a chave de recuperação são `segredo`. Nenhuma resposta
da API, em nenhum papel, contém hash de senha. `login` fica em `leitura` (o administrador
precisa ver o próprio usuário); endereço e contato ficam em `leitura` (é dado cadastral da
escola, não de pessoa).

**Comportamento seguro.** `listar` e `listarPorId` projetam `projecoes.UnidadeEscolar.leitura`.
`criar` **para de fazer `SELECT *`**: hoje `generic-db-utils.js:26` relê a linha inteira e a
devolve em `data`. Passa a reler pela projeção de leitura.

**Testes.**
- `GET /escolas` como `ADMINISTRADOR` → nenhuma chave da resposta pertence a `segredo`, em
  qualquer profundidade do JSON
- `GET /escolas/:id` idem
- `POST /escolas` → a resposta de criação não traz `senha`, mesmo tendo sido enviada
- teste de mecanismo: acrescentar uma coluna fictícia a `segredo` e provar que ela some da
  resposta **sem** o controller ter sido tocado

**Fora de escopo.** Quem pode chamar `GET /escolas` (R1-02, fechado). Se a listagem deveria
existir num sistema de unidade única — é pergunta de produto, issue separada.

### 3.2 `[A-002]` — credencial de catraca

**Escopo.** `deviceController.js:45` (`campos`), `deviceController.js:782-825` (`criar`),
`deviceController.js:888` (`quickAdd`), `exportService.js:36-43`, `importService.js:217-229`,
`deviceService.js:63`.

**Contrato.** `Dispositivo.usuario` e `Dispositivo.senha` são `segredo`. Em `escrita` (o
operador cadastra), fora de `leitura`, fora de export, fora de log.

**Comportamento seguro.**
- `criar` (`deviceController.js:788`) e `quickAdd` releem por `leitura` antes de responder
- a aba **Catracas** do `exportService` deixa de projetar `usuario` e `senha`. A planilha vai
  para o disco da escola e para o e-mail de quem pediu; é o pior destino possível para um
  segredo operacional
- `importService` continua **aceitando** as duas colunas (é o caminho de cadastro em massa) e
  passa a não ecoá-las em nenhum resumo, log ou mensagem de erro
- `deviceService.js:63` — `global.db('Dispositivo').select('*')` passa a selecionar
  explicitamente. `select('*')` traz o segredo para a memória de um caminho que loga objeto
- a resposta de erro de conexão com a catraca não repete a credencial tentada

**Testes.**
- `POST /dispositivos` com `senha` no corpo → 201, e `senha` ausente da resposta
- planilha exportada → a aba Catracas não tem coluna de credencial (asserção sobre o cabeçalho,
  não sobre as células: aba vazia passaria um teste de célula)
- importação de planilha com credencial → nenhuma linha de log contém o valor
- teste de mecanismo igual ao de C-001

**Fora de escopo.** Criptografia em repouso (R2, issue própria). Rotação das credenciais já
gravadas (operacional, visita).

### 3.3 `[A-001]` — chave de corpo virando identificador SQL

**Escopo.** `generic-db-utils.js:15-38`, `genericControllerFactory.js:93-125`, `queryBuilder.js:74-109`.

**Contrato.** Nenhuma string vinda de `req.body`, `req.query` ou `req.params` chega a uma
posição de identificador SQL. Colunas de escrita vêm de `projecoes[tabela].escrita`.

**Comportamento seguro.** Em `criar` e `editar`, `Object.keys(dados)` é intersectado com
`escrita`. Chave fora da lista → **400**, nomeando as chaves recusadas.

Descarte silencioso está **proibido**, e a razão é a mesma do AGENTS.md: responder 200 depois
de não gravar o campo é afirmar um estado que não existe. O usuário edita o telefone, vê
"salvo com sucesso", e o telefone é o antigo.

> ⚠️ **Isto quebra o frontend se `escrita` for montada por adivinhação.** O primeiro passo do
> pacote é **medir**: varrer o repositório `SAGE` atrás de todo corpo de `POST`/`PATCH`
> efetivamente enviado, e derivar `escrita` da interseção entre isso e as colunas reais do DDL.
> Divergência entre o que o frontend manda e o que a tabela tem é achado — registre, não
> acomode. Sem esse inventário o pacote **não começa**.

`queryBuilder.buildQuery()` ganha asserção: tabela, coluna, direção de `ORDER BY` conferidas
contra allowlist; `LIMIT`/`OFFSET` coeridos a inteiro. Hoje nenhum consumidor passa dado de
cliente — a asserção existe para que continue assim.

**Testes.**
- `PATCH /pessoas/:id` com chave `"nome = 'x' --"` → 400, e o SQL executado não muda de forma
- `POST` com chave válida em maiúsculas/minúsculas trocadas → decidido explicitamente e testado
  (a comparação é **case-sensitive**; MySQL trata nome de coluna sem distinção de caixa, mas
  aceitar variação de caixa é aceitar que a allowlist tenha entradas que ninguém declarou)
- corpo com chave desconhecida → 400 nomeando a chave, **e** o registro não foi alterado
- `queryBuilder` com coluna fora da allowlist → levanta, não interpola
- o inventário do frontend vira um teste: os corpos reais que a interface envia passam todos

**Fora de escopo.** Migrar para Knex (ADR-0010, issue própria). Transações (`C-018`, R1-03).

### 3.4 `[C-016]` — erro interno na resposta

**Escopo.** `app.js:169` (middleware global) e **69 ocorrências** de `error: error.message` /
`detalhe: err.message` em 12 arquivos, medidas em `23516c6`.

**Contrato.** Corpo de erro 500 é exatamente `{ error: <mensagem pública estável>, traceId }`.
Sem `detalhe`, sem `error.message`, sem stack, **em qualquer ambiente**.

A auditoria sugeriu condicionar a `NODE_ENV`. **Rejeitado.** `NODE_ENV` mal configurado no PC
da escola é justamente o modo de falha esperado — e um controle que depende de variável de
ambiente estar certa é o mesmo anti-padrão do `C-008`. Incondicional.

**Comportamento seguro.** O detalhe vai para o log via `sanitizar()`, correlacionado pelo mesmo
`traceId` que foi devolvido. O suporte remoto pede o `traceId`, casa com a linha de log. Nenhum
diagnóstico é perdido — ele muda de canal.

`traceId` passa a ser gerado por `crypto.randomBytes`. Hoje `app.js:159` usa `Math.random()`,
que colide e torna a correlação ambígua justamente quando há muitos erros.

**Testes.**
- handler que levanta com mensagem contendo CPF → resposta sem o CPF **e** sem a mensagem;
  a linha de log tem o `traceId` e o CPF redigido
- varredura estática: nenhum `res.json`/`res.status().json()` do repositório referencia
  `error.message` ou `err.message`. Este é o teste que impede a regressão; os 69 consertos são
  mecânicos e o guard é o que vale
- dois erros simultâneos produzem `traceId` distintos

**Fora de escopo.** Códigos de erro estruturados por domínio. Reescrever mensagens de negócio 4xx.

### 3.5 `[C-017]` — log HTTP com query string, token e IP

**Escopo.** `app.js:77-89` (log HTTP), `app.js:92-97` (log do monitor, que registra `req.ip`),
`monitorCallbackAuth.js:12-16`, `src/config/logger.js`.

**Contrato.** Log de requisição registra **método + rota**, nunca URL com query string. Nenhum
endereço de origem é gravado. Nenhum valor de segredo aparece em log, venha de header, corpo
ou URL.

**Comportamento seguro.**
- a linha usa `req.route?.path ?? <pathname normalizado>`. Preferir a rota registrada
  (`/dispositivos/:id`) ao pathname (`/dispositivos/17`) — o id não é segredo, mas rota
  agrega e pathname não
- `req.ip`, `req.connection?.remoteAddress` e `x-forwarded-for` **saem** das linhas de log.
  Não há transformação irreversível "só para este caso": numa rede de escola com /24 o espaço
  de busca de um hash de IP tem 254 elementos
- `sanitizarTexto()` passa a rodar no **transport** do winston, não em cada callsite. O
  docstring do sanitizador já pede isso — "o sanitizador precisa ser a única saída possível".
  Um `logger.error(pessoa.nome)` esquecido em 2027 é pego pelo transport
- chaves de query sabidamente secretas (`token`, `key`, `senha`, `password`, `secret`) são
  redigidas antes de qualquer gravação, caso alguma linha volte a montar URL

**Testes.**
- request para `/api/notifications/dao?token=abc123` → nenhum arquivo de log contém `abc123`
- request qualquer → nenhuma linha de log contém o IP de origem
- `logger.info` com CPF/e-mail/telefone no meio de texto livre → gravado redigido
- o teste lê o **arquivo** de log, não o objeto passado ao logger. Asserção sobre o argumento
  não prova o que foi para o disco

**Fora de escopo.** O callback continuar aceitando `?token=` (`C-006`, issue #67, R1-05).
Rotação de log (R0, fechado).

### 3.6 `[C-019]` — boot parcial com `/health` verde

**Escopo.** `app.js:130-137`, `app.js:172-190`.

**Estado verificado.** O `catch` do carregamento de rotas registra e segue — o comentário
`// Continuar mesmo com erro de rotas` está lá. `/health` responde `status: 'ok'` sem consultar
`routesReady`, e devolve `environment`, `version`, estatísticas de cache, estado global e
contagem de conexões WebSocket — tudo isso em rota `publica()`.

**Contrato.** Duas coisas, e as duas são de saída.

**(a) Boot falha fechado.** Rota essencial que não carrega **derruba o processo** com código de
saída diferente de zero e uma linha de log com código próprio. Não existe servir tráfego com
superfície incompleta.

A alternativa — subir e responder 503 em tudo — foi considerada e **rejeitada**: mantém de pé
um processo que aceita conexão, o operador vê "o SAGE está rodando", e metade de um fluxo
executa antes de falhar. Processo morto é diagnóstico honesto. Um `require` quebrado vira
crash-loop, que é ruidoso e achável; `/health` verde com rotas faltando é silencioso e produz
estado inconsistente no dado de presença, que tem peso legal (ADR-0007).

> Dependência declarada para **R2**: a política de reinício do serviço Windows precisa ter
> backoff e um limite que pare de reiniciar e deixe o erro visível. Sem isso, crash-loop numa
> escola sem técnico é um PC que liga e não sobe, sem ninguém saber por quê. **Abra a issue
> em R2 agora**, referenciando esta seção, antes de mudar o boot.

**(b) `/health` volta a ser liveness.** Corpo passa a ser apenas `{ status, timestamp }`.
Ambiente, versão, estatísticas de cache, estado global e contagem de WebSocket saem — são
informação operacional numa rota pública. Quem precisa disso é `/ready` e `/diagnostico`, que
já passam pelo sanitizador e já estão nomeados no teste de redação da §7 da R1.

**Testes.**
- módulo de rota essencial que falha no `require` → o processo sai com código ≠ 0 e **nenhuma**
  porta fica escutando
- rota **não** essencial que falha → boot segue, e `/ready` reporta a degradação
- `/health` → o corpo tem exatamente duas chaves
- o teste de redação da R1 §7 passa a nomear `/health` e `/ready` além de `/status` e
  `/diagnostico`

**Fora de escopo.** Reescrever `loadRoutes`. Definir a política de reinício do serviço (R2).

### 3.7 `[+2A-C10]` — caminho vindo do banco apagando arquivo fora de `uploads`

**Escopo.** `peopleService.js:189-196` (troca de foto), `peopleService.js:249-254` (remoção),
`peopleController.js:132-150`.

**Estado verificado.** `path.join(baseUploads, pessoa[0].foto)` seguido de `fs.unlinkSync`, sem
teste de contenção. `foto` é campo persistível pelo caminho de edição de pessoa.

**Contrato.** Duas travas independentes, porque uma só é uma trava.

**(a) `Pessoa.foto` sai de `escrita`.** O nome do arquivo é gerado pelo servidor
(`pessoa_${id}.png`, `peopleService.js:200`) e só o handler de upload o define. Nenhum corpo de
requisição grava esse campo.

**(b) Toda operação de filesystem resolve canonicamente e testa contenção** antes de agir:
resolver o caminho absoluto real, confirmar que está sob a raiz permitida, e só então operar.
Alvo fora da raiz → **não apaga**, registra código de erro próprio, responde erro. Falha
fechada.

Duas travas porque (a) sozinha depende de nenhuma linha já gravada no banco estar envenenada —
e o banco da escola tem histórico que ninguém auditou —, e (b) sozinha depende de a checagem
nunca ser esquecida no próximo `unlinkSync` que alguém escrever.

**Testes.**
- registro com `foto = '../../config/.env'` → a remoção **não** apaga o arquivo, responde erro,
  e o arquivo continua existindo depois (asserção no filesystem, não no status HTTP)
- `PATCH /pessoas/:id` com `foto` no corpo → 400, e a coluna não muda
- symlink dentro de `uploads` apontando para fora → recusado. `path.resolve` sozinho não pega
  symlink; a checagem tem que ser sobre o caminho **real**
- upload normal continua substituindo a foto anterior

**Fora de escopo.** `/uploads` ser estático e anônimo (`C-014`/`+2A-C11`) — mesmo arquivo,
achado diferente, issue própria. Nomes opacos de arquivo. Retenção de planilhas importadas.

---

## 4. A barreira — o que impede a volta em seis meses

Do mesmo jeito que a R1 §4.2 varre a árvore Express, o R1-04 ganha **dois guards** no CI.

**Guard de projeção.** Todo controller que devolve linha de banco declara projeção. Um teste
percorre as entidades de `projecoes.js` e reprova se: alguma tabela referenciada por controller
não tiver declaração; `leitura ∩ segredo ≠ ∅`; ou `leitura` contiver coluna que não existe no DDL.

**Guard de vazamento.** Um teste que **não** conhece a lista de rotas: percorre a árvore Express
registrada, chama cada `GET` autenticado com um usuário de cada papel, e reprova se a resposta
contiver qualquer chave declarada `segredo` ou qualquer padrão do sanitizador (CPF, e-mail,
telefone) em rota `publica()`.

O guard de vazamento é o que mais vale desta release. Os outros consertos são pontuais; ele é
o que pega o oitavo achado, que ninguém encontrou ainda.

---

## 5. Corte em pacotes

R1-04 inteiro estoura muito o teto de ~300 linhas de diff. Um pacote por vez, PR direto na
`wip/recuperacao-local-pre-auditoria`, merge antes do próximo. **Sem pilha de PRs** — a pilha é
o que quebrou na R0.

| Pacote | Fecha | Entrega |
|---|---|---|
| **R1-04A** | `C-001`, `A-002` (resposta) | `projecoes.js`, factory projetando por `leitura`, `criar` sem `SELECT *`, guard de projeção |
| **R1-04B** | `A-001` | inventário do frontend **primeiro**, allowlist de escrita com 400, asserção no `queryBuilder` |
| **R1-04C** | `C-017` | linha de log por rota, IP fora, sanitizador no transport, redação de query secreta |
| **R1-04D** | `C-016`, `C-019` | corpo de erro incondicional, sweep dos 69 callsites + guard estático, boot fail-closed, `/health` mínimo |
| **R1-04E** | `+2A-C10`, `A-002` (export) | `foto` fora de `escrita`, contenção canônica no filesystem, aba Catracas sem credencial |

**R1-04A é pré-requisito de B e E** — os dois dependem de `projecoes.js` existir. C e D são
independentes entre si e do resto.

O **guard de vazamento** da §4 entra no **último** pacote fechado, não no primeiro: antes disso
ele reprova de propósito, e um guard que nasce vermelho é um guard que alguém desliga.

---

## 6. Critérios de aceite da release

Cada um com teste que falha antes e passa depois.

- [ ] Nenhuma resposta da API, em nenhum papel, contém hash de senha ou credencial de catraca
- [ ] `criar` devolve projeção de leitura, não `SELECT *`
- [ ] Chave de corpo fora da allowlist → 400 nomeando a chave, sem alterar o registro
- [ ] Os corpos que o frontend `SAGE` realmente envia passam todos na allowlist de escrita
- [ ] Corpo de erro 500 não contém `err.message` em nenhum ambiente; guard estático verde
- [ ] `traceId` da resposta casa com a linha de log, e é gerado por CSPRNG
- [ ] Nenhum arquivo de log contém query string, token ou IP de origem — verificado **lendo o
      arquivo**
- [ ] Rota essencial que não carrega derruba o processo; nenhuma porta escutando
- [ ] `/health` responde exatamente `{ status, timestamp }`
- [ ] Caminho de foto com subida de diretório não apaga nada fora de `uploads`, symlink incluído
- [ ] Planilha exportada não tem coluna de credencial no cabeçalho
- [ ] Guard de projeção e guard de vazamento no CI, verdes nos **dois** jobs (ubuntu e
      windows-latest)
- [ ] Issues de dívida abertas e referenciadas no código: cofre de credencial (R2),
      ADR-0010/Knex, política de reinício do serviço Windows (R2)

---

## 7. Fora de escopo — não construa

`C-006` callback fail-open (#67, R1-05) · `C-013` upload antes de autenticar (R1-05) ·
`C-015` rate limit e anti-enumeração no login (R1-05) · `C-014`/`+2A-C11` `/uploads` público ·
migração para Knex (ADR-0010) · criptografia de credencial em repouso (R2) · transações
(`C-018`, R1-03) · códigos de erro estruturados por domínio · rotação de credencial já gravada.

Qualquer um deles: **issue de decisão e pare.**

---

## 8. Onde isto pode dar errado

- **A allowlist de escrita é a mudança que pode derrubar a interface.** É o único item aqui que
  transforma requisição que hoje funciona em 400. O inventário do frontend antes de codificar é
  obrigatório, e mesmo assim ele só cobre o que está no código — fluxo que passe por payload
  montado dinamicamente escapa. Se o R1-04B começar a produzir 400 em tela, a decisão certa é
  **parar e ampliar a lista com o campo nomeado**, nunca afrouxar para "aceita qualquer chave".

- **Boot fail-closed troca um risco silencioso por um risco barulhento, e barulhento numa escola
  sem técnico ainda dói.** Defendo a decisão — dado de presença tem peso legal e estado parcial é
  pior. Mas o custo é real e cai fora desta release: se a R2 não entregar backoff e limite de
  reinício, o primeiro `require` quebrado em produção vira um PC que não sobe. A issue em R2 é
  pré-requisito, não sugestão.

- **Não medi o guard de vazamento contra o custo de CI.** Ele chama toda rota `GET` da árvore
  com dois papéis. Se a suíte hoje sobe o app inteiro por teste, isso pode dobrar o tempo do
  job — e job lento é job que alguém marca como opcional.

- **Os 69 callsites de `error.message` são mecânicos e por isso perigosos.** É o tipo de sweep
  que um agente faz com regex e quebra uma mensagem 4xx legítima no meio. O guard estático
  precisa distinguir corpo de erro 500 de mensagem de validação — se não distinguir, ou reprova
  o que é válido, ou passa o que não é.

- **`/health` mínimo pode quebrar consumidor que eu não conheço.** Não varri o frontend nem os
  scripts de operação atrás de quem lê `cache`, `stats` ou `connections` dessa resposta. Se
  algum painel depende, ele quebra silenciosamente — e é o tipo de coisa que só aparece na
  escola.

- **A-002 fica meio consertado, e "meio" é onde mora a falsa sensação de pronto.** A credencial
  para de sair, mas continua em claro no banco, e o banco é um arquivo no disco de um PC que
  fica numa escola. Se o checkbox for marcado sem a issue do cofre aberta, o achado desaparece
  do radar com metade do risco vivo.

- **O WebSocket é uma saída de dado que esta spec não cobre, e o risco é latente, não ativo.**
  Verifiquei: `notificationService.js:30` faz `io.emit` **global** — todo cliente conectado, sem
  filtro de papel — e o payload é `{title, message, type}`. Nos 14 callsites que amostrei
  (`accessSolicitationController`, `accessService`, `deviceController`, `scheduledJobs`,
  `dataRoutes`) a `message` carrega contagem e nome de dispositivo, não dado de pessoa. Ou seja
  hoje não vaza — mas é campo de texto livre, transmitido em broadcast, sem contrato de
  projeção. O primeiro `message: \`${pessoa.nome} chegou atrasado\`` vira vazamento sem que
  nada reprove. Não puxei para cá porque é `C-009` e contrato de realtime; registre e trate lá.
