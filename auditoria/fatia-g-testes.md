# FATIA G — harness de testes e simulador Control iD

> **Nota do orquestrador:** este é o relatório bruto. Aceitação, consolidações e
> severidades finais estão em `ONDA3-VERIFICACAO.md`; essa verificação prevalece.

Data da auditoria: 2026-08-06  
Repositório-base: `C:\SAGE-WS\SAGE-API`  
Branch confirmada: `wip/recuperacao-local-pre-auditoria`  
Commit observado: `9e3eaba3475c3e9755f341d29bada059cc6fc5db`  
Escopo lido: `test/**`, `vitest.config.js` e, para precedência de campo, `test/fakes/controlid/README.md`, `docs/ANALISE_SYNC_CONTROL_ID.md` e `docs/ORDEM_SYNC_CATRACA.md`. Arquivos de produção foram lidos somente para confirmar o caminho realmente exercitado e construir a matriz de risco.

## Resultado executivo

Foram confirmados **8 achados**: cinco SEV2 e três SEV3. O harness tem bons testes para identidade de log, concorrência Monitor/polling, recuperação após queda e para os quirks isolados do simulador. A lacuna material está nos fluxos de escrita e destruição: a suíte de modos de falha exercita diretamente o fake, mas não passa pelos serviços que criam/editam pessoas; os endpoints de backup/zeragem não têm testes de integração; e parte dos testes MySQL pode terminar verde sem executar nenhuma asserção.

Não foram executados testes. O Node local é `v18.16.1`, enquanto `package.json` exige `>=24 <25`. Não foi instalado ou trocado runtime.

## Inventário reproduzível

Critério de suíte backend: arquivo que casa com o `include` efetivo de `vitest.config.js`, isto é, `test/**/*.test.js`. Por esse critério há **49 arquivos/suítes**, não 51. Como métricas auxiliares, a busca estática encontra 63 declarações `describe/suite`, 226 declarações simples `it/test` e três `it.each` que expandem duas entradas cada, totalizando **232 casos materializados** se todas as parametrizações forem coletadas. Para MySQL ausente, a distinção exata é: **6 blocos condicionais `describe.skip` cobrindo 10 casos materializados**, **11 casos com `skip(...)` explícito** e **12 casos que retornam cedo e aparecem verdes**.

| Grupo | Arquivos | LOC físicas |
|---|---:|---:|
| `test/*.test.js` | 49 | 5.298 |
| `test/fakes/controlid/*` (inclui README) | 5 | 1.002 |
| `test/helpers/*` | 1 | 117 |
| `vitest.config.js` | 1 | 16 |
| **Total auditado** | **56** | **6.433** |

### LOC por arquivo de teste

| Arquivo | LOC | Arquivo | LOC |
|---|---:|---|---:|
| `agenda-canonica.test.js` | 49 | `assemble-api-payload.test.js` | 110 |
| `assemble-windows-layout.test.js` | 167 | `backup-banco.test.js` | 148 |
| `backup-maintenance-credential.test.js` | 78 | `bootstrap-seguro.test.js` | 155 |
| `contrato-diretorios.test.js` | 95 | `dependencia-sheetjs.test.js` | 25 |
| `dependencias-email-config.test.js` | 20 | `diagnostico.test.js` | 149 |
| `fetch-windows-artifacts.test.js` | 70 | `first-run-onboarding-contract.test.js` | 23 |
| `first-run-onboarding-http.test.js` | 146 | `fuso-horario.test.js` | 72 |
| `ingestao-catraca-log-id.test.js` | 192 | `legacy-baseline.test.js` | 155 |
| `local-origin-contract.test.js` | 12 | `local-origin-http.test.js` | 61 |
| `migration-catraca-log-id.test.js` | 212 | `migration-runner.test.js` | 322 |
| `migrations-respeitam-banco-alvo.test.js` | 21 | `modos-de-falha-controlid.test.js` | 238 |
| `protecao-logs.test.js` | 86 | `quirks-controlid.test.js` | 398 |
| `readiness.test.js` | 144 | `recuperacao-apos-queda.test.js` | 227 |
| `regressao-metodo-auth.test.js` | 109 | `regressao-monitor-dao.test.js` | 126 |
| `runtime-schema-gate.test.js` | 42 | `runtime-sem-dados-da-escola.test.js` | 28 |
| `sanitizador.test.js` | 153 | `saude-dispositivos.test.js` | 98 |
| `schedule-seed-converter.test.js` | 59 | `sem-falhas-silenciosas-banco.test.js` | 55 |
| `sem-falhas-silenciosas.test.js` | 95 | `servidor-web.test.js` | 179 |
| `setup-migration-ledger.test.js` | 52 | `simulador-controlid.test.js` | 280 |
| `start-with-setup.test.js` | 46 | `windows-artifacts.test.js` | 77 |
| `windows-ci-contract.test.js` | 78 | `windows-firewall-contract.test.js` | 46 |
| `windows-initialize-state-contract.test.js` | 69 | `windows-inno-contract.test.js` | 52 |
| `windows-mysql-bootstrap-contract.test.js` | 59 | `windows-native-builder-contract.test.js` | 33 |
| `windows-services-contract.test.js` | 73 | `windows-uninstall-contract.test.js` | 81 |
| `windows-update-contract.test.js` | 33 |  |  |

