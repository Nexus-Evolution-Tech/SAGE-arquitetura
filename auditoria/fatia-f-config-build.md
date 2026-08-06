# FATIA F — configuração, dependências e build

> **Nota do orquestrador:** este é o relatório bruto da fatia. Criticidade CVSS do
> Dependabot não equivale à severidade operacional do SAGE. Aceitação, duplicatas e
> severidades finais estão em `ONDA2-VERIFICACAO.md`; essa verificação prevalece.

Auditoria independente, somente leitura, dos repositórios `SAGE` e `SAGE-API` na branch `wip/recuperacao-local-pre-auditoria`. Data da coleta: 2026-08-06 (America/Sao_Paulo).

## Resultado executivo

- Foram encontrados **10 achados**: 1 crítico, 1 alto, 6 médios e 2 baixos.
- O snapshot informado do Dependabot fecha em **98 alertas**: **2 críticos + 53 altos + 37 médios + 6 baixos = 98**. A API do GitHub retornou, no momento da coleta, apenas **97 abertos**: 2 críticos + 52 altos + 37 médios + 6 baixos. A unidade faltante do snapshot é, portanto, exatamente **um alerta alto**, mas sua identidade já não é observável.
- Classificação fechada do snapshot: **(a) 80** alertas em transitivas exclusivas de build/teste do CRA/`react-scripts`; **(b) 17** em dependências que chegam ao bundle; **(c) 1** alerta alto indeterminado e não mais retornado. Soma: **80 + 17 + 1 = 98**.
- Dos 97 alertas identificáveis, **70 ainda satisfazem a faixa vulnerável** no `package-lock.json` da branch auditada e **27 não satisfazem mais**, inclusive os dois críticos. “Alerta aberto no GitHub” e “versão vulnerável presente nesta branch” não são equivalentes porque o Dependabot acompanha a default branch (`main`).
- A divergência mais grave de configuração é `CATRACA_USER_ID_OFFSET`: criação/sincronização usam defaults diferentes (`110000000` e `111000000`).
- A API lê 93 nomes estáticos de `process.env`; 39 não aparecem na `.env.example`. Em sentido inverso, 7 chaves SMTP/e-mail são anunciadas no exemplo mas não têm consumidor de produção.
- Não foram executados `npm install`, `npm audit`, `npm audit fix`, build ou testes. O Node local é 18.16.1, incompatível com `SAGE-API` (`>=24 <25`).

## Escopo, identidade e manifesto reproduzível

| Repositório | HEAD auditado | branch | lockfileVersion | SHA-256 do lock |
|---|---|---|---:|---|
| SAGE | `06c1ed4e948236c44926ed13fdb96521dd81d269` | `wip/recuperacao-local-pre-auditoria` | 3 | `0d7191fae9d23f029f665d992f62421022b0f26e9e1a6075764d3d19e06a8f9f` |
| SAGE-API | `9e3eaba3475c3e9755f341d29bada059cc6fc5db` | `wip/recuperacao-local-pre-auditoria` | 3 | `67fb329b5fdb76b55e7e026c92e113f5e0d3ee3fde84f74b5719489f6461e485` |

O manifesto foi formado pela união de: (1) `package.json`, `package-lock.json`, `.env.example`, `.env.production`, ESLint e `*.config.js`; (2) todo arquivo JS/CJS/MJS versionado que contém literalmente `process.env`; (3) em `SAGE-API`, todos os arquivos versionados sob `scripts/`, `installer/windows/` e `.github/workflows/`. LOC significa linhas físicas, sem contar uma linha vazia artificial após o último `\n`.

| Repositório/categoria | arquivos | LOC |
|---|---:|---:|
| SAGE — núcleo de configuração | 6 | 20.071 |
| SAGE — consumidores de `process.env` | 7 | 2.084 |
| SAGE — união sem duplicação | 13 | 22.155 |
| SAGE-API — núcleo de configuração | 4 | 4.170 |
| SAGE-API — consumidores de `process.env` | 48 | 8.819 |
| SAGE-API — scripts/setup/build/release | 32 | 4.356 |
| SAGE-API — união sem duplicação | 76 | 16.338 |

Detalhe do núcleo: SAGE — `.env.example` 6, `.env.production` 4, `.eslintrc.cjs` 5, `craco.config.js` 19, `package.json` 54, `package-lock.json` 19.983 LOC. SAGE-API — `.env.example` 144, `vitest.config.js` 16, `package.json` 48, `package-lock.json` 3.962 LOC. Não existe `.env.production` versionada na API; o instalador gera `%ProgramData%\SAGE\config\sage.env`.

Reprodução somente leitura:

```powershell
git -C C:\SAGE-WS\SAGE ls-files
git -C C:\SAGE-WS\SAGE-API ls-files
rg -l --hidden -g '!node_modules/**' -g '!.git/**' 'process\.env' C:\SAGE-WS\SAGE C:\SAGE-WS\SAGE-API
Get-FileHash -Algorithm SHA256 C:\SAGE-WS\SAGE\package-lock.json,C:\SAGE-WS\SAGE-API\package-lock.json
```

