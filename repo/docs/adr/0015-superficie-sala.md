# ADR-0015 — Superfície duplicada de Sala

- **Status:** decisão documental proposta para revisão externa; não fecha a issue #93
- **Data:** 2026-08-26
- **Pacote:** #12 do SAGE-arquitetura
- **Origem:** [SAGE-API #93](https://github.com/Nexus-Evolution-Tech/SAGE-API/issues/93)
- **Commit-base da API:** `b181b704328349293267c4ff4158e2546e03272f`
- **Commit-base deste repositório:** `b25b5d0d8dc127cd23735aa222e30c22355c3ca6`

## 1. Origem, escopo e limitações

O inventário da #93 encontrou `roomController.js` e `salaController.js` servindo a
mesma tabela `Sala`, pelas superfícies `/sala` e `/salas`. A issue #12 pede a
classificação documental dessa duplicidade para revalidar o EPIC #87, sem alterar
comportamento.

Esta investigação compara as duas superfícies no snapshot da API em
`b181b70`, incluindo rota, controller, factory, projeção, banco, autenticação,
cache, auditoria, respostas e consumidores existentes. O checkout local do
SAGE-API foi consultado somente para leitura; o checkout do consumidor
`C:\SAGE-WS\SAGE` também foi consultado somente para leitura.

Este ADR não remove rota, consolida handler, altera payload, status, erro,
autorização ou alias executável. Não altera código, teste, workflow, spec
normativa ou histórico. Qualquer divergência que exija implementação permanece
como lacuna e exige recorte separado. A revisão externa continua necessária;
este documento não fecha automaticamente a #93.

## 2. Inventário factual

### 2.1 Montagem e cadeia

`loadRoutes.js` carrega todo arquivo que termina em `Routes.js` e monta cada
router em `/`. Portanto, no snapshot, as duas rotas são públicas no sentido de
serem endpoints HTTP da mesma API, mas cada operação recebe seu próprio
middleware `exige(...)`.

| Superfície | Route file | Controller | Factory/prefixo | Tabela |
|---|---|---|---|---|
| `/sala` | `src/routes/roomRoutes.js` | `src/controllers/roomController.js` | `genericRoutesFactory(roomController, 'sala')` | `Sala` |
| `/salas` | `src/routes/salaRoutes.js` | `src/controllers/salaController.js` | `genericRoutesFactory(salaController, 'salas')` | `Sala` |

As duas invocações usam os defaults do factory: cinco handlers habilitados,
`autenticarTodas: true`, papel `SECRETARIA` e nenhuma sobrescrita por operação.
Assim, cada superfície oferece `GET`, `POST`, `GET /:id`, `PATCH /:id` e
`DELETE /:id`.

Os controllers declaram arrays `campos` diferentes. Essa diferença não é
efetiva no snapshot: `genericControllerFactory` recebe o parâmetro, mas não o
usa; deriva leitura de `projecoes.colunasDeLeitura('Sala')` e deixa a escrita
para `generic-db-utils`/`projecoes`. A projeção efetiva é única para ambas.

### 2.2 Tabela e campos

O DDL de `Sala` declara `id`, `unidade_id`, `numero`, `nome`, `capacidade`,
`tipo`, `ativo`, `observacao`, `created_at` e `updated_at`. Há FK opcional para
`UnidadeEscolar`, `numero` é `NOT NULL` e único global, e `tipo` aceita
`SALA_AULA`, `LABORATORIO`, `AUDITORIO`, `BIBLIOTECA` e `OUTRO`.

A declaração efetiva de projeção é:

- **leitura/resposta:** `id`, `unidade_id`, `numero`, `nome`, `capacidade`,
  `tipo`, `ativo`, `observacao`, `created_at`, `updated_at`;
- **escrita:** `unidade_id`, `numero`, `nome`, `capacidade`, `tipo`, `ativo`,
  `observacao`;
- **segredo:** nenhum.

Na escrita, chave desconhecida produz HTTP 400 com código
`ESCRITA_CHAVE_NAO_DECLARADA`; chave conhecida mas não gravável é acumulada em
`ignorados`; corpo sem campo gravável produz HTTP 400 com
`ESCRITA_NENHUM_CAMPO_APLICAVEL`. `id`, `created_at` e `updated_at` são
conhecidos para leitura, mas não são graváveis. Essa regra é igual em `/sala` e
`/salas`.

### 2.3 Autenticação, autorização e escopo

Cada um dos dez caminhos CRUD chama `exige('SECRETARIA')`. O middleware exige
Bearer válido e usuário ativo; token ausente, inválido, expirado ou usuário
inativo resulta em 401. Um papel válido `SECRETARIA` ou `ADMINISTRADOR` passa;
papel insuficiente resulta em 403. Não há autorização por `unidade_id` nem
filtro de escopo no handler: a consulta é global à tabela `Sala`.

`unidade_id` é dado de negócio, não uma cerca de autorização. No consumidor,
`DadosEscolares` filtra salas por `unidade_id` no cliente; isso não restringe a
resposta da API. Como nenhuma rota de Sala é a exceção de troca de senha,
usuário autenticado com `precisa_trocar_senha` recebe 428; falha na consulta do
usuário durante autenticação recebe 503.

## 3. Matriz comparativa completa

As linhas abaixo descrevem o comportamento observado, não um contrato novo.
Como as duas superfícies usam a mesma cadeia efetiva, a comparação é pareada.

| Operação | Autorização/escopo | Payload/campos aceitos | Projeção/resposta | Status/erros | Efeitos colaterais e idempotência | Classificação |
|---|---|---|---|---|---|---|
| `GET /sala` vs `GET /salas` (listar) | `SECRETARIA`; ADMINISTRADOR também permitido; sem escopo por unidade | Query `page` e `limit`; defaults 1 e 50 | `200` `{data, page, limit, total, totalPages}`; dados passam por ajuste de fuso e projeção de `Sala` | Falha do handler: `500` `{error, traceId}`; auth: 401/403/428/503 | Cache key `Sala:list:page{page}:limit{limit}`, TTL MEDIUM (5 min); sem mutação de banco/auditoria; leitura idempotente | **Inexistente** entre superfícies |
| `GET /sala/:id` vs `GET /salas/:id` (listar por ID) | Igual: `SECRETARIA`/ADMINISTRADOR; sem escopo | Parâmetro `id`; sem body | `200` com o array retornado pelo `SELECT ... WHERE id = ?`, projetado; ausente permanece `[]` (não há 404 no handler) | Falha do handler: `500` `{error, traceId}`; auth: 401/403/428/503 | Cache key `Sala:id:{id}`, TTL LONG (15 min); sem mutação de banco/auditoria; leitura idempotente | **Inexistente** entre superfícies |
| `POST /sala` vs `POST /salas` (criar) | Igual: `SECRETARIA`/ADMINISTRADOR; sem escopo | Body JSON filtrado pela allowlist de escrita; `id`/timestamps ignorados, desconhecidas rejeitadas | `201` `{message: 'Sala criada com sucesso', data: <projeção Sala>, ignorados}` | 400 para os dois códigos de escrita; demais falhas `500` com `traceId`; auth: 401/403/428/503 | Invalida `Sala:*`; INSERT e auditoria `REGISTRO_CRIADO` na mesma transação; sem chave/idempotency key, repetição cria novo registro (sujeita ao DDL) | **Inexistente** entre superfícies |
| `PATCH /sala/:id` vs `PATCH /salas/:id` (editar) | Igual: `SECRETARIA`/ADMINISTRADOR; sem escopo | Body JSON com a mesma allowlist de escrita; `id`/timestamps ignorados, desconhecidas rejeitadas | `200` `{message: 'Sala atualizada com sucesso', ignorados}`; não retorna o registro projetado | 400 para os dois códigos de escrita; demais falhas `500` com `traceId`; auth: 401/403/428/503 | Invalida `Sala:*`; UPDATE e auditoria `REGISTRO_EDITADO` na mesma transação; estado pode convergir ao repetir, mas cada chamada audita e não há idempotency key | **Inexistente** entre superfícies |
| `DELETE /sala/:id` vs `DELETE /salas/:id` (deletar) | Igual: `SECRETARIA`/ADMINISTRADOR; sem escopo | Sem body relevante; parâmetro `id` | `200` `{message: 'Sala removida com sucesso'}`; não retorna registro | Falha do handler `500` com `traceId`; auth: 401/403/428/503; não há 404 por inexistência no handler | Invalida `Sala:*`; DELETE e auditoria `REGISTRO_DELETADO` na mesma transação; estado do recurso é idempotente, mas cada repetição gera auditoria | **Inexistente** entre superfícies |

Em todas as linhas, a transação de mutação exige `req.user.usuario_id` válido,
executa o CRUD, registra `entidade: 'Sala'` e só então faz commit. O cache é
invalidado após a mutação; falha do cache é registrada e não substitui a
operação de banco. Listar e obter não geram evento de auditoria.

### 3.1 Diferenças observadas fora da equivalência efetiva

| Diferença | Classificação | Impacto e recorte |
|---|---|---|
| Arrays `campos` distintos nos dois controllers | **Compatível**: parâmetro sem uso no factory | Não muda o contrato atual. Se forem mantidos, podem induzir leitura equivocada; revisão/limpeza de código deve ser recorte separado e não faz parte deste ADR. |
| Swagger documenta `/sala`, mas não `/salas` | **Pendente** | Consumidor de documentação pode não descobrir o alias e o owner; abrir recorte de sincronização documental. |
| Swagger declara lista como array, GET por ID como objeto, PATCH com corpo projetado, DELETE 204 e 404; handlers observados retornam envelope de lista, array por ID, PATCH sem data, DELETE 200 e não produzem 404 | **Pendente** | Há risco de integração e decisão de compatibilidade. Abrir recorte de contrato Swagger/respostas; este pacote não corrige a API nem a spec. |
| O quick create de `Aulas` envia `POST /salas` com apenas `{nome}`; o DDL de `Sala` exige `numero NOT NULL` | **Pendente** | O payload do consumidor pode ser rejeitado pelo banco. Abrir recorte separado de contrato frontend/API/schema; não corrigir aqui e não afirmar sucesso sem execução. |
| `Sala` também é declarado em `database/melhorias_sistema.sql` | **Pendente** | Duas fontes de DDL podem divergir do schema-base; abrir recorte de convergência de schema, sem escolher ou alterar uma fonte neste pacote. |
| Dois consumidores usam caminhos diferentes | **Compatível por alias** | A migração imediata quebraria consumidores existentes; qualquer mudança de caminho exige recorte de compatibilidade, inventário atualizado e validação externa. |

Não foi encontrada diferença factual entre as superfícies em autorização,
escopo, campos efetivos, projeção, respostas CRUD, status, erros, cache,
auditoria ou transação. As pendências acima são divergências de documentação,
manutenção ou compatibilidade ao redor do par, não uma justificativa para mudar
o comportamento neste pacote.

## 4. Consumidores e decisão de owner

Antes da decisão, foram verificados todos os usos de endpoints no checkout
`SAGE` observado em `2e18e95f6097dbae20c494f9a94164f63d4bfa97`:

- `DadosEscolares` lista em `/sala?limit=1000` e usa o mesmo endpoint para
  criar, editar e deletar; seu teste de contrato fixa `sala: '/sala'`.
- `Aulas` lista em `/salas`, cria rapidamente em `/salas` e deleta em
  `/salas/:id`; usa os campos `id`, `nome` e `numero` para seleção. O quick
  create observado envia apenas `{nome}`, embora `numero` seja `NOT NULL` no DDL;
  a compatibilidade desse caminho fica pendente e não foi executada neste pacote.
- Não foi encontrado consumidor de `/salas/:id` para leitura ou edição, nem
  outro consumidor literal de `/sala` fora de `DadosEscolares` e seu teste.

**Decisão documental:** `Sala` é o owner de domínio/persistência único, com a
projeção e o CRUD compartilhados. `/sala` é a superfície canônica, pois é a
superfície documentada no Swagger, coberta pelo teste HTTP de CRUD e usada pelo
`DadosEscolares` no CRUD completo. `/salas` permanece explicitamente como alias
de compatibilidade do fluxo de Aulas; seu uso existente não é removido apesar da
lacuna de payload registrada acima.

Essa decisão é de documentação e orientação de integração. O alias não é
implementado, removido, redirecionado nem alterado neste pacote; os dois
endpoints continuam com o comportamento observado até uma decisão e um recorte
de implementação próprios.

## 5. Impacto em releases e classificação da #93

- **R1:** a investigação classifica a duplicidade funcional: não há divergência
  efetiva entre os dois CRUDs, mas há duas portas e consumidores divididos. Isso
  permite revalidar o aspecto documental do recorte, sem declarar a R1 integral
  concluída nem corrigir as pendências de Swagger/compatibilidade.
- **EPIC #87:** a #93 fica **classificada documentalmente no escopo desta ADR**:
  owner único de `Sala`, `/sala` canônico e `/salas` alias explícito. O EPIC não
  é fechado por este documento; a confirmação externa deve revisar a escolha e
  os recortes pendentes.
- **Gate R2-01:** impacto **nenhum**. R2-01 continua não iniciado e bloqueado
  por padrão; esta ADR não fornece matriz de independência para liberar o gate,
  não toca assinatura, instalador ou workflow e não muda esse estado.

## 6. Referências

- [Issue #12 — pacote](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/issues/12)
- [SAGE-API #93 — origem](https://github.com/Nexus-Evolution-Tech/SAGE-API/issues/93)
- [roomRoutes.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/routes/roomRoutes.js#L1-L4), [salaRoutes.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/routes/salaRoutes.js#L1-L4), [inventário R1-03B1](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/docs/R1-03B1-inventario-rotas.md#L3-L23)
- [roomController.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/controllers/roomController.js#L1-L6), [salaController.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/controllers/salaController.js#L1-L6), [genericRoutesFactory.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/routes/genericRoutesFactory.js#L4-L34), [genericControllerFactory.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/controllers/genericControllerFactory.js#L38-L175)
- [projecoes.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/config/projecoes.js#L54-L57), [generic-db-utils.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/utils/generic-db-utils.js#L14-L84), [schema Sala](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/database/sage.sql#L186-L201), [DDL repetido](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/database/melhorias_sistema.sql#L65-L82)
- [autorizacao.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/middlewares/autorizacao.js#L59-L75), [autenticar.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/middlewares/autenticar.js#L5-L25), [loadRoutes.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/config/loadRoutes.js#L4-L20)
- [cache helpers/TTL](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/cache/helpers.js#L14-L103), [cacheKeys.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/cache/cacheKeys.js#L52-L66), [auditoriaService.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/services/auditoriaService.js#L95-L134), [responderErroInterno.js](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/utils/responderErroInterno.js#L9-L21)
- [Swagger observado](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/src/docs/swagger.yml#L49-L133)
- [DadosEscolares](https://github.com/Nexus-Evolution-Tech/SAGE/blob/2e18e95f6097dbae20c494f9a94164f63d4bfa97/src/components/pages/Dados/DadosEscolares.js#L7-L145), [teste de contrato](https://github.com/Nexus-Evolution-Tech/SAGE/blob/2e18e95f6097dbae20c494f9a94164f63d4bfa97/src/components/pages/Dados/DadosEscolares.contract.test.js#L7-L22), [Aulas — listagem](https://github.com/Nexus-Evolution-Tech/SAGE/blob/2e18e95f6097dbae20c494f9a94164f63d4bfa97/src/components/pages/Aulas/Aulas.js#L61-L69), [Aulas — exclusão](https://github.com/Nexus-Evolution-Tech/SAGE/blob/2e18e95f6097dbae20c494f9a94164f63d4bfa97/src/components/pages/Aulas/Aulas.js#L168-L187), [Aulas — quick create](https://github.com/Nexus-Evolution-Tech/SAGE/blob/2e18e95f6097dbae20c494f9a94164f63d4bfa97/src/components/pages/Aulas/Aulas.js#L411-L425)
- [Estado de R1, EPIC #87, #93 e R2-01](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/blob/b25b5d0d8dc127cd23735aa222e30c22355c3ca6/PLANO-POS-AUDITORIA.md#L67-L111), [classificação de rotas R1](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/blob/b25b5d0d8dc127cd23735aa222e30c22355c3ca6/specs/R1-usuarios-e-autorizacao.md#L161-L193)
