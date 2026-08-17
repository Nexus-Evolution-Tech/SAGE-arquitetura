# R1-05 — Fronteira e falha fechada

> Especificação do arquiteto. O implementador executa; não decide arquitetura.
> Dúvida sobre algo aqui: abra issue de decisão e **pare**.
>
> Contexto obrigatório: `specs/R1-usuarios-e-autorizacao.md` §4 (as quatro declarações e a
> barreira), `specs/R1-04-vazamento-em-resposta-e-log.md` §2.1–2.2 (projeção × sanitizador),
> `repo/AGENTS.md` §4.3 e §4.6, ADR-0005 (postura de falha por fluxo), ADR-0014 (fronteira de
> confiança e transporte).
>
> Estado verificado em `bf6562e` — a R1-04 está integrada (A, B0, B1, C, D, E na `wip`).

**Achados cobertos:** `[C-006]` `[C-008]` `[C-009]` `[C-013]` `[C-014]` `[C-015]`

---

## 1. O problema

A R1-02 fechou quem pode chamar. A R1-04 fechou o que sai. Sobrou o que a R1-02 não alcança
porque **não passa pela árvore Express de jeito nenhum, ou passa antes dela**:

- o callback da catraca, que tem autenticação própria — e essa autenticação **não autentica**
- o upload, que grava no disco **antes** de a cadeia de autorização rodar
- o `/uploads`, que é `express.static` e não tem cadeia nenhuma
- o WebSocket, que é outro servidor, com outro handshake e nenhuma barreira
- o login, que é `preAutenticacao` por definição e por isso não pode ser protegido por papel

O padrão comum é o mesmo dos achados: **a decisão de segurança falha aberta quando a
configuração falta.** Sem `MONITOR_CALLBACK_TOKEN` o callback passa. Sem token no handshake o
WebSocket entra. Sem `DIAGNOSTICO_KEY` o diagnóstico abria — este já foi fechado. É o
anti-padrão do AGENTS.md §4.6, e é o único tema desta release.

---

## 2. A decisão que governa a release: **quem é o cliente**

Três dos seis achados dependem de saber de onde a requisição veio, e **hoje essa pergunta não
tem resposta correta no código.**

Medido em `bf6562e`:

- `monitorCallbackAuth.js:24` lê `x-forwarded-for` e usa o **primeiro** valor da lista —
  que é escolhido pelo cliente
- Express **não tem `trust proxy` configurado** em lugar nenhum (`grep -rn "trust proxy" src/`
  → vazio)
- o instalador da escola (`installer/windows/`) **não tem nginx, IIS nem proxy reverso
  nenhum**. `SAGE-API.xml.template` sobe o serviço direto
- o `nginx.conf` com `proxy_pass http://api:3000` mora no repositório `SAGE` e é o caminho
  de contêiner/desenvolvimento

### 2.1 `trust proxy` fica **desligado**. `x-forwarded-for` nunca é lido.

Na escola não há proxy. Logo `req.ip` **já é** o cliente real, e ligar `trust proxy` faria
qualquer cliente escolher o próprio endereço mandando um header. Seria **criar** a
vulnerabilidade achando que está consertando.

A leitura de `x-forwarded-for` em `monitorCallbackAuth.js:24` é **apagada**, não corrigida.
Identidade de origem é `req.socket.remoteAddress`, normalizado (`::ffff:` removido), e nada
mais. Header nenhum participa.

Um teste fixa isso: requisição com `x-forwarded-for` forjado **não** muda a origem observada.

> **Divergência de topologia entre desenvolvimento e produção, registrada como risco.** O dev
> roda atrás de nginx e a escola não. É a mesma inversão perigosa do Node 18 × 24 já anotada no
> bastão: o ambiente onde se testa é diferente do ambiente onde se instala. Esta spec fixa a
> topologia **da escola** como autoritativa. Se algum dia entrar um proxy na frente, `trust
> proxy` passa a ser obrigatório e esta seção inteira precisa ser reescrita — não ajustada.
> **Abra a issue registrando isso; não resolva aqui.**

### 2.2 Segredo nunca vem na URL

O callback aceita `?token=`. A R1-04C fez o log parar de gravar isso; ela deliberadamente não
mexeu no contrato de aceitação, porque era desta release. Agora muda: **o token vem por header,
e só por header.** Query string vai para histórico de navegador, log de proxy e `Referer`.

### 2.3 Falha fechada é no **boot**, não na requisição

Middleware que descobre no meio da requisição que não tem segredo configurado só pode escolher
entre passar (aberto) e recusar tudo (o sistema parece quebrado sem dizer por quê).

A postura desta release: **configuração de segurança ausente derruba o boot**, com código de
erro próprio, do mesmo jeito que a R1-04D fez com rota essencial que não carrega. Vale para
`MONITOR_CALLBACK_TOKEN` e para o segredo do JWT.

Isso tem custo, e o custo é a mesma dependência que a R1-04D já criou: a política de reinício
do serviço Windows precisa de backoff e teto (R2). **Se aquela issue ainda estiver aberta, esta
release aumenta a superfície de um PC que liga e não sobe.** Confira antes de começar.

---

## 3. Contrato por achado

