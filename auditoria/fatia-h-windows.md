# FATIA H — Auditoria independente do instalador e empacotamento Windows

> **Nota do orquestrador:** este é o relatório bruto. Aceitação, duplicatas e
> severidades finais estão em `ONDA3-VERIFICACAO.md`; essa verificação prevalece.

## Veredicto

**NÃO APTO para instalação ou atualização autônoma em escola.** O protótipo separa corretamente o estado persistente do código e tem controles úteis de ACL, serviços, firewall, readiness e hash dos runtimes. Porém, o caminho real do `.exe` não implementa a atualização blue-green aceita: a versão permanece `1.0.0`, o Inno Setup sobrescreve o layout em uso, o marcador `current.json` não é o ponteiro de ativação e o rollback pode relançar exatamente os arquivos recém-sobrescritos. Há ainda um caminho direto em que a API é parada e não reiniciada quando a parada posterior do MySQL falha.

Foram confirmados **12 achados**: **3 SEV1**, **1 SEV2**, **8 SEV3**, **0 SEV4**.

| ID | Severidade | Resumo |
|---|---:|---|
| H-001 | SEV1 | Upgrade sobrescreve código/runtime em uso e o fallback aponta para a mesma versão `1.0.0` |
| H-002 | SEV1 | Rollback para código antigo é incompatível com o ledger depois de migration nova |
| H-003 | SEV2 | Migration ocorre sem backup verificado nem restauração; DDL parcial permanece |
| H-004 | SEV1 | Falha ao parar o MySQL deixa a API parada e desarma a recuperação do setup |
| H-005 | SEV3 | Não há preflight completo nem ledger/desfazimento da instalação |
| H-006 | SEV3 | Diretório selecionável e caminhos fixos divergem; shutdown fixa `C:` |
| H-007 | SEV3 | Workflow não gera, testa, publica nem calcula hash do instalador final |
| H-008 | SEV3 | Compilação final não autentica o layout nem o `ISCC.exe` efetivamente usado |
| H-009 | SEV3 | Qualquer commit do frontend pode ser pareado; readiness só prova que `index.html` existe |
| H-010 | SEV3 | Reinstalação após uninstall preservador falha nas ACLs de SIDs de serviços removidos |
| H-011 | SEV3 | MySQL instalado contradiz porta, layout, modelo de serviço e distribuição do ADR aceito |
| H-012 | SEV3 | Fluxo e mensagens não são acionáveis para a secretária não técnica |

## Identificação, restrições e cobertura

- Repositório auditado: `C:\SAGE-WS\SAGE-API`
- Branch: `wip/recuperacao-local-pre-auditoria`
- Commit: `9e3eaba3475c3e9755f341d29bada059cc6fc5db`
- Estado inicial do worktree: limpo (`git status --short` sem saída).
- Revisão exclusivamente estática/read-only. Não foram executados instalador, build, serviço, setup, download, release nem scripts da aplicação.
- Runtime local: **Node v18.16.1**, incompatível com `package.json:6-8` (`>=24 <25`). Por essa limitação e pela proibição operacional, testes Node/Vitest não foram executados e nenhum runtime foi instalado.
- Windows PowerShell local observado: `5.1.22621.4249`.
- Documentos de contrato lidos, e somente estes no repositório de arquitetura:
  - `repo/docs/adr/0011-atualizacao-blue-green.md`
  - `repo/docs/adr/0001-mysql-embarcado.md`
  - `repo/docs/adr/0002-assinatura-signpath.md`
  - `repo/docs/adr/0003-estado-da-maquina-desconhecido.md`
  - `repo/docs/arquitetura/atualizacao.md`
  - `repo/docs/operacao/instalacao.md`

### Inventário e LOC do escopo principal

LOC física e LOC não vazia, obtidas com `Get-Content` sem executar os arquivos:

| Arquivo | Física | Não vazia |
|---|---:|---:|
| `installer/windows/artifacts.json` | 62 | 62 |
| `installer/windows/build-installer.ps1` | 21 | 21 |
| `installer/windows/build-release.ps1` | 120 | 107 |
| `installer/windows/complete-install.ps1` | 75 | 71 |
| `installer/windows/configure-firewall.ps1` | 93 | 84 |
| `installer/windows/initialize-mysql.ps1` | 262 | 242 |
| `installer/windows/initialize-state.ps1` | 279 | 263 |
| `installer/windows/prepare-install.ps1` | 18 | 16 |
| `installer/windows/provision-services.ps1` | 292 | 270 |
| `installer/windows/SAGE.iss` | 92 | 84 |
| `installer/windows/SAGE-API.xml.template` | 26 | 26 |
| `installer/windows/SAGE-MySQL.xml.template` | 24 | 24 |
| `installer/windows/stop-mysql.ps1` | 9 | 9 |
| `installer/windows/uninstall-services.ps1` | 253 | 232 |
| `scripts/assemble-api-payload.js` | 182 | 170 |
| `scripts/assemble-windows-layout.js` | 186 | 172 |
| `scripts/fetch-windows-artifacts.js` | 82 | 78 |
| `scripts/verify-windows-artifacts.js` | 94 | 86 |
| `.github/workflows/windows-native.yml` | 478 | 453 |
| **Total** | **2.648** | **2.470** |

