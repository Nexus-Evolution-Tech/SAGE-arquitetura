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

#### `segredo` é **derivado**, não julgado

Acrescentado em 2026-08-15, depois de o R1-04B0 achar `Pessoa.senha_acesso`. A versão anterior
mandava `segredo: []` para as onze tabelas restantes — e isso era **asserção minha, não
derivação**. Eu escrevi "fora de `UnidadeEscolar` e `Dispositivo` não há credencial nas onze"
sem abrir o DDL. Havia.

A regra passa a ter fonte, e a fonte é o próprio esquema:

> **Coluna cujo comentário no DDL exige criptografia é `segredo`.**
> `grep -niE 'criptograf' database/sage.sql`

Medido em `6523ab2`, isso dá exatamente três colunas, e nenhuma outra:

| Linha | Coluna | Estado |
|---|---|---|
| `sage.sql:20` | `UnidadeEscolar.senha` | já declarada (R1-04A) |
| `sage.sql:65` | `Dispositivo.senha` | já declarada (R1-04A) |
| `sage.sql:112` | `Pessoa.senha_acesso` | **faltando — é a contradição** |

`Pessoa.senha_acesso` é hash bcrypt (`peopleService.js:88` chama `hashSenha`), tem a mesma forma
de `UnidadeEscolar.senha`, e **o frontend não o referencia em lugar nenhum** — zero ocorrências
em `SAGE/src`. Declará-lo `segredo` não quebra tela alguma. Fica: `escrita` sim, `leitura` não,
`segredo` sim.

**A regra ganha rede de segurança**, para não depender de ninguém repetir o `grep`: o guard
reprova se existir coluna com comentário de criptografia no DDL que não esteja em `segredo`.
Migração futura que acrescente uma quarta credencial reprova o CI até ser declarada.

#### O que **não** é `segredo` — e a tentação de usar o sanitizador como fonte

`sanitizador.js` também lista `senha_acesso` em `CAMPOS_PESSOAIS`, e isso torna tentador usar
`CAMPOS_PESSOAIS` como a segunda fonte de derivação. **Não use.** Ela contém `nome`, `cpf`,
`email`, `telefone`, `foto`, `data_nascimento`, `cep` — derivar `segredo` dela apaga
`Pessoa.nome` de toda resposta e mata o produto. É a armadilha da §2.2 chegando por outra porta.

Três categorias distintas, e colapsar duas delas quebra alguma coisa:

| Categoria | Exemplo | Onde vive | Controle |
|---|---|---|---|
| **Segredo** | `senha_acesso` | nunca em `leitura` | projeção |
| **Credencial de emissão auditada** | `qr_code`, `cartao_rfid` | em `leitura` | autorização + trilha (R1-03) |
| **Dado pessoal** | `nome`, `cpf` | em `leitura` | autorização (R1-02) |

`qr_code` e `cartao_rfid` **são** credencial reutilizável — quem tem o valor passa na catraca.
Mas têm caminho de emissão legítimo e já auditado (`r1-03b2c-qr-auditoria`), e o frontend os usa
em 16 pontos. Tratá-los como `segredo` aqui quebraria a emissão de crachá. Ficam em `leitura`
nesta release. **Se a emissão deve ser restrita a `ADMINISTRADOR` é decisão separada — abra
issue, não resolva no B0.**

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

**Comportamento seguro — revisto em 2026-08-15 pela contradição achada no inventário do
R1-04B.** A versão anterior desta seção mandava 400 para toda chave fora de `escrita`. Isso
quebrava `PATCH /unidade`, que **funciona hoje**, e punha a correção do frontend no caminho
crítico de um sistema que terá uma visita presencial só. Três classes, não duas:

| Chave | Desfecho |
|---|---|
| ∈ `escrita` | aplicada |
| ∉ colunas declaradas da tabela | **400**, nomeando a chave. Não é coluna: é bug ou sondagem |
| ∈ colunas declaradas, ∉ `escrita` (`id`, `created_at`, `updated_at`, segredo em entidade só-leitura) | **ignorada e nomeada na resposta**, em `ignorados: [...]` |