### LOC do suporte

| Arquivo | LOC |
|---|---:|
| `test/fakes/controlid/index.js` | 515 |
| `test/fakes/controlid/store.js` | 159 |
| `test/fakes/controlid/geradorLogs.js` | 85 |
| `test/fakes/controlid/prng.js` | 22 |
| `test/fakes/controlid/README.md` | 221 |
| `test/helpers/banco.js` | 117 |
| `vitest.config.js` | 16 |

## Achados

### G-001 — Fluxos destrutivos contornam o contrato de backup e não têm teste de rota

- **Arquivo:linhas:** `test/protecao-logs.test.js:13-85`; `src/controllers/deviceController.js:438-465`, `502-569`; `docs/ORDEM_SYNC_CATRACA.md:9-18`.
- **Severidade:** SEV2.
- **Categoria:** cobertura de operação destrutiva / pré-condição não exercitada.
- **Depende do ambiente:** NÃO.
- **Confiança:** alta.
- **Sintoma:** os oito testes de `protecao-logs` validam apenas a função pura `avaliarPerdaDeLogs`. Não existe teste que invoque as rotas reais. `comecarDoZero` chama `zerarTudoNaCatraca` antes de qualquer backup; `zerarTudo` faz o mesmo; e `zerarPorTipo` apaga `access_logs` sem gerar backup e sem aplicar a avaliação de perda.
- **Evidência real sanitizada:** busca por `comecarDoZero`, `zerarTudoNaCatraca`, `zerarPorTipo`, `gerarBackupCompletoCatraca` e `gerarBackupLogsCatraca` em `test/**` retorna zero chamadas de produção. No controller, a primeira mutação de “começar do zero” é a zeragem da catraca e, depois, seguem deletes no SAGE. O documento de campo prescreve explicitamente: backup completo e download, zeragem da catraca, só então exclusão no SAGE.
- **Impacto no dado:** exclusão irreversível de usuários, áreas, grupos e logs sem cópia restaurável; dependendo das opções, também exclusão de acessos e pessoas no banco local.
- **Como reproduzir:** `rg -n --glob 'test/**' 'comecarDoZero|zerarTudoNaCatraca|zerarPorTipo|gerarBackupCompletoCatraca|gerarBackupLogsCatraca'`; em seguida comparar a ordem estática de `deviceController.comecarDoZero` com `docs/ORDEM_SYNC_CATRACA.md:9-18`.
- **Correção sugerida apenas como direção:** criar teste HTTP/integração com simulador que prove backup completo verificado antes da primeira chamada destrutiva, falha fechada se o download/arquivo não for comprovado e nenhuma mutação no SAGE se qualquer etapa da catraca falhar. Centralizar a pré-condição para que nenhuma rota alternativa a contorne.
- **Regra violada:** operações destrutivas exigem backup; multi-passo preserva atomicidade; falha parcial nunca é sucesso.

### G-002 — Backup completo inventa ausência quando um objeto falha