Também foram rastreados, por serem chamados no ciclo, `scripts/setup-database.js`, `scripts/migration-runner.js`, `scripts/runtime-schema-gate.js`, `scripts/start-with-setup.js`, `scripts/legacy-baseline.js`, `src/services/readinessService.js`, `src/config/web.js`, migrations versionadas e os testes de contrato Windows pertinentes. `.github/workflows/ci.yml` foi triado e não gera artefato Windows.

## Mapa exato do layout instalado

O assembler cria o layout abaixo e o Inno copia todo ele para `{app}` com `ignoreversion recursesubdirs createallsubdirs` (`SAGE.iss:31-33`). `{app}` tem default em `{autopf}\SAGE`, mas pode divergir; os scripts, contudo, calculam `%ProgramFiles%\SAGE`.

```text
%ProgramFiles%\SAGE\                     código/runtime (descartável em tese)
├── release.json                          versão, commits, componentes e hashes do layout
├── runtime\
│   ├── node\...                          ZIP Node inteiro extraído
│   └── mysql\...                         ZIP MySQL inteiro extraído
├── service\
│   ├── SAGE-API.exe                      WinSW
│   ├── SAGE-API.xml                      reescrito para a versão ativa
│   ├── SAGE-MySQL.exe                    WinSW
│   ├── SAGE-MySQL.xml
│   ├── initialize-state.ps1
│   ├── initialize-mysql.ps1
│   ├── configure-firewall.ps1
│   ├── provision-services.ps1
│   ├── uninstall-services.ps1
│   ├── stop-mysql.ps1
│   ├── complete-install.ps1
│   └── prepare-install.ps1
└── releases\<package.json.version>\
    ├── api\                               allowlist de API + node_modules de produção
    └── web\                               allowlist do build React

%ProgramData%\SAGE\                       estado persistente
├── current.json                          registro da versão; não é junction nem ponteiro usado no boot
├── config\
│   ├── sage.env
│   ├── maintenance.env
│   ├── maintenance-client.cnf
│   ├── shutdown-client.cnf
│   ├── mysql.ini
│   └── mysql-accounts.ready
├── mysql\
│   ├── data\                              datadir MySQL
│   └── tmp\
├── logs\
│   ├── api\
│   └── mysql\
├── backups\
├── uploads\
└── exports\
```

Temporários possíveis durante bootstrap/falha: `config\mysql-bootstrap-client.cnf`, `config\runtime-client.partial.cnf`, `config\mysql-bootstrap.partial.sql`, `mysql\bootstrap.log`, `current.json.pending` e arquivos `*.partial-<pid>-<guid>`. Os `finally` tentam remover esses temporários, mas não há ledger durável da instalação.

### O que é preservado ou substituído

| Cenário | `%ProgramFiles%\SAGE` | `%ProgramData%\SAGE` | Serviços/firewall | Resultado real |
|---|---|---|---|---|
| Fresh install | Layout inteiro é copiado antes da inicialização | Diretórios, segredos, configs, datadir, logs e marcador são criados | SAGEMySQL/SAGEAPI registrados como LocalService; firewall criado ao ativar API | Sucesso somente após schema, API `/ready` e `current.json`; onboarding fica para a aplicação web |
| Upgrade | Serviços são parados; arquivos comuns, runtime, service e release do mesmo nome são sobrescritos; `releases\<versão>` só é lado a lado se a versão mudar | Config existente é validada exatamente e preservada; migrations escrevem no banco | XML do serviço é reescrito e serviços reiniciados | `current.json` só muda após readiness, mas o serviço já aponta diretamente para a versão escolhida; não existe junction atômica |
| Falha antes da cópia | Se SAGEAPI parar e SAGEMySQL falhar ao parar, nada restaura a API | Preservado | API pode ficar parada | SEV1 H-004 |
| Falha durante/depois da cópia | Pode haver mistura de layout antigo/novo; `DeinitializeSetup` tenta provisionar o layout presente, sem validar o resultado | Estado externo já criado/alterado não é desfeito | Serviços/firewall podem permanecer criados, modificados ou parados | Sem ledger e sem retorno garantido ao estado anterior |
| Falha após migration | Código tenta provisionar `previousVersion`; banco não é restaurado | Schema/ledger permanecem modificados | Runtime antigo pode recusar o ledger | SEV1 H-002 e SEV2 H-003 |
| Uninstall | Inno remove os arquivos que instalou após o script remover serviços/firewall | **Preservado integralmente**; não há opção de apagar na UI | Serviços e regra de firewall são removidos com validação de propriedade | Boa proteção contra destruição de dado, mas reinstalação pode falhar pelas ACLs preservadas (H-010) |

