# Estado verificado do SAGE — 2026-08-05

> Levantado pelo arquiteto por leitura direta do código, não por leitura de documento.
> Onde este arquivo contradisser `LEIA-PRIMEIRO.md` ou `docs/produto/roadmap.md`, **este
> vence**, porque aqueles descrevem o sistema como era projetado e este descreve o que está
> no disco.
>
> Regra de leitura: **VERIFICADO** = li o arquivo e a linha. **PROJETADO** = existe em
> documento, não em código. **DESCONHECIDO** = ninguém tem a informação ainda.
> Confundir os três é o erro mais caro deste projeto.

---

## 0. A correção mais importante deste documento

O `LEIA-PRIMEIRO.md` afirma que o bug de offset "provavelmente explica" o caso dos 48.057
logs com zero inseridos. **Isso está errado, e a evidência de campo derruba.**

`SAGE-API/docs/ANALISE_SYNC_CONTROL_ID.md` registra os contadores reais da ocorrência:

```
logs=48057  inseridos=0  ignoradosPessoa=0  ignoradosDuplicata=0
```

Se a causa fosse o offset divergente, os logs teriam sido convertidos para um `pessoa_id`
inexistente e morreriam em `ignoradosPessoa`, que seria 48.057 — não zero. Eles morreram
**antes**, no primeiro `if` do laço, que aplica `CATRACA_MIN_LOG_ID`.

**São dois defeitos independentes que produzem o mesmo sintoma visível (zero inseridos).**
Corrigir o offset sozinho não vai destravar a ingestão. Ambos precisam de correção, e cada
um precisa do seu próprio teste de regressão.

Consequência de processo: a documentação de campo em `SAGE-API/docs/` tem precedência sobre
a documentação de arquitetura quando fala de comportamento observado do hardware. Ela foi
escrita olhando para o sistema rodando.

---

## 1. VERIFICADO — defeitos confirmados por leitura do código

| # | Defeito | Evidência | Impacto |
|---|---|---|---|
| V1 | Offset divergente entre escrita e leitura | `controlIdService.js:11` = `110000000`; `accessService.js:8` e `deviceController.js:105` = `111000000`; `.env:56` comentado | Log atribuído à pessoa errada ou descartado |
| V2 | `CATRACA_MIN_LOG_ID` global, aplicado antes da conversão | descrito em `ANALISE_SYNC_CONTROL_ID.md` §1.1–1.2 | Ingestão inteira descartada em silêncio |
| V3 | **Nenhuma autorização por perfil em lugar nenhum** | `middlewares/autenticar.js` tem 18 linhas: valida JWT e chama `next()`. `grep -rn "perfil\|role\|permissao"` em `middlewares/` e `routes/` retorna **vazio** | Qualquer token válido executa qualquer operação, inclusive apagar pessoa |
| V4 | `catch` vazio | `deviceController.js:557` — `catch (_) {}` num `DELETE FROM sync_pendente` | Viola AGENTS.md §4.2; falha de limpeza invisível |
| V5 | `console.log` em código de produção | 13 arquivos em `src/`, incluindo `autenticar.js:1` (`[BOOT-AUT]`) | Viola AGENTS.md §7; risco de vazar dado em stdout não redigido |
| V6 | Não existe camada de redação de PII | `src/config/` não contém `redact.js`; o `AGENTS.md` afirmava que existia | Nada impede dado pessoal de entrar em log |
| V7 | Modelo de presença auditável não existe | `database/sage.sql` tem `Presenca` mutável; não há `RegistroPresenca` | ADR-0007 não está implementado |
| **V8** | **`comecar-do-zero` apaga a escola inteira sem trava** | `deviceRoutes.js:24` → `deviceController.comecarDoZero` (linha 522), bloco na 545: doze `DELETE` sem `WHERE`, sem transação, sem backup, sem confirmação, sem autoria. Protegido só por `autenticar` | **Perda total de dado a um clique. A mais grave da lista** |
| V9 | Não existe usuário do sistema | Login é `UnidadeEscolar.login`+`senha` — uma credencial para a escola inteira. `jwt.js` aceita payload sem estrutura; `autenticar.js` só faz `req.user = payload` | Nada "registra em nome de quem fez"; V8 fica ao alcance de qualquer um que saiba a senha |
| V10 | Sem rotação de log | `src/config/logger.js` não tem `maxsize` nem `maxFiles` | Disco enche → MySQL para de escrever → registro perdido em silêncio |
| V11 | **Dez rotas de monitoramento sem autenticação nenhuma** | `src/routes/monitoringRoutes.js` não importa `autenticar`. Nove `GET` + um `POST`. Expõe `/monitoring/state` e `/monitoring/users`; **apenas `POST /monitoring/cache/clear` muta** — os dois `sync-db` são `SELECT` (correção do auditor sobre versão anterior deste documento) | Estado do sistema e usuários conectados legíveis sem credencial; operações de mutação disparáveis por qualquer um |
| V12 | Superfície de rota duplicada | `loadRoutes.js:16` monta todo `*Routes.js` em `/`, e `app.js:99` monta `monitoringRoutes` **de novo** em `/monitoring`. Resultado: `/monitoring/state` e `/monitoring/monitoring/state` | Duas superfícies para a mesma coisa; correção em uma não cobre a outra |

