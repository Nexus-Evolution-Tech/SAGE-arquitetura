# HANDOFF — Auditoria completa do código existente

Para um Claude Code atuando como **orquestrador de auditoria**, chamando agentes auxiliares
para revisar fatias do repositório em paralelo.

---

## Regra de ouro

> **Isto é auditoria. Nada é corrigido.**
>
> Nenhum arquivo de código é modificado. Nenhum PR é aberto. Nenhuma issue é criada.
> A saída é conhecimento: o inventário completo do que está errado.

Motivo: corrigir durante a auditoria contamina o levantamento. Você perde a visão do todo,
mistura diagnóstico com tratamento, e não consegue mais priorizar por risco — porque já
mexeu no que era fácil e deixou o difícil para depois.

---

## Contexto

**SAGE** — plataforma de presença e autorização escolar da ETEC de Taboão da Serra.
Node 24, Express 5, MySQL 8.4, React 19, catraca Control iD. Roda on-premise num PC Windows
dentro da escola, desligado toda noite, operado por secretária não-técnica, mantido
remotamente sem VPN. Trata dados de menores. Alimenta folha de ponto e folha de presença.

**Situação:** o sistema já rodou em produção e a catraca gira. Mas o código tem defeitos
conhecidos, alguns corrompendo dado silenciosamente. Antes de uma visita presencial, tudo
que depende **só do código** precisa ser levantado e catalogado.

**Repositórios:** `SAGE-API` (backend) e `SAGE` (frontend). Nos dois, a branch a auditar é
`wip/recuperacao-local-pre-auditoria` — ela contém tudo que existe, inclusive trabalho
recente ainda não revisado.

**Leia `_arquitetura/ESTADO-VERIFICADO.md` antes de qualquer coisa.** Ele corrige premissas
falsas dos outros documentos, em especial a de que "zero por cento do roadmap está
implementado" — que é falsa e faria você auditar procurando ausência onde há código.

---

## Antes de começar

Leia, nesta ordem, e trate como a régua da auditoria:

1. `AGENTS.md` — as regras invioláveis. Violação delas é achado, mesmo que o código funcione
2. `docs/README.md` — índice
3. `docs/adr/` — as 12 decisões de arquitetura. Código que contraria um ADR é achado
4. `docs/arquitetura/sincronizacao.md` — em especial a seção "Estado atual do código"
5. `docs/arquitetura/presenca.md` — o modelo que o código deveria estar seguindo

---

## PROMPT PARA O ORQUESTRADOR