## Achados

### H-001 — Upgrade in-place e fallback para a mesma versão

- **Arquivo:linhas:** `package.json:3-8`; `scripts/assemble-windows-layout.js:96-97,138-166`; `installer/windows/SAGE.iss:31-32,73-81`; `installer/windows/complete-install.ps1:9-24,42-71`.
- **Severidade:** SEV1.
- **Categoria:** atomicidade / rollback / indisponibilidade.
- **Depende do ambiente:** NÃO.
- **Confiança:** ALTA.
- **Sintoma:** a segunda build do commit atual continua sendo `1.0.0` e é copiada sobre `releases\1.0.0`, `runtime`, `service` e `release.json`. Se a ativação falhar, `previousVersion` também é `1.0.0`; o “rollback” relança os arquivos novos/sobrescritos. Mesmo com futuro bump de versão, runtime e service continuam compartilhados e sobrescritos antes do veredito.
- **Evidência real sanitizada:** `package.json` fixa `"version": "1.0.0"`; o assembler usa `pkg.version` tanto no diretório quanto no manifesto; `[Files]` copia `SourceRoot\*` diretamente para `{app}` com `ignoreversion`; o catch chama `provision-services.ps1 -Version $previousVersion`, mas não restaura nenhum arquivo. `current.json` é somente um JSON movido depois do start; nenhum processo inicia por uma junction `current`.
- **Impacto no dado:** dados/config/logs não são diretamente sobrescritos por `[Files]`, mas a catraca/API pode permanecer parada. Se o erro ocorrer depois de migrations, o banco pode já estar alterado (H-002/H-003).
- **Como reproduzir:** em VM, produzir dois layouts de commits diferentes sem mudar `package.json.version`, instalar A, induzir falha de readiness na instalação B e comparar o hash de `releases\1.0.0\api\index.js` antes/depois; observar que o fallback aponta para `1.0.0` e não recupera o hash A. Reprodução estática: `rg -n '"version"|pkg.version|ignoreversion|previousVersion|current.json' package.json scripts/assemble-windows-layout.js installer/windows/{SAGE.iss,complete-install.ps1}`.
- **Correção sugerida apenas como direção:** implementar releases realmente imutáveis por versão/identidade, runtime versionado quando necessário, junction/pointer atômico usado pelo serviço e rollback que apenas troca o ponteiro; impedir build se a identidade já existir com conteúdo diferente.
- **Regra/ADR violado:** ADR-0011:18-29,53-60,66-76; `docs/arquitetura/atualizacao.md:13-32,71-108`; `docs/operacao/instalacao.md:9-31`.

### H-002 — Código antigo recusa o ledger após migration nova

- **Arquivo:linhas:** `installer/windows/complete-install.ps1:29-71`; `scripts/setup-database.js:369-389`; `scripts/migration-runner.js:110-123,216-249`; `scripts/runtime-schema-gate.js:6-24`; `scripts/start-with-setup.js:26-31,51-60`.
- **Severidade:** SEV1.
- **Categoria:** rollback / compatibilidade de schema / indisponibilidade.
- **Depende do ambiente:** NÃO, quando a atualização contém migration nova.
- **Confiança:** ALTA.
- **Sintoma:** a versão nova aplica a migration antes de subir. Se readiness falha, o instalador tenta iniciar a versão anterior; o gate dessa versão lê seu conjunto local de migrations e recusa qualquer linha do ledger sem arquivo local com `MISSING_LOCAL_FILE`. Logo, justamente a atualização que muda schema inviabiliza o rollback de código antigo.
- **Evidência real sanitizada:** `complete-install.ps1` executa `setup-database.js` antes de `provision -StartApi`. `verifyMigrationState` e `runMigrations` exigem que toda versão aplicada no banco tenha arquivo local e checksum idêntico. A versão anterior, por definição, não contém o arquivo novo. Não existe contrato `schema_minimo/schema_maximo`; a compatibilidade é uma lista fixa de colunas mais igualdade do inventário local de migrations.
- **Impacto no dado:** o ledger e o schema novos permanecem; o dado não é apagado automaticamente, porém o serviço antigo não sobe e a catraca fica sem API.
- **Como reproduzir:** em VM com release A, criar release B com uma migration expand-only nova; induzir `/ready` falhar após a migration; verificar o log da tentativa de A com `MISSING_LOCAL_FILE` e o serviço SAGEAPI sem readiness. A prova estática é `rg -n 'MISSING_LOCAL_FILE|verifyMigrationState|previousVersion|setup-database' scripts installer/windows`.
- **Correção sugerida apenas como direção:** declarar faixa explícita de schema por release e permitir que código antigo aceite migrations novas compatíveis; testar rollback A←B em VM para toda migration antes de liberar B.
- **Regra/ADR violado:** ADR-0011:26-29,40-41,64-68; `docs/arquitetura/atualizacao.md:36-67,89-100`.