## Dependabot: unidade, reconciliação e caminhos

**Unidade:** um alerta é o registro numerado do Dependabot para uma combinação de advisory, ecossistema, manifesto e dependência vulnerável. Um mesmo pacote pode gerar vários alertas (por exemplo, `react-router`: 14), e um advisory pode atingir mais de uma versão/caminho. Logo, **98 alertas não significam 98 pacotes nem 98 advisories**. Há 36 nomes de pacote entre os 97 alertas atualmente retornados.

Consulta utilizada:

```powershell
gh api 'repos/Nexus-Evolution-Tech/SAGE/dependabot/alerts?state=open&per_page=100' --paginate
npm ls react-router lodash webpack-dev-server minimatch node-forge ws uuid --all --package-lock-only
```

O endpoint retornou 97 alertas e o histórico acessível do repositório retornou 6 `fixed`; não existe registro acessível que permita identificar com segurança a 98ª unidade do snapshot. Ela foi mantida em (c), com severidade alta deduzida exclusivamente da diferença fechada `53 - 52 = 1`; pacote, GHSA, número e caminho **não foram inventados**.

### Fechamento dos 98

| bucket | crítico | alto | médio | baixo | total |
|---|---:|---:|---:|---:|---:|
| (a) transitivas exclusivas de CRA/build/teste | 2 | 43 | 29 | 6 | **80** |
| (b) bundle/runtime | 0 | 9 | 8 | 0 | **17** |
| (c) indeterminadas | 0 | 1 | 0 | 0 | **1** |
| **total** | **2** | **53** | **37** | **6** | **98** |

### (a) 80 alertas de CRA/build/teste

Todos os caminhos abaixo partem de `react-scripts@5.0.1`; a exceção aparente `uuid` foi conferida por versão: o alerta #78 ainda atinge `react-scripts > webpack-dev-server > sockjs > uuid@8.3.2`, enquanto o `uuid@11.1.1` direto da branch já está corrigido e nem é importado pelo frontend.

| pacote | alertas Dependabot | nós relevantes no lock da branch |
|---|---|---|
| `nth-check` | #1 | `node_modules/svgo/node_modules/nth-check@1.0.2` |
| `postcss` | #2, #81, #114, #115 | `node_modules/postcss@8.5.6`; `resolve-url-loader/node_modules/postcss@7.0.39` |
| `webpack-dev-server` | #7, #8, #75, #90, #101, #102 | `node_modules/webpack-dev-server@4.15.2` |
| `js-yaml` | #14, #15, #97, #98, #105, #108 | `js-yaml@3.14.2`; cópias 4.1.1 de ESLint |
| `glob` | #16 | `glob@7.2.3`; `sucrase/node_modules/glob@10.5.0` |
| `node-forge` | #17, #18, #19, #57–#60 | `node_modules/node-forge@1.3.3` |
| `qs` | #20, #33, #79 | `node_modules/qs@6.13.0` |
| `jsonpath` | #29, #34 | `node_modules/jsonpath@1.1.1` |
| `webpack` | #30, #31 | `node_modules/webpack@5.101.3` |
| `ajv` | #37, #38 | `ajv@6.12.6`; três cópias 8.17.1 |
| `minimatch` | #39–#41, #43–#48 | `minimatch@3.1.2`; cópias 5.1.6 e 9.0.5 |
| `rollup` | #42 | `node_modules/rollup@2.79.2` |
| `serialize-javascript` | #49, #77 | versões 4.0.0 e 6.0.2 |
| `underscore` | #50 | `node_modules/underscore@1.12.1` |
| `svgo` | #52, #107 | versões 1.3.2 e 2.8.0 |
| `flatted` | #53, #54 | `node_modules/flatted@3.3.3` |
| `yaml` | #55, #56 | versões 1.10.2 e 2.8.1 |
| `brace-expansion` | #62, #113, #117 | versões 1.1.12 e 2.0.2 |
| `path-to-regexp` | #63 | `node_modules/path-to-regexp@0.1.12` |
| `picomatch` | #64, #65 | `node_modules/picomatch@2.3.1` |
| `follow-redirects` | #68 | `node_modules/follow-redirects@1.15.11` |
| `fast-uri` | #72, #73, #103, #104, #118 | `node_modules/fast-uri@3.0.6` |
| `@babel/plugin-transform-modules-systemjs` | #74 | versão 7.27.1 |
| `@tootallnate/once` | #76 | versão 1.1.2 |
| `uuid` | #78 | `sockjs/node_modules/uuid@8.3.2` |
| `launch-editor` | #89 | versão 2.11.1 |
| `form-data` | #91 | versão 3.0.4 |
| `@babel/core` | #95 | versão 7.28.4 |
| `http-proxy-middleware` | #96 | versão 2.0.9 |
| `shell-quote` | #88, #106 | override atual `1.10.0`; ambos fora da faixa nesta branch |
| `websocket-driver` | #99, #100 | override atual `0.7.5`; ambos fora da faixa nesta branch |
| `ws` | #80, #93, #94 | os caminhos afetados do alerta são de Jest/WDS; lock atual tem 7.5.13 e 8.21.1, já fora das três faixas |
| `body-parser` | #112 | `node_modules/body-parser@1.20.3`, via WDS/Express |

