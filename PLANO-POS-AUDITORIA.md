# Plano de execução pós-auditoria

> Escrito pelo arquiteto em 2026-08-06, com o inventário de 99 achados na mão.
> **Supersede a seção de conteúdo das releases em `ROADMAP-RELEASES.md`.** A estrutura
> daquele documento (releases como estados, visita como pivô) continua valendo; o que muda é
> o que cabe em cada uma.
>
> Este é o documento que o Codex segue. Fonte dos achados: `auditoria/INVENTARIO.md`.

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

### R0-05 — Cercar a destruição `[A-004, B-011, B-012, D-004, D-005]`
- [ ] `comecar-do-zero` exige confirmação por valor digitado, backup **restaurado-prova**, transação e registro de autoria
- [ ] Dump reprovado **não** conta como recente e **não** deixa status verde
- [ ] Backup da catraca recusa conteúdo parcial; existe caminho de restore
- [ ] Teste: falha no meio não apaga nada

### R0-06 — Rotação de log e crescimento `[V10, D-*]`
- [ ] `maxsize` e `maxFiles`; teto total em disco documentado
- [ ] Disco cheio produz erro visível, não falha silenciosa

### R0-07 — `catch` vazio e `console.log` `[V4, V5]`
- [ ] Nenhum dos dois em `src/`, verificável por lint, com CI reprovando

**Não faça na R0:** offset, piso de log e cursor. São bloqueados no campo — ver R-CAMPO.

---

## R1 — Identidade e superfície

**Especificação completa e obrigatória:** `specs/R1-usuarios-e-autorizacao.md`. Leia inteira
antes de escrever código.

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

**Frontend, na mesma release** `[E-003..E-007]` — hoje **nenhuma das 21 telas trata 403**:
- [ ] 403 **preserva a sessão**; só 401 desloga
- [ ] Cache e WebSocket limpam por identidade ao trocar de usuário
- [ ] Ações de administrador ficam ocultas para secretaria
- [ ] Primeiro login força troca de senha

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

Telemetria nunca é requisito (ADR-0012): sem internet, a catraca ainda gira.

---

## ▶ R-CAMPO — A visita

**O checklist está pronto:** `auditoria/INVENTARIO.md` §4 traz **14 perguntas exatas** —
offset por catraca, faixa de `access_logs.id` por dispositivo, timezone do Windows/MySQL/catraca,
`device_id` do push, qual backup foi restaurado de fato, política de TI, permissões do grupo `1`.

Acrescente: Wireshark durante uso do software oficial da Control iD, tempo do MySQL até aceitar
conexão naquele HD, tempo real do `destroy_objects`, se a catraca aceita liberar **uma passagem
específica** sob demanda, e quantos grupos e faixas de horário ela comporta.

**Somente leitura. Nenhuma mutação de dado na visita.**

---

## R4+ — Depois da visita

Com os dados de campo em mãos, na ordem: **núcleo de sync idempotente por dispositivo**
(A-013, B-001, B-006, B-008, B-013) · **transações e ledger de presença** (A-003, A-005, A-011,
A-015, A-017, A-018, A-020, A-021) · **expectativa por slot** e o resto do `ROADMAP-RELEASES.md`
R4–R9 · **operação** (scheduler, shutdown, Redis, readiness) · **toolchain** (CRA 5, os três
`lodash` do bundle; os 80 alertas build-only não são urgentes).

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