### 3.1 `[C-006]` — callback do monitor falha aberto

**Escopo.** `src/middlewares/monitorCallbackAuth.js` inteiro, `src/routes/notificationRoutes.js`.

**Estado verificado.** Os dois `if` são condicionais e o `next()` final é incondicional. Sem
`MONITOR_CALLBACK_TOKEN` e sem `MONITOR_IP_WHITELIST` no `.env`, **a rota é integralmente
pública** e qualquer cliente da rede da escola pode injetar acesso e presença — dado com peso
legal (ADR-0007). A whitelist, quando existe, é contornável por header.

**Contrato.**

1. `MONITOR_CALLBACK_TOKEN` é **obrigatório**. Ausente ou vazio → **o boot falha**.
   Vale mesmo em modo polling: `notificationRoutes.js` está na lista de rotas essenciais de
   `app.js:155` e é montada **incondicionalmente**, então a superfície existe mesmo com
   `MONITOR_USE_PUSH=false` (que é o padrão em `.env.example:89`)
2. **Transporte do token — revisto em 2026-08-17, ver §3.1.1.** O token é aceito em
   `x-monitor-token` (**preferido**) **ou** em `?token=` (**aceito**). Header vence se os dois
   vierem. Os dois passam pela mesma comparação em tempo constante
3. Comparação em **tempo constante** (`crypto.timingSafeEqual`, com igualdade de tamanho
   tratada antes para não vazar comprimento)
4. `MONITOR_IP_WHITELIST` compara contra `req.socket.remoteAddress` normalizado. Não casando →
   403. **Opcional em polling; obrigatória no boot quando `MONITOR_USE_PUSH=true`** — §3.1.1
5. O `next()` final deixa de existir como caminho incondicional: sai por 401, 403 ou por um
   `next()` alcançável **somente** depois de o token ter casado

#### 3.1.1 Por que o token continua aceito na query — correção de uma decisão minha

A versão `11cd4d4` desta spec mandava recusar `?token=`. **Estava errada, e eu a escrevi sem
verificar se a catraca consegue mandar header.** É a terceira vez nesta release que afirmo
comportamento sem abrir o arquivo; a PR #110 implementou fielmente o que eu escrevi e o
resultado quebraria o callback real.

**A contradição, medida em `bf6562e`:** `deviceService.js:715-719` grava na catraca
`path: 'api/notifications/dao?token=<segredo>'`, e o objeto `monitorConfig` enviado ao
`set_configuration.fcgi` tem exatamente quatro campos — `request_timeout`, `hostname`, `port`,
`path`. **Não há campo de header.** `docs/MONITOR_CONTROL_ID.md:66` e
`docs/SEGURANCA_CATRACA_E_MONITORAMENTO.md:100,115,141` prescrevem a query. A catraca monta o
POST sozinha; o SAGE só lhe diz para onde.

**Se a Control iD suporta header customizado no Monitor, eu não sei — e não vou inventar.**

**Por que o header valia pouco aqui, ao contrário do caso geral.** Os motivos clássicos para
não pôr segredo em URL não se aplicam a este caminho:

| Motivo clássico | Aqui |
|---|---|
| Histórico de navegador | não há navegador — é POST de dispositivo embarcado |
| Cabeçalho `Referer` | idem |
| Log de proxy | não há proxy na escola (§2.1) |
| Log da própria API | **já fechado pela R1-04C** |

E o que sobra é igual nos dois transportes: é HTTP em texto claro na rede da escola, então quem
escuta o fio pega o token vindo em header ou em query. O mesmo segredo ainda fica gravado **na
configuração da própria catraca**, legível por quem autenticar no equipamento — e
`Dispositivo.senha` só sai do claro na R2.

Ou seja: o ganho de mudar o transporte é quase nulo neste deployment, e o custo é perder o push
em tempo real numa escola com **uma visita presencial só**. Otimizei uma propriedade secundária
contra a função primária.

**A query não é um bypass.** Com falha fechada, o token é exigido nos dois transportes — quem
não tem o segredo não passa por lugar nenhum. A query é transporte mais vazado do **mesmo**
credencial exigido, não um segundo caminho mais fraco. Por isso aceitar os dois não afrouxa o
`C-006`: os itens 1, 3, 4 e 5 são o que fecham o achado, e nenhum depende do transporte.

**Contrapartida obrigatória, porque token estático em HTTP claro é fraco de qualquer jeito.**
Quando `MONITOR_USE_PUSH=true`, `MONITOR_IP_WHITELIST` passa a ser **exigida no boot**. Em modo
push o segredo é gravado no equipamento e trafega na rede; o endereço de origem é o único
controle que um atacante remoto não satisfaz. Ligar push já exige abrir porta no firewall e
configurar rede à mão — quem faz isso consegue fixar o IP da catraca.

> **Dependência registrada, e não é bloqueio do R1-05A.** A pergunta "o Monitor da Control iD
> aceita header HTTP customizado no callback?" precisa de resposta do fabricante ou do
> equipamento. Ela entra em `auditoria/INVENTARIO.md` §4, junto das outras perguntas de campo.
> **Se a resposta for sim**, o header vira obrigatório e a query é removida — em pacote próprio,
> com `deviceService`, docs e testes juntos. **Se for não**, esta seção é a resposta final e o
> `C-006` está fechado como está.