### (b) 17 alertas que chegam ao bundle

| pacote | alertas | caminho de produção/bundle | estado no lock auditado |
|---|---|---|---|
| `react-router` | #21–#25, #82–#87, #109–#111 (14) | `react-router-dom@7.18.2 > react-router@7.18.2` | os 14 alertas abertos já não satisfazem a versão 7.18.2 da branch |
| `lodash` | #26, #66, #67 (3) | `recharts@2.15.4 > lodash@4.17.21` | os 3 ainda satisfazem suas faixas; o pacote entra no grafo importado pelos gráficos |

### (c) 1 alerta indeterminado

Uma unidade alta existe apenas no snapshot informado. A API atual devolve 52 altos em vez de 53. Sem registro retornado, não é possível atribuir pacote, caminho, versão ou GHSA. Esta é uma limitação de acesso temporal, não evidência de ausência.

### Estado da branch versus estado dos alertas

Alertas atualmente fora da faixa na branch: **#14–#19, #21–#25, #80, #82–#88, #93, #94, #99, #100, #106, #109–#111** (27). Os outros 70 identificáveis continuam reproduzíveis por comparação semver com os nós do lock. Os dois críticos (#88 `shell-quote` e #99 `websocket-driver`) estão corrigidos localmente pelos overrides de `package.json:50-52`, mas continuam abertos no estado observado do repositório/default branch.

## Achados

### F-001 — Snapshot do Dependabot contém 98 alertas, incluindo 2 críticos; 70 continuam reproduzíveis na lock auditada

- **Arquivo:linhas:** `SAGE/package.json:21,50-52`; `SAGE/package-lock.json` (nós detalhados nas tabelas acima).
- **Severidade estrita:** **Crítica** — existem duas unidades críticas abertas no repositório; embora corrigidas na branch local, não há evidência de que a default branch tenha recebido os overrides.
- **Categoria:** dependências / supply chain.
- **Depende do ambiente:** sim — depende da branch instalada e de ferramentas de build/dev serem expostas a entradas não confiáveis.
- **Confiança:** alta para os 97 alertas identificados e suas faixas; média para a unidade histórica faltante, cuja identidade não está mais disponível.
- **Sintoma:** Dependabot permanece vermelho com 98 unidades no snapshot; builds da default branch podem resolver versões vulneráveis. A branch local ainda contém 70 faixas vulneráveis, 3 delas no grafo do bundle (`lodash`).
- **Evidência:** consulta REST retorna 97 abertos (2/52/37/6); `package-lock.json` cruza cada pacote/faixa; `package.json:50-52` fixa os dois críticos localmente.
- **Impacto:** execução/DoS/prototype pollution e outras classes conforme cada GHSA; risco operacional adicional por não distinguir vulnerabilidade de build de código entregue ao usuário.
- **Reprodução:** executar os dois comandos read-only da seção Dependabot e comparar `security_vulnerability.vulnerable_version_range` com `packages[*].version`.
- **Correção sugerida:** integrar os overrides/updates na default branch; migrar para uma toolchain mantida em vez de sustentar CRA 5; atualizar `lodash` pelo caminho de `recharts`; fechar alertas somente após lock e caminho comprovadamente corrigidos.
- **Regra violada:** gestão contínua de vulnerabilidades e separação de dependências de build das de produção.

### F-002 — Default divergente de `CATRACA_USER_ID_OFFSET` quebra a identidade entre criação e leitura

- **Arquivo:linhas:** `SAGE-API/src/services/controlIdService.js:11`; `src/services/accessService.js:7-8`; `src/controllers/deviceController.js:105`; `.env.example:54-56`.
- **Severidade estrita:** **Alta** — o default é parte da chave de correlação de pessoas e eventos da catraca.
- **Categoria:** configuração / consistência de dados.
- **Depende do ambiente:** sim — manifesta quando `CATRACA_USER_ID_OFFSET` não é definido explicitamente, como no `sage.env` gerado pelo instalador.
- **Confiança:** alta.
- **Sintoma:** criação envia `110000000 + pessoa.id`, enquanto sincronização e diagnóstico esperam `111000000 + pessoa.id`.
- **Evidência:** os três consumidores têm literais diferentes e o próprio comentário de `accessService` exige que sejam iguais; `initialize-state.ps1:199-219` não grava a variável.
- **Impacto:** acessos podem ser associados à pessoa errada, descartados ou aparecer como não reconhecidos; ressincronizações podem duplicar/romper usuários.
- **Reprodução:** sem definir a variável, avaliar os três `parseInt(process.env... || literal)` para uma mesma `pessoa.id`.
- **Correção sugerida:** definir um único módulo de configuração validado e obrigatório; migrar dados/dispositivos existentes antes de mudar o valor; gravar explicitamente o valor no perfil do instalador.
- **Regra violada:** uma única fonte de verdade para identificadores persistentes.

### F-003 — Contrato de ambiente é incompleto: 39 de 93 variáveis lidas não estão no exemplo