- **Arquivo:linhas:** ausência de teste para `gerarBackupCompletoCatraca` em `test/**`; `src/services/deviceService.js:366-401`; `docs/ORDEM_SYNC_CATRACA.md:20-39`.
- **Severidade:** SEV2.
- **Categoria:** asserção ausente / falha parcial convertida em artefato de sucesso.
- **Depende do ambiente:** NÃO.
- **Confiança:** alta.
- **Sintoma:** cada erro de `load_objects` é capturado, o tipo é gravado como `[]`, o arquivo é publicado e a função retorna normalmente. O caller recebe `filePath`, `filename` e `summary`, sem indicação de que o backup é incompleto.
- **Evidência real sanitizada:** no laço dos objetos, o `catch` atribui `result.dados[objectType] = []` e `summary[objectType] = 0`; depois `writeFileSync` e `return` ocorrem mesmo com `result.erros`. Não há teste do serviço nem da rota `backupCompleto` com `offline`, `timeout`, `sessaoExpirada` ou `respostaParcial`.
- **Impacto no dado:** um backup parcial passa por completo e representa “não havia dado” onde na verdade “não foi possível ler”. Se usado antes de zerar, a restauração perde silenciosamente objetos e vínculos.
- **Como reproduzir:** `rg -n --glob 'test/**' 'gerarBackupCompletoCatraca|backupCompleto'` e inspeção de `deviceService.js:383-401`. Em Node 24, injetar falha em uma das leituras do simulador e confirmar que a função ainda publica o JSON.
- **Correção sugerida apenas como direção:** distinguir ausência confirmada de leitura falha; abortar, remover staging e não publicar backup se qualquer objeto obrigatório falhar; devolver erro tipado e testar restauração/contagens mínimas do artefato completo.
- **Regra violada:** nunca inventar presença/dado; falha parcial nunca é sucesso; backup deve ser recuperável.

### G-003 — Backup paginado não converge quando a catraca ignora `limit/offset`

- **Arquivo:linhas:** `test/quirks-controlid.test.js:145-160`; `test/fakes/controlid/README.md:91-103`; `src/services/deviceService.js:409-459`; `docs/ANALISE_SYNC_CONTROL_ID.md:49-51`.
- **Severidade:** SEV2.
- **Categoria:** divergência entre teste do quirk e consumidor de produção / laço sem progresso.
- **Depende do ambiente:** SIM — manifesta-se no firmware que devolve todos os logs e ignora paginação, comportamento registrado em campo e reproduzível pelo simulador.
- **Confiança:** alta.
- **Sintoma:** o teste Q3 confirma que uma solicitação com `limit: 200` pode devolver 48.057 itens, mas não chama `gerarBackupLogsCatraca`. O backup incrementa `offset` e só encerra quando `logs.length < CHUNK_SIZE`; se o equipamento ignora ambos, a condição nunca é atingida e o mesmo conjunto é anexado indefinidamente.
- **Evidência real sanitizada:** o quirk `ignoraLimitEmAccessLogs: true` descarta `limit/offset`. No consumidor, não existe detecção de cursor repetido, ID já visto, limite total ou ausência de progresso antes de `offset += CHUNK_SIZE`.
- **Impacto no dado:** arquivo JSONL duplicado/corrompido, backup que nunca termina e possível esgotamento de disco; isso também impede o fluxo seguro de zeragem que depende do backup.
- **Como reproduzir:** em Node 24, iniciar o simulador com `ignoraLimitEmAccessLogs: true`, semear quantidade maior que `CATRACA_BACKUP_CHUNK_SIZE` e invocar `gerarBackupLogsCatraca`; observar repetição do mesmo primeiro/último ID e crescimento contínuo. A análise estática reproduz a condição comparando `index.js:129-139` com `deviceService.js:429-449`.
- **Correção sugerida apenas como direção:** paginar por cursor de ID com verificação estrita de avanço, deduplicar IDs, abortar em página repetida e ter teto explícito; adicionar teste de produção com o quirk Q3 ligado.
- **Regra violada:** backup íntegro; escrita/ingestão idempotente; comportamento de campo prevalece sobre o happy path.

### G-004 — Falha parcial de edição é explicitamente reportada como sucesso e o teste não passa pelo serviço