### H-003 — Migration sem backup verificado nem restauração

- **Arquivo:linhas:** `installer/windows/complete-install.ps1:26-73`; `scripts/setup-database.js:369-393`; `scripts/migration-runner.js:137-192`; `.github/workflows/windows-native.yml:184-196`.
- **Severidade:** SEV2.
- **Categoria:** integridade de dados / migration / recuperação.
- **Depende do ambiente:** NÃO.
- **Confiança:** ALTA.
- **Sintoma:** o upgrade aplica SQL diretamente no banco vivo sem gerar e restaurar-provar um backup. Em falha, o catch restaura apenas código. MySQL faz commit implícito de DDL; um arquivo com múltiplos DDL pode deixar os primeiros aplicados e marcar a migration `failed` quando um posterior falhar.
- **Evidência real sanitizada:** não há referência a backup/restauração em `complete-install.ps1`. O runner insere `in_progress`, envia `migration.sql` e, no catch, executa `ROLLBACK` e muda status para `failed`; isso não desfaz DDL já confirmado implicitamente. O workflow prova isoladamente que o serviço de backup funciona, mas não o chama no fluxo do instalador.
- **Impacto no dado:** schema e eventualmente dados de uma migration podem ficar parcialmente modificados e sem cópia restaurável criada pelo upgrade; a mensagem do instalador não informa que o banco foi alterado.
- **Como reproduzir:** em VM, adicionar migration com um `ALTER TABLE` válido seguido de DDL inválido, instalar como upgrade e comparar schema/ledger antes/depois. Comando estático: `rg -n -i 'backup|verificarBackup|restaur' installer/windows/complete-install.ps1` retorna vazio.
- **Correção sugerida apenas como direção:** antes de qualquer migration, criar backup e provar restauração em schema isolado; registrar no ledger; em falha pós-migration, restaurar a cópia verificada antes de religar a versão antiga. Validar política expand-only no CI, sem tratá-la como substituta do backup.
- **Regra/ADR violado:** ADR-0011:26-29; `docs/arquitetura/atualizacao.md:36-68,86-100`; `docs/operacao/instalacao.md:60-75`.

### H-004 — Falha na parada do segundo serviço abandona a API parada

- **Arquivo:linhas:** `installer/windows/prepare-install.ps1:7-17`; `installer/windows/SAGE.iss:39-55,73-81`.
- **Severidade:** SEV1.
- **Categoria:** ordem de serviços / rollback / falha parcial.
- **Depende do ambiente:** SIM (MySQL demora, recusa ou falha ao parar).
- **Confiança:** ALTA.
- **Sintoma:** `prepare-install.ps1` para SAGEAPI primeiro e SAGEMySQL depois. Se a segunda parada falha, o script retorna erro após já parar a API. `ServicesPrepared` só vira verdadeiro quando o script inteiro retorna zero; portanto `DeinitializeSetup` não chama a recuperação e a instalação aborta com a API/catraca parada.
- **Evidência real sanitizada:** ordem literal `@('SAGEAPI', 'SAGEMySQL')`; `ServicesPrepared := True` fica depois do teste de `ResultCode`; a recuperação exige `ServicesPrepared and not InstallCompleted`.
- **Impacto no dado:** nenhuma escrita de dado é necessária para disparar; o banco tende a permanecer intacto. O impacto é indisponibilidade imediata da API/catraca sem recuperação autônoma.
- **Como reproduzir:** em VM, manter ambos os serviços em execução, fazer o stop do SAGEMySQL exceder/falhar e iniciar o upgrade; observar SAGEAPI `Stopped` após o setup abortar. A reprodução não foi executada nesta auditoria.
- **Correção sugerida apenas como direção:** tratar a preparação como transação: registrar cada serviço parado e, em qualquer falha, religar em ordem segura; ou parar MySQL somente depois de garantir um rollback que independe do flag global.
- **Regra/ADR violado:** ADR-0003:9-22,39-51; ADR-0011:9-14,66-68; `docs/operacao/instalacao.md:60-75`.

### H-005 — Ausência de preflight completo e ledger de instalação