- **Arquivo:linhas:** `SAGE-API/.env.example:1-144`; consumidores catalogados no apêndice; exemplos de alto impacto em `src/app.js:40-41,70-71,106-107,201`, `src/services/backupBanco.js:34,71-72`, `src/config/redis.js:23-26`.
- **Severidade estrita:** **Média** — não há falha universal, mas operadores não conseguem descobrir ou tipar controles de segurança, timeout, backup e runtime.
- **Categoria:** configuração / operabilidade.
- **Depende do ambiente:** sim.
- **Confiança:** alta; extração automática sobre todos os JS/CJS/MJS versionados.
- **Sintoma:** 39 chaves consumidas não são documentadas: `API_URL`, `BASE_URL`, `CATRACA_ADMIN_PASSWORD`, `CATRACA_ADMIN_USER`, `CATRACA_BACKUP_CHUNK_SIZE`, `CATRACA_LOGS_INFO_THRESHOLD`, `CATRACA_RETRY_DELAY_1_MS`, `CATRACA_RETRY_DELAY_2_MS`, `CATRACA_RETRY_DELAY_3_MS`, `CORS_ALLOW_ALL`, `DEBUG_QUEDA`, `DIAGNOSTICO_KEY`, `ESCOLA_SENHA`, `ESCOLA_USUARIO`, `HOST`, `IMPORT_TIMEOUT_MS`, `JOBS_ENABLED`, `MONITOR_SYNC_LIMIT`, `MYSQL_DEFAULTS_EXTRA_FILE`, `REDIS_DB`, `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`, `REQUEST_TIMEOUT`, `SAGE_ALLOW_FIRST_RUN_ONBOARDING`, `SAGE_APP_VERSION`, `SAGE_AUDIT_MAX_LATENCY_MS`, `SAGE_MAINTENANCE_CONFIG_FILE`, `SAGE_REQUIRE_MAINTENANCE_DB`, `SAGE_REQUIRE_WEB`, `SAGE_RUNTIME_SCHEMA_RETRY_ATTEMPTS`, `SAGE_RUNTIME_SCHEMA_RETRY_DELAY_MS`, `SAGE_WEB_DIR`, `SYNC_PARALLEL_LIMIT`, `SYNC_PASSO_PONTEIRO`, `UNIDADE_ID`, `UPLOAD_MAX_SIZE_MB`, `WS_PING_INTERVAL`, `WS_PING_TIMEOUT`.
- **Evidência:** 93 nomes estáticos únicos; 54 têm entrada ativa ou comentada na `.env.example`; 39 não têm.
- **Impacto:** defaults invisíveis, configurações inseguras por omissão e suporte/reprodução difíceis; em especial manutenção de banco e diretórios web ficam acoplados ao instalador.
- **Reprodução:** usar o `rg` do manifesto e extrair `process.env.<NOME>`/`process.env['NOME']`, comparando com `^#?\s*[A-Z][A-Z0-9_]*=` da `.env.example`.
- **Correção sugerida:** schema central tipado/validado, geração automática do exemplo e do perfil do instalador, com descrição, unidade, faixa e semântica booleana.
- **Regra violada:** configuração explícita, validada e documentada.

### F-004 — Sete chaves SMTP anunciadas não têm consumidor e `nodemailer` só é carregado por teste