- **Arquivo:linhas:** `test/modos-de-falha-controlid.test.js:62-83`; `src/services/controlIdService.js:128-219`.
- **Severidade:** SEV2.
- **Categoria:** título/cenário não corresponde ao caminho de produção; falha parcial mascarada.
- **Depende do ambiente:** NÃO — o caminho é determinístico com o modo `sessaoExpirada`.
- **Confiança:** alta.
- **Sintoma:** o teste demonstra apenas que o store do simulador fica com usuário sem cartão quando a sessão expira. Ele não chama `editarPessoaNasCatracas`. No serviço real, qualquer exceção durante editar usuário, remover/criar cartões ou foto cai no `catch` que retorna `{ sucesso: true, aviso: 'Update parcial' }`; o agregador então não encontra falhas e registra sucesso em todas as catracas.
- **Evidência real sanitizada:** o próprio teste comenta que “a produção precisa tolerar” o estado parcial, mas não importa `controlIdService`. O código de produção contém literalmente o contrato “UPDATE aplicado parcialmente = sucesso”.
- **Impacto no dado:** a pessoa pode ter nome novo com credencial antiga, cartão removido sem substituto ou divergência entre catracas, enquanto API/logs informam sucesso.
- **Como reproduzir:** `rg -n --glob 'test/**' 'editarPessoaNasCatracas|processarEdicaoDispositivo'` retorna zero. Em Node 24, chamar o serviço contra o simulador e expirar a sessão entre `modify_objects` e operações de cartão; observar `sucesso: true` com store parcial.
- **Correção sugerida apenas como direção:** testar o serviço completo; representar etapa e falha explicitamente, retornar falha, persistir reconciliação e/ou compensar para restaurar o estado anterior. Não transformar exceção genérica em sucesso.
- **Regra violada:** falha parcial nunca é sucesso; multi-passo precisa preservar atomicidade.

### G-005 — A suíte intitulada “prova de idempotência” prova apenas a não idempotência do fake

- **Arquivo:linhas:** `test/modos-de-falha-controlid.test.js:115-162`; `src/services/controlIdService.js:49-120`.
- **Severidade:** SEV2.
- **Categoria:** título permissivo / comportamento sob teste substituído por chamada direta ao simulador.
- **Depende do ambiente:** NÃO — `perdeRespostaAposProcessar` reproduz deterministicamente a janela.
- **Confiança:** alta.
- **Sintoma:** os três testes fazem `POST create_objects/destroy_objects` diretamente. Eles confirmam que repetir `create` falha com “já existe”, mas não verificam que a camada SAGE reconcilia isso. O caminho real cria usuário, RFID, QR e grupo em passos separados; se a resposta do primeiro passo se perde, o usuário fica criado, o serviço informa falha e a nova tentativa volta a falhar antes de criar as dependências.
- **Evidência real sanitizada:** não há referência a `criarNovaPessoaNasCatracas` em `test/**`. A produção não consulta o estado após erro ambíguo, não faz upsert e não compensa o usuário já criado.
- **Impacto no dado:** pessoa parcialmente provisionada e potencialmente impedida de passar; reexecuções não convergem e podem exigir intervenção manual por dispositivo.
- **Como reproduzir:** em Node 24, chamar `criarNovaPessoaNasCatracas` contra simulador com `perdeRespostaAposProcessar` aplicado ao primeiro `create_objects`; repetir a operação e verificar que `cards`/`user_groups` continuam ausentes. Estático: `rg -n --glob 'test/**' 'criarNovaPessoaNasCatracas'` retorna zero.
- **Correção sugerida apenas como direção:** transformar o teste de caracterização em teste do serviço; após erro ambíguo, reler por ID/registration e completar as dependências faltantes de forma convergente, com ledger de etapas ou compensação segura.
- **Regra violada:** escrita na catraca deve ser idempotente; multi-passo precisa preservar atomicidade.

### G-006 — Doze testes de integração podem ficar vacuamente verdes sem MySQL