Se depois da filtragem não sobrar nenhuma chave aplicável → **400**. Isso preserva o
comportamento que `schoolController.js:240` já tem hoje.

**A proibição de descarte silencioso continua de pé — o que mudou é onde estava a mentira.**
A mentira nunca foi o descarte: era responder `"atualizado com sucesso"` sem dizer o que não
foi aplicado. Resposta que **nomeia** o que ignorou não esconde nada de ninguém. Descartar sem
avisar segue proibido.

A enforcement mora em `generic-db-utils.js`, **não** nos controllers. São 7 callsites de
`criarRegistro`/`atualizarRegistro` fora do módulo; travar no ponto de estrangulamento cobre
os sete por construção e torna impossível acrescentar um oitavo inseguro. O módulo levanta erro
tipado; o controller mapeia para 400.

> ⚠️ **O inventário do frontend é o primeiro passo do pacote e não é opcional.** Medido em
> 2026-08-15: dois pontos do `SAGE` espalham linha vinda do `GET` dentro do corpo de escrita —
> `Settings.js:172` (`{ ...unidade }`) e `DadosEscolares.js:90,116` (`{ ...item }` →
> `{ ...formData }`), este cobrindo escola, curso, turma e sala pelo mesmo `handleSubmit`.
> `Areas.js:179` espalha objeto montado localmente e está correto. Os outros nove arquivos de
> escrita montam corpo explícito.
>
> Os dois são corrigidos no R1-04B1 — corpo de escrita monta campo a campo, nunca espalha linha
> lida. Com a regra das três classes isso deixa de ser pré-requisito de correção e passa a ser
> higiene: o sistema não quebra se um payload sujo escapar.

`queryBuilder.buildQuery()` ganha asserção: tabela, coluna, direção de `ORDER BY` conferidas
contra allowlist; `LIMIT`/`OFFSET` coeridos a inteiro. Hoje nenhum consumidor passa dado de
cliente — a asserção existe para que continue assim.

**Testes.**
- `PATCH /pessoas/:id` com chave `"nome = 'x' --"` → 400, e o SQL executado não muda de forma
- corpo com chave desconhecida → 400 nomeando a chave, **e** o registro não foi alterado
- `PATCH` com `id`/`created_at`/`updated_at` mais um campo editável → 200, o campo editável
  gravado, os três nomeados em `ignorados`, e `updated_at` **não** veio do cliente
- `PATCH` só com chaves só-leitura → 400 ("nenhum campo aplicável")
- chave válida com a caixa trocada → **400**. A comparação é **case-sensitive**: MySQL não
  distingue caixa em nome de coluna, e aceitar variação é aceitar entrada que ninguém declarou
- oitavo callsite: um teste prova que nenhum `INSERT`/`UPDATE` compõe identificador fora de
  `generic-db-utils.js`
- `queryBuilder` com coluna fora da allowlist → levanta, não interpola
- o inventário do frontend vira teste **no repositório `SAGE`**: nenhum corpo de `api.post`/
  `api.patch` espalha objeto vindo de resposta da API. Asserção sobre o padrão, não sobre a
  lista de campos — lista de campos duplicada em dois repositórios sem pacote comum diverge

**Fora de escopo.** Migrar para Knex (ADR-0010, issue própria). Transações (`C-018`, R1-03).
Redesenhar o formulário de edição do frontend — o conserto é o corpo de escrita, não a tela.

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
| **R1-04B0** | — (habilitador) | declara as **11 tabelas restantes** em `projecoes.js` e liga o guard de completude |
| **R1-04B1** | `A-001` | allowlist de escrita em `generic-db-utils.js` (três classes), asserção no `queryBuilder`, corpos de escrita do `SAGE` |
| **R1-04C** | `C-017` | linha de log por rota, IP fora, sanitizador no transport, redação de query secreta |
| **R1-04D** | `C-016`, `C-019` | corpo de erro incondicional, sweep dos 69 callsites + guard estático, boot fail-closed, `/health` mínimo |
| **R1-04E** | `+2A-C10`, `A-002` (export) | `foto` fora de `escrita`, contenção canônica no filesystem, aba Catracas sem credencial |

