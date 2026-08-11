# Inventário consolidado da auditoria SAGE

Snapshot auditado: backend `9e3eaba3475c` e frontend `06c1ed4e9482`, branch `wip/recuperacao-local-pre-auditoria`, incluindo as alterações locais preexistentes descritas em **Cobertura e confiança**. Este documento consolida e reclassifica os relatórios por fatia; os valores sensíveis encontrados no repositório não são reproduzidos.

## Sumário executivo

Foram consolidados **92 achados únicos**: **4 SEV1**, **65 SEV2** e **23 SEV3**. Os 119 achados brutos das seis fatias foram deduplicados por causa raiz. A maior concentração está na sincronização Control iD, no modelo de acesso/presença, nas superfícies HTTP operacionais e no instalador/atualizador Windows.

**O que impede instalar hoje:** o software não deve ser instalado em escola enquanto quatro caminhos puderem interromper a operação das catracas: reset destrutivo sem salvaguarda, remoção em massa por prefixo, instalação sem preflight/ledger e ativação/rollback não atômicos. Mesmo sem uma parada total, há riscos SEV2 silenciosos: relógio e offset divergentes, cursores que tornam logs irrecuperáveis, presença mutável, sincronização não idempotente, operações multi-etapas sem transação, superfícies públicas com dados operacionais e segredos/PII em logs ou arquivos versionados.

O sistema pode parecer saudável enquanto perde dados: vários caminhos respondem sucesso após falha parcial, avançam cursor sobre evento não persistido, aceitam backup incompleto como válido ou classificam erro de comunicação como estado operacional. Isso torna um piloto sem contenção e observabilidade particularmente arriscado.

Relatórios detalhados: [Fatia A](fatia-a-dados.md), [Fatia B](fatia-b-sincronizacao.md), [Fatia C](fatia-c-http-auth.md), [Fatia D](fatia-d-infra-operacao.md), [Fatia E](fatia-e-frontend.md), [Fatia F](fatia-f-config-build.md) e [inventário físico](INVENTARIO-ARQUIVOS.md).

## Tabela mestra

Os IDs entre parênteses apontam para a evidência completa nas fatias. A severidade abaixo é a reclassificação consolidada pela régua do handoff, não a simples soma das classificações dos auditores.