**V8 combinado com V9 é o cenário mais caro deste repositório:** uma senha compartilhada e um
endpoint que apaga doze tabelas. Não depende de visita, nem de decisão da escola, nem de
nada externo para ser cercado. Deve entrar no WP-00.

**V3 é o achado mais grave que eu levantei e ele estava subdimensionado no roadmap.** O
WP-01 descrevia "autorização por perfil" como um item entre outros. Não é um item: é a
ausência total da camada. O sistema hoje tem autenticação e zero autorização.

---

## 2. VERIFICADO — o que JÁ EXISTE e o roadmap não sabe

Esta seção existe porque o handoff afirma "zero por cento do roadmap está implementado".
**É falso, e agir sobre essa premissa faria o implementador reconstruir o que já está
pronto.**

| Área | Estado real |
|---|---|
| **Harness de teste (WP-00a)** | **Essencialmente pronto.** 51 arquivos em `test/`, Vitest configurado |
| **Simulador Control iD** | **Pronto.** `test/fakes/controlid/` com `store.js`, `prng.js`, `geradorLogs.js` e um `README.md` que cataloga quirks do hardware — inclusive o Q6, que documenta a divergência de offset como cenário de teste |
| **Instalador Windows** | Avançado. `installer/windows/` com Inno Setup, WinSW, provisionamento de serviço, firewall, bootstrap de MySQL, rollback |
| **Readiness / boot** | Existe. `readinessService.js`, `runtime-schema-gate.js`, `start-with-setup.js` |
| **Primeiro acesso** | Existe. Onboarding de primeira execução com teste de contrato e de HTTP |
| **Rate limit** | Existe em `app.js` (`express-rate-limit`) |

Consequência direta: **o WP-00a não precisa ser executado.** Precisa ser *auditado* — pode
ter buracos — mas mandar construir do zero é desperdício e conflito garantido.

---

## 3. VERIFICADO — estado do repositório

- **Ambos os repositórios estavam PÚBLICOS em 2026-08-05**, com `database/` rastreada
  contendo `pessoas_etec.sql`, `dados_etec_taboao.sql`, `PlanilhaPessoas.xlsx` e dumps
  completos. Incidente de dado pessoal **em curso**, não dívida histórica.
- Mitigação bloqueada: a conta `caiopieri` é `member` da org, sem `admin` no repositório.
  Só `igorfcfs` (único owner) pode alterar visibilidade.
- `main` **não** está protegida em `SAGE-API`.
- Trabalho em voo salvo em `wip/recuperacao-local-pre-auditoria` nos dois repos: troca de
  recuperação de senha por e-mail para chave local com hash, contador de falhas e bloqueio
  temporário. Não revisado. Sem PII no diff (conferido).