**R1-04A é pré-requisito de B0 e E** — os dois dependem de `projecoes.js` existir. **B0 é
pré-requisito de B1.** C e D são independentes entre si e do resto.

**Por que B0 é pacote próprio.** O R1-04A declarou duas tabelas: `UnidadeEscolar` e
`Dispositivo`. Existem **13 controllers genéricos**, cobrindo mais 11 tabelas sem declaração —
`Area`, `Acesso`, `Empresa`, `Turma`, `Curso`, `Sala`, `UnidadeFoto`, `Presenca`, `Materia`,
`SolicitacaoAcesso` e `Pessoa`. Onze declarações mais o cruzamento com o DDL mais os testes já
comem sozinhos o teto de ~300 linhas; somar a isso a enforcement, o `queryBuilder` e o
frontend produz o PR gigante que a R0 provou que ninguém revisa.

**Nada é afrouxado ao separar — são dois guards distintos, e cada um nasce estrito.**

- **B0 liga o guard de completude.** `obterDeclaracao` já levanta para tabela sem declaração
  (`projecoes.js`, R1-04A). B0 torna isso verdadeiro para todas as tabelas alcançáveis por
  controller, e acrescenta o teste que reprova quando um controller novo aparece sem
  declaração. O guard não muda de rigor; muda de cobertura.
- **B1 liga o guard de escrita** no ponto de estrangulamento.

B0 é **mecânico e conferível**: os três conjuntos saem de `database/sage.sql`, não de
julgamento. Regra de corte, na íntegra:

1. `segredo` = colunas cujo comentário no DDL exige criptografia (§2.1). Nas onze, isso é
   **exatamente `Pessoa.senha_acesso`** — as outras dez ficam com `segredo: []`, e agora isso
   é resultado da regra, não asserção
2. `leitura` = todas as colunas do DDL **menos** `segredo`
3. `escrita` = todas as colunas do DDL **menos** `id`, `created_at`, `updated_at`

`Pessoa.senha_acesso` é o único caso nas onze em que `escrita` e `leitura` divergem por
segredo: entra em `escrita`, fica fora de `leitura`.

Divergência entre o DDL e o que o controller declarava em `campos` é **achado**: registre em
issue, não acomode em silêncio.

> ⚠️ **`Pessoa` não passa pelo ponto de estrangulamento.** Verificado em `6523ab2`:
> `peopleController` não usa `gerarController`, e nem ele nem `people-db-utils.js` chamam
> `criarRegistro`/`atualizarRegistro`. `Pessoa` tem caminho próprio — `people-db-utils.js:74`
> (insert) e `:311` (`pessoaFields`, update). B0 **declara** a tabela normalmente; o B1
> precisa cobrir esse segundo caminho explicitamente, senão a allowlist de escrita passa ao
> largo da tabela que carrega dado de menor de idade. Isso é escopo do B1, não do B0.

> Achado encontrado no inventário, para registrar e **não** puxar: `roomController.js` e
> `salaController.js` servem os dois a tabela `Sala`. Superfície duplicada, mesma classe do
> `[V12]`/`[C-008]`. Uma declaração serve às duas, então B0 não trava — mas abra a issue.

O **guard de vazamento** da §4 entra no **último** pacote fechado, não no primeiro: antes disso
ele reprova de propósito, e um guard que nasce vermelho é um guard que alguém desliga.

---

## 6. Critérios de aceite da release

Cada um com teste que falha antes e passa depois.