| ID | Título | Sev | Arquivo principal | Depende do ambiente | Confiança |
|---|---|---:|---|:---:|:---:|
| M-001 | Reset autenticado pode esvaziar catracas e base local sem restauração provada (A-06/B-12/C-14) | SEV1 | `SAGE-API/src/controllers/deviceController.js` | Não | alta |
| M-002 | Limpeza por prefixo pode remover todos os usuários SAGE das catracas (B-14) | SEV1 | `SAGE-API/src/services/controlIdService.js` | Parcial | alta |
| M-003 | Instalador altera estado e para serviços antes de preflight, sem ledger recuperável (D-09/F-05) | SEV1 | `SAGE-API/installer/windows/prepare-install.ps1` | Não | alta |
| M-004 | Ativação e rollback regravam serviços sem troca atômica de release (D-10/F-04) | SEV1 | `SAGE-API/installer/windows/complete-install.ps1` | Não | alta |
| M-005 | Identificadores SQL derivados de JSON entram no SQL sem escape/allowlist (A-01/C-08) | SEV2 | `SAGE-API/src/config/queryBuilder.js` | Não | alta |
| M-006 | Pessoa, subtipo e outbox são gravados sem uma transação comum (A-02/B-03) | SEV2 | `SAGE-API/src/services/peopleService.js` | Não | alta |
| M-007 | Importação confirma linhas parciais e chama exports de sincronização inexistentes (A-03/B-08) | SEV2 | `SAGE-API/src/services/importService.js` | Não | alta |
| M-008 | Saída posterior sobrescreve a chegada original do dia (A-04) | SEV2 | `SAGE-API/src/services/accessService.js` | Não | alta |
| M-009 | Acesso e presença são mutáveis/excluíveis, contrariando o histórico imutável (A-05/C-12) | SEV2 | `SAGE-API/src/controllers/presenceController.js` | Não | alta |
| M-010 | Outbox é melhor esforço e não existe reconciliação desejado × observado (A-07/B-10) | SEV2 | `SAGE-API/src/services/sync.js` | Parcial | alta |
| M-011 | DATETIME recebe UTC ingênuo enquanto o pool aplica UTC−03 (A-09) | SEV2 | `SAGE-API/src/config/database.js` | Não | alta |
| M-012 | Promoção parcial ainda marca o ano como concluído (A-10) | SEV2 | `SAGE-API/src/services/promocaoAlunosService.js` | Não | alta |
| M-013 | Substituição de horário apaga antes de validar e pode confirmar lista parcial/vazia (A-11/E-17) | SEV2 | `SAGE-API/src/controllers/horarioController.js` | Não | alta |
| M-014 | Relação responsável–aluno não possui integridade referencial (A-12) | SEV2 | `SAGE-API/database/sage.sql` | Não | alta |
| M-015 | Evento anual referencia variáveis fora do escopo da procedure (A-13) | SEV2 | `SAGE-API/database/sage.sql` | Não | alta |
| M-016 | Arquivos versionados contêm identidade operacional, PII e credenciais aparentes (A-14/E-27) | SEV2 | `SAGE-API/database/dados_etec_taboao.sql` | Sim | média |
| M-017 | `create_objects` não é idempotente e deixa estado parcial sem identidade provada (B-01) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Parcial | alta |
| M-018 | Coalescência CREATE→DELETE presume que CREATE incerto nunca foi entregue (B-02) | SEV2 | `SAGE-API/src/services/sync.js` | Parcial | alta |
| M-019 | Edição parcial na catraca é convertida explicitamente em sucesso (B-04) | SEV2 | `SAGE-API/src/services/sync.js` | Não | alta |
| M-020 | Falha de exclusão retorna `false`, mas o chamador declara sucesso (B-05) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Não | alta |
| M-021 | Exclusão de cartão recebe tipo incorreto e falha fora do bloco protegido (B-06) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Não | alta |
| M-022 | Sync manual recria pessoa invisível e responde sucesso apesar de falhas (B-09) | SEV2 | `SAGE-API/src/controllers/deviceController.js` | Parcial | alta |
| M-023 | Todas as pessoas são atribuídas ao grupo de liberação total (B-11) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Sim | alta |
| M-024 | Backup de catraca converte erro de leitura em coleção vazia e não prova restauração (B-13) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Parcial | alta |
| M-025 | Sessão, token, nome e QR reutilizável podem aparecer em logs (B-15/B-16/C-15/D-02) | SEV2 | `SAGE-API/src/config/logger.js` | Não | alta |
| M-026 | Defaults divergentes de offset quebram identidade entre escrita e leitura (B-17/F-01) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Sim | alta |
| M-027 | Corte mínimo de log é global e pode descartar eventos válidos de outro dispositivo (B-20) | SEV2 | `SAGE-API/src/services/accessService.js` | Sim | alta |
| M-028 | Cursor avança sobre log não persistido e impede sua recuperação (B-21) | SEV2 | `SAGE-API/src/services/accessService.js` | Não | alta |
| M-029 | `Acesso` é confirmado antes de `Presenca`; retry pula a reparação (B-22) | SEV2 | `SAGE-API/src/services/accessService.js` | Não | alta |
| M-030 | Há janela de perda entre backup e destruição dos logs da catraca (B-23) | SEV2 | `SAGE-API/src/services/controlIdService.js` | Parcial | alta |
| M-031 | Importação catraca→SAGE perde ID externo e deduplica pessoa por nome (B-24) | SEV2 | `SAGE-API/src/services/catracaImportService.js` | Sim | alta |
| M-032 | Importação catraca→SAGE retorna conclusão após leituras/inserts parciais (B-25) | SEV2 | `SAGE-API/src/services/catracaImportService.js` | Não | alta |
| M-033 | Jobs e ações manuais de sincronização podem executar sobrepostos (B-26/D-08) | SEV2 | `SAGE-API/src/jobs/scheduledJobs.js` | Parcial | alta |
| M-034 | Callback Monitor aceita origem por fail-open e cabeçalho encaminhado forjável (C-01/D-04) | SEV2 | `SAGE-API/src/middlewares/monitorCallbackAuth.js` | Parcial | alta |
| M-035 | Callback confirma HTTP 200/`ok` após falha de ingestão (C-02) | SEV2 | `SAGE-API/src/routes/notificationRoutes.js` | Não | alta |
| M-036 | Endpoint público de escolas expõe hash/login e dados de contato (C-03) | SEV2 | `SAGE-API/src/routes/schoolRoutes.js` | Não | alta |
| M-037 | Monitoramento/diagnóstico/WebSocket públicos expõem dados operacionais e permitem mutação (C-04/D-01) | SEV2 | `SAGE-API/src/app.js` | Parcial | alta |
| M-038 | Diagnóstico torna-se fail-open quando a chave não está configurada (C-05) | SEV2 | `SAGE-API/src/app.js` | Não | alta |
| M-039 | JWT autenticado não tem autorização por papel (C-06) | SEV2 | `SAGE-API/src/middlewares/autenticar.js` | Não | alta |
| M-040 | Consultas e mutações não têm escopo por unidade/tenant (C-07) | SEV2 | `SAGE-API/src/routes` | Sim | alta |
| M-041 | Upload grava arquivo antes da autenticação e sem limite/tipo robusto (C-09/D-16) | SEV2 | `SAGE-API/src/routes/peopleRoutes.js` | Não | alta |
| M-042 | Caminho persistido de foto permite remoção fora da área prevista (C-10) | SEV2 | `SAGE-API/src/services/peopleService.js` | Não | alta |
| M-043 | Fotos, planilhas e biometria ficam sob diretório estático público (C-11) | SEV2 | `SAGE-API/src/app.js` | Parcial | alta |
| M-044 | Login não tem rate limit, backoff ou bloqueio progressivo (C-16) | SEV2 | `SAGE-API/src/controllers/schoolController.js` | Não | alta |
| M-045 | Falha ao carregar rota é engolida e saúde pode não refletir API incompleta (C-18) | SEV2 | `SAGE-API/src/config/loadRoutes.js` | Não | alta |
| M-046 | Sanitizador não cobre JWT, documentos, cartão, QR, nomes e texto livre (D-03) | SEV2 | `SAGE-API/src/services/sanitizador.js` | Não | alta |
| M-047 | Backup parcial do banco é apresentado como recente/saudável (D-05) | SEV2 | `SAGE-API/src/services/backupBanco.js` | Não | alta |
| M-048 | Backups concorrentes podem colidir no mesmo nome de segundo (D-06) | SEV2 | `SAGE-API/src/services/backupBanco.js` | Parcial | alta |
| M-049 | Readiness pode ficar positiva após falha de inicialização de jobs (D-07) | SEV2 | `SAGE-API/src/app.js` | Não | alta |
| M-050 | Migração legada usa alteração/destruição incompatível com expand-only (D-11) | SEV2 | `SAGE-API/database/melhorias_sistema.sql` | Sim | alta |
| M-051 | Distribuição/serviço/porta MySQL contradizem o contrato arquitetural (D-12/F-02/F-03) | SEV2 | `SAGE-API/installer/windows/SAGE-MySQL.xml.template` | Sim | média |
| M-052 | Falha ao encerrar MySQL é ignorada e processo residual pode bloquear manutenção (D-13) | SEV2 | `SAGE-API/installer/windows/stop-mysql.ps1` | Sim | alta |
| M-053 | Ausência de `SAGE_DATA_DIR` põe estado mutável dentro da release (D-14) | SEV2 | `SAGE-API/src/config/paths.js` | Não | alta |
| M-054 | Transporte operacional usa HTTP puro, inclusive credenciais e PII (E-02) | SEV2 | `SAGE/src/services/api.js` | Sim | alta |
| M-055 | 403 é convertido em sessão expirada e apaga o contexto do erro de autorização (E-04) | SEV2 | `SAGE/src/services/api.js` | Não | alta |
| M-056 | Socket nasce anônimo e não acompanha login/logout (E-06) | SEV2 | `SAGE/src/contexts/WebSocketContext.js` | Não | alta |
| M-057 | “Liberar acesso” só altera a interface e declara sucesso sem comando real (E-09) | SEV2 | `SAGE/src/components/pages/Home/Home.js` | Não | alta |
| M-058 | Monitor fabrica área, dispositivo e sentido ausentes (E-10) | SEV2 | `SAGE/src/components/pages/Home/Home.js` | Não | alta |
| M-059 | Totais do painel são calculados sobre páginas truncadas (E-14) | SEV2 | `SAGE/src/components/pages/Inicio/Inicio.js` | Não | alta |
| M-060 | Falha da validação remota de horário vira permissão para salvar (E-15) | SEV2 | `SAGE/src/components/pages/Horarios/Horarios.js` | Não | alta |
| M-061 | Falha de detach aciona deleção total da aula (E-16) | SEV2 | `SAGE/src/components/pages/Aulas/Aulas.js` | Não | alta |
| M-062 | Cadastro de pessoa é multi-etapas e pode aparentar sucesso parcial (E-18) | SEV2 | `SAGE/src/components/pages/Formulario/Formulario.js` | Não | alta |
| M-063 | Abrir aluno para consulta sobrescreve o ano no formulário (E-19) | SEV2 | `SAGE/src/components/pages/Formulario/Formulario.js` | Não | alta |
| M-064 | Falha da API substitui dados por identidade operacional hardcoded aparente (E-20) | SEV2 | `SAGE/src/components/pages/Settings/Settings.js` | Sim | média |
| M-065 | Cadastro injeta nome de foto inexistente no dado persistido (E-21) | SEV2 | `SAGE/src/components/pages/Adicionar/Adicionar.js` | Não | alta |
| M-066 | Notificações potencialmente pessoais persistem entre sessões/usuários (E-22) | SEV2 | `SAGE/src/contexts/NotificationContext.js` | Não | alta |
| M-067 | Erros internos brutos chegam a respostas, console e interface (C-17/D-18/E-23) | SEV2 | `SAGE-API/src/app.js` | Não | alta |
| M-068 | Não existe canal de release assinado/verificado antes da atualização (F-06) | SEV2 | `SAGE-API/scripts/fetch-windows-artifacts.js` | Não | alta |
| M-069 | Frontend não possui CI próprio que bloqueie regressões (F-13) | SEV2 | `SAGE/package.json` | Não | alta |
| M-070 | Predicados/índices de relatórios anuais impedem uso eficiente dos índices (A-08) | SEV3 | `SAGE-API/src/controllers/relatorioController.js` | Parcial | alta |
| M-071 | Sincronizador legado sem chamador usa assinatura deslocada e catches vazios (B-07) | SEV3 | `SAGE-API/src/utils/sync_catracas.js` | Não | alta |
| M-072 | Timeouts e retries se empilham e algumas chamadas não têm timeout (B-18) | SEV3 | `SAGE-API/src/services/controlIdService.js` | Sim | alta |
| M-073 | Foto é procurada por ID remoto e a falha opcional é ocultada (B-19) | SEV3 | `SAGE-API/src/services/controlIdService.js` | Parcial | alta |
| M-074 | Rotas de matéria duplicadas dependem da ordem do filesystem (C-19) | SEV3 | `SAGE-API/src/config/loadRoutes.js` | Não | alta |
| M-075 | Monitoramento é montado duas vezes por aliases distintos (C-20) | SEV3 | `SAGE-API/src/app.js` | Não | alta |
| M-076 | Paginação e operações em hardware não têm teto consistente (C-21) | SEV3 | `SAGE-API/src/routes` | Parcial | alta |
| M-077 | Build e dependências não são inteiramente reproduzíveis (D-15/F-08/F-09) | SEV3 | `SAGE-API/package.json` | Não | alta |
| M-078 | Bundle de suporte e operação remota não cobrem o diagnóstico necessário (D-17) | SEV3 | `SAGE-API/scripts/diagnostico-acessos.js` | Sim | média |
| M-079 | Docker só encaminha `/backend`, enquanto fluxos usam URLs na raiz (E-01) | SEV3 | `SAGE/nginx.conf` | Sim | alta |
| M-080 | Token em `localStorage` fica acessível a qualquer script da origem (E-03) | SEV3 | `SAGE/src/services/api.js` | Não | alta |
| M-081 | Socket.IO usa namespace/path incompatíveis entre cliente e servidor (E-05) | SEV3 | `SAGE/src/contexts/WebSocketContext.js` | Não | alta |
| M-082 | Cliente emite `join`, mas servidor só aceita `subscribe:*` (E-07) | SEV3 | `SAGE/src/hooks/useWebSocket.js` | Não | alta |
| M-083 | Realtime abandona reconexão depois de cinco tentativas (E-08) | SEV3 | `SAGE/src/hooks/useWebSocket.js` | Não | alta |
| M-084 | Polling a cada 2 s dispara enriquecimento N+1 por acesso (E-11) | SEV3 | `SAGE/src/components/pages/Home/Home.js` | Sim | alta |
| M-085 | Falha de status é exibida como OFFLINE e o parser espera outro shape (E-12) | SEV3 | `SAGE/src/components/pages/Dispositivos/Dispositivos.js` | Não | alta |
| M-086 | Catches do frontend ocultam falhas de listagem/criação de dispositivo (E-13) | SEV3 | `SAGE/src/components/pages/Dispositivos/Dispositivos.js` | Não | alta |
| M-087 | Cadastro público é cenográfico e seus cartões navegam para login (E-24) | SEV3 | `SAGE/src/components/pages/Cadastro/Cadastro.js` | Não | alta |
| M-088 | Dependências de teste/servidor e módulos mortos entram no runtime frontend (E-26/F-12) | SEV3 | `SAGE/package.json` | Não | alta |
| M-089 | `postinstall` altera estado e silencia qualquer falha (F-07) | SEV3 | `SAGE-API/package.json` | Não | alta |
| M-090 | Contrato de ambiente é espalhado e não possui schema central (F-10) | SEV3 | `SAGE-API/src/config/env.js` | Não | alta |
| M-091 | SMTP é anunciado, mas não há consumidor de runtime (F-11) | SEV3 | `SAGE-API/.env.example` | Não | alta |
| M-092 | Janela de readiness pode exceder o limite definido no ADR (F-14) | SEV3 | `SAGE-API/src/services/readinessService.js` | Sim | média |