**Enquanto a query for aceita, a redação de log da R1-04C deixa de ser higiene e vira controle
de segurança de primeira linha.** O teste que prova que nenhum arquivo de log contém query
string passa a ser requisito do `C-006`, não só do `C-017`.

**A declaração para de mentir.** A rota é `autenticacaoPropria('monitorCallbackAuth')` pela §4
da R1, e a barreira já confere que o middleware está na cadeia. Hoje a declaração afirma uma
proteção inexistente; ao fim deste pacote ela passa a ser verdadeira.

**Testes.**
- sem `MONITOR_CALLBACK_TOKEN` → o processo **não sobe**; nenhuma porta escutando
- token ausente → 401 · token errado → 401, nos **dois** transportes
- token certo em `x-monitor-token` → passa
- token certo em `?token=` → **passa**. Este é o teste que prova a §3.1.1, e é o que teria
  pego a contradição antes do merge
- header e query presentes e divergentes → o **header** decide
- `MONITOR_USE_PUSH=true` sem `MONITOR_IP_WHITELIST` → o processo **não sobe**
- whitelist configurada + `x-forwarded-for` forjado apontando para IP permitido, socket fora →
  **403**. Este é o teste que prova a §2.1
- nenhuma resposta de erro distingue "token ausente" de "token errado"
- **teste ponta a ponta:** a URL que `deviceService.configurarMonitorNaCatraca` grava na catraca
  é aceita pelo `monitorCallbackAuth`. Um único teste que consome a saída de um lado como
  entrada do outro — a ausência dele é a causa raiz desta contradição

**Fora de escopo.** `[C-007]` — o callback responder 200 depois de falha parcial. Mesmo
arquivo, achado diferente, é confiabilidade e não fronteira. Issue própria.

### 3.2 `[C-008]` — diagnóstico: **já fechado, só falta a trava**

**Estado verificado.** A montagem duplicada em `app.js` **não existe mais** — foi removida no
R1-02B por decisão da issue #66. Sobrou `deviceRoutes.js:16`, com `autenticar`. `DIAGNOSTICO_KEY`
não aparece em `src/`.

**Não conserte o que já está consertado.** O que falta é a regressão:

- teste que reprova se `diagnosticoAcessos` for exposto por qualquer rota sem `exige()`
- guard estático: `DIAGNOSTICO_KEY` não aparece em `src/`
- o handler herda o contrato de projeção da R1-04 — a resposta não traz credencial de catraca
  nem PII fora de `leitura`

### 3.3 `[C-013]` — upload grava antes de autenticar

**Escopo.** Cinco rotas, medidas em `bf6562e`:

| Arquivo | Linha |
|---|---|
| `peopleRoutes.js` | 13 |
| `areaRoutes.js` | 8 |
| `schoolRoutes.js` | 36 |
| `schoolPhotoRoutes.js` | 12 |
| `dataRoutes.js` | 51 (planilha) |

Mais `src/middlewares/uploadFoto.js`, que **não define `limits` nem `fileFilter`**.

**Contrato.**

1. **Autorização antes do multer**, nas cinco. Requisição anônima nunca chega a gravar byte
2. `limits`: tamanho máximo por arquivo e `files: 1`. Estouro → 413, sem deixar temporário
3. `fileFilter` por mimetype **e** extensão
4. Depois da gravação, validação por **assinatura real do arquivo** (magic bytes) —
   `Content-Type` é escolhido pelo cliente. Reprovou → apaga e 415
5. Temporário é removido em **todos** os caminhos, inclusive 401, 403, 413, 415 e exceção
6. `uploadFoto.js:14` calcula `ext` e não usa. Ou usa na validação, ou some

**Barreira.** Um teste varre a árvore Express e reprova se **qualquer** rota tiver middleware
de multer antes do middleware de autorização. É a única forma de isso não voltar na sexta rota
de upload que alguém acrescentar.

**Testes.**
- `POST` multipart sem credencial nas cinco rotas → 401 **e** nenhum arquivo criado em
  `paths.uploads` (asserção no filesystem, não no status)
- arquivo acima do limite → 413, sem temporário
- arquivo `.png` cujo conteúdo é executável → 415, sem temporário
- upload legítimo continua funcionando nas cinco
- barreira: rota nova com multer antes de autorização reprova o CI

**Fora de escopo.** Reencodar a imagem (defesa contra payload em imagem válida) — vale, mas é
CPU num PC modesto e merece medição. Issue própria.

### 3.4 `[C-014]` — fotos públicas e enumeráveis

**Escopo.** `app.js:122` (`express.static`), `peopleService.js` (nome
`pessoa_${pessoa_id}.png`), e no `SAGE`: `services/api.js:220`, `Settings.js:26`,
`Areas.js:74`, `Inicio.js:29`.

**Estado verificado.** `/uploads` inteiro é estático e anônimo, e o nome da foto é o id
numérico. Qualquer um na rede da escola percorre `pessoa_1.png`, `pessoa_2.png`… e coleciona
**fotos de menores de idade**. É o achado mais grave desta release.

**Contrato.**