- [ ] Nenhuma resposta da API, em nenhum papel, contém hash de senha ou credencial de catraca
- [ ] `criar` devolve projeção de leitura, não `SELECT *`
- [ ] Todas as tabelas alcançáveis por controller têm declaração; controller novo sem
      declaração reprova o CI
- [ ] `Pessoa.senha_acesso` está em `segredo` e em `escrita`, e fora de `leitura`
- [ ] Coluna com comentário de criptografia no DDL que não esteja em `segredo` **reprova o CI** —
      a rede que impede a quarta credencial de passar batida
- [ ] `qr_code` e `cartao_rfid` continuam em `leitura`; a emissão de crachá não quebra
- [ ] Chave que não é coluna → 400 nomeando a chave, sem alterar o registro
- [ ] Chave só-leitura → ignorada **e nomeada** em `ignorados`; corpo só de chaves só-leitura → 400
- [ ] `PATCH /unidade` continua funcionando com o payload que o `Settings.js` envia hoje
- [ ] Nenhum corpo de escrita do `SAGE` espalha objeto vindo de resposta da API
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

- **Errei duas vezes seguidas do mesmo jeito: afirmei estado sem abrir o arquivo.** Primeiro
  "o inventário do frontend" sem olhar `Settings.js`; depois "não há credencial nas onze" sem
  abrir o DDL. As duas eram checáveis num comando, e as duas foram achadas pelo agente que
  parou em vez de obedecer. **Enquanto a spec tiver afirmação minha sobre conteúdo de arquivo
  que não esteja acompanhada do comando que a produziu, trate a afirmação como suspeita.**
  A correção estrutural é a que está na §2.1: regra derivada com fonte, mais guard que reprova
  a divergência — assim a próxima credencial é achada pelo CI, não por um agente atento.

- **`qr_code` e `cartao_rfid` ficam em `leitura` e isso é uma dívida real, não um não-problema.**
  São credenciais reutilizáveis de acesso físico saindo em resposta de API. Estou apostando que
  a autorização da R1-02 mais a trilha da R1-03 bastam, e não medi essa aposta. Se a emissão de
  crachá não estiver restrita a `ADMINISTRADOR`, uma secretaria pode listar o `cartao_rfid` de
  qualquer pessoa — inclusive de quem tem acesso a áreas que ela não tem.

- **`Pessoa` fora do ponto de estrangulamento é o buraco mais provável desta release.** B0
  declara a tabela e o guard de completude fica verde, o que **parece** cobertura. Se o B1 não
  tratar `people-db-utils.js` explicitamente, a tabela com dado de menor de idade fica declarada
  e desprotegida — o pior dos dois mundos, porque o painel diz que está pronto.

- **A regra das três classes tira a interface do caminho crítico, mas cria uma zona cinzenta
  nova.** A distinção "não é coluna → 400" versus "é coluna só-leitura → ignora e avisa" depende
  de a declaração estar certa. Coluna que **deveria** ser editável e ficou fora de `escrita` por
  engano vira um campo que o usuário edita, vê aparecer em `ignorados` que a tela não mostra, e
  conclui que salvou. É mais silencioso que o 400 que eu tinha especificado antes. A mitigação
  real não é de backend: a tela precisa exibir `ignorados`, e isso não está no escopo de nenhum
  pacote desta release. **Registre como issue de frontend antes de fechar o R1-04B1.**

- **Se o R1-04B1 começar a produzir 400 em tela**, a decisão certa é **parar e ampliar a
  declaração com o campo nomeado**, nunca afrouxar para "aceita qualquer chave" nem promover a
  chave para a classe ignorável só para o vermelho sumir.

- **O inventário do frontend cobre o que está no código.** Payload montado dinamicamente — chave
  computada, `Object.assign` em cima de resposta, campo vindo de configuração — escapa do grep.
  Meu primeiro levantamento procurou `{ ...item }` e **perdeu** o `Settings.js:172`, que usa
  outro nome de variável. O teste de padrão no repositório `SAGE` existe justamente porque a
  varredura manual já errou uma vez.

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