- **Arquivo:linhas:** `installer/windows/SAGE.iss:14-32,43-70`; `installer/windows/initialize-state.ps1:7-20,176-196`; `installer/windows/complete-install.ps1:26-74`.
- **Severidade:** SEV3.
- **Categoria:** estado desconhecido / instalação parcial / diagnóstico.
- **Depende do ambiente:** SIM.
- **Confiança:** ALTA.
- **Sintoma:** o primeiro pre-install apenas tenta parar serviços. O payload é escrito antes de validar versão mínima do Windows, espaço, portas, VC++ runtime, relógio, antivírus, IP e demais condições. Não existe `instalacao-ledger.json` nem ações `desfazer`; falhas após criar configs, serviços, ACLs, banco ou firewall dependem de tentativas ad hoc.
- **Evidência real sanitizada:** `[Files]` antecede `ssPostInstall`; `initialize-state` valida apenas Win32/admin/caminho; `complete-install` não mantém ledger. `rg -n 'SYS-|PORT-|NET-|DEP-|TIME-|AV-|ledger|desfazer' installer/windows` não encontra os códigos/ledger exigidos.
- **Impacto no dado:** o instalador evita pôr ProgramData dentro de `{app}`, mas pode deixar config, datadir/schema, serviços e firewall parciais. Não há prova de retorno à árvore/registro anteriores.
- **Como reproduzir:** em snapshots separados, ocupar porta 3000/3307, limitar espaço ou remover dependência nativa e comparar arquivos, serviços e registro após a falha. O contrato exige falha induzida por passo; não há implementação equivalente para exercitar.
- **Correção sugerida apenas como direção:** implementar preflight completo antes de `[Files]` e ledger durável com compensação inversa, IDs de erro e testes por fault injection em VM.
- **Regra/ADR violado:** ADR-0003:17-22,39-51; `docs/operacao/instalacao.md:35-75,162-186`.

### H-006 — Caminho de instalação inconsistente e shutdown preso a `C:`

- **Arquivo:linhas:** `installer/windows/SAGE.iss:18,31-32`; `installer/windows/complete-install.ps1:6-15`; `installer/windows/initialize-state.ps1:15-16,198-219,258-273`; `installer/windows/provision-services.ps1:15-28`; `installer/windows/stop-mysql.ps1:1-8`.
- **Severidade:** SEV3.
- **Categoria:** portabilidade Windows / caminho fixo.
- **Depende do ambiente:** SIM.
- **Confiança:** ALTA.
- **Sintoma:** Inno instala em `{app}` e a tela de diretório não é bloqueada, mas todos os scripts procuram `%ProgramFiles%\SAGE`. Além disso, o stop command do serviço MySQL fixa `C:\Program Files` e `C:\ProgramData`. Diretório customizado, Program Files em outro volume ou ProgramData redirecionado quebra complete-install e/ou shutdown gracioso.
- **Evidência real sanitizada:** `{app}` é a origem da cópia, enquanto `complete-install.ps1` ignora `{app}` e recalcula `GetFolderPath('ProgramFiles')`. `stop-mysql.ps1` não usa Known Folders e contém dois literais em `C:`.
- **Impacto no dado:** a falha de shutdown pode impedir upgrade/uninstall ou deixar serviço indisponível; não há intenção de apagar o datadir, mas parar MySQL fora do caminho gracioso aumenta risco operacional.
- **Como reproduzir:** em VM, escolher outro destino no wizard ou usar Windows com pastas conhecidas fora de `C:`; observar “release.json ausente”/falha do stop script. Estático: `rg -n 'C:\\Program|GetFolderPath|\{app\}' installer/windows`.
- **Correção sugerida apenas como direção:** bloquear destino e usar uma única raiz injetada pelo instalador, ou propagar `{app}`/Known Folders a todos os scripts e XMLs; eliminar literais de unidade.
- **Regra/ADR violado:** ADR-0003:9-22; `docs/operacao/instalacao.md:9-31,152-158`.

### H-007 — Workflow não produz nem testa o `.exe` final

- **Arquivo:linhas:** `.github/workflows/windows-native.yml:3-11,83-124,473-478`; `installer/windows/build-installer.ps1:1-21`; `test/windows-ci-contract.test.js:29-35`.
- **Severidade:** SEV3.
- **Categoria:** CI/release / divergência artefato testado versus instalado.
- **Depende do ambiente:** NÃO.
- **Confiança:** ALTA.
- **Sintoma:** o workflow monta um diretório, testa componentes manualmente e o apaga. Nunca chama `build-installer.ps1`, nunca compila `SAGE.iss`, nunca exercita callbacks/rollback/uninstall do Inno, nunca faz upload e nunca calcula/publica SHA-256 do `.exe`. Push automático cobre apenas branches `agent/f8-*`, não a branch auditada, `main` ou tags.
- **Evidência real sanitizada:** o último passo remove `sage-release-smoke`; o teste de contrato exige explicitamente ausência de `upload-artifact`/release. Não existe referência a `build-installer.ps1` no workflow.
- **Impacto no dado:** não toca dado diretamente; permite que falhas exclusivas do instalador final cheguem à escola sem cobertura e sem hash publicável.
- **Como reproduzir:** `rg -n 'build-installer|ISCC|upload-artifact|Get-FileHash|release' .github/workflows/windows-native.yml` mostra somente o layout/smoke e descarte; `rg -n 'branches:'` mostra os gatilhos históricos.
- **Correção sugerida apenas como direção:** job Windows de release que compile o `.exe` a partir do layout verificado, faça smoke do próprio instalador em VM descartável, gere SHA-256/proveniência e publique apenas após a matriz de falhas.
- **Regra/ADR violado:** ADR-0002:54-65; `docs/operacao/instalacao.md:112-122,162-186`; ADR-0003:39-51.