## Corrigível remotamente

É possível trabalhar remotamente, antes da visita, nos seguintes blocos:

1. **Contenção imediata:** desabilitar ou colocar confirmação forte, autorização específica, backup verificável e limite de impacto em M-001/M-002; tornar M-034/M-038 fail-closed; autenticar M-037/M-041/M-043; remover M-016 e rotacionar os segredos se forem reais.
2. **Integridade do banco:** eliminar identificadores SQL livres; criar transações para pessoa/importação/acesso-presença; tornar presença append-only; corrigir chegada, timezone, promoção, horários e constraints (M-005 a M-015, M-029).
3. **Sincronização:** tornar as operações idempotentes, corrigir contratos e retornos, não avançar cursor sem persistência, particionar cursor/corte por dispositivo e implementar reconciliação (M-017 a M-033).
4. **HTTP e privacidade:** autorização por papel/unidade, limites de requisição, sanitização e resposta de erro opaca; retirar PII/segredos de logs e de arquivos públicos/versionados (M-025, M-036 a M-046, M-067).
5. **Frontend:** alinhar autenticação e contrato Socket.IO, remover sucessos fictícios/fallbacks fabricados e tornar formulários resistentes a falha parcial (M-055 a M-066, M-079 a M-088).
6. **Entrega Windows:** preflight/ledger, layout imutável, ativação atômica, canal assinado, schema de ambiente e CI reproduzível (M-003/M-004/M-051 a M-053/M-068/M-069/M-077/M-089 a M-092).

