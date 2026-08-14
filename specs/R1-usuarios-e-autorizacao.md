# R1 — Usuários e autorização

> Especificação do arquiteto. O implementador executa; não decide arquitetura.
> Dúvida sobre algo aqui: abra issue de decisão e **pare**.
>
> Contexto obrigatório: `ESTADO-VERIFICADO.md` (V3, V8, V9, V11, V12),
> `DOMINIO-E-LACUNAS.md` §7.4, `ROADMAP-RELEASES.md` R1.

---

## 1. O problema

Hoje o SAGE tem autenticação e **zero autorização**.

**Verificado no código:**
- O login é `UnidadeEscolar.login` + `senha` — **uma credencial para a escola inteira**
- `src/utils/jwt.js` → `gerarToken(payload)` assina qualquer objeto, sem estrutura
- `src/middlewares/autenticar.js` tem 18 linhas: valida o JWT e faz `req.user = payload`
- `grep -rn "perfil|role|permissao"` em `middlewares/` e `routes/` retorna **vazio**
- `src/routes/monitoringRoutes.js` não importa `autenticar` — dez rotas sem nada

Consequências que travam o produto:

1. **"Toda liberação registra em nome de quem liberou" é impossível.** Se todas as
   secretárias entram com a mesma senha, não existe "quem"
2. **O modelo de responsabilidade da folha de ponto não fecha.** Alguém confere, assina e
   responde por aquilo. Sem identidade individual a assinatura não tem lastro
3. **`zerar-tudo` está ao alcance de qualquer um** que saiba a senha compartilhada

**Isto não é "adicionar perfis a um sistema que tem usuários". É criar a noção de usuário.**

---

## 2. Decisões de desenho

### 2.1 `Usuario` é tabela própria, com vínculo OPCIONAL a `Pessoa`

**Decisão:** não amarrar a credencial de sistema ao registro de pessoa da escola.

**Razão, que vem da ordem de instalação:** a conta administradora nasce no **passo 1** do
assistente (escola + admin) e `Pessoa` só existe no **passo 8**. Se o login dependesse de
`Pessoa`, a instalação não teria como começar — não há a quem vincular.

O vínculo existe, mas é opcional: a secretária que também está cadastrada como
`Administrador` pode ter `pessoa_id` preenchido; a conta de instalação não tem.

**Não confunda com `Administrador.cargo`.** Aquilo é função na escola. Isto é acesso ao
sistema. São eixos diferentes: existe secretária sem login, e existe login sem pessoa.

### 2.2 Dois papéis, e só

- **`ADMINISTRADOR`** — tudo, incluindo gestão de usuários, configuração e operações
  destrutivas
- **`SECRETARIA`** — operação diária: consultar, corrigir com justificativa, aprovar
  liberação, fechar período

Não invente um terceiro. Se a direção pedir acesso só-leitura depois, entra como decisão
nova — o mecanismo da §4 suporta sem refatoração.

### 2.3 O estado do usuário é verificado a cada requisição

**Decisão:** `autenticar` consulta o banco e confirma que o usuário existe e está ativo,
a cada requisição. Não confia só no que está assinado no token.

**Razão:** JWT é apátrida. Se uma secretária sai da escola e o token dela vale mais uma
hora, ela continua entrando. Num sistema on-premise, com uma máquina e tráfego baixo, uma
consulta indexada por requisição custa nada e faz o desligamento valer **imediatamente**.

Simplicidade acima de esperteza: nada de lista de revogação, nada de refresh token.

### 2.4 Desligar, nunca apagar

Usuário que sai da escola é **desativado**, jamais removido. Se fosse removido, a trilha de
auditoria passaria a apontar para um autor inexistente — e a assinatura da folha de ponto
perderia o lastro retroativamente.

---

## 3. Modelo de dados