- **Arquivo:linhas:** `test/backup-banco.test.js:99-147`; `test/diagnostico.test.js:33-133`; `test/fuso-horario.test.js:37-71`; `test/regressao-metodo-auth.test.js:62-108`; `test/recuperacao-apos-queda.test.js:168-226`; orientação contraditória em `test/helpers/banco.js:14-15`.
- **Severidade:** SEV3.
- **Categoria:** teste vacuamente verde / skip semântico ausente.
- **Depende do ambiente:** SIM — ocorre quando MySQL não está acessível.
- **Confiança:** alta.
- **Sintoma:** 12 casos executam `return` antes das asserções quando `temBanco` é falso. O runner os contabiliza como aprovados, não skipped. Isso atinge restauração real de backup, detecção de truncamento, limpeza de banco temporário, sanitização do diagnóstico, desvio de fuso, regressão QR Code e recuperação/idempotência após `SIGKILL`.
- **Evidência real sanitizada:** a coleta estrutural encontra exatamente 3 casos em backup, 4 em diagnóstico, 1 em fuso, 2 em método de autenticação e 2 em recuperação, totalizando 12. Em contraste, seis blocos condicionais usam `describe.skip` para 10 casos materializados, e outros 11 casos chamam `skip(!temBanco, 'MySQL indisponível')` corretamente.
- **Impacto no dado:** CI/operador pode aceitar regressões de perda, duplicação ou backup inválido acreditando que os controles críticos foram executados.
- **Como reproduzir:** executar a suíte em Node 24 sem MySQL e observar os casos como passed em vez de skipped; sem executar, `rg -n --glob 'test/**/*.test.js' 'if \(!temBanco\)'` lista os guardas.
- **Correção sugerida apenas como direção:** usar `skip(...)`/`describe.skip` de forma uniforme e fazer a pipeline obrigatória falhar se o job de integração coletar zero testes MySQL; separar job unitário de job de integração com pré-requisito explícito.
- **Regra violada:** teste não pode ser vacuamente verde; falha/ausência de infraestrutura não pode se apresentar como sucesso.

### G-007 — Integrações de produção usam defaults opostos ao comportamento de campo para Q3/Q4

- **Arquivo:linhas:** `test/fakes/controlid/index.js:12-26`; `test/ingestao-catraca-log-id.test.js:58-79`; `test/recuperacao-apos-queda.test.js:115-161`; `test/regressao-metodo-auth.test.js:34-55`; `test/fakes/controlid/README.md:91-120`; `docs/ANALISE_SYNC_CONTROL_ID.md:49-51`.
- **Severidade:** SEV3.
- **Categoria:** cobertura de variante de campo / configuração do simulador.
- **Depende do ambiente:** SIM — Q4 permanece não verificado no equipamento, mas o documento de campo tem precedência e registra retorno de todos os logs.
- **Confiança:** alta para a lacuna; média para o comportamento exato de cada firmware.
- **Sintoma:** `ignoraLimitEmAccessLogs` é `false` e `honorsWhereFilter` é `true` por padrão. Todas as integrações que chamam `sincronizarAcessos` criam o simulador sem alterar esses flags. Os modos adversos aparecem somente em testes do próprio fake, não nos consumidores de produção.
- **Evidência real sanitizada:** `ingestao`, `recuperacao-apos-queda` e `regressao-metodo-auth` usam o construtor default. O README exige que o código de sync funcione nos dois modos Q4, e a análise de campo registra que o equipamento devolve todos os logs.
- **Impacto no dado:** regressão que dependa indevidamente de paginação/filtro aceito pode passar; no campo pode haver reprocessamento maciço, timeout, atraso de monitoramento ou caminho de retomada não exercitado.
- **Como reproduzir:** repetir as integrações em Node 24 com matriz `ignoraLimitEmAccessLogs: true` × `honorsWhereFilter: false`; hoje não há parametrização equivalente. Estático: cruzar os construtores listados por `rg -n 'createCatracaSimulator\(' test` com `QUIRKS_PADRAO`.
- **Correção sugerida apenas como direção:** parametrizar os testes dos consumidores em ambos os modos Q4 e no Q3 de campo; escolher default conservador para integrações ou exigir flags explícitos por cenário.
- **Regra violada:** testes de integração usam simulador; comportamento documentado de campo prevalece; quirks intencionais não podem ficar confinados ao autoteste do fake.