1. `express.static` **deixa de servir mídia de pessoa**. Foto sai por handler que passa pela
   barreira, com `exige(...)`
2. O nome no disco vira **identificador opaco gerado no servidor** (CSPRNG), não derivável do
   id. Continua valendo a contenção de caminho da R1-04E
3. `Cache-Control: private, no-store` na resposta de mídia sensível
4. **Migração dos arquivos já gravados**: renomeia para nome opaco e atualiza `Pessoa.foto`.
   Expand-only (ADR-0011); não apaga o que não conseguiu migrar — registra e segue
5. Ativo genuinamente público (logo da unidade) pode continuar estático, em **raiz separada**

**Testes.**
- `GET /uploads/pessoa_1.png` sem credencial → 404 ou 401, **nunca** a imagem
- handler autenticado devolve a foto para papel autorizado
- nome no disco não contém o id da pessoa (asserção sobre o nome gerado)
- migração roda sobre diretório com arquivos existentes e não perde foto
- resposta de mídia traz `Cache-Control: private`

**Fora de escopo.** Planilhas importadas retidas em `uploads` (`+2A-C11`) — mesmo diretório,
achado diferente. Issue própria.

### 3.5 `[C-015]` — login sem limite, e dois oráculos

**Escopo.** `app.js` (rate limit ausente), `schoolController.js:191-212`,
`usuarioService.js:autenticar`.

**Estado verificado — metade já está fechada.** A R1-01 entregou bloqueio **por conta**:
`falhas_login`, `bloqueado_ate`, `LIMITE_FALHAS = 5`, `BLOQUEIO_MS = 15min`, tudo dentro de
transação com `FOR UPDATE`. O corpo da resposta é uniforme (`'Credenciais inválidas'`).

Falta o limite **por origem**, e existem **dois oráculos que a própria R1-01 introduziu ou
deixou**:

**Oráculo de status.** `schoolController.js:195`:
```js
return res.status(resultado.bloqueado ? 429 : 401).json({ message: 'Credenciais inválidas' });
```
Conta inexistente devolve sempre 401. Conta existente e bloqueada devolve 429. **O corpo é
uniforme e o status não é** — cinco tentativas contra um login enumeram sua existência.

**Oráculo de tempo.** Em `autenticar`, `compararHash` só roda quando o usuário existe. Login
inexistente responde em microssegundos; login existente paga o bcrypt. A diferença é medível
pela rede mesmo com corpo e status idênticos.

**Contrato.**

1. Limite por origem nas rotas `preAutenticacao` — `express-rate-limit` **já está no
   `package.json` (8.6.1) e não é usado em lugar nenhum**. Chave é `req.socket.remoteAddress`
   pela §2.1
2. **Status uniforme.** Falha de credencial responde sempre o mesmo código. O 429 fica
   reservado ao limite por origem, que é propriedade do chamador e não da conta
3. **Tempo uniforme.** Usuário inexistente compara contra um hash-isca de custo equivalente
4. O limite por origem **não pode trancar a escola inteira**. Bucket por origem, e o teto
   precisa caber num laboratório de informática — o teste fixa o número

**Testes.**
- N+1 tentativas da mesma origem → 429 na N+1
- origem A no limite **não** afeta origem B
- login inexistente × login existente com senha errada → **mesmo status, mesmo corpo**
- diferença de tempo entre os dois abaixo de um limiar declarado, medida sobre várias amostras
- bloqueio por conta da R1-01 continua funcionando e seus testes continuam verdes

**Fora de escopo.** CAPTCHA · 2FA · alerta por e-mail. Recuperação já tem bloqueio próprio.

### 3.6 `[C-009]` — WebSocket anônimo

**Escopo.** `src/websocket/wsServer.js:27-76`; no `SAGE`, `contexts/WebSocketContext.js`.

**Estado verificado.** `wsServer.js:30-34`:
```js
if (!token) {
  socket.userId = null;
  return next();   // "Permitir conexões sem token por enquanto (para desenvolvimento)"
}
```
E os quatro `subscribe:*` fazem `socket.join(room)` **sem checar nada**. Qualquer cliente que
alcance o Socket.IO acompanha a movimentação de pessoas em tempo real.

Do lado do cliente, dois fatos que o pacote precisa tratar:
- `WebSocketContext.js:29` manda `token: token || ''` — string vazia quando não há sessão
- o token é lido do `localStorage` **uma vez**, dentro do `useEffect`. Depois do login o socket
  continua com o token antigo até remontar

**Contrato.**

1. Conexão sem token válido é **recusada** no handshake. O ramo "por enquanto" morre
2. Cada `subscribe:*` é autorizado por papel, com a mesma tabela da §4.3 da R1. Sala não
   autorizada → recusa, não join silencioso
3. O payload de evento respeita a projeção de `leitura` da R1-04. `io.emit` global de
   notificação só carrega texto que não identifica pessoa — o risco latente registrado na §8 da
   R1-04 vira regra aqui
4. Cliente conecta **somente** quando há sessão, e **reconecta ao trocar de identidade**. Isso
   fecha também o `[E-003..E-007]` de cache por identidade