- `SAGE-API` tem 11 commits não empurrados na `agent/f8-uninstall`; `SAGE` tem 4 na
  `agent/f8-frontend-same-origin`.

---

## 4. PROJETADO — existe em documento, não em código

Modelo de presença auditável (WP-02), pareamento entrada/saída (WP-03), reconciliação com
a catraca (WP-04), telemetria e redação de PII (WP-05), support bundle e catálogo de erros
(WP-06), tudo da Fase 3 em diante (folha de presença, folha de ponto, histórico, dashboard,
detecção de padrão), toda a Fase 4 (autorização em tempo real).

---

## 5. DESCONHECIDO

Ambiente da escola (rede, proxy, política de TI, estado da máquina, edição do Windows,
espaço em disco), capacidade da catraca contra o número de alunos, comportamento das
funções nunca exercitadas do hardware, se há política que bloqueia executável não assinado,
tempo real do MySQL até aceitar conexão no HD mecânico, tempo real do `destroy_objects`.

Acrescento um item que não estava mapeado: **se as senhas nos dumps públicos são de contas
reais.** Se forem, apagar o arquivo não resolve — exige rotação.

---

## 5-A. Achados de domínio (2026-08-05, depois do relato do dono do produto)

Levantados em `_arquitetura/DOMINIO-E-LACUNAS.md`, que é a fonte completa. O que muda o
plano:

| # | Achado | Peso |
|---|---|---|
| D1 | **O SAGE é um observador, não um controlador.** `accessSolicitationController.js` (67 linhas) aprova mudando um `status` e emitindo notificação de tela. Não fala com a catraca, não libera nada, e **não grava quem aprovou** | Metade do produto pedido não existe |
| D2 | Push (`/api/notifications/dao`) e polling são **notificação de fato consumado**, não ponto de decisão. Nenhum código pergunta à catraca "libero?" | A Fase 4 depende de fato não verificado |
| D3 | **ADR-0008 está pendurado numa suposição.** "Política mora no SAGE" só se sustenta se a catraca delegar decisão em tempo real. Se não delegar, o bloqueio tem de ser preventivo e a política precisa morar na catraca | ADR pode precisar de superseder |
| D4 | `HorarioAula.horario` é `VARCHAR(11)` — texto tipo `"07:30-08:20"`. E `migration_horario_aula_horario.sql` revela que **existem instalações com `inicio`/`fim` e outras com `horario`** | Duas escolas, dois schemas |
| D5 | **Schema fragmentado em 3+ lugares.** `Sala`, `HorarioAula`, `Presenca`, `FuncionarioHorario`, `ConfigSistema` aparecem em mais de um arquivo. `FuncionarioHorario` (requisito de folha de ponto) só existe em `melhorias_sistema.sql` | Não se sabe qual é o schema verdadeiro |
| D6 | `Presenca` não tem **nenhum campo de saída**, é mutável, e sua unidade é o dia — mas as regras de negócio são por aula | V7 é mais grave do que eu escrevi |
| D7 | Dois caminhos para o professor de uma aula: `Materia.professor_id` e `Aula.professor_id` | Decide de quem é a falta |

**O que já estava certo e é bom:** hierarquia organizacional completa, divisão A/B modelada
nos dois lados, `PROFADM` previsto, `FuncionarioHorario` para horário fixo, validação de
conflito de grade correta (`horarioAulaController.js:48`), e camada de relatórios bem mais
avançada do que qualquer documento sugeria.

---

## 6. O que isto muda no plano

1. **WP-00a sai da fila** — auditar em vez de construir.
2. **V2 (`MIN_LOG_ID`) entra no WP-00** como defeito próprio, com teste próprio.
3. **WP-01 sobe de prioridade e muda de descrição** — não é "melhorar autorização", é
   "construir a camada que não existe".
4. **A trilha LGPD é bloqueante e depende de um humano** (`igorfcfs`), não de código.
   Corre em paralelo; não segura a auditoria, que é só leitura.
5. **O roadmap precisa ser reescrito depois da auditoria**, com o inventário na mão. Até
   lá, ele não é fonte confiável de escopo.