### G-008 — Fixtures versionadas contêm PII de aparência real e IPs internos literais

- **Arquivo:linhas:** `test/sanitizador.test.js:113-140`; `test/diagnostico.test.js:39-62`, `94-115`; `test/runtime-sem-dados-da-escola.test.js:4-24`; `test/simulador-controlid.test.js:237-248`; `test/saude-dispositivos.test.js:1-9`.
- **Severidade:** SEV3.
- **Categoria:** fixture/log de teste com dado sensível.
- **Depende do ambiente:** NÃO.
- **Confiança:** alta para a violação de aparência; não foi tentado confirmar identidade real.
- **Sintoma:** há um cadastro rotulado no título como “real”, com nome completo, identificadores escolares, data de nascimento, contato em domínio institucional e credenciais biométricas/cartão de formato plausível. O mesmo conjunto reaparece no diagnóstico. Também há literais RFC1918 em payloads e mensagens. O teste que procura dados conhecidos da escola carrega sua própria denylist com instituição, endereço, IPs e identificador conhecido, mas só varre `src`.
- **Evidência real sanitizada:** pessoa `[NOME COMPLETO REDIGIDO]`, e-mail `[USUÁRIO]@[DOMÍNIO INSTITUCIONAL]`, documentos/RA/RM `[REDIGIDOS]`, IPs `192.168.0.xxx`. Os valores não são reproduzidos neste relatório.
- **Impacto no dado:** exposição de dados pessoais — possivelmente de menor — e topologia interna no histórico Git, clones, artefatos de CI e ferramentas de análise; a própria fixture contraria o controle que pretende provar.
- **Como reproduzir:** `rg -n --glob 'test/**' '\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b'`; revisar as linhas indicadas sem copiar os valores.
- **Correção sugerida apenas como direção:** substituir por dados inequivocamente sintéticos e inválidos, domínios `example.invalid` e endereços de documentação (`192.0.2.0/24`), mantendo os formatos necessários; remover dados conhecidos também da denylist versionada e usar fingerprints/fixtures privadas controladas se indispensável.
- **Regra violada:** logs/fixtures não podem conter PII real ou de aparência real, credencial, token ou IP interno.

## Matriz de cobertura por risco/produção

Critério: referência executável ao símbolo de produção ou chamada HTTP que chega ao consumidor; comentário e autoteste do simulador não contam como cobertura do consumidor.

| Risco / produção | Cobertura encontrada | Qualidade / lacuna |
|---|---|---|
| `accessService.sincronizarAcessos` | `ingestao-catraca-log-id`, `regressao-metodo-auth`, `recuperacao-apos-queda` | Boa para identidade/concorrência/queda; parte pode ficar verde sem MySQL e nenhum caso usa Q3/Q4 adversos no consumidor. |
| `accessService.processarNotificacaoMonitorDao` | `ingestao-catraca-log-id`, `regressao-monitor-dao` | Cobre concorrência e payload inválido; depende de MySQL, com skip explícito. |
| `deviceService.obterLogsCatraca` | `sem-falhas-silenciosas`, um caso em `quirks-controlid` | Cobre vazio/offline/timeout; não cobre backup nem zeragem. |
| `protecaoLogs.avaliarPerdaDeLogs` | `protecao-logs` | Função pura bem coberta; ligação às rotas destrutivas não coberta. |
| `controlIdService.criarNovaPessoaNasCatracas` | nenhuma | Falta idempotência, perda de resposta, sessão no meio e convergência. |
| `controlIdService.editarPessoaNasCatracas` | nenhuma | Produção converte falha parcial em sucesso. |
| `controlIdService.deletarPessoaDasCatracas` | nenhuma | Sem prova de idempotência/cascata/falha entre dispositivos. |
| `deviceService.gerarBackupCompletoCatraca` | nenhuma | Sem falha parcial, atomicidade ou restauração. |
| `deviceService.gerarBackupLogsCatraca` | nenhuma | Incompatibilidade Q3 não exercitada. |
| `deviceService.zerarAccessLogsCatraca` | somente comentários/autoteste do formato `where` no fake | Nenhuma chamada de produção nos testes. |
| `deviceService.zerarTudoNaCatraca` | nenhuma | Sem ordem inversa, falha no meio, backup ou compensação. |
| Rotas `comecar-do-zero`, `zerar-tudo`, `zerar-por-tipo`, backup completo/logs | nenhuma | Maior lacuna destrutiva. |
| `catracaImportService.importarDaCatracaParaSage` | nenhuma | Ordem Area → Pessoa documentada, mas não provada. |
| Simulador — login/CRUD/paginação/ordem/push | `simulador-controlid` | Boa cobertura do fake básico. |
| Simulador — Q1–Q7 | `quirks-controlid` | Boa caracterização isolada; Q3/Q4 não chegam às integrações de produção. |
| Simulador — falhas injetáveis | `modos-de-falha-controlid` | Todos os modos básicos têm autoteste; não prova tolerância da camada SAGE. |
| Backup MySQL (`backupBanco`) | `backup-banco`, `backup-maintenance-credential` | Boa intenção (restore real), mas três casos ficam vacuamente verdes sem MySQL. |