**Testes.**
- handshake sem token → recusado · com `token: ''` → recusado · com token expirado → recusado
- token de `SECRETARIA` tentando sala restrita a `ADMINISTRADOR` → recusado
- evento de acesso entregue a assinante autorizado não traz campo fora de `leitura`
- trocar de usuário derruba o socket anterior e não entrega evento à identidade antiga

#### 3.6.1 A medição do canal, e por que **E vem antes de F**

Medido em 2026-08-17, a pedido da §7. O canal não está morto: está **meio vivo, e as duas
metades falham de formas opostas.**

| Caminho | Servidor | Cliente | Estado |
|---|---|---|---|
| **Por sala** | `emitToRoom('acessos', 'acesso:novo', …)` — 3 callsites em `accessController.js:58,68` e `accessService.js:396,404,722,730` | `useWebSocket.js` emite `join` e `join {room}` | **MORTO.** O servidor só escuta `subscribe:acessos\|dispositivos\|sync\|stats`. Ninguém entra na sala, e `io.to('acessos')` alcança **zero** sockets |
| **Global** | `notificationService.js:30` → `io.emit('notification', …)` | qualquer socket conectado | **VIVO.** Não usa sala, então chega a **todos** — inclusive aos anônimos |

**Consequência que decide a ordem: fazer F primeiro conserta o cano antes de existir a
válvula.** Hoje o caminho por sala não vaza porque está quebrado. F o faz funcionar; se E ainda
não tiver entrado, `acesso:novo` — que carrega id, nome, horário e decisão — passa a ser
entregue a **cliente anônimo**. Inverter a ordem transforma um vazamento morto num vazamento
vivo, em cima de dado de menor de idade.

**E não é vazio sem F.** Dos quatro itens do contrato da §3.6, três são testáveis hoje:

| Item | Sem F |
|---|---|
| 1. handshake recusa anônimo | **testável e vale hoje** — fecha o vazamento global vivo |
| 2. sala autorizada por papel | o cliente real não entra em sala… |
| 3. projeção no payload | **testável** — `io.emit` de notificação está vivo |
| 4. cliente conecta só com sessão | **testável** |

**O item 2 também não é vazio — ele só não pode ser testado pelo frontend.** O contrato que o E
possui é o **do servidor**: `socket.on('subscribe:acessos', …)` passa a autorizar antes do
`join`. O teste dirige o handler com um cliente socket.io sintético portando token de
`SECRETARIA`. Isso é teste real de contrato de servidor. Que o frontend hoje chame outro nome
de evento é problema do F.

**O E não toca em nome de evento.** Renomear `subscribe:*` ou aceitar `join` é decisão de
protocolo e pertence ao F. Fazer isso no E é exatamente a ampliação de pacote que se quer
evitar.

**Guard obrigatório no E, e é a única coisa que acrescento:** um teste reprova se existir
`socket.on(...)` que faça `socket.join(...)` sem passar pela função de autorização. Sem ele, o
F pode acrescentar um handler `join` sem cerca e ninguém nota — o protocolo novo entraria por
fora da válvula que o E acabou de instalar. É o mesmo padrão da barreira da §4 da R1, e custa
poucas linhas.

#### 3.6.2 Tabela papel→sala — a que faltava

A §4.3 da R1 classifica rota HTTP e não mapeia estas quatro salas. Lacuna minha. A regra é a
mesma da §4.3: **dado de negócio → `SECRETARIA`; estado interno do sistema → `ADMINISTRADOR`.**

| Sala | Evento | Carrega | Papel |
|---|---|---|---|
| `acessos` | `acesso:novo` | `pessoa_id`, `pessoa_nome`, `dispositivo_id`, `status`, `permitido`, `data_hora` | **`SECRETARIA`** |
| `dispositivos` | `dispositivo:status` | catraca online/offline | **`SECRETARIA`** |
| `sync` | `sync:fila` | fila de sincronização | **`ADMINISTRADOR`** |
| `stats` | `stats:update` | ver abaixo — **payload muda** | **`SECRETARIA`** |

Como `PAPEIS_PERMITIDOS.SECRETARIA = {ADMINISTRADOR, SECRETARIA}`, o administrador entra em
todas sem regra extra.

**`acessos` é `SECRETARIA` porque é o trabalho dela.** A tela de monitoramento é dado de
negócio em tempo real, não interno de sistema. Restringir a administrador quebraria a função
principal do produto para quem a usa o dia inteiro.

**`dispositivos` é `SECRETARIA` porque é *status*, não configuração.** A §4.3 põe "config de
dispositivo" em `ADMINISTRADOR`; saber que a catraca caiu é o que permite agir, e quem está no
balcão precisa saber.

**`sync` é `ADMINISTRADOR`** — é a mesma classe do monitoramento `[V11]` que a §4.3 já colocou lá.

**`stats` exigiu decisão, porque `globalState.getStats()` é misturado.** Ele devolve contadores
de negócio (`acessos_hoje`, `acessos_negados_hoje`, `pessoas_ativas`, `catracas_online`,
`catracas_offline`) **e** interno de sistema (`usuariosConectados`, `filaSincronizacao`,
`sincronizacoesEmAndamento`, `uptime`). `ADMINISTRADOR` em bloco tira da secretaria o
`acessos_hoje`, que é o número da tela inicial; `SECRETARIA` em bloco entrega interno de
sistema a quem não precisa.