```
Usuario
  id                  INT PK
  login               VARCHAR(100) NOT NULL UNIQUE
  senha_hash          VARCHAR(255) NOT NULL        -- bcrypt, já é dependência
  nome_exibicao       VARCHAR(100) NOT NULL        -- aparece na trilha e na tela
  papel               ENUM('ADMINISTRADOR','SECRETARIA') NOT NULL
  ativo               BOOLEAN NOT NULL DEFAULT TRUE
  pessoa_id           INT NULL  FK → Pessoa(id) ON DELETE SET NULL
  precisa_trocar_senha BOOLEAN NOT NULL DEFAULT FALSE
  falhas_login        INT NOT NULL DEFAULT 0
  bloqueado_ate       DATETIME NULL
  ultimo_acesso       DATETIME NULL
  created_at, updated_at
```

```
TrilhaAuditoria                                   -- somente inserção
  id                  BIGINT PK
  usuario_id          INT NOT NULL FK → Usuario(id)
  acao                VARCHAR(60) NOT NULL         -- vocabulário fechado
  entidade            VARCHAR(60) NULL             -- 'Pessoa', 'Acesso', ...
  entidade_id         INT NULL
  detalhe             JSON NULL                    -- SEM dado pessoal
  ocorrido_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  INDEX (usuario_id, ocorrido_em), INDEX (entidade, entidade_id)
```

**Regras da trilha:**
- `UPDATE` e `DELETE` rejeitados — sem exceção
- Registra: login e logout, criação/alteração/desativação de usuário, toda operação
  destrutiva, toda correção de registro, fechamento e reabertura de período
- `detalhe` **nunca** carrega nome, CPF, RG, e-mail, foto, QR ou cartão. Só identificadores

Migration segue a regra de expand-only (ADR-0011).

---

## 4. Autorização — o mecanismo

O ponto desta release **não é uma tabela; é impedir que o V3 volte a acontecer.**

### 4.1 Declaração obrigatória por rota

Toda rota declara explicitamente o acesso exigido. **Rota sem declaração é negada** — não
liberada. Falha fechada, conforme AGENTS.md §4.6.

```js
// forma esperada; o nome exato fica a critério do implementador
router.post('/pessoas', exige('ADMINISTRADOR'), peopleController.criar);
router.get('/relatorios/resumo', exige('SECRETARIA'), relatorioController.resumo);
router.get('/health', publica(), statusController.health);
```

`publica()` é declaração explícita, não ausência. **Ausência sempre nega.**

**A declaração diz por que aquele nível de acesso é o certo, não só qual é.** São quatro
tipos, e não existe um quinto (§4.4):

| Tipo | Significa |
|---|---|
| `exige(papel)` | Requer usuário SAGE autenticado com o papel |
| `preAutenticacao(motivo)` | Não pode exigir credencial porque a credencial é o que está sendo obtida ou criada |
| `autenticacaoPropria(nome)` | Máquina-a-máquina, com esquema de autenticação próprio não-JWT |
| `publica()` | Decidimos que qualquer um pode. **Lista fechada** — §4.4 |

### 4.2 Barreira automática no CI

Um teste varre **toda a árvore Express efetivamente registrada** — subrouters carregados por
`loadRoutes` e rotas montadas direto em `app.js` — e reprova se alguma rota não trouxer uma
das quatro declarações. Isso é o que impede a regressão daqui a seis meses, quando ninguém
lembrar desta especificação.

**A barreira não tem recorte.** Excluir da varredura justamente as rotas que não couberam na
tabela institucionaliza o buraco que a barreira existe para achar.

Para `autenticacaoPropria(nome)`, a barreira exige mais: **o middleware nomeado tem que estar
de fato na cadeia registrada daquela rota.** Sem essa checagem a declaração vira etiqueta, e
alguém remove o middleware um dia sem a barreira notar.

### 4.3 Classificação das rotas

O implementador não escolhe por intuição. A regra:

| Categoria | Papel | Exemplos |
|---|---|---|
| Destrutiva ou de configuração | `ADMINISTRADOR` | `comecar-do-zero`, `zerar-tudo`, `zerar-logs`, `limpar`, promoção, importação, gestão de usuário, config de dispositivo |
| Escrita de dado de negócio | `SECRETARIA` | criar/editar pessoa, turma, grade, aprovar solicitação |
| Leitura de dado de negócio | `SECRETARIA` | relatórios, listagens, histórico |
| Infraestrutura sem dado | `publica()` | `GET /health`, `GET /ready` |
| **Monitoramento `[V11]`** | **`ADMINISTRADOR`** | as dez rotas de `monitoringRoutes.js` |
| **Bootstrap, login e recuperação** | **`preAutenticacao()`** | `GET /setup/status`, `POST /setup/initialize`, `POST /escolas/login/:id`, `POST /escolas/recuperar-acesso` |
| **Callback da catraca** | **`autenticacaoPropria()`** | `POST /api/notifications/dao` |
| **Caminho que tem que funcionar quebrado** | **`publica()`** | `GET /status`, `GET /diagnostico` |

**Sobre o monitoramento:** hoje `/monitoring/state`, `/monitoring/users` e `POST /monitoring/cache/clear`, a única que muta,
não têm autenticação nenhuma. Todas passam a exigir administrador.

**Sobre a superfície duplicada `[V12]`:** `loadRoutes.js:16` monta todo `*Routes.js` em `/`,
e `app.js:99` monta `monitoringRoutes` **de novo** em `/monitoring`, criando
`/monitoring/state` e `/monitoring/monitoring/state`. **Elimine a montagem duplicada** —
senão a proteção precisa ser aplicada duas vezes e alguém vai esquecer uma.

**`GET /diagnostico-acessos/:id` (`app.js:104`) não se classifica — se apaga.** É a mesma
superfície duplicada do `[V12]`: expõe o mesmo `dispositivosController.diagnosticoAcessos`
que `deviceRoutes.js:16` já expõe em `/dispositivos/:id/diagnostico-acessos` **com**
`autenticar`. Mesmo controller, duas portas, e a segunda sem cerca. Pior: a cerca que ela tem
falha **aberta** — `if (!isDev && key !== undefined && req.query.key !== key)`; sem
`DIAGNOSTICO_KEY` definida, `key === undefined`, a condição inteira é falsa e a rota passa em
produção. É o anti-padrão literal do AGENTS.md §4.6 e o achado `[C-008]`. Apague a montagem de
`app.js`; a rota sobrevivente recebe `exige('ADMINISTRADOR')`.

Se surgir rota que não cabe em nenhuma das categorias: **issue de decisão, e pare.**

### 4.4 Os três tipos que não são `exige()`

**`preAutenticacao(motivo)`** — bootstrap, login e recuperação.

Não é "qualquer um pode": é "não pode exigir credencial porque a credencial é o que está
sendo obtida ou criada". Colapsar isso em `publica()` apaga a diferença, e é justamente o
atalho que faz `publica()` virar lixeira. Guardas obrigatórias, cada uma com teste:

- Rate limit por IP `[C-015]`
- Resposta indistinguível entre usuário inexistente e senha errada `[C-015]`
- `POST /setup/initialize` só responde enquanto o sistema **não** estiver configurado. A
  guarda já existe e é boa — loopback-only, `GET_LOCK`, e `COUNT(*) != 0 → 409`. Ela passa a
  ter **teste de regressão nomeado**, porque é a única coisa entre a rede da escola e a tomada
  do sistema por quem chegar primeiro

**`autenticacaoPropria(nome)`** — `POST /api/notifications/dao`.

É máquina-a-máquina, não existe usuário SAGE do outro lado. `exige()` quebraria o callback e
`publica()` mentiria sobre o que protege a rota. A declaração **nomeia** o middleware que é a
autenticação dela — `monitorCallbackAuth` — e a barreira confere que ele está na cadeia.