### H-008 — Builder final desacoplado do manifesto e do inventário verificados

- **Arquivo:linhas:** `installer/windows/artifacts.json:47-59`; `installer/windows/build-installer.ps1:8-20`; `scripts/assemble-windows-layout.js:146-166`; `scripts/verify-windows-artifacts.js:61-79`.
- **Severidade:** SEV3.
- **Categoria:** supply chain / integridade e autenticidade.
- **Depende do ambiente:** SIM (estado da máquina de build/layout entre etapas).
- **Confiança:** ALTA.
- **Sintoma:** o cache baixa/verifica `innosetup-6.7.3.exe`, mas o compilador final não o usa. `build-installer.ps1` aceita o primeiro `ISCC.exe` encontrado em três pastas, não verifica versão, hash nem assinatura, e a mensagem “6.7.3 não encontrado” não é uma validação. Também não revalida os hashes de `release.json.files`; qualquer alteração do layout após assembly entra no `.exe`.
- **Evidência real sanitizada:** o manifesto fixa hash do instalador Inno; o builder só faz `Test-Path`, lê `release.json` e chama o executável encontrado. O inventário SHA-256 é escrito pelo assembler, mas não é consumido no builder nem no instalador.
- **Impacto no dado:** um builder/layout adulterado pode distribuir código diferente do inventariado, executado como administrador e com acesso indireto ao estado; a divergência seria silenciosa para a escola.
- **Como reproduzir:** numa cópia descartável do layout, alterar um arquivo após gerar `release.json` e observar estaticamente que `build-installer.ps1` não chama verificador algum; comparar `rg -n 'sha256|Get-FileHash|verify|version' installer/windows/build-installer.ps1` com o manifesto.
- **Correção sugerida apenas como direção:** usar exatamente o artefato Inno pinado/verificado, validar sua assinatura/versão/licença e revalidar inventário completo imediatamente antes da compilação; gerar proveniência do `.exe`.
- **Regra/ADR violado:** ADR-0002:54-65; ADR-0011:57-60; `docs/operacao/instalacao.md:112-122`.

### H-009 — Pareamento web/API sem contrato de compatibilidade

- **Arquivo:linhas:** `.github/workflows/windows-native.yml:4-9,24-40,95-124`; `installer/windows/build-release.ps1:67-73,110-113`; `scripts/assemble-windows-layout.js:146-165`; `src/config/web.js:10-29`; `src/services/readinessService.js:92-101`.
- **Severidade:** SEV3.
- **Categoria:** compatibilidade frontend/backend / release.
- **Depende do ambiente:** SIM (commit escolhido em `web_ref`).
- **Confiança:** ALTA.
- **Sintoma:** `workflow_dispatch` aceita qualquer commit do repositório SAGE. O builder apenas registra os dois SHAs. O readiness considera o frontend pronto se `index.html` existir; não testa rotas, payloads ou versão de API. Um frontend compilável mas incompatível pode ser instalado e confirmado como `ready`.
- **Evidência real sanitizada:** `web_ref` é input livre obrigatório; `release.json.source.webCommit` é metadado, não constraint; `webBuildAvailable()` executa somente `statSync(indexFile).isFile()`.
- **Impacto no dado:** não há escrita direta comprovada; a interface pode falhar ou enviar contratos errados enquanto backend/readiness permanecem verdes, exigindo rollback/manual pairing.
- **Como reproduzir:** disparar o workflow em ambiente controlado com um SHA web compilável de contrato divergente e observar que a única validação web de runtime é a existência de `index.html`. Estático: `rg -n 'web_ref|webCommit|webBuildAvailable|indexFile' .github/workflows/windows-native.yml scripts src/config/web.js`.
- **Correção sugerida apenas como direção:** manifesto de compatibilidade API↔web pinado/assinado, teste E2E do par exato e readiness/smoke funcional que cubra operações críticas da UI.
- **Regra/ADR violado:** ADR-0003:19-22; `docs/arquitetura/atualizacao.md:42-54,75-100`.