**Decisão: a sala é `SECRETARIA` e o payload encolhe.** `stats:update` passa a emitir **somente
os contadores de negócio**. O interno de sistema sai do realtime e continua em
`/monitoring/state`, que já é `ADMINISTRADOR` por HTTP pela §4.3.

Escolhi encolher o payload em vez de projetar por papel dentro da sala porque projeção por
socket exige iterar conexões em vez de `io.to(sala).emit`, e sala nova mudaria o protocolo —
que é do F. **Esta decisão não amplia o E:** o item 3 do contrato da §3.6 já mandava o payload
respeitar a projeção; isto é o item 3 aplicado, não escopo novo.

**Testes.**
- token `SECRETARIA` entra em `acessos`, `dispositivos`, `stats`; é **recusado** em `sync`
- token `ADMINISTRADOR` entra nas quatro
- `stats:update` não contém `usuariosConectados`, `filaSincronizacao`,
  `sincronizacoesEmAndamento` nem `uptime`
- `acesso:novo` continua trazendo `pessoa_nome` — está em `leitura` de `Pessoa` pela R1-04, e
  a tela precisa dele

### 3.7 Contrato de realtime — `[+2A-E05/E07/E08]`

O plano manda consertar aqui porque é a release que já mexe em WebSocket. **É o único pacote
desta spec que não é segurança** — é a funcionalidade possivelmente não funcionar.

Contrato fechado em 2026-08-17, quatro decisões. **Nenhuma delas é escolha do implementador.**

#### 1. O protocolo canônico é `subscribe:*`. Quem muda é o cliente.

O servidor **não ganha** handler `join`. `useWebSocket.js` para de emitir `join`/`join {room}` e
passa a emitir `subscribe:acessos|dispositivos|sync|stats`.

A razão não é "já estava assim": `join('acessos')` faz o **nome da sala virar string escolhida
pelo cliente**, enquanto `subscribe:acessos` faz dela um nome de evento pertencente ao código.
É exatamente o princípio da allowlist de escrita da R1-04B1 — identificador vindo de fora nunca
vira estrutura. Além disso o R1-05E já pendurou a autorização por handler, e o guard de CI
confere isso; mover para `join` levaria a autorização para um lugar onde a sala chega como dado.

**Versionamento:** o conjunto de eventos aceitos é code-owned e fechado. Evento fora da lista →
recusa, não `join` silencioso.

#### 2. Nem "explicitar `/socket.io`" nem "alterar a URL": a URL volta a ser a origem, e o **`path`** vira o configurável.

O defeito medido: `io('/backend')` — socket.io interpreta string iniciada por `/` como
**namespace**, não como path. Então o cliente pede namespace `/backend` no path default
`/socket.io`, o nginx não casa `location /backend/socket.io/`, cai no `location /` e recebe o
`index.html` do SPA. Nunca houve socket.

O servidor **não muda**: `nginx.conf:20` faz `rewrite ^/backend(.*)$ $1 break`, então a API já
vê `/socket.io/`. Mantém o path default.

O cliente passa a `io({ path: <configurável> })`, com a origem default (mesma origem). E o
`path` tem **dois valores legítimos, pela mesma divergência de topologia da §2.1**:

| Deployment | Proxy | `path` |
|---|---|---|
| **Escola** (`installer/windows`, bundle servido pela própria API) | nenhum | `/socket.io` ← **default** |
| Docker (`nginx.conf`) | nginx com prefixo | `/backend/socket.io` |

**Renomeie a variável.** `REACT_APP_SOCKET_URL` guardando um path é a causa da confusão —
`Dockerfile:8` passa `/backend` para algo chamado URL, e `.env.production:4` deixa vazio. Vira
`REACT_APP_SOCKET_PATH`, default `/socket.io`, e o `Dockerfile` passa `/backend/socket.io`.

#### 3. `reconnectionAttempts: Infinity`, com o backoff que já existe e o erro **persistente**.

`reconnectionDelayMax: 5000` já está lá, então é uma tentativa a cada 5s para sempre — o certo
para um PC que fica ligado o dia inteiro numa escola. Sem teto, porque teto significa que a
tela morre em silêncio depois de 5 tentativas e ninguém percebe.

`connectionError` deixa de ser evento passageiro e vira **estado visível enquanto durar**. O
critério é negativo e é o que o teste fixa: **não existe estado "desconectado e silencioso"** —
se não há socket, a tela diz que não há.

#### 4. Proxy HTTP real **em processo**, no CI da API. Sem docker, sem nginx.

Não crie harness de container. Razões, em ordem:

- o CI roda **ubuntu-latest e windows-latest**; docker+nginx no runner Windows é caro e frágil,
  e um teste frágil é um teste que alguém marca como opcional
- o que quebra de verdade é **reescrita de path e upgrade de WebSocket**. Um proxy Node em
  processo reproduz os dois, determinístico e igual nos dois sistemas
- **o repositório `SAGE` não tem CI nenhum** — `.github/` não existe lá. Verificado. O teste
  precisa morar no `ci.yml` da API de qualquer forma