⚠️ **`monitorCallbackAuth` hoje falha aberto.** Sem `MONITOR_CALLBACK_TOKEN` e sem
`MONITOR_IP_WHITELIST` no `.env`, ele chama `next()` sem verificar nada; e a whitelist confia
em `x-forwarded-for`, que o cliente escolhe. **Preserve o middleware, mas não declare que a
rota está autenticada.** O conserto é `[C-006]` e é da R1-05 — abra a issue agora e
referencie-a na declaração, para que a dívida fique visível no código e não só no plano.

**`publica()` é lista fechada.** Exatamente quatro rotas: `GET /health`, `GET /ready`,
`GET /status`, `GET /diagnostico`. Acrescentar uma quinta exige decisão registrada.

`/status` e `/diagnostico` ficam públicos **de propósito**: são o caminho que precisa
funcionar quando o sistema está quebrado, inclusive quebrado no login — que é exatamente
quando alguém precisa deles (RNF-12). Exigir credencial neles é exigir que o sistema esteja
saudável para que se possa descobrir que ele não está. O comentário que já existe em
`statusRoutes.js:125-133` argumenta isso e o argumento está correto.

A contrapartida é que **o controle passa a ser o conteúdo, não o acesso**: o teste de redação
da §7 nomeia essas duas rotas e reprova o build se a resposta trouxer dado pessoal ou segredo.
Segredo aparece só como `[DEFINIDO]`/`[NAO_DEFINIDO]`.

---

## 5. Sessão e credencial

- JWT com claims estruturados: `usuario_id`, `papel`, `emitido_em`. **Rejeite token cujo
  formato não bata** — hoje `gerarToken` assina qualquer coisa
- `autenticar` valida a assinatura **e** confirma no banco que o usuário existe e está ativo
- Senha com bcrypt, reaproveitando o `hashSenha` que já existe
- Mínimo de 8 caracteres, mantendo o critério que já vale para a escola
- Bloqueio temporário após falhas repetidas, no mesmo desenho de
  `recuperacao_falhas`/`recuperacao_bloqueada_ate` que a branch `wip/` introduziu
- **Recuperação:** o administrador redefine a senha de qualquer usuário. O administrador
  recupera a própria conta pela chave local já existente em `UnidadeEscolar`. **Não
  construa fluxo por e-mail** — a instalação é on-premise sem SMTP garantido, e a branch
  `wip/` removeu esse caminho justamente por isso

---

## 6. Migração — não trave ninguém para fora

A instalação existente tem uma credencial em `UnidadeEscolar.login`/`senha`, e todo mundo a
conhece.

1. A credencial existente vira o **primeiro usuário `ADMINISTRADOR`**, preservando login e
   hash — ninguém fica de fora no dia da atualização
2. Esse usuário nasce com `precisa_trocar_senha = TRUE`
3. No primeiro login, troca obrigatória antes de qualquer outra ação
4. `UnidadeEscolar.login`/`senha` **param de ser caminho de autenticação**. Não remova as
   colunas nesta versão — expand-only (ADR-0011). Remoção fica para uma versão futura
5. A tela de administração permite criar as contas individuais das secretárias

---

## 7. Critérios de aceite

**Identidade**
- [ ] Dois usuários distintos produzem registros de trilha com autores distintos
- [ ] Usuário desativado é recusado **na requisição seguinte**, sem esperar o token expirar
- [ ] Usuário desativado não some da trilha; o histórico dele continua atribuível
- [ ] Login com credencial migrada exige troca de senha antes de qualquer outra ação