## Propostas resumidas

1. Criar uma suíte de contrato destrutivo que atravesse controller → service → simulador e prove: backup íntegro antes da primeira mutação, falha fechada, ausência de deletes no SAGE após falha e ordem correta.
2. Levar `sessaoExpirada` e `perdeRespostaAposProcessar` até `controlIdService`, exigindo convergência e retorno de falha real.
3. Parametrizar consumidores com Q3 e ambos os modos Q4; incluir detecção de falta de progresso no backup.
4. Separar jobs unitário e MySQL; infraestrutura ausente deve aparecer como skipped/falha de job, nunca passed.
5. Higienizar fixtures e adicionar varredura do próprio `test/**` por PII, segredos e IPs internos usando apenas valores sintéticos seguros no corpus de validação.

## Limitações

- Nenhum teste, cobertura dinâmica, verificação de handles ou medição de timers foi executado por incompatibilidade deliberadamente respeitada do runtime (`v18.16.1` local versus `>=24 <25`).
- Contagens de casos são estáticas e reproduzíveis; plugins de coleta do Vitest podem alterar a apresentação, mas não a contagem de 49 arquivos casados pelo `include`.
- Não foi tentado validar se a PII aparente pertence a pessoa real; a regra de auditoria já proíbe fixture com aparência real.
- Q4 segue uma incerteza de firmware. O achado é a ausência da matriz de consumo, não a existência dos dois modos, que é intencional.
- Não houve conexão com catraca ou MySQL e nenhuma configuração/versão foi alterada.

## Comandos reproduzíveis usados

Executados em `C:\SAGE-WS\SAGE-API`, somente leitura:

```powershell
git branch --show-current
git status --short
node --version
rg --files test
Get-ChildItem test -Recurse -File
Get-Content vitest.config.js -Raw
Get-Content test\fakes\controlid\README.md -Raw
Get-Content docs\ANALISE_SYNC_CONTROL_ID.md -Raw
Get-Content docs\ORDEM_SYNC_CATRACA.md -Raw
rg -n --glob 'test/**/*.test.js' '^\s*(?:describe|suite)\s*\('
rg -n --glob 'test/**/*.test.js' '^\s*(?:it|test)\s*\('
rg -n --glob 'test/**/*.test.js' '^\s*(?:it|test)\.each\s*\('
rg -n --glob 'test/**' '\.(skip|todo|only)\b|\b(?:xit|xtest|xdescribe)\b'
rg -n --glob 'test/**/*.test.js' 'if \(!temBanco\)|skip\(!temBanco'
rg -n --glob 'test/**' 'gerarBackupCompletoCatraca|gerarBackupLogsCatraca|zerarTudoNaCatraca|comecarDoZero|criarNovaPessoaNasCatracas|editarPessoaNasCatracas'
rg -n --glob 'test/**' '\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b'
git worktree list --porcelain
```

## Estado dos worktrees

Antes da gravação deste relatório, `SAGE-API` e `SAGE` estavam limpos (`git status --short` sem saída), ambos na branch `wip/recuperacao-local-pre-auditoria`. A única escrita realizada pela FATIA G é este relatório autorizado.