**Escopo do teste:** job novo em `ubuntu-latest` no `ci.yml` da API, com checkout dos dois
repositórios — o padrão já existe no job `instalador` (`FRONTEND_REF`, paths `api/` e `web/`).
O teste sobe a API, sobe um proxy que reescreve `/backend/*` → `/*` e encaminha upgrade, aponta
o cliente real com `path: '/backend/socket.io'`, autentica, assina `subscribe:acessos` e
**recebe um `acesso:novo` emitido pelo servidor**.

O `nginx.conf` ganha verificação **separada e barata**, porque o proxy em processo não é nginx:
asserção sobre o arquivo — existe `location /backend/socket.io/`, tem `proxy_set_header Upgrade`,
tem o `rewrite`. Isso não prova nginx; prova que a config não regrediu.

**Testes.**
- cliente real conectando com `path` errado → falha **de forma visível**, não pendura
- cliente real com `path` correto atrás do proxy → conecta, assina e **recebe evento**
- token de `SECRETARIA` assinando `sync` atrás do proxy → recusado (a tabela §3.6.2 vale
  ponta a ponta, não só no handler)
- derrubar a API no meio → cliente reconecta sozinho depois que ela volta, sem recarregar a
  página, e o estado de erro fica visível durante a queda
- evento fora da lista canônica → recusado
- `nginx.conf` sem `proxy_set_header Upgrade` → reprova

---

## 4. Corte em pacotes

Um por vez, PR direto na `wip/recuperacao-local-pre-auditoria`, merge antes do próximo. **Sem
pilha de PRs.**

| Pacote | Fecha | Entrega |
|---|---|---|
| **R1-05A** | `C-006`, `C-008` | origem = socket, `x-forwarded-for` apagado, callback fail-closed no boot, token só por header, regressão do diagnóstico |
| **R1-05B** | `C-013` | autorização antes do multer nas 5 rotas, `limits`/`fileFilter`/magic bytes, limpeza de temporário, barreira |
| **R1-05C** | `C-015` | limite por origem, status uniforme, tempo uniforme |
| **R1-05D1** | `C-014` (backend) | handler autenticado de mídia, nome opaco, `Cache-Control`, `/uploads` deixa de servir foto de pessoa |
| **R1-05D2** | `C-014` (migração + frontend) | renomeação dos arquivos existentes, 5 referências do `SAGE` |
| **R1-05E** | `C-009` | handshake recusa anônimo, sala por papel, projeção no payload, cliente conecta com sessão |
| **R1-05F** | `+2A-E05/E07/E08` | protocolo único, namespace/`path`, reconexão, teste de contrato |

**A é pré-requisito de C** — o limite por origem depende de a origem ser confiável; ligá-lo
antes seria limitar um endereço que o cliente escolhe. **D1 é pré-requisito de D2.**
**E é pré-requisito de F, e isto é agora obrigatório, não preferência de ordem** — medido na
§3.6.1. O caminho por sala está quebrado hoje e por isso não vaza; F o conserta. Entrar com F
antes de E entrega `acesso:novo` a cliente anônimo. B é independente.

**F é o pacote a cortar se a release esticar.** É o único que não é segurança, e o único cujo
teste exige o proxy real de pé. Cortá-lo para a R1-06 não deixa buraco de fronteira aberto —
deixa uma funcionalidade possivelmente quebrada, que já está quebrada hoje.

---

## 5. Critérios de aceite da release

- [ ] Sem `MONITOR_CALLBACK_TOKEN` o processo não sobe
- [ ] Callback aceita o token por header **ou** por query, sempre em tempo constante, e recusa
      ausente/errado nos dois transportes
- [ ] A URL que `deviceService` grava na catraca é aceita pelo `monitorCallbackAuth` — provado
      por teste ponta a ponta, não por leitura
- [ ] `MONITOR_USE_PUSH=true` sem `MONITOR_IP_WHITELIST` não sobe
- [ ] Nenhum arquivo de log contém a query string do callback (R1-04C, agora requisito do C-006)
- [ ] `x-forwarded-for` forjado não muda a origem observada em nenhum ponto do sistema
- [ ] `diagnosticoAcessos` não é exposto por nenhuma rota sem `exige()`; `DIAGNOSTICO_KEY` não
      existe em `src/`
- [ ] Upload anônimo nas 5 rotas → 401 **e nenhum arquivo criado no disco**
- [ ] Rota com multer antes de autorização reprova o CI
- [ ] `GET /uploads/pessoa_1.png` sem credencial não devolve imagem
- [ ] Nome de arquivo de foto não é derivável do id da pessoa
- [ ] Migração de fotos existentes roda sem perder arquivo
- [ ] Login inexistente e senha errada devolvem **mesmo status e mesmo corpo**, com tempo
      equivalente
- [ ] Limite por origem dispara, e origem A no limite não afeta origem B
- [ ] Handshake WebSocket sem token válido é recusado; sala é autorizada por papel, provado
      com cliente socket.io sintético contra o handler do servidor
- [ ] Nenhum `socket.on` entra em sala sem passar pela autorização — guard no CI
- [ ] Evento de realtime não carrega campo fora de `leitura`, incluindo o `io.emit` global de
      notificação, que é o único caminho vivo hoje