```
Você é o orquestrador de uma auditoria de código. Você NÃO corrige nada. Você NÃO abre PR.
Você NÃO cria issue. Você levanta, verifica e consolida.

═══════════════════════════════════════════════════════════════════
CALIBRAÇÃO — leia isto e NÃO repasse aos auditores
═══════════════════════════════════════════════════════════════════

Existem dez defeitos JÁ CONFIRMADOS por leitura direta do código, listados como V1..V10 em
`_arquitetura/ESTADO-VERIFICADO.md`, seção 1. LEIA-OS AGORA, mas **NÃO os inclua nos
prompts dos auditores e NÃO os mencione para eles.**

Eles são o gabarito que mede a confiança da auditoria inteira. Cada um tem dono:

| Gabarito | Fatia que DEVE encontrar sozinha |
|---|---|
| V1 offset divergente | B — sincronização |
| V2 `CATRACA_MIN_LOG_ID` global | B — sincronização |
| V3 zero autorização por perfil | C — HTTP e autorização |
| V4 `catch` vazio em `deviceController.js` | C ou D |
| V5 `console.log` em produção (13 arquivos) | D — infraestrutura |
| V6 ausência de `redact.js` | D — infraestrutura |
| V7 ausência de `RegistroPresenca` | A — camada de dados |
| V8 `zerar-tudo` sem trava nenhuma | C — HTTP e autorização |
| V9 ausência de usuário do sistema | C — HTTP e autorização |
| V10 log sem rotação | D — infraestrutura |

**A fatia C carrega três dos dez.** Se ela não trouxer V3, V8 e V9 sozinha, refaça antes de
qualquer outra coisa — é a fatia que guarda os achados mais caros.

Regra de descarte: **fatia que não redescobre o gabarito do próprio território é NÃO
CONFIÁVEL por inteiro** — não só naquele achado. Refaça com outro agente e instruções mais
específicas. Um auditor que passou por cima do que sabidamente está lá também passou por
cima do que você não sabe que está lá.

Registre no relatório final o placar por fatia. Ele vale mais que a contagem de achados.

**Armadilha específica de calibração, para você e não para os auditores:** V1 e V2
produzem o MESMO sintoma visível (zero logs inseridos) por causas diferentes. Auditor que
encontrar V1 e parar, concluindo que explicou o caso dos 48.057 logs, errou — e esse erro
já foi cometido antes, na documentação. Se a fatia B entregar só um dos dois, cobre o
outro explicitamente antes de aceitar.

═══════════════════════════════════════════════════════════════════
FASE 1 — INVENTÁRIO
═══════════════════════════════════════════════════════════════════

Antes de despachar auditores, levante o terreno:

- Lista completa de arquivos de código, com contagem de linhas
- Mapa de dependências entre módulos (quem importa quem)
- Ciclos de importação, se houver
- Arquivos que ninguém importa (código morto)
- Rotas registradas e qual controller atende cada uma
- Tabelas do schema e quais módulos escrevem em cada uma
- Jobs agendados e o que disparam

Isso define as fatias reais. Ajuste as fatias abaixo se o inventário mostrar que a divisão
não corresponde ao código.

═══════════════════════════════════════════════════════════════════
FASE 2 — AUDITORIA EM FATIAS PARALELAS
═══════════════════════════════════════════════════════════════════

Despache um agente auditor por fatia. Cada um recebe: o conteúdo do AGENTS.md, os ADRs
relevantes, a lista de arquivos da fatia dele, e o formato de saída obrigatório.

FATIA A — CAMADA DE DADOS
  src/config/queryBuilder.js, database.js, knex.js
  src/utils/generic-db-utils.js
  database/*.sql, migrations
  Procure: SQL por concatenação, identificador não escapado, ausência de transação em
  escrita multi-passo, ausência de índice em consulta de relatório, tipo errado de coluna,
  FK faltando, ON DELETE perigoso, timezone inconsistente entre camadas.

FATIA B — SINCRONIZAÇÃO COM A CATRACA
  src/services/deviceService.js, controlIdService.js, accessService.js,
  catracaImportService.js, protecaoLogs.js
  src/utils/controlId-utils.js, sync_catracas.js, syncFlags.js
  Procure: escrita não idempotente, ausência de retry, retry sem backoff, estado parcial
  sem compensação, erro engolido, falha reportada como sucesso, constante duplicada entre
  módulos, ordem de operação que deixa janela sem acesso, operação irreversível sem
  proteção, dependência circular, uso de relógio local onde deveria ser o do equipamento.

FATIA C — HTTP, AUTENTICAÇÃO E AUTORIZAÇÃO
  src/routes/**, src/controllers/**, src/middlewares/**
  src/config/loadRoutes.js, app.js, index.js
  Procure: rota sem autenticação, autenticação sem autorização por perfil, decisão de
  segurança que falha aberta, entrada não validada, parâmetro que chega ao SQL, upload sem
  limite ou sem validação de tipo, path traversal, CORS permissivo, resposta que vaza dado
  pessoal ou stack trace, ausência de rate limit, erro genérico que esconde a causa.

FATIA D — INFRAESTRUTURA E OPERAÇÃO
  src/config/logger.js, paths.js, redis.js, env.js, web.js
  src/services/readinessService.js, notificationService.js
  src/cache/**, src/state/**, jobs agendados, scripts/**
  Procure: dado pessoal em log, segredo em log, console.log em produção, promise sem
  tratamento, timer que não é limpo, vazamento de memória, estado global mutável, job que
  pode rodar concorrente consigo mesmo, readiness que reporta pronto quando não está,
  caminho absoluto fixo, dependência de cwd.

FATIA E — FRONTEND
  Repositório SAGE, branch agent/f8-frontend-same-origin
  src/** inteiro
  Procure: token em localStorage, tratamento de 401 vs 403, dado pessoal em console,
  requisição sem tratamento de erro, estado inconsistente após falha, chave de lista
  instável, re-render desnecessário em lista grande, formulário sem validação, mensagem de
  erro técnica exposta ao usuário, dependência não usada, dependência de produção que
  deveria ser de desenvolvimento.

FATIA F — CONFIGURAÇÃO E BUILD
  package.json (ambos), .env.example, eslint, scripts de setup
  Procure: dependência com versão flutuante, dependência não usada, dependência de
  desenvolvimento em produção, script de produção usando ferramenta de desenvolvimento,
  variável de ambiente lida em mais de um lugar com defaults diferentes, valor
  hardcoded que deveria ser configurável, e o inverso.

  ATENÇÃO ESPECIAL: "variável lida em mais de um lugar com defaults diferentes" é
  exatamente a classe do pior bug conhecido deste repositório. Varra TODAS as leituras
  de process.env e compare os defaults entre si. Não é exercício teórico.

FATIA G — HARNESS DE TESTE E SIMULADOR DA CATRACA
  test/** inteiro (51 arquivos), test/fakes/controlid/**, vitest.config.js
  Este código não vai para produção, mas é a régua que aprova todo o resto. Teste que
  passa por vacuidade é pior que teste ausente: dá confiança falsa.
  Procure: teste que não exercita o caminho que diz exercitar, asserção que passaria com
  qualquer valor, mock que esconde o comportamento sob teste, teste acoplado a ordem de
  execução, ausência de teste para caminho de erro, simulador que diverge do
  comportamento real documentado em SAGE-API/docs/, dado que pareça de pessoa real em
  fixture ou seed, teste desabilitado ou pulado sem justificativa.
  Compare test/fakes/controlid/README.md com ANALISE_SYNC_CONTROL_ID.md e
  ORDEM_SYNC_CATRACA.md: onde o simulador contradisser o campo, o campo vence e a
  divergência é achado.

FATIA H — INSTALADOR E EMPACOTAMENTO WINDOWS
  installer/windows/** (PowerShell, Inno Setup, templates WinSW), scripts de release
  e de artefatos, .github/workflows/windows-native.yml
  Contexto que muda a régua: quem executa isto é uma secretária não-técnica, numa
  máquina cujo estado ninguém conhece, sem ninguém capaz por perto se falhar.
  Procure: passo que falha em silêncio, instalação parcial sem rollback, ordem que
  deixa serviço morto, ACL ou permissão concedida além do necessário, caminho absoluto
  fixo, pressuposto sobre versão do Windows, atualização que toca dados/ ou config/
  (proibido pelo ADR-0011), credencial ou senha em script ou template, ausência de
  verificação de integridade de artefato baixado, mensagem de erro que a secretária não
  consegue agir sobre.

═══════════════════════════════════════════════════════════════════
FORMATO OBRIGATÓRIO DE CADA ACHADO
═══════════════════════════════════════════════════════════════════

Um arquivo por fatia em `auditoria/fatia-<letra>-<nome>.md`. Cada achado:

### [ID] Título curto e específico

- **Arquivo:** `caminho/arquivo.js:123-130`
- **Severidade:** SEV1 | SEV2 | SEV3 | SEV4
- **Categoria:** dado | segurança | confiabilidade | manutenibilidade | desempenho
- **Depende do ambiente da escola:** SIM | NÃO
- **Confiança:** alta | média | baixa

**Sintoma**
O que está errado, objetivamente.

**Evidência**
```js
// trecho real do código, SEM dado pessoal
```

**Impacto no dado**
Corrompe registro? Afeta folha de ponto ou presença? Já pode ter corrompido dado em
produção? Precisa de correção retroativa?

**Como reproduzir**
Passos, ou "análise estática" se não for reproduzível sem ambiente.

**Correção sugerida**
Direção, não implementação. Não escreva o código corrigido.

**Regra violada**
Qual regra do AGENTS.md ou qual ADR. Se nenhum, escreva "nenhuma — é qualidade".

═══════════════════════════════════════════════════════════════════
REGRAS PARA OS AUDITORES
═══════════════════════════════════════════════════════════════════

- TODO achado precisa citar arquivo e linha e mostrar o código real. Achado sem evidência
  verificável é DESCARTADO
- NÃO corrija nada. NÃO escreva o código da correção. Aponte a direção
- Marque confiança BAIXA quando não tiver certeza. É melhor um achado duvidoso marcado como
  duvidoso do que um palpite apresentado como fato
- **"Não encontrei nada relevante nesta área" é resposta válida e esperada.** Não invente
  achado para parecer produtivo. Volume não é qualidade — achado falso desperdiça tempo de
  quem vai verificar
- NÃO reporte estilo, formatação ou preferência pessoal. Só defeito, risco ou violação de
  regra documentada
- NUNCA cole dado pessoal, credencial, IP interno ou trecho de .env real na evidência

═══════════════════════════════════════════════════════════════════
FASE 3 — VERIFICAÇÃO PELO ORQUESTRADOR
═══════════════════════════════════════════════════════════════════

Você NÃO consolida cegamente. Para cada achado recebido:

3.1 Abra o arquivo na linha citada e confirme que o código é o que o auditor descreveu.
    Achado que não bate com o código real é DESCARTADO e registrado como erro do auditor.

3.2 Verifique duplicatas entre fatias. Mesmo defeito visto de ângulos diferentes vira um
    achado só, com as duas perspectivas.

3.3 Reclassifique a severidade você mesmo. Auditores tendem a inflar. Use a régua:
    SEV1 — catraca parada, ninguém entra
    SEV2 — funciona mas perde ou corrompe dado (o mais traiçoeiro deste projeto:
           ninguém reclama, porque a catraca gira)
    SEV3 — incômodo com contorno
    SEV4 — cosmético

3.4 Aplique o gabarito de calibração. Registre quantos dos sete defeitos conhecidos cada
    fatia relevante redescobriu. Fatia com desempenho ruim é refeita.

3.5 Faça você mesmo uma passada nos arquivos que nenhum auditor cobriu, ou que receberam
    "nada encontrado" sendo grandes ou críticos.

═══════════════════════════════════════════════════════════════════
FASE 4 — CONSOLIDAÇÃO
═══════════════════════════════════════════════════════════════════

Produza `auditoria/INVENTARIO.md` com:

1. **Sumário executivo** — quantos achados por severidade, quais módulos concentram
   defeito, e a resposta a: "o que impede este software de ser instalado hoje?"

2. **Tabela mestra**, ordenada por risco ao dado:
   | ID | Título | Sev | Arquivo | Depende do ambiente | Confiança |

3. **Corrigível remotamente** — a lista do que dá para resolver sem estar na escola. É a
   fila de trabalho até a visita.

4. **Bloqueado no ambiente** — o que só avança com mapeamento presencial. Cada item com a
   pergunta exata a responder na escola, para virar item de checklist.

5. **Candidatos a reescrita** — módulos onde a densidade de defeito é tão alta que remendar
   sai mais caro e mais arriscado que refazer. Justifique com números: linhas, achados,
   achados por 100 linhas.

6. **Ordem de correção sugerida**, com as dependências entre correções explícitas.

7. **Cobertura e confiança** — o que foi auditado, o que não foi, resultado da calibração
   por fatia, e onde você tem menos confiança no levantamento.

8. **Achados descartados** — o que os auditores reportaram e você derrubou, com o motivo.
   Isso é importante: mostra o rigor da verificação.

═══════════════════════════════════════════════════════════════════
RESTRIÇÕES FINAIS
═══════════════════════════════════════════════════════════════════

- NENHUM arquivo de código é modificado
- NENHUM PR é aberto, NENHUMA issue é criada
- Os documentos em docs/ NÃO são alterados
- Nenhum dado pessoal, credencial ou IP interno sai em nenhum arquivo da auditoria
- Se você discordar de um ADR, registre como achado com a justificativa. Não o contrarie
  em silêncio
```

---

## Quando voltar aqui

Traga:

- `auditoria/INVENTARIO.md`
- Os arquivos por fatia
- O resultado da calibração (quantos dos sete conhecidos cada fatia achou)

Eu vou verificar:

1. **Calibração** — fatia que não achou o que sabidamente está lá teve o resto do
   levantamento comprometido
2. **Amostragem de evidências** — abro alguns achados e confirmo contra o código real
3. **Severidade** — se está inflada ou, pior, subestimada nos que corrompem dado
4. **A separação remoto vs ambiente** — é ela que define seu plano de visita
5. **Cobertura** — o que ficou de fora e se importa
6. **Candidatos a reescrita** — se o argumento se sustenta ou é preguiça disfarçada
7. **Coerência com o contexto** — se algum achado contraria uma decisão que já tomamos por
   um bom motivo que o auditor não conhecia

Daí montamos a fila de correção até a visita.
