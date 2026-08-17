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

1. `MONITOR_CALLBACK_TOKEN` é **obrigatório**. Ausente ou vazio → **o boot falha**
2. O token vem de `x-monitor-token`. `req.query.token` **deixa de ser aceito**
3. Comparação em **tempo constante** (`crypto.timingSafeEqual`, com igualdade de tamanho
   tratada antes para não vazar comprimento)
4. `MONITOR_IP_WHITELIST` continua **opcional** e passa a comparar contra
   `req.socket.remoteAddress` normalizado. Configurada e não casando → 403
5. O `next()` final deixa de existir como caminho incondicional: sai por 401, 403 ou por um
   `next()` alcançável **somente** depois de o token ter casado

**A declaração para de mentir.** A rota é `autenticacaoPropria('monitorCallbackAuth')` pela §4
da R1, e a barreira já confere que o middleware está na cadeia. Hoje a declaração afirma uma
proteção inexistente; ao fim deste pacote ela passa a ser verdadeira.

**Testes.**
- sem `MONITOR_CALLBACK_TOKEN` → o processo **não sobe**; nenhuma porta escutando
- token ausente → 401 · token errado → 401 · token certo em `?token=` → **401**
- token certo em `x-monitor-token` → passa
- whitelist configurada + `x-forwarded-for` forjado apontando para IP permitido, socket fora →
  **403**. Este é o teste que prova a §2.1
- nenhuma resposta de erro distingue "token ausente" de "token errado"

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

### 3.7 Contrato de realtime — `[+2A-E05/E07/E08]`

O plano manda consertar aqui porque é a release que já mexe em WebSocket. **É o único pacote
desta spec que não é segurança** — é a funcionalidade possivelmente não funcionar.

- cliente emite `join`; servidor escuta `subscribe:acessos|dispositivos|sync|stats`. Protocolo
  único e versionado
- `io(SOCKET_URL)` × `path` do nginx: separar origem, namespace e `path`
- `reconnectionAttempts: 5` e desiste em silêncio → backoff contínuo com estado visível
- **teste de contrato cliente↔servidor atrás do proxy real.** Sem isso o conserto não tem como
  ser provado

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
**E é pré-requisito de F.** B é independente.

**F é o pacote a cortar se a release esticar.** É o único que não é segurança, e o único cujo
teste exige o proxy real de pé. Cortá-lo para a R1-06 não deixa buraco de fronteira aberto —
deixa uma funcionalidade possivelmente quebrada, que já está quebrada hoje.

---

## 5. Critérios de aceite da release

- [ ] Sem `MONITOR_CALLBACK_TOKEN` o processo não sobe
- [ ] Callback recusa token em query string e aceita só por header, com comparação em tempo
      constante
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
- [ ] Handshake WebSocket sem token válido é recusado; sala é autorizada por papel
- [ ] Evento de realtime não carrega campo fora de `leitura`
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

- **Não sei se o WebSocket funciona hoje.** A segunda auditoria levanta que `join` × `subscribe`
  podem nunca ter casado. Se o realtime está morto, o R1-05E vai "consertar" autenticação de um
  canal que não entrega evento nenhum, e os testes de payload por papel vão passar por vacuidade.
  **Meça se o canal entrega alguma coisa antes de começar o E** — se não entregar, F vira
  pré-requisito de E em vez do contrário, e o corte desta spec se inverte.

- **A projeção no payload de evento (§3.6, item 3) atravessa a fronteira da R1-04 sem que eu
  tenha verificado como.** A projeção mora em `generic-db-utils`/controllers; o `io.emit` não
  passa por lá. Pode ser que aplicar `leitura` no realtime exija um ponto de estrangulamento
  novo — e aí o E é maior do que estimei.