- **Arquivo:linhas:** `SAGE-API/.env.example:117-126`; `package.json:34`; `test/dependencias-email-config.test.js:2,9-10`.
- **Severidade estrita:** **Média** — credenciais podem ser provisionadas sem qualquer efeito, criando falsa expectativa operacional.
- **Categoria:** configuração obsoleta / dependência não usada.
- **Depende do ambiente:** não para a ausência de consumidor; sim para o custo operacional.
- **Confiança:** alta.
- **Sintoma:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` e `FRONTEND_URL` aparecem no exemplo, mas nenhuma leitura `process.env` existe; `nodemailer` só aparece em teste. A recuperação atual é local por chave.
- **Evidência:** busca versionada por `smtp|nodemailer|EMAIL_FROM|FRONTEND_URL`; fora de exemplo, lock e teste, não há import/configuração de transporte.
- **Impacto:** segredo SMTP armazenado sem necessidade, pacote de runtime e transitivas instalados inutilmente, documentação enganosa.
- **Reprodução:** `rg -n -i 'smtp|nodemailer|EMAIL_FROM|FRONTEND_URL' SAGE-API -g '!node_modules/**'`.
- **Correção sugerida:** remover chaves e dependência se o fluxo local é definitivo; ou implementar um consumidor explícito, validado e testado em produção se e-mail ainda for requisito.
- **Regra violada:** minimizar segredos e dependências; configuração deve corresponder a comportamento implementado.

### F-005 — Dependências de teste/build e pacotes sem uso estão declarados como runtime

- **Arquivo:linhas:** `SAGE/package.json:10-16,21,25-26,47-49`; `SAGE-API/package.json:25-36`.
- **Severidade estrita:** **Média** — amplia instalação e triagem de vulnerabilidades, mas o instalador final não copia `node_modules` do frontend.
- **Categoria:** dependências / separação dev-produção.
- **Depende do ambiente:** sim — relevante para `npm install --omit=dev`, scanners e qualquer imagem que carregue `node_modules`.
- **Confiança:** alta para importações literais; média para “não usado” porque carregamento por nome construído dinamicamente seria invisível, embora não haja evidência disso.
- **Sintoma:** no SAGE, `react-scripts` e quatro Testing Library estão em `dependencies`; `@tanstack/react-query-devtools`, `cors`, `json-server`, `uuid` e `web-vitals` não têm import versionado; `@testing-library/react` e `user-event` só aparecem em testes. Na API, `express-rate-limit` e `redis` não são importados; `ioredis` é o cliente real; `nodemailer` só aparece em teste.
- **Evidência:** scanner de `require`/`import` sobre todos os JS/JSX/CJS/MJS versionados; `npm ls --package-lock-only` mostra toda a árvore CRA marcada com scope runtime pelo manifesto.
- **Impacto:** lock maior, mais alertas, downloads e superfície de supply chain; classificação enganosa de alertas de build como “runtime”.
- **Reprodução:** extrair specifiers literais e compará-los às chaves de `dependencies`/`devDependencies`; conferir exceções de script (`react-scripts`, `craco`, `nodemon`).
- **Correção sugerida:** remover pacotes sem uso; mover teste/build para `devDependencies`; manter no runtime apenas o que é carregado pelo servidor/bundle; substituir CRA 5 por toolchain mantida.
- **Regra violada:** dependências mínimas e separação entre build/teste e produção.

### F-006 — Smoke Windows não acompanha `main` e usa commit fixo antigo do frontend

- **Arquivo:linhas:** `SAGE-API/.github/workflows/windows-native.yml:3-11,24-25,34-39`; `.github/workflows/ci.yml:7-13`.
- **Severidade estrita:** **Média** — o release nativo pode não ser exercitado para a combinação efetivamente entregue.
- **Categoria:** CI/CD / release.
- **Depende do ambiente:** sim — push nas branches listadas ou execução manual.
- **Confiança:** alta.
- **Sintoma:** o workflow Windows dispara automaticamente apenas em cinco branches `agent/f8-*`, não em `main`; o fallback/default do frontend é `e8c5131e...`, diferente do HEAD auditado `06c1ed4e...`. O CI de `main` roda apenas em Ubuntu.
- **Evidência:** filtros e `WEB_REF` literais no YAML; SAGE não possui workflow versionado próprio.
- **Impacto:** regressões de PowerShell 5.1, bcrypt nativo, empacotamento ou compatibilidade API/frontend podem chegar a `main` sem smoke da combinação atual.
- **Reprodução:** comparar `on.push.branches` e `env.WEB_REF` com `git rev-parse HEAD` dos dois repositórios.
- **Correção sugerida:** executar smoke Windows em PR/main quando arquivos relevantes mudarem; obter o SHA do frontend de manifesto de release/entrada obrigatória sem fallback antigo; tornar o check requerido.
- **Regra violada:** CI deve testar o artefato e a combinação de fontes que serão entregues.

### F-007 — `postinstall` altera configuração e suprime qualquer falha

- **Arquivo:linhas:** `SAGE-API/package.json:10`; `scripts/check-first-run.js:7-25`; `.github/workflows/ci.yml:47-50`.
- **Severidade estrita:** **Média** — instalação pode terminar com sucesso sem preparar configuração/diretórios.
- **Categoria:** setup / tratamento de falhas.
- **Depende do ambiente:** sim — permissões, caminho de dados e presença de `.env.example`.
- **Confiança:** alta.
- **Sintoma:** todo `npm install` executa criação de diretórios/cópia de configuração; o `catch` vazio silencia qualquer erro. CI e release precisam usar `--ignore-scripts` para contornar o hook.
- **Evidência:** `catch (error) { /* Silenciar erros no postinstall */ }`; scripts de CI/release explicitamente ignoram scripts.
- **Impacto:** falso sucesso, estados parciais e comportamento diferente entre instalação local, CI e instalador Windows.
- **Reprodução:** inspeção estática do fluxo; não foi executado install por restrição da auditoria.
- **Correção sugerida:** remover efeito colateral de `postinstall`; criar comando de setup explícito e idempotente que falhe com código não zero e mensagem acionável.
- **Regra violada:** fail-fast e instalação reproduzível sem efeitos ambientais ocultos.

### F-008 — Defaults de jobs divergem entre exemplo, código e perfil Windows

- **Arquivo:linhas:** `SAGE-API/.env.example:101,107-112`; `src/jobs/scheduledJobs.js:94-99,201-211,307-308`; `installer/windows/initialize-state.ps1:199-219`.
- **Severidade estrita:** **Média** — muda cadência e habilitação de tarefas de produção.
- **Categoria:** configuração / jobs.
- **Depende do ambiente:** sim — especialmente instalação Windows, cujo `sage.env` omite ambas as chaves.
- **Confiança:** alta.
- **Sintoma:** `SYNC_CHECK_INTERVAL` é `*/5` no exemplo e `*/1` no fallback; `PROMOCAO_CRON` é descrito como padrão `10 8 * * *`, mas o job usa vazio como “desligado”. O log contém fallback `10 8`, embora só seja emitido quando um valor real habilitou o job.
- **Evidência:** literais divergentes; perfil gerado pelo instalador não grava `SYNC_CHECK_INTERVAL` nem `PROMOCAO_CRON`.
- **Impacto:** cinco vezes mais consultas de sincronização que o esperado e ausência do job diário de promoção na instalação padrão.
- **Reprodução:** iniciar a avaliação de configuração com as duas variáveis ausentes; `verificarSyncPendentesJob` agenda a cada minuto e `promocaoAlunosJob` retorna `null`.
- **Correção sugerida:** centralizar defaults, decidir semanticamente se promoção é opt-in ou default, e gerar exemplo/instalador a partir do mesmo schema.
- **Regra violada:** defaults consistentes entre documentação, setup e consumidores.

### F-009 — Script `prod` usa sintaxe POSIX em produto Windows

- **Arquivo:linhas:** `SAGE-API/package.json:11-14`.
- **Severidade estrita:** **Baixa** — o serviço WinSW não usa esse script, mas ele é uma interface pública do pacote.
- **Categoria:** scripts / portabilidade.
- **Depende do ambiente:** sim — falha em `cmd.exe`, shell usado pelo npm no Windows.
- **Confiança:** alta.
- **Sintoma:** `"prod": "NODE_ENV=production node index.js"` depende de atribuição inline POSIX.
- **Evidência:** target oficial e builder são Windows; não há `cross-env`.
- **Impacto:** `npm run prod` não inicia a API no Windows e gera runbooks divergentes.
- **Reprodução:** por semântica do `cmd.exe`; não executado para não iniciar o servidor.
- **Correção sugerida:** usar script Node/cross-platform ou definir `NODE_ENV` dentro do wrapper `start-with-setup`/serviço.
- **Regra violada:** scripts suportados devem ser portáveis para a plataforma-alvo.

### F-010 — API não tem lint; frontend silencia uma classe ampla de warnings de source map

- **Arquivo:linhas:** `SAGE-API/package.json:9-17,44-47`; `.github/workflows/ci.yml:52-58`; `SAGE/.eslintrc.cjs:1-5`; `SAGE/craco.config.js:3-15`.
- **Severidade estrita:** **Baixa** — é lacuna de prevenção, sem falha funcional isolada demonstrada.
- **Categoria:** qualidade de build / ESLint.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** a API não declara ESLint, config ou script `lint`; CI faz apenas `node --check`. O frontend descarta todo warning de `source-map-loader` originado em qualquer `node_modules`.
- **Evidência:** manifestos/configs e workflow.
- **Impacto:** problemas semânticos não cobertos por testes escapam; warnings de mapas corrompidos/ausentes deixam de sinalizar degradação de depuração.
- **Reprodução:** listar scripts/configs e examinar o predicado de `ignoreWarnings`.
- **Correção sugerida:** adicionar lint explícito e requerido à API; restringir exceções de source map a pacotes/causas conhecidos, com remoção planejada.
- **Regra violada:** quality gates explícitos e supressões mínimas/específicas.

## Catálogo automático de `process.env`

A extração reconheceu acessos `process.env.NOME` e `process.env['NOME']` em todos os JS/CJS/MJS versionados. Spreads/dinâmicos foram revisados separadamente: `renomear-bd-para-antigo.js:27`, `backupBanco.js:70,111-112`, `sanitizador.js:157` e helpers/testes. `backupBanco` limita a passagem dinâmica por allowlist; spreads de testes herdam o ambiente do processo.

### SAGE — 3 nomes estáticos

| variável | tipo/default efetivo | consumidores | exemplo/produção |
|---|---|---|---|
| `REACT_APP_API_URL` | string; `''`; remove `/` final; vazio = same-origin | `src/services/api.js:3`; `Areas.js:35`; `Inicio.js:25`; `Settings.js:21`; teste de API | vazia nos dois arquivos env |
| `REACT_APP_SOCKET_URL` | string ou `undefined`; vazio = same-origin | `src/contexts/WebSocketContext.js:24` e teste | vazia nos dois arquivos env |
| `NODE_ENV` | enum injetado pelo CRA; comparado estritamente a `development` | `src/services/api.js:4` | `development` apenas no exemplo; CRA fixa `production` no build |

### SAGE-API — 93 nomes estáticos

| família | variáveis, tipo e default | consumidores principais |
|---|---|---|
| servidor/CORS | `PORT` string/número `3000`; `HOST` string `0.0.0.0`; `NODE_ENV` string `development`; `LOG_LEVEL` string `info`; `API_VERSION` string `null` ou versão do pacote em readiness; `JOBS_ENABLED` booleano false-only (ausente = ligado); `REQUEST_TIMEOUT` int `30000`; `UPLOAD_MAX_SIZE_MB` int `25`; `IMPORT_TIMEOUT_MS` int `300000`; `DIAGNOSTICO_KEY` segredo opcional; `CORS_ORIGINS` CSV vazio; `CORS_ALLOW_ALL` true-only; `SAGE_REQUIRE_WEB` true-only, forçado em produção | `index.js:14-15,27,70`; `src/app.js:40-41,70-71,106-107,181-205`; `dataRoutes.js:26,62,78`; `statusRoutes.js:118` |
| banco | `DB_HOST=localhost`; `DB_PORT=3306` int; `DB_USER=root` em setup/config, **sem default** no gate; `DB_PASSWORD` obrigatório/sem default (alguns utilitários usam `''`); `DB_NAME=sage`; `DB_TIMEZONE=-03:00`; `DB_CONNECTION_LIMIT=10`; `DB_QUEUE_LIMIT=100` | `src/config/database.js:8-22,54`; `scripts/setup-database.js:15-21`; `runtime-schema-gate.js:8-12`; scripts e helpers de teste |
| JWT | `JWT_SECRET` sem default; `JWT_EXPIRES_IN=1h` | `src/utils/jwt.js:7-8`; testes definem segredo próprio |
| Redis/LRU | `REDIS_ENABLED` false-only (**ausente = tenta Redis**); `REDIS_HOST=localhost`; `REDIS_PORT=6379`; `REDIS_PASSWORD` sem default; `REDIS_DB=0` | `src/config/redis.js:14,23-26` |
| Control iD/rede | `CATRACA_TIMEOUT=10000`; `CATRACA_RETRY_ATTEMPTS=3`; `CATRACA_RETRY_DELAY=1000`; `CATRACA_LOAD_LOGS_TIMEOUT=60000`; `CATRACA_ZERAR_LOGS_TIMEOUT_MS=180000`; `CATRACA_BACKUP_CHUNK_SIZE=2000`; `CATRACA_LOGS_INFO_THRESHOLD=5000`; delays `CATRACA_RETRY_DELAY_1_MS=2000`, `_2_MS=5000`, `_3_MS=10000`; `CATRACA_USER_ID_OFFSET=110000000/111000000` divergente; portais entrada/saída `1/2`; `CATRACA_MIN_LOG_ID=0`; `CATRACA_DELAY_APOS_BACKUP_MS=15000`; `CATRACA_SKIP_USER_IMAGE` true/`1`; `CATRACA_ADMIN_USER` e `CATRACA_ADMIN_PASSWORD` sem default | `src/config/axios.js:7,46,66`; `deviceService.js:10,28-30,143-478`; `controlIdService.js:11,146-167`; `accessService.js:8,12-13,134`; `deviceController.js:105,302,450` |
| sync/jobs/backup | `CATRACA_SYNC_ENABLED` false-only, default ligado; `SYNC_PARALLEL_LIMIT=3`; `SYNC_PASSO_PONTEIRO=25`; `SYNC_CHECK_INTERVAL=*/1 * * * *`; `SYNC_BATCH_SIZE=50`; `HEALTH_CHECK_INTERVAL=60000`; `PROMOCAO_CRON=''` (desliga); `PROMOCAO_NA_SUBIDA` false-only, default ligada; `BACKUP_CRON=0 3 * * *` ou literal `false`; `BACKUP_MAX_HORAS=24`; `BACKUP_VERIFICAR` false-only, default ligado; `BACKUP_DIR=paths.backups`; `BACKUP_RETER_DIAS=14`; `BACKUP_RETER_MINIMO=3` | `index.js:70-118`; `scheduledJobs.js:14,39,58,97,106,207,249,271,308`; `accessService.js:304`; `controlIdService.js:12`; `backupBanco.js:82-87` |
| monitor/callback | `MONITOR_SYNC_LIMIT=200`; `MONITOR_MAX_EVENT_AGE_SECONDS=300`; `MONITOR_USE_PUSH` true-only; `MONITOR_POLLING_INTERVAL_MS=20000`; `MONITOR_CALLBACK_URL` opcional; host = callback/`HOST`/`localhost`; porta = callback/`PORT`/`3000`; `MONITOR_CALLBACK_TOKEN` e `MONITOR_IP_WHITELIST` opcionais | `accessService.js:137,598`; `deviceService.js:650-690`; `monitorCallbackAuth.js:9-10`; `schoolController.js:249-250`; `scheduledJobs.js:39` |
| WebSocket | `WS_PING_INTERVAL=30000`; `WS_PING_TIMEOUT=60000` | `src/websocket/wsServer.js:22-23` |
| diretórios/runtime/instalador | `SAGE_DATA_DIR`, `SAGE_CONFIG_FILE`, `SAGE_WEB_DIR` caminhos opcionais/absolutos; `SAGE_INITIAL_ADMIN_LOGIN`, `_PASSWORD`, `_SCHOOL_NAME` (nome default `Unidade Escolar`); `SAGE_ALLOW_FIRST_RUN_ONBOARDING` true-only; `SAGE_APP_VERSION` cai na versão do pacote; retries de schema `SAGE_RUNTIME_SCHEMA_RETRY_ATTEMPTS=10`, `_DELAY_MS=3000`, com limites; `SAGE_MAINTENANCE_CONFIG_FILE`, `MYSQL_DEFAULTS_EXTRA_FILE` opcionais; `SAGE_REQUIRE_MAINTENANCE_DB` true-only; `MYSQLDUMP_PATH=mysqldump`; `MYSQL_PATH=mysql` | `src/config/env.js:5-21`; `paths.js:5-20`; `web.js:5`; `setup-database.js:11,251-256`; `start-with-setup.js:40-77`; `backupBanco.js:34,71-85` |
| scripts auxiliares | `API_URL`/`BASE_URL` => `http://localhost:3000`; `UNIDADE_ID=1`; `ESCOLA_USUARIO`/`ESCOLA_SENHA` sem default; `SAGE_AUDIT_MAX_LATENCY_MS=2000` | `scripts/diagnostico-acessos.js:15`; `test-monitoramento.js:16`; `reverter-finalizados.js:25-36`; `audit-api-surface.js:7` |
| somente teste | `DEBUG_QUEDA` booleano por presença | `test/recuperacao-apos-queda.test.js:202` |