As correções que dependem de respostas da escola podem ser implementadas atrás de configuração/feature flag, mas não devem ser ativadas com valores presumidos.

## Bloqueado no ambiente

| Tema | Achados | Pergunta exata a responder na escola |
|---|---|---|
| Identidade/offset | M-026, M-031 | Quais IDs locais e IDs Control iD correspondem à mesma pessoa em cada catraca, e qual offset foi usado historicamente? |
| Cursores e perda histórica | M-027, M-028, M-030 | Qual é o último log comprovadamente persistido por dispositivo e quais intervalos ainda existem na catraca ou em backup? |
| Semântica do firmware | M-017 a M-024, M-072/M-073 | A versão instalada suporta `create_or_update`, quais códigos retorna em entrega incerta e qual é o comportamento real de `destroy_objects`, Monitor e sessão? |
| Grupos e portas | M-002, M-023 | O grupo de ID padrão realmente significa liberação total e quais portais/grupos pertencem ao SAGE em cada equipamento? |
| Relógio | M-010/M-011/M-026 | Qual timezone/hora cada catraca, host Windows e MySQL reporta, e o firmware oferece API segura de ajuste? |
| Capacidade | M-076/M-084 | Quantos usuários/logs cada modelo suporta e qual latência/uso foi observado no hardware e na rede reais? |
| Segredos/PII versionados | M-016/M-064 | Os valores aparentes correspondem a escola, pessoa ou equipamento real e ainda estão ativos? Se sim, quem autoriza rotação e limpeza do histórico? |
| Rede e TLS | M-034/M-037/M-040/M-043/M-054 | Quais VLANs, proxy, firewall, DNS e certificados existem; há múltiplas unidades e acesso de suporte fora da LAN? |
| MySQL Windows | M-003/M-004/M-051/M-052/M-092 | Qual é o tempo real de boot/shutdown no HDD alvo, qual serviço/porta é oficial e qual política de executáveis/assinaturas a TI exige? |
| Tráfego Control iD | M-018/M-035 | É possível capturar uma sessão oficial sanitizada para confirmar retry, ACK e entrega incerta sem expor dados pessoais? |