- [ ] Testes verdes nos **dois** jobs (ubuntu e windows-latest)
- [ ] Issues abertas e referenciadas: `[C-007]` callback 200 após falha parcial ·
      `+2A-C11` planilhas retidas · reencode de imagem · divergência de topologia dev × escola

---

## 6. Fora de escopo — não construa

`[C-007]` semântica de retry do callback · `+2A-C11` retenção de planilha · reencode de imagem ·
CAPTCHA · 2FA · alerta de login por e-mail · proxy reverso na escola · rotação das credenciais
de catraca já materializadas · cofre de credencial (R2) · Knex (ADR-0010).

Qualquer um deles: **issue de decisão e pare.**

---

## 7. Onde isto pode dar errado

- **Especifiquei um contrato de rede sem checar o que o outro lado consegue falar, e a PR #110
  o implementou fielmente.** O CI ficou verde porque os dois lados foram testados separados: o
  middleware contra requisições sintéticas, o `deviceService` contra nada. Uma spec que dita
  transporte tem que trazer o teste que fecha o laço, e a §3.1.1 agora traz. **Este é o terceiro
  erro meu da mesma classe nesta sequência** — afirmação sobre arquivo que eu não abri. Nas três
  quem pegou foi o agente que parou em vez de obedecer; nenhuma foi pega por revisão minha.

- **Manter a query aceita é uma decisão de risco, não um não-problema.** Se algum dia entrar um
  proxy reverso na frente (a própria `SEGURANCA_CATRACA_E_MONITORAMENTO.md:129` recomenda nginx
  para HTTPS), o token volta a cair em log de proxy — e aí o motivo clássico que eu descartei na
  §3.1.1 passa a valer. A decisão está amarrada à topologia da §2.1: **mudou a topologia, as
  duas seções caem juntas.**

- **A whitelist obrigatória em push pode matar o callback em silêncio.** Se a catraca pegar IP
  por DHCP e ele mudar, o POST passa a dar 403 e ninguém percebe — a tela de monitoramento
  simplesmente para de atualizar, que é indistinguível de "não passou ninguém". Isso precisa de
  IP fixo no equipamento, e isso é tarefa da visita. Sem a visita configurar, ligar push é pior
  do que não ligar.

- **A §2.1 é a decisão mais importante e a mais fácil de inverter por engano.** "Ligue
  `trust proxy` e leia `x-forwarded-for` direito" é o conselho que qualquer busca na internet
  dá, e neste deployment ele **abre** o buraco em vez de fechar. A auditoria também sugeriu
  "proxy explicitamente confiável", pressupondo um proxy que na escola não existe. Se alguém
  ligar `trust proxy` para "consertar" o rate limit, o limite por origem passa a ser
  contornável por header e o callback volta a ser burlável — os dois de uma vez.

- **Fail-closed no boot aumenta a chance de um PC que liga e não sobe.** A R1-04D já criou essa
  exposição e a mitigação (backoff e teto no serviço Windows) é R2. Esta release acrescenta
  `MONITOR_CALLBACK_TOKEN` à lista de coisas cuja ausência impede o boot. **Se a issue de R2
  ainda estiver aberta, o risco composto é maior do que a soma** — e numa escola sem técnico o
  modo de falha é o pior possível: o sistema não liga na segunda-feira e ninguém sabe por quê.
  Considere seriamente exigir a issue de R2 fechada antes do R1-05A.

- **C-014 é o achado mais grave e o pacote com maior chance de quebrar tela.** São só 5
  referências no frontend, mas mídia é o tipo de coisa que aparece em lugar que o grep não
  pega — `src` montado dinamicamente, CSS, PDF de relatório. E a migração renomeia arquivo no
  disco de uma escola: se ela falhar no meio, algumas fotos ficam órfãs.

- **Não medi o oráculo de tempo.** Afirmo que existe pela leitura do código (bcrypt só roda com
  usuário existente), mas não medi se a diferença é explorável na rede da escola, nem qual
  limiar é honesto para o teste. Um teste de timing mal calibrado é intermitente, e teste
  intermitente é teste que alguém desliga.

- **O teto do rate limit não tem número nesta spec, de propósito, e isso é uma lacuna real.**
  Um laboratório de informática com 30 máquinas atrás do mesmo switch tem 30 origens distintas
  — mas se algum dia houver NAT, viram uma só, e o teto errado tranca a escola. Quem
  implementar precisa escolher o número **e** escrever por que ele é seguro para este prédio.

- ~~**Não sei se o WebSocket funciona hoje.** Se o realtime está morto, F vira pré-requisito de
  E e o corte desta spec se inverte.~~ **MEDIDO EM 2026-08-17 — e esta nota estava errada. A
  ordem E → F se confirma, e inverter seria perigoso. Ver §3.6.1.**

- **A projeção no payload de evento (§3.6, item 3) atravessa a fronteira da R1-04 sem que eu
  tenha verificado como.** A projeção mora em `generic-db-utils`/controllers; o `io.emit` não
  passa por lá. Pode ser que aplicar `leitura` no realtime exija um ponto de estrangulamento
  novo — e aí o E é maior do que estimei.