### H-010 — Reinstalação após uninstall falha nas ACLs preservadas

- **Arquivo:linhas:** `installer/windows/initialize-state.ps1:22-32,57-79,176-195`; `installer/windows/SAGE.iss:61-69`; `installer/windows/uninstall-services.ps1:208-249`.
- **Severidade:** SEV3.
- **Categoria:** idempotência / ACL / reinstalação.
- **Depende do ambiente:** SIM (estado “desinstalado com ProgramData preservado”).
- **Confiança:** ALTA.
- **Sintoma:** o uninstall remove os serviços, mas preserva ProgramData e suas ACEs de `NT SERVICE\SAGEAPI`/`SAGEMySQL`. Na reinstalação, `SAGE.iss` chama `initialize-state.ps1` antes de recriar os serviços. A tradução dos nomes falha quando os serviços não existem, os SIDs são omitidos de `$allowedSids`, e `Assert-PrivateAcl` recusa as ACEs preservadas.
- **Evidência real sanitizada:** a tradução está em `try/catch { $null }`; qualquer SID fora de required+service traduzido dispara “ACL não autorizada”. No host de auditoria, sem os dois serviços, ambas as traduções retornaram `MethodInvocationException`. O uninstall declara os dados preservados e não remove as ACEs.
- **Impacto no dado:** dados permanecem intactos, mas a reinstalação aborta antes de recuperar o serviço; o contorno perigoso seria apagar estado ou editar ACL manualmente.
- **Como reproduzir:** em VM, instalar, desinstalar preservando ProgramData e reinstalar. Reprodução read-only da pré-condição: tentar traduzir `[NTAccount]('NT SERVICE','SAGEAPI')` sem o serviço e observar falha.
- **Correção sugerida apenas como direção:** registrar serviços antes de validar ACL preservada, ou calcular/aceitar de modo seguro os SIDs determinísticos esperados e validar propriedade/rights; adicionar cenário install→uninstall→reinstall preservando hashes dos dados.
- **Regra/ADR violado:** ADR-0003:19-22,47-51; `docs/operacao/instalacao.md:69-75,176-182`.

### H-011 — Implementação do MySQL diverge do ADR aceito

- **Arquivo:linhas:** `installer/windows/artifacts.json:18-32`; `scripts/assemble-windows-layout.js:111-120`; `installer/windows/SAGE.iss:31-32`; `installer/windows/initialize-state.ps1:198-219,258-273`; `installer/windows/provision-services.ps1:18-26,155-201,238-268`.
- **Severidade:** SEV3.
- **Categoria:** arquitetura / redistribuição / conflito de porta.
- **Depende do ambiente:** SIM (colisão da porta e liberação jurídica).
- **Confiança:** ALTA.
- **Sintoma:** o `.exe` inclui o ZIP MySQL de 281.191.914 bytes, instala runtime em Program Files, datadir em `%ProgramData%\SAGE\mysql\data`, usa porta 3307 e cria serviço Windows. O ADR aceito exige download oficial no primeiro run, porta 33306, binário/datadir sob `dados\mysql` e supervisor próprio sem serviço Windows. O próprio manifesto marca assinatura e revisão de redistribuição como pendentes.
- **Evidência real sanitizada:** `includeInPayload: true`; `signatureVerification: pending`; `redistribution: legal-review-required`; `sageReleaseGate: signature-and-redistribution-review-required`. O assembler copia MySQL para `runtime\mysql` e o Inno inclui todo `SourceRoot`.
- **Impacto no dado:** datadir continua fora de `releases` e é preservado, o que é positivo. Porém colisão em 3307 só é descoberta tarde; a distribuição ignora gate jurídico/autenticidade declarado e o lifecycle diverge do mecanismo aprovado.
- **Como reproduzir:** inspecionar o `.exe`/layout gerado em ambiente de build e confirmar presença de `runtime\mysql`; reservar porta 3307 antes do setup para observar falha tardia. Estático: `rg -n 'includeInPayload|3307|33306|SAGEMySQL|datadir' installer/windows scripts/assemble-windows-layout.js`.
- **Correção sugerida apenas como direção:** alinhar implementação e ADR numa decisão explícita; se o ADR permanecer, retirar MySQL do payload, usar download oficial com hash antes da extração, porta/layout aprovados e supervisor previsto. Não liberar enquanto gates do manifesto estiverem pendentes.
- **Regra/ADR violado:** ADR-0001:23-29,41-59; ADR-0003:41-48.

### H-012 — Assistente e erros não são acionáveis para a usuária-alvo