## Candidatos a reescrita

Reescrita aqui significa substituir um limite coerente e testável, não “refazer o sistema”. As densidades usam achados consolidados cuja causa principal está no módulo.

| Limite candidato | LOC | Achados | Achados/100 LOC | Justificativa |
|---|---:|---:|---:|---|
| Núcleo de sync (`controlIdService`, `controlId-utils`, `sync`, `sync_catracas`) | 825 | 14 | 1,70 | Identidade, idempotência, retry, fila e retorno estão misturados; remendos mantêm estados impossíveis. |
| Realtime frontend (`WebSocketContext` + `useWebSocket`) | 247 | 4 | 1,62 | Namespace, autenticação, assinatura e reconexão discordam simultaneamente do servidor. |
| Monitoramento frontend | 368 | 4 | 1,09 | Ação fictícia, dados fabricados, polling N+1 e interpretação errada de falha compartilham estado. |
| Instalador/serviços Windows | 1.626 | 10 | 0,62 | Falta máquina de estados recuperável, contrato único de MySQL e ativação atômica. |
| CRUD genérico (`queryBuilder`, utilitários e controller) | 521 | 3 | 0,58 | SQL dinâmico sem tipagem/allowlist conflita com o ADR que exige Knex. |
| Modelo acesso/presença/relatórios | 1.897 | 8 | 0,42 | O defeito é de modelo: eventos mutáveis e derivação não atômica. Exige migração append-only, não só patch local. |