Comparações relevantes entre consumidores: `DB_USER` tem default em setup/config mas é obrigatório no runtime gate; `DB_PASSWORD` é `undefined` em produção e `''` em scripts/helpers; `API_VERSION` pode ser `null`, env ou versão do pacote conforme endpoint; `NODE_ENV` ausente significa desenvolvimento e faz `start-with-setup` tentar `nodemon`; os defaults divergentes de offset e jobs são achados F-002/F-008.

Chaves documentadas sem qualquer leitura `process.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `FRONTEND_URL` (F-004).

## Dependências, versões e hardcodes

### Versões flutuantes

- SAGE: 18 de 22 dependências de runtime usam `^`; a única devDependency (`@craco/craco`) também usa `^`.
- SAGE-API: 13 de 23 dependências de runtime usam `^`; as 2 devDependencies usam `^`. `xlsx` usa tarball local fixo `file:vendor/xlsx-0.20.3.tgz` e não foi contado como flutuante.
- Os dois lockfiles v3 fixam versões e o builder usa `npm ci`, portanto o artefato do commit é determinístico quanto ao npm. A flutuação reaparece em `npm install`, regeneração do lock e atualizações automatizadas.

### Dev em produção / ferramentas no runtime

- SAGE coloca CRA, Testing Library e utilitários sem uso em `dependencies`; isso explica por que o Dependabot marca transitivas de build com `scope=runtime`.
- SAGE-API separa `nodemon`/`vitest` em `devDependencies`; `build-release.ps1:93` usa `npm ci --ignore-scripts --omit=dev`, e `assemble-api-payload.js:124-132` recusa devDependencies no payload. Não foi encontrada ferramenta de build no `node_modules` entregue da API.
- `artifacts.json` distingue `inno-setup` como `role=build, includeInPayload=false`; Node 24.18.0, MySQL 8.4.11 e WinSW 2.12.0 são runtimes fixados com tamanho e SHA-256.

### Hardcodes catalogados

- **Problemático:** SHA do frontend `e8c5131e...` no workflow Windows (F-006).
- **Divergente:** offset `110000000`/`111000000` (F-002), cron `*/1`/`*/5` e promoção vazia/`10 8` (F-008).
- **Perfis intencionais:** API `PORT=3000`; MySQL local `3307` no instalador contra `3306` no exemplo; origens locais `localhost/127.0.0.1/[::1]:3000`; artefatos Windows e hashes fixos.
- **Dependente do ambiente:** `.env.example:84-86` traz `MONITOR_CALLBACK_HOST=192.168.0.64` e porta 3000, mas `MONITOR_USE_PUSH=false` torna o host dormente por padrão. Deve ser placeholder comentado para evitar adoção acidental.
- **Gate de release:** `artifacts.json:26-32` marca assinatura MySQL pendente e revisão de redistribuição necessária; o layout gerado permanece `distribution.public=false`, e `build-installer.ps1:9-10` recusa layout público. Isto é limitação explícita, não foi contado como vulnerabilidade.

## Limitações e integridade

- O Node disponível é `v18.16.1`/npm `9.5.1`; `SAGE-API/package.json:6-8` exige Node `>=24 <25`, e `build-release.ps1:53-59` exige Node 24 x64 no Windows. Por isso não foi possível validar execução local sem trocar o ambiente, o que estava fora do escopo.
- Não foram executados install, audit, build ou testes. `npm ls --package-lock-only` e consultas `gh api` foram somente leitura.
- O Dependabot expõe a default branch, não a branch local. A classificação preserva simultaneamente o snapshot 98/2/53 e o máximo atualmente verificável de 97 registros, sem fabricar a unidade ausente.
- A detecção de dependência não usada é estática e reconhece imports/requires literais; peer dependencies necessárias foram preservadas (`@fortawesome/fontawesome-svg-core`).
- Ao final, `git status --short` permaneceu vazio em `C:\SAGE-WS\SAGE` e `C:\SAGE-WS\SAGE-API`. O único arquivo gravado pela fatia foi este relatório fora dos dois worktrees.