**Autorização**
- [ ] Token de `SECRETARIA` é recusado com **403** em rota de `ADMINISTRADOR`
- [ ] Requisição sem token é recusada com **401**
- [ ] **Rota sem declaração de papel é negada em tempo de execução**
- [ ] **O CI reprova quando uma rota nova não declara nenhum dos quatro tipos**
- [ ] A barreira varre a árvore Express **inteira** — `loadRoutes` e o que é montado em `app.js`
- [ ] `autenticacaoPropria('monitorCallbackAuth')` reprova se o middleware nomeado sair da cadeia
- [ ] `POST /setup/initialize` responde 409 com o sistema já configurado — teste nomeado
- [ ] `publica()` aplicado a uma quinta rota reprova o build
- [ ] As dez rotas de `monitoringRoutes.js` exigem administrador `[V11]`
- [ ] Não existe mais superfície duplicada de monitoramento `[V12]`
- [ ] `GET /diagnostico-acessos/:id` não existe mais em `app.js`; a rota em `deviceRoutes.js` exige administrador `[C-008]`
- [ ] `comecar-do-zero` (o apagamento global do banco), `zerar-tudo` e as demais rotas destrutivas exigem administrador `[V8]`

**Trilha**
- [ ] `UPDATE` e `DELETE` em `TrilhaAuditoria` são rejeitados
- [ ] Toda operação destrutiva gera entrada com autor
- [ ] Teste de redação: nome, CPF, RG, e-mail ou token sintético em `detalhe` reprova o build

**Regressão**
- [ ] Cada critério acima tem teste que **falha antes** da correção e passa depois

---

## 8. Fora de escopo — não construa

Auto-cadastro de usuário · recuperação por e-mail · SSO ou login federado · permissão
granular por recurso · multi-escola ou escopo por unidade · perfil só-leitura ·
autenticação de dois fatores.

Qualquer um deles: issue de decisão primeiro.

---

## 9. Onde isto pode dar errado

- **A classificação de rotas é a parte que mais provavelmente sai errada.** São mais de cem
  rotas e a tabela da §4.3 é uma regra, não uma lista. Espero divergência em casos de
  fronteira — por isso a instrução é abrir issue, não decidir sozinho.
- **Consultar o banco a cada requisição é decisão de simplicidade, não de desempenho.** Se
  o sistema um dia atender muitas requisições simultâneas, isso vira gargalo. Para uma
  escola numa máquina só, é a escolha certa. Está registrado para quando deixar de ser.
- **`precisa_trocar_senha` pode travar a instalação existente** se a tela de troca tiver
  qualquer defeito — é o caminho por onde todo mundo passa no dia da atualização. Precisa de
  teste de ponta a ponta, não só unitário.
- **Dois papéis podem ser pouco.** A coordenação pode querer ver relatório sem poder
  corrigir. Deliberadamente não construí — mas se a escola pedir, é decisão nova, não
  conserto.
- **Não sei quantas rotas o frontend chama sem tratar 403.** Hoje só existe 401. A tela
  pode quebrar de formas estranhas quando o backend passar a negar por papel. A fatia E da
  auditoria deve olhar isso, e o pacote do frontend precisa acompanhar esta release.
- **Quatro tipos de declaração podem virar quatro lixeiras.** Reduzi o risco tornando
  `publica()` lista fechada e fazendo a barreira conferir o middleware nomeado em
  `autenticacaoPropria`. Mas `preAutenticacao(motivo)` aceita motivo livre — nada impede
  alguém de escrever um motivo qualquer e passar. A revisão humana é o único controle ali.
- **`/status` e `/diagnostico` públicos são uma aposta na redação, não no acesso.** Se o
  sanitizador tiver furo, a rota entrega estado operacional da escola para a rede inteira. A
  aposta é deliberada e o motivo é bom, mas o teste de redação passa a ser um controle de
  segurança de primeira linha, não um detalhe de qualidade.
- **Mandei apagar `/diagnostico-acessos/:id` sem saber quem chama.** Se alguma ferramenta
  interna ou atalho do Caio usa aquela URL, ela quebra. A rota autenticada equivalente existe
  e serve, mas o caminho muda.