## Ordem de correção sugerida

1. **Criar proteção de mudança:** fixtures sanitizadas, testes de contrato HTTP/Control iD, testes de migração/restore e observabilidade por dispositivo. Todas as etapas seguintes dependem disso.
2. **Conter risco imediato:** bloquear M-001/M-002; fechar superfícies públicas; retirar/rotacionar segredos; redigir logs. Esta etapa não depende de redesenho.
3. **Fixar invariantes de dados:** timezone/offset canônicos e migração de legado; transações; presença append-only; cursores por dispositivo. A reconciliação depende desses IDs e eventos confiáveis.
4. **Reconstruir sincronização:** idempotência, estados de entrega, contratos de erro, reconciliação, limite de impacto e relógio. Só ativar em hardware após responder às perguntas de firmware/identidade.
5. **Alinhar HTTP e frontend:** RBAC/tenant, contratos de erro, Socket.IO autenticado e formulários sem fallback destrutivo. Depende dos contratos do backend estabilizados.
6. **Reconstruir entrega Windows:** schema de ambiente e MySQL único; preflight/ledger; backup/restore; releases imutáveis e ativação atômica. Depende dos testes de instalação/restore da etapa 1.
7. **Publicar por canal assinado e pilotar:** CI reproduzível, artefato assinado, rollout em uma catraca de laboratório, depois piloto escolar com telemetria sanitizada e rollback ensaiado.