- **Arquivo:linhas:** `installer/windows/SAGE.iss:29,35-36,43-70`; `installer/windows/complete-install.ps1:75`; `test/windows-inno-contract.test.js:22-27`.
- **Severidade:** SEV3.
- **Categoria:** UX operacional / diagnóstico.
- **Depende do ambiente:** NÃO.
- **Confiança:** ALTA.
- **Sintoma:** o instalador não coleta os três campos, não mostra preflight ao vivo, não testa catraca/internet, não exibe código de instalação e cria só o atalho SAGE. Scripts rodam ocultos (`SW_HIDE`). A falha final diz apenas “Consulte os logs locais”, sem caminho, etapa, código rastreável ou ação; o setup não cria atalhos Reiniciar/Diagnóstico.
- **Evidência real sanitizada:** o teste de contrato exige ausência de `CreateInputQueryPage` e credencial no instalador; `SAGE_ALLOW_FIRST_RUN_ONBOARDING=true` adia cadastro para a aplicação. `[Icons]` contém uma única entrada. Não existem códigos `SYS-*`, `PORT-*`, `UPD-*` nos scripts do instalador.
- **Impacto no dado:** nenhum direto; em falha, a secretária sem suporte local não tem ação segura e pode repetir setup, desligar a máquina ou tentar apagar pastas com estado.
- **Como reproduzir:** abrir o instalador em VM e percorrer instalação/falha controlada; inventário estático: `rg -n 'CreateInput|\[Icons\]|SW_HIDE|Consulte|SYS-|PORT-|UPD-' installer/windows`.
- **Correção sugerida apenas como direção:** implementar as seis telas e três atalhos do contrato, progresso nomeado, códigos únicos com instrução segura e caminho de diagnóstico sem segredo; validar com pessoa não técnica.
- **Regra/ADR violado:** `docs/operacao/instalacao.md:3-5,60-75,131-158,184-186`; `docs/arquitetura/atualizacao.md:112-142`.

## Controles positivos confirmados

- `ProgramData` não entra em `[Files]` nem em diretivas de exclusão do Inno; uninstall preserva dados/config/logs e valida que serviços/regra pertencem ao SAGE antes de removê-los.
- Downloads de artefatos exigem HTTPS, limite/tamanho exato e SHA-256 antes da extração; montagem usa staging e recusa links simbólicos.
- Segredos são gerados por CSPRNG, gravados uma vez por arquivos temporários com flush e ACL protegida; bootstrap root e SQL temporário são removidos no sucesso/finally.
- MySQL usa loopback, desabilita MySQL X/local infile e configura `innodb-flush-log-at-trx-commit=1`.
- Serviços usam LocalService + service SID, dependência API→MySQL, recovery e readiness antes de confirmar `current.json`.
- Firewall é restrito a Domain/Private, `LocalSubnet`, TCP/3000 e executável Node, recusando política efetiva insegura.

Esses controles reduzem exposição e protegem o estado no caminho feliz, mas não compensam a ausência da transação de instalação/atualização e do rollback de dados/código.

## Comandos reproduzíveis usados (somente leitura)

```powershell
Set-Location C:\SAGE-WS\SAGE-API
git branch --show-current
git rev-parse HEAD
git status --short
rg --files installer/windows .github/workflows scripts | Sort-Object
rg -n -S 'windows-native|build-release|build-installer|assemble-windows|verify-windows' .github installer/windows scripts test
rg -n -i -S '\b(drop|truncate|delete\s+from|rename\s+(?:table|column)|change\s+(?:column)?|modify\s+(?:column)?)\b' database/migrations
rg -n '"version"|pkg.version|ignoreversion|previousVersion|current.json' package.json scripts/assemble-windows-layout.js installer/windows
rg -n -i 'backup|verificarBackup|restaur' installer/windows/complete-install.ps1
rg -n 'SYS-|PORT-|NET-|DEP-|TIME-|AV-|ledger|desfazer' installer/windows
rg -n 'build-installer|ISCC|upload-artifact|Get-FileHash' .github/workflows/windows-native.yml
node --version
```

Para LOC:

```powershell
$targets = @()
$targets += Get-ChildItem installer/windows -File
$targets += Get-Item scripts/assemble-api-payload.js,scripts/assemble-windows-layout.js,scripts/fetch-windows-artifacts.js,scripts/verify-windows-artifacts.js
$targets += Get-Item .github/workflows/windows-native.yml
$targets | ForEach-Object {
  $c = @(Get-Content -LiteralPath $_.FullName)
  [pscustomobject]@{ Arquivo=$_.FullName; Fisica=$c.Count; NaoVazia=@($c | Where-Object { $_ -match '\S' }).Count }
}
```

## Fechamento

O worktree do SAGE-API estava limpo no início da auditoria. A confirmação final deve permanecer sem saída em `git status --short`; nenhum arquivo do SAGE-API, frontend, arquitetura, configuração, serviço ou release foi modificado por esta fatia. O único artefato escrito é este relatório.
