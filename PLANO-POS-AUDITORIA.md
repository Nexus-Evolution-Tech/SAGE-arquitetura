# Plano de execução pós-auditoria

> Escrito pelo arquiteto em 2026-08-06, com o inventário de 99 achados na mão.
> **Supersede a seção de conteúdo das releases em `ROADMAP-RELEASES.md`.** A estrutura
> daquele documento (releases como estados, visita como pivô) continua valendo; o que muda é
> o que cabe em cada uma.
>
> Este é o documento que o Codex segue. Fonte dos achados: `auditoria/INVENTARIO.md`.

---

## Estado verificado — fechamento documental da R1 (2026-08-26)

Esta seção atualiza o estado verificável sem apagar o histórico de planejamento abaixo. O
recorte é documental: não implementa código, não altera testes de aplicação e não fecha a R1
inteira nem declara o produto terminado antes da validação final.

### Evidências verificadas

- O achado de `Adicionar.js` que inventava uma foto foi corrigido no SAGE pelo commit
  [`a342781`](https://github.com/Nexus-Evolution-Tech/SAGE/commit/a3427814dced2bdc560b97c89c970a17f7094eca),
  integrado na branch `wip/recuperacao-local-pre-auditoria` pelo merge
  [`2e18e95`](https://github.com/Nexus-Evolution-Tech/SAGE/commit/2e18e95f6097dbae20c494f9a94164f63d4bfa97).
  A evidência de teste é `src/components/pages/Adicionar/Adicionar.contract.test.js`.
  A execução remota [`33012409366`](https://github.com/Nexus-Evolution-Tech/SAGE/actions/runs/33012409366)
  terminou verde; a suíte final registrou **18 suítes e 57 testes**, e o build foi compilado no
  Windows.
- R1-02, R1-03, R1-04, R1-05 e R1-07 possuem os commits e testes dos respectivos pacotes já
  auditados. Isso é estado verificado desses recortes, não a conclusão da R1: a validação final
  da release ainda é necessária.
  As referências verificáveis dos testes auditados são: R1-02, SAGE-API PRs #65/#68 e
  `test/r1-02a-autorizacao-primitivas.test.js` / `test/r1-02b-barreira-rotas.test.js`; R1-03,
  PRs #71/#76/#81/#82/#84/#85/#86 e os testes `test/r1-03*.test.js`; R1-04, PRs
  #89/#95/#97/#100/#104/#108 e os testes `test/r1-04*.test.js`; R1-05, SAGE-API PRs
  #110/#112/#114/#116/#118/#120 e SAGE PRs #19/#21/#23/#25, com os testes `test/r1-05*.test.js`,
  `ci/r1-05f-websocket-proxy.test.js` e os testes de WebSocket do frontend; R1-07, SAGE PRs
  #28/#32/#34/#36/#38, com os testes de identidade, senha, sessão, papel e Settings.
- O `AGENTS.md` de `_arquitetura/repo` já está atualizado pelo commit
  [`1e43eeb`](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/commit/1e43eebb8045b92031575d28cd58fd48878071d7),
  e o espelho em `SAGE-API/AGENTS.md` já existe pelo commit
  [`25826bd`](https://github.com/Nexus-Evolution-Tech/SAGE-API/commit/25826bd5afaf9b08eb3033f41a767965960bb70c).
  Não reescrever `AGENTS.md` neste pacote.

### Pendências classificadas

- **#93 — duplicação de Sala:** permanece aberta.
- **#96 — política/matriz de `qr_code`/`cartao_rfid`:** permanece aberta e não está resolvida.
  A decisão arquitetural consultada é provisória: manter os campos em fluxos autorizados, sem
  restrição global a `ADMIN`, até existir matriz explícita, testes e documentação.
- **#47 — smoke/ACL Windows:** permanece como pendência de ambiente a acompanhar. O CI verde
  deste pacote não resolve nem substitui a investigação do problema ambiental.

### Candidatos a fechamento

Com base apenas na evidência já auditada, ficam indicados como candidatos a fechamento os
pacotes/issues **#62, #69, #72, #75, #77, #87, #92, #94, #101 e #67**. Esta indicação não marca
nenhuma issue do GitHub como fechada e não substitui a validação de cada fechamento.

---

## 0. O que a auditoria mudou no plano

Escrevi o roadmap apostando que "a R0 engorda, a sequência não muda". **Errei em três pontos**,
e os três estão corrigidos aqui:

1. **O instalador não estava quase pronto.** Blue/green nunca foi implementado — não existe
   ponteiro atômico, e o rollback aponta para os arquivos recém-sobrescritos. Era a release
   que eu achava mais barata; virou uma das mais caras.
2. **O offset (V1/B-001) não pode ser corrigido antes da visita.** Eu o pus como segunda
   tarefa da R0. Está errado: unificar o offset sem saber o que já está gravado na catraca
   pode orfanar todo mundo. É **bloqueado no campo**.
3. **A instalação limpa está quebrada de forma determinística** (A-008). Nada disso importa
   até isso ser corrigido, porque nem a primeira instalação completa.

---

## 0-bis. A segunda auditoria (enxertada em 2026-08-11)

Um segundo agente auditou **o mesmo snapshot** (`wip/recuperacao-local-pre-auditoria`, backend
`9e3eaba`, frontend `06c1ed4`) de forma independente, e produziu 92 achados em 6 fatias (A–F).
Os arquivos estão em `SAGE-WS/auditoria/`, fora deste repositório. **Ele não alterou uma linha
de código** — os dois clones estão limpos.

**As duas auditorias concordam no diagnóstico central**, e isso é o resultado mais importante:
dois auditores independentes chegaram a "não instalar hoje" pelos mesmos caminhos destrutivos,
e o segundo reencontrou sozinho o achado D1 (o "Liberar acesso" que só pinta a tela).

**Onde ela me superou** — enxertado acima, marcado `[+2A-*]`: `DELETE /dispositivos` (segunda
rota de destruição global, **SEV1**), fallbacks destrutivos no frontend, dado inventado em
`Adicionar.js`, identidade real no bundle, HTTP puro sem TLS, contrato de Socket.IO quebrado,
saída sobrescrevendo chegada, fuso ambíguo, dedup por nome, e o grupo `1` promovido de pergunta
a achado.

**Onde esta continua sendo a fonte:** ela cobriu 6 fatias; esta cobriu 8. Não há equivalente
para **A-008** (`DELIMITER $` quebrando a instalação limpa — o `[BLOQUEIA TUDO]`), **H-001**
(versão congelada em `1.0.0`) nem **H-002** (contrato de faixa de schema, que inviabiliza o
rollback justamente na atualização que muda schema). A fatia G (harness de teste), base do
R-LAB, também não existe lá.

**Ressalva de leitura:** ela auditou o snapshot **anterior** aos PRs #34–#40 do Codex. Parte
dos achados dela em transação e falha parcial pode já estar corrigida. Confira antes de abrir
issue duplicada.

---

## 1. Regras que valem em todo o plano

**Do AGENTS.md e dos ADRs, sem exceção:** nunca invente dado · nunca engula erro · nunca dado
pessoal em log, issue ou PR · escrita na catraca é idempotente · decisão de segurança falha
fechada · escrita multi-passo usa transação · o atualizador nunca toca em `dados/` ·
correção de bug exige teste que falha antes e passa depois · operação irreversível exige
backup verificado por releitura · migrations só expandem.

**Dependências que não podem ser invertidas** (da auditoria, §6 — respeite literalmente):

- Não unificar `CATRACA_USER_ID_OFFSET` antes de mapear os usuários existentes na catraca
- Não mover cursor ou piso de log antes de capturar as faixas por dispositivo
- Não reabrir zeragem antes de provar restore completo
- Não declarar rollback do Windows sem testar migration nova seguida de volta ao release anterior
- Não entregar frontend da R1 antes de o backend distinguir 401 de 403
- Não habilitar diagnóstico ou telemetria antes de autenticação e redação

**Disciplina:** uma issue por pacote, uma branch por issue, um PR por branch, **PR ≤ ~300
linhas**. Se o pacote estoura, quebre o pacote. Um pacote por vez.

---

## R-LAB — Laboratório reproduzível `[PRIMEIRO DE TUDO]`

**Por que primeiro:** a auditoria inteira foi estática. Nenhuma suíte rodou. Sem laboratório,
toda correção daqui para frente é "parece que funciona" — e a maioria dos 50 SEV2 é sobre
transação, DDL e ordem de operação, que é justamente o que análise estática erra.

- [ ] Node 24 disponível na máquina de trabalho (o `.exe` já leva o seu; isto é para o CI e o dev)
- [ ] MySQL descartável para teste, com guarda que **recusa rodar se `DB_NAME` não terminar em `_teste`**
- [ ] VM Windows descartável com snapshot, para exercitar instalador
- [ ] `npm ci && npm test` verde numa máquina limpa
- [ ] CI com job Node 24 + MySQL obrigatório

Fecha: G-006, H-005 e H-007 parcialmente. **Torna todo o resto verificável.**

---

## R0 — Contenção

**Objetivo:** o sistema para de perder dado, para de mentir sucesso, e a instalação limpa funciona.

### R0-01 — Baseline de instalação `[A-008]` `[BLOQUEIA TUDO]`
`DELIMITER $$` em `database/sage.sql:321` não é SQL — é comando do cliente mysql. Executado
por driver, é erro de sintaxe, e vem **depois** dos `CREATE TABLE`: meio schema aplicado, depois falha.
- [ ] Instalação limpa completa em MySQL descartável, do zero ao `/ready`
- [ ] Teste que falha antes e passa depois

### R0-02 — Schema convergente e migrations seguras `[A-009, A-010, A-016]`
- [ ] `DROP COLUMN` fora do ledger eliminado; migrations expand-only
- [ ] CI reprova PR com `DROP COLUMN` ou `RENAME`
- [ ] Schemas legados de `Sala`, `HorarioAula`, `Presenca` convergem
- [ ] Backup verificado por releitura **antes** de qualquer migration `[H-003]`

### R0-03 — Config fail-fast `[D-001, D-003, F-003, F-008]`
`parseInt('abc')` é `NaN`, e `NaN <= 0` é **falso** — a guarda não pega. `setInterval(fn, NaN)`
vira 1 ms e satura a máquina.
- [ ] Toda variável numérica de ambiente é validada; valor inválido **impede o boot** com mensagem clara
- [ ] `SAGE_DATA_DIR` ausente não deixa estado dentro do release
- [ ] Teste: `MONITOR_POLLING_INTERVAL_MS=abc` não sobe o sistema

### R0-04 — Parar de mentir sucesso `[A-012, A-014, B-003, B-004, B-005, C-007]`
A família mais perigosa: falha parcial reportada como sucesso, e a pendência sai da fila.
- [ ] Falha parcial **nunca** retorna 2xx nem `sucesso: true`
- [ ] `UPDATE`/`DELETE` remoto que falha **não** remove a pendência da outbox
- [ ] Callback com falha total ou parcial **não** responde 200
- [ ] Lote da outbox não é monopolizado por dispositivo offline
- [ ] Um teste de regressão por item

### R0-05 — Cercar a destruição `[A-004, B-011, B-012, D-004, D-005, +2A-M002, +2A-E16, +2A-E17]`
- [ ] `comecar-do-zero` exige confirmação por valor digitado, backup **restaurado-prova**, transação e registro de autoria
- [ ] Dump reprovado **não** conta como recente e **não** deixa status verde
- [ ] Backup da catraca recusa conteúdo parcial; existe caminho de restore
- [ ] Teste: falha no meio não apaga nada

**Acrescentado pela segunda auditoria — segunda rota de destruição global `[SEV1]`:**

`DELETE /dispositivos` (`deviceRoutes.js:30`) chama `limparUsuariosPorPrefixo11`
(`controlId-utils.js:308`), que varre **todos** os dispositivos com `sync_enabled`, seleciona
IDs por `String(id).startsWith("11")` e emite um `destroy_objects` por usuário.

**Verificado pelo arquiteto, e é pior que o relatado:** o `USER_ID_OFFSET` é `110000000` /
`111000000` — **todo usuário provisionado pelo SAGE começa com `11`**. O filtro não é um
recorte, é um "todos". Um `try/catch` único envolve o laço inteiro e só registra em log:
falha no meio deixa catracas em estado misto e não propaga nada.

- [ ] Rota genérica `DELETE /dispositivos` **removida**. Se a operação precisa existir, exige
      escopo de um dispositivo, seleção por identidade mapeada, prévia contável, backup
      restaurado-prova e confirmação por valor digitado
- [ ] Erro por dispositivo é propagado; parcial **nunca** vira sucesso
- [ ] Teste: rota recusa executar sem escopo explícito

**Fallbacks destrutivos no frontend:**
- [ ] `Aulas.js:189-207` — falha de *detach* **não** pode escalar para `deletarAula(id)`.
      Falha transitória apagando a entidade é ampliação de escopo destrutivo
- [ ] `HorarioFixoForm.jsx:24-76` — GET falho substitui o estado por linhas vazias e o salvar
      envia `horarios: []`. Leitura que falha **não** habilita escrita
- [ ] Teste para os dois: primeira requisição rejeitada não amplia a operação

### R0-06 — Rotação de log e crescimento `[V10, D-*]`
- [ ] `maxsize` e `maxFiles`; teto total em disco documentado
- [ ] Disco cheio produz erro visível, não falha silenciosa

### R0-07 — `catch` vazio, `console.log` e dado inventado `[V4, V5, +2A-E21, +2A-novo]`
- [ ] Nenhum dos dois em `src/`, verificável por lint, com CI reprovando

**Acrescentado — violações literais dos invariantes:**
- [ ] `Adicionar.js:94-128` — `if (!payload.foto) payload.foto = "foto_exemplo.png"`. Ausência
      de foto vira nome de arquivo fictício **persistido como dado da pessoa**. É o invariante
      "nunca invente dado" quebrado numa linha
      **Estado verificado em 2026-08-26:** corrigido no SAGE por `a342781`, integrado por
      `2e18e95`, com `Adicionar.contract.test.js` e CI remoto `33012409366` verde. O checkbox
      permanece histórico do plano e não deve ser convertido em conclusão de R0 neste pacote.
- [ ] `controlId-utils.js:236` — `catch (err)` cujo corpo referencia `error`. O caminho de erro
      lança `ReferenceError` e destrói a causa original. **Achado do arquiteto; nenhuma das
      duas auditorias pegou.** Procure o mesmo padrão no resto do arquivo
- [ ] Lint proíbe referência a identificador não declarado em bloco `catch`

**Não faça na R0:** offset, piso de log e cursor. São bloqueados no campo — ver R-CAMPO.

---

## R1 — Identidade e superfície

**Especificação completa e obrigatória:** `specs/R1-usuarios-e-autorizacao.md`. Leia inteira
antes de escrever código.

**R1-04 tem spec própria:** `specs/R1-04-vazamento-em-resposta-e-log.md` — cobre `[C-001]`
`[C-016]` `[C-017]` `[C-019]` `[A-001]` `[A-002]` `[+2A-C10]` e corta o pacote em R1-04A..E.
**Integrada em `bf6562e`.**

**R1-05 tem spec própria:** `specs/R1-05-fronteira-e-falha-fechada.md` — cobre `[C-006]`
`[C-008]` `[C-009]` `[C-013]` `[C-014]` `[C-015]` e o contrato de realtime, cortado em
R1-05A..F. A decisão que governa a release está na §2: **`trust proxy` desligado,
`x-forwarded-for` nunca lido, origem = endereço do socket** — porque a escola não tem proxy.
**Integrada em `b181b704`** (API) e `76f5beb` (frontend).

**R1-07 tem spec própria:** `specs/R1-07-frontend-identidade-e-autorizacao.md` — cobre
`[E-003..E-007]` e `[+2A-E20]`, cortado em R1-07A..E, **todo no repo `SAGE`**. É o último pacote
de implementação da R1. A §2.1 governa: **papel lido no cliente decide o que desenhar, nunca o
que autorizar** — o servidor continua sendo a única autoridade.

Acrescente a ela, da auditoria:

- [ ] `GET /escolas` para de devolver hash de senha e contato `[C-001]`
- [ ] `/uploads` deixa de ser público; foto de pessoa exige autorização `[C-014]`
- [ ] Diagnóstico falha **fechado** sem chave — hoje é o anti-padrão literal do AGENTS.md §4.6 `[C-008]`
- [ ] Callback do monitor falha fechado e para de confiar em `x-forwarded-for` `[C-006]`
- [ ] WebSocket exige autenticação; nada de evento global anônimo `[C-009]`
- [ ] Upload autentica **antes** de gravar, com limite e validação de tipo `[C-013]`
- [ ] Login com rate limit e sem diferenciar usuário inexistente de senha errada `[C-015]`
- [ ] Log HTTP para de gravar segredo em query string `[C-017]`
- [ ] Identificadores SQL deixam de vir de chaves do corpo da requisição `[A-001]`
- [ ] Credencial de catraca deixa de ser persistida e devolvida em claro `[A-002]`
- [ ] Erro global para de devolver `err.message` em produção `[C-016]`
- [ ] Loader que engole erro para de deixar `/health` verde com rotas parciais `[C-019]`

- [ ] Caminho de foto vindo do banco é **contido** antes de `unlinkSync` — hoje
      `peopleService.js:189-196` faz `path.join(baseUploads, pessoa[0].foto)` sem teste de
      contenção, e a edição aceita persistir referência manipulada `[+2A-C10]`

**Frontend, na mesma release** `[E-003..E-007]` — hoje **nenhuma das 21 telas trata 403**:
- [ ] 403 **preserva a sessão**; só 401 desloga
- [ ] Cache e WebSocket limpam por identidade ao trocar de usuário
- [ ] Ações de administrador ficam ocultas para secretaria
- [ ] Primeiro login força troca de senha
- [ ] `Settings.js:33-48` — `DADOS_UNIDADE_INICIAL` traz nome, identificadores, endereço e
      contato de uma unidade real **dentro do bundle**, usados como estado inicial quando
      `/unidade` falha. Fallback passa a ser neutro; identidade vem do onboarding `[+2A-E20]`

**Contrato de realtime — a release que já mexe em WebSocket é a que conserta** `[+2A-E05/E07/E08]`.
A segunda auditoria mostrou que o problema não é só de autenticação: **o realtime pode
simplesmente não estar funcionando.**
- [ ] Cliente emite `join`; servidor só escuta `subscribe:acessos|dispositivos|sync|stats`
      (`useWebSocket.js:72-99` × `wsServer.js:59-75`). Protocolo único, versionado
- [ ] `io(SOCKET_URL)` passa `/backend` como namespace enquanto o nginx espera
      `/backend/socket.io/` — separar origem, namespace e `path`
- [ ] `reconnectionAttempts: 5` e depois desiste em silêncio. Reconexão contínua com backoff
- [ ] **Teste de contrato cliente↔servidor**, atrás do proxy real. Sem isso o conserto não
      tem como ser provado

---

## R2 — Ativação e distribuição

**Decisão de escopo do arquiteto:** **não reescrever o instalador.** A auditoria recomendou
reescrita por densidade (7,78/100 LOC). Densidade engana aqui — o relatório credita controles
que estão certos e são caros de acertar: segredos por CSPRNG com ACL, SHA-256 antes de extrair,
MySQL só em loopback, LocalService com service SID, firewall restrito, uninstall que preserva
dado e valida propriedade.

**Substitua a camada de ativação**, não as 2.648 linhas. Da ordem de 500: `complete-install.ps1`,
a parte de `[Files]`/ativação do `SAGE.iss`, e como `provision-services.ps1` resolve caminho,
com respingo nos templates XML.

- [ ] **Identidade de release real** — hoje a versão é `1.0.0` congelada, e duas builds
      diferentes ocupam a mesma pasta `[H-001]`
- [ ] **Diretório imutável por versão**; build recusa se a identidade já existir com conteúdo diferente
- [ ] **Ponteiro atômico** (junction) do qual o serviço parte. Hoje `current.json` é um JSON
      movido depois do start, não o ponteiro de ativação
- [ ] **Rollback = trocar o ponteiro.** Nada de recopiar arquivo
- [ ] **Contrato de faixa de schema por release** `[H-002]` — hoje o código antigo recusa o
      ledger com `MISSING_LOCAL_FILE`, então justamente a atualização que muda schema
      inviabiliza o rollback. **Trabalho separado e de tamanho comparável ao da ativação**
- [ ] **Parada de serviço transacional** `[H-004]` — hoje para a API, falha ao parar o MySQL,
      e aborta com a API parada, sem religar
- [ ] **Preflight antes de `[Files]`** `[H-005]`: versão do Windows, espaço, **porta 3307**,
      relógio, permissões. E ledger de instalação com compensação inversa
- [ ] **CI constrói e testa o `.exe`** `[H-007]` — hoje o workflow nunca chama
      `build-installer.ps1` nem compila o `.iss`. Com fault injection por etapa, SHA-256 e proveniência
- [ ] **Caminho único** `[H-006]` — eliminar os literais `C:` de `stop-mysql.ps1` e a divergência
      entre `{app}` e `%ProgramFiles%\SAGE`
- [ ] **Reinstalação após uninstall** funciona apesar das ACLs preservadas `[H-010]`
- [ ] **Mensagens acionáveis** `[H-012]`: código de erro, etapa, ação. Hoje diz "Consulte os
      logs locais", sem caminho

**Fronteira de confiança e transporte** `[+2A-E02]` — **decidido em ADR-0014. Leia antes de
codar.** O teto de implantação é duas máquinas na mesma LAN, e a decisão segue disso:

- **T1, uma máquina — o padrão.** API escuta só em `127.0.0.1`. **Sem TLS**, porque sem fio não
  há escuta, e um certificado a mais é um certificado a mais para expirar sozinho no campo
- **T2, duas máquinas — modo explícito.** TLS obrigatório, com CA local gerada pelo instalador,
  validade de **10 anos** por decisão consciente (ver ADR-0014 sobre expiração remota)

- [ ] API escuta em loopback por padrão; abrir para a LAN é configuração explícita
- [ ] Habilitar T2 gera CA + folha por CSPRNG, com a mesma ACL dos demais segredos
- [ ] Instalador produz `confiar-sage.cer` e instrução para a segunda máquina
- [ ] Em T2, `http://` responde redirecionamento; nada operacional trafega em claro
- [ ] `nginx.conf` e o atalho do `SAGE.iss` deixam de fixar `http://`
- [ ] Readiness expõe a data de expiração do certificado
- [ ] Teste: subir em T1 **não** gera certificado nenhum

**MySQL:** implementado conforme **ADR-0013**, que supersede o ADR-0001. Embarcado, serviço do
Windows, porta 3307. **Não refaça isso** — `[H-011]` está resolvido por decisão, não por código.
Fica aberto, para o dono do produto e não para o implementador: `signatureVerification: pending`
e `redistribution: legal-review-required` no `artifacts.json`.

---

## R3 — Olhos remotos

**Portão:** `redact.js` não existe. **Nada sai antes dele.**

- [ ] Redação com teste adversarial: CPF, RG, e-mail, nome e JWT sintéticos reprovam o build `[V6]`
- [ ] Heartbeat de saída cobrindo processo, banco e catraca
- [ ] Erro com contexto, redigido, com código estável e identificador de ocorrência
- [ ] Indicador que uma secretária entende: "não estou registrando"
- [ ] Support bundle determinístico com manifesto
- [ ] **Aviso de expiração de certificado com 180 dias de antecedência** `[ADR-0014]`. Só existe
      em T2. É o que impede a segunda máquina de cair sozinha sem ninguém no local

Telemetria nunca é requisito (ADR-0012): sem internet, a catraca ainda gira.

---

## ▶ R-CAMPO — A visita

**O checklist está pronto:** `auditoria/INVENTARIO.md` §4 traz **14 perguntas exatas** —
offset por catraca, faixa de `access_logs.id` por dispositivo, timezone do Windows/MySQL/catraca,
`device_id` do push, qual backup foi restaurado de fato, política de TI, permissões do grupo `1`.

Acrescente: Wireshark durante uso do software oficial da Control iD, tempo do MySQL até aceitar
conexão naquele HD, tempo real do `destroy_objects`, se a catraca aceita liberar **uma passagem
específica** sob demanda, e quantos grupos e faixas de horário ela comporta.

**Acrescentado pela segunda auditoria — duas perguntas que viraram bloqueantes:**

- **O grupo `1` significa mesmo liberação total?** `controlId-utils.js:224` grava todo mundo em
  `group_id: 1`, com o comentário `// grupo default - libera todo mundo`. Se for verdade,
  **hoje ninguém tem restrição física nenhuma** — o SAGE nunca aplicou política na catraca, e
  toda a R8 parte de um estado em que a autorização real é "todos liberados". Levantar quais
  `access_rules` e portais referenciam o grupo `1`, e quais outros grupos existem.
- **Quantos usuários da catraca começam com `11`, e quais são do SAGE?** É o que separa a
  correção segura do `DELETE /dispositivos` de um apagamento acidental. Contar antes, nunca
  deduzir por prefixo.

**Decidir em campo qual topologia do ADR-0014 vale** — e é a única coisa da visita que muda o
instalador: a secretaria vai usar o SAGE **da própria máquina onde ele roda** (T1) ou de **outra
máquina** (T2)? Se for T2, confiar a CA na segunda máquina é passo da visita, com o operador
junto. É o único passo do sistema que pode precisar de alguém competente do outro lado depois.

**Somente leitura. Nenhuma mutação de dado na visita.**

---

## R4+ — Depois da visita

Com os dados de campo em mãos, na ordem: **núcleo de sync idempotente por dispositivo**
(A-013, B-001, B-006, B-008, B-013) · **transações e ledger de presença** (A-003, A-005, A-011,
A-015, A-017, A-018, A-020, A-021) · **expectativa por slot** e o resto do `ROADMAP-RELEASES.md`
R4–R9 · **operação** (scheduler, shutdown, Redis, readiness) · **toolchain** (CRA 5, os três
`lodash` do bundle; os 80 alertas build-only não são urgentes).

**Acrescentado pela segunda auditoria, tudo dentro da R4 (fundação do tempo):**

- **A saída sobrescreve a chegada** `[+2A-A04]`. `presenceService.js:148-181` mantém no máximo
  uma linha por pessoa e data, e todo acesso posterior faz `UPDATE ... horario_chegada`.
  **Verificado.** Isto não é só desenho ruim: **os dados que já estão no banco estão corrompidos**
  para quem passou duas vezes no mesmo dia, sem trilha do valor anterior. Some ao levantamento
  de campo estimar quantas linhas de `Presenca` foram sobrescritas — é o que decide se dá para
  reconstruir a partir de `Acesso` ou se aquele histórico é perda declarada.
- **Fuso ambíguo na mesma coluna** `[+2A-A09]`. O pool aplica `-03:00` e os caminhos da catraca
  gravam `toISOString()` sem marcador. Eventos equivalentes diferem três horas conforme a origem
  e **atravessam a meia-noite**, mudando dia de presença, atraso e ordenação. Converter só nas
  bordas, e migrar o existente só com origem conhecida.
- **Importação da catraca deduplica por nome** `[+2A-B24]`. `catracaImportService.js:76-102`
  ignora `u.id` e casa por `(unidade_id, nome)`. Homônimos são fundidos e a identidade externa
  se perde. Staging, chave externa por dispositivo, subtipo transacional antes de publicar.
- **Política do grupo `1`** `[+2A-B11]` — pré-requisito documentado da R8, respondido no campo.

---

## Onde este plano pode dar errado

- **99 achados não cabem antes da visita.** R-LAB + R0 + R1 + R2 + R3 é trabalho de semanas.
  Se há prazo com a escola, precisa ser renegociado agora.
- **Escopei a R2 em ~500 linhas sem escrever PowerShell.** Ativação atômica no Windows tem
  armadilha: junction exige privilégio, WinSW guarda caminho absoluto no XML, arquivo em uso
  não se move. Pode ser mais caro.
- **H-002 pode ser tão grande quanto a ativação** e não está bem dimensionado aqui.
- **A auditoria não executou nada.** Achados de transação, DDL e ordem são os mais prováveis
  de conter falso positivo — e são a maioria dos SEV2. O R-LAB existe para isso.
- **Discordei da reescrita do instalador sem ter lido com a mesma profundidade** as outras
  quatro recomendações de reescrita (`app.js`, `scheduledJobs.js`, `peopleService.js`,
  `accessService.js`). Se densidade engana num lugar, pode enganar nos outros.

**Acrescentado depois do enxerto da segunda auditoria:**

- **A concordância entre as duas auditorias vale menos do que parece se elas não forem
  independentes de verdade.** Não sei sob que instrução o segundo agente rodou. Se ele teve
  o handoff desta auditoria na mão, a convergência é eco, não confirmação.
- **Enxertei a partir do inventário consolidado dela, não das 6 fatias inteiras.** Verifiquei
  na fonte os quatro que mudam o plano (`DELETE /dispositivos`, grupo `1`, A-04, `criarGrupo`);
  os demais entraram pela evidência que ela apresentou. Pode haver falso positivo aí.
- **Duas auditorias estáticas concordando ainda são duas auditorias estáticas.** Nenhuma das
  duas executou o sistema — a segunda registra que Node/npm não estavam disponíveis. O R-LAB
  não fica menos necessário por causa da concordância; fica mais, porque agora há mais achado
  não executado para confirmar.
- **O enxerto reabre um plano que já está sendo executado.** Os PRs #34–#40 estão empilhados
  sobre `wip/recuperacao-local-pre-auditoria`. O que entrou na R0-05 e na R0-07 muda pacotes
  que o Codex já entregou em draft — eles vão precisar de complemento, não de rebase.
- **A decisão de TLS está em aberto e é minha.** Enquanto eu não escolher entre loopback e CA
  local, a R2 está subespecificada e o implementador não pode fechá-la.