## Cobertura e confiança

- **Backend:** 209 arquivos e 25.853 linhas físicas relevantes; 172 módulos JS, 334 arestas internas e 25 imports dinâmicos de rotas. Foram cobertos 100 arquivos `src`, 54 testes, 16 scripts, 17 SQLs, instalador Windows, workflows e configurações. Apenas `dataController.js` vazio e `validacao.js` ficaram inalcançáveis pelas raízes produtivas; ambos foram inventariados.
- **Frontend:** 123 arquivos e 18.268 linhas; 74 arquivos JS/JSX, 47 CSS, HTML/configuração. O grafo tem 0 ciclos. Há 30 arquivos inalcançáveis (incluindo 7 testes) e três imports quebrados, todos no ramo morto de cache/debug.
- **Superfície:** 158 pares método+caminho, 27 tabelas e seis jobs recorrentes, além da limpeza periódica de sessão e tarefas de startup.
- **Verificação:** o orquestrador releu no código as linhas dos 14 achados A, os contratos críticos B, as superfícies C e os pontos de instalação/infraestrutura de maior risco. A redação final também passou por checagem estrutural e busca de padrões sensíveis.
- **Execução:** a análise foi predominantemente estática. Node/npm/npx não estavam disponíveis no ambiente de auditoria, portanto a suíte Vitest, build e ensaios com hardware não foram executados. Não se afirma segurança dinâmica nem compatibilidade de firmware.
- **Worktree:** nenhum arquivo de código, `docs/`, ADR, PR ou issue foi alterado pela auditoria. Os relatórios consideram as modificações locais preexistentes: no backend, uma migration, seis arquivos do instalador, um script de auditoria e seis testes de onboarding/origem/Windows; no frontend, cinco arquivos/testes de notificação, dados escolares, recuperação e login. O `git status` final mantém somente esses caminhos preexistentes; `_arquitetura` permanece limpo.

### Calibração

Dos sete defeitos históricos reservados, cinco ainda existem no snapshot e foram redescobertos: offset divergente, argumentos deslocados na edição legada, falha parcial tratada como sucesso, catch vazio e tipo incorreto na exclusão de cartão. Dois não correspondem mais ao código atual: a fila não está integralmente desativada e a recursão por dependência circular não existe no caminho atual. Assim, o resultado é **5/5 defeitos atuais** e **5/7 históricos**. A primeira passada da fatia B encontrou só três dos cinco atuais; ela foi descartada como insuficiente e a fatia foi refeita por revisão independente de contratos.

Confiança é alta para defeitos determinísticos no código e média quando depende de valor real, firmware, topologia, timing, capacidade ou política da escola. A confiança global é **alta para existência dos defeitos estáticos** e **média para impacto/frequência no ambiente real**.

## Achados descartados

| Relato descartado | Motivo |
|---|---|
| Recursão atual entre `obterSessao` e verificação de pendências | O caminho recursivo não existe no snapshot auditado. |
| “Fila de sincronização totalmente desativada” | Produtores atuais chamam a fila; permanecem M-006/M-010/M-018/M-019, mas a formulação absoluta é falsa. |
| Mutação global de configuração de retry/backfill no frontend (E-25) | Não foi demonstrado efeito material adicional no caminho produtivo atual. |
| CORS permissivo como defeito independente | Sem origem/credenciais e cenário de exploração confirmados, duplicava superfícies de autenticação já registradas. |
| Ciclo de imports sugerido por comentário no código | O grafo estático atual tem zero componentes cíclicos. |
| Problemas cosméticos, estilo e `key` de React | Não alcançam a régua de risco material do handoff. |
| Contagem exata de vulnerabilidades de `npm audit` | A ferramenta não estava disponível para reprodução independente; problemas de dependência verificáveis ficaram em M-077/M-088. |
| Relatórios antigos de `_arquitetura/auditoria` como evidência atual | Referiam-se a outro snapshot e foram ignorados; todos os achados finais foram revalidados no código atual. |
