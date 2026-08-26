# R1-04 — Matriz de `qr_code` e `cartao_rfid`

> Decisão documental do Arquiteto SAGE para a R1. Este documento não autoriza mudança de
> código, payload, rota, status, autorização, efeito ou auditoria já existentes.

## 1. Referências e escopo

Esta decisão responde à [issue #96 do SAGE-API](https://github.com/Nexus-Evolution-Tech/SAGE-API/issues/96),
cujo escopo é decidir se a emissão e o retorno de `qr_code` e `cartao_rfid` devem ser restritos
por papel. O desenho segue a [spec normativa R1-04 — Vazamento em resposta e em log](R1-04-vazamento-em-resposta-e-log.md),
especialmente §2.1 e §2.2; a barreira de papéis é a da [R1 — usuários e autorização](R1-usuarios-e-autorizacao.md).

A issue define o recorte da pergunta; a spec normativa define o desenho: `qr_code` e
`cartao_rfid` permanecem credenciais de emissão auditada em `Pessoa.leitura`, sob autorização
existente, sem serem tratados como `segredo` nesta release. A matriz abaixo torna essa decisão
verificável por operação, sem ampliar o contrato.

Evidências consultadas no repositório `SAGE-API`, em modo somente leitura, no commit
[`b181b70`](https://github.com/Nexus-Evolution-Tech/SAGE-API/commit/b181b704328349293267c4ff4158e2546e03272f):

- `src/config/projecoes.js:79-82`: `Pessoa.leitura` contém os dois campos; `segredo` contém
  `senha_acesso`.
- `src/routes/peopleRoutes.js:5-17`, `src/routes/genericRoutesFactory.js:7-24` e
  `src/middlewares/autorizacao.js:6-10`: as rotas de Pessoa usam `exige('SECRETARIA')`, e a
  hierarquia existente também permite `ADMINISTRADOR` nesse nível.
- `src/controllers/peopleController.js:246-264`: a geração de QR atualiza Pessoa e devolve o
  campo na resposta.
- [`7ce8d52`](https://github.com/Nexus-Evolution-Tech/SAGE-API/commit/7ce8d521b4b1af42aff6f80c1e6a600835ee8282)
  e `test/r1-03b2c-qr-auditoria.test.js`: a geração de QR tem operação auditada, autor obrigatório
  e cobertura de rollback quando a auditoria falha.
- [`440ae92`](https://github.com/Nexus-Evolution-Tech/SAGE-API/commit/440ae92f456d14f1c9947a516519166561bb1dbc2)
  e `test/r1-04b0-projecoes.test.js`: a declaração B0 mantém os campos na leitura de Pessoa.

Os caminhos acima são evidência do contrato existente, não uma autorização para alterá-lo.

## 2. Definição e risco

`qr_code` e `cartao_rfid` são credenciais reutilizáveis: o valor apresentado por quem o obtém
pode ser usado no fluxo de acesso da catraca. Portanto, exposição em resposta, log, telemetria,
diagnóstico ou detalhe de auditoria aumenta o risco operacional.

Na R1-04, eles não são `segredo` de projeção: ambos estão em `Pessoa.leitura` porque há fluxos
legítimos de leitura/retorno e emissão, enquanto `Pessoa.senha_acesso` é o segredo derivado do
DDL. Essa classificação reconhece o risco; não o elimina, não cria armazenamento seguro e não
transforma a resposta de negócio em log. Valores reais, credenciais, dados pessoais e logs não
fazem parte desta spec.

## 3. Matriz verificável

Em todas as células abaixo, “`exige('SECRETARIA')`” significa a autorização já instalada nas
rotas: o nível aceita `SECRETARIA` e também `ADMINISTRADOR` pela hierarquia existente. Não há
restrição global `ADMINISTRADOR`-only nesta decisão.

| Campo | Operação | Estado / decisão | Papel, fluxo e escopo | Autorização e pré-condição | Auditoria / log seguro | Recorte |
|---|---|---|---|---|---|---|
| `qr_code` | leitura/listagem | Permanece em `Pessoa.leitura`; não é removido nem promovido a `segredo`. | Leitura de negócio de Pessoa: `GET /pessoas`, `GET /pessoas/:id` e `GET /pessoas/tipo/:tipo`, conforme as rotas existentes. | `exige('SECRETARIA')` e as pré-condições já existentes do handler/registro. Nenhuma nova condição. | Não se cria evento de auditoria para leitura. O valor não entra em `TrilhaAuditoria.detalhe` nem em log; sanitização continua sendo a proteção de log/diagnóstico, não da resposta de negócio. | **Dentro:** preservar leitura autorizada e projeção vigente. |
| `cartao_rfid` | leitura/listagem | Permanece em `Pessoa.leitura`; não é removido nem promovido a `segredo`. | Os mesmos fluxos autorizados de leitura/listagem de Pessoa. | `exige('SECRETARIA')` e pré-condições já existentes. Nenhuma nova condição. | Não se cria evento de auditoria para leitura. O valor não entra em detalhe de auditoria nem em log seguro. | **Dentro:** preservar leitura autorizada e projeção vigente. |
| `qr_code` | emissão | Permanece a emissão explícita já existente em `POST /pessoas/gerar_qrcode/:id`; não se cria rota ou regra nova. | Fluxo de geração de QR de Pessoa, com retorno do valor gerado. | `exige('SECRETARIA')`, `id` da Pessoa e autor disponível no contexto da operação auditada, conforme o fluxo existente. | `executarOperacaoAuditada`, ação `REGISTRO_EDITADO`, entidade `Pessoa`, com detalhe nulo no fluxo atual. A cobertura existente verifica sucesso, rollback da alteração quando a auditoria falha e ausência de autor. O detalhe continua nulo; logs seguem a redação segura existente e não recebem o valor por esta decisão. | **Dentro:** manter emissão auditada, autorização, payload, efeitos e status atuais. |
| `cartao_rfid` | emissão | Não há emissor específico de RFID nem auditoria específica de emissão identificados nas evidências. Preserva-se a atribuição do campo nos fluxos existentes de Pessoa; não se inventa uma política de emissão. | Cadastro/edição de Pessoa que aceita `cartao_rfid` em `Pessoa.escrita`, alcançado por `POST /pessoas` e `PATCH /pessoas/:id`. | `exige('SECRETARIA')`, com `ADMINISTRADOR` também permitido pela hierarquia atual, e as pré-condições já existentes de escrita. Nenhuma elevação para ADMIN-only. | Não se cria evento ou trilha de emissão RFID nesta decisão. A trilha que já existir para uma operação permanece com o contrato atual; o valor não pode aparecer em detalhe ou log. | **Dentro:** preservar o campo e o fluxo autorizado. **Fora:** definir emissor ou nova trilha específica. |
| `qr_code` | retorno em resposta | Permanece no retorno dos fluxos autorizados que já o devolvem, incluindo a resposta da geração e a projeção de leitura de Pessoa. Payload inalterado. | Resposta de negócio dos handlers de Pessoa, sem criar variante por papel. | A mesma autorização do fluxo chamador: `exige('SECRETARIA')`; sem nova pré-condição. | Resposta segue a projeção `leitura`; o sanitizador não é aplicado para redigir resposta de negócio. O valor não vai para detalhe de auditoria, log ou diagnóstico. | **Dentro:** manter retorno autorizado e payload vigente. |
| `cartao_rfid` | retorno em resposta | Permanece no retorno dos fluxos autorizados cobertos por `Pessoa.leitura`. Payload inalterado. | Resposta de negócio de Pessoa que já projeta o campo; não se cria endpoint de retorno dedicado. | `exige('SECRETARIA')` e pré-condições existentes do fluxo. Sem ADMIN-only global. | Resposta segue `leitura`; não se copia o valor para trilha, log ou diagnóstico. | **Dentro:** manter retorno autorizado e payload vigente. |
| `qr_code` | regeneração | Não há política decidida. A existência da geração auditada não é interpretada como autorização para definir repetição, substituição, invalidação ou janela de uso. | Nenhum novo papel, fluxo ou endpoint. O fluxo atual não é reclassificado nesta célula. | Não se escolhe nova autorização ou pré-condição. Qualquer desenho exige novo ADR/issue antes de código. | Nenhum contrato de auditoria ou log novo é definido; o evento existente não é ampliado por inferência. | **Fora:** regeneração e suas regras. |
| `cartao_rfid` | regeneração | Não há política nem fluxo específico decidido para regenerar RFID. | Nenhum novo papel, fluxo ou endpoint. Não se deduz regeneração a partir de cadastro/edição. | Não se escolhe autorização ou pré-condição. Novo ADR/issue é obrigatório antes de código. | Nenhum contrato de auditoria ou log novo é definido; não se registra valor. | **Fora:** regeneração e suas regras. |
| `qr_code` | revogação | Não há política decidida de revogar, invalidar ou substituir o QR. Revogar uma Pessoa não é presumido como revogar sua credencial. | Nenhum papel ou fluxo de revogação é definido. | Autorização e pré-condição ficam em aberto; novo ADR/issue obrigatório antes de código. | Nenhuma trilha, log ou efeito físico é inventado para revogação. | **Fora:** revogação e suas regras. |
| `cartao_rfid` | revogação | Não há política decidida de revogar, invalidar ou substituir o RFID. | Nenhum papel ou fluxo de revogação é definido. | Autorização e pré-condição ficam em aberto; novo ADR/issue obrigatório antes de código. | Nenhuma trilha, log ou efeito físico é inventado para revogação. | **Fora:** revogação e suas regras. |

## 4. Decisão R1

1. O recorte decisório de #96 fica fechado documentalmente na R1 por esta matriz verificável; o
   estado da issue permanece sem alteração por este PR.
2. `qr_code` e `cartao_rfid` permanecem nos fluxos autorizados de leitura e retorno.
3. A emissão auditada de QR já existente permanece, inclusive sua autorização e seu retorno.
4. Não existe, nesta issue, restrição global `ADMINISTRADOR`-only. A autorização existente de
   nível `SECRETARIA` continua permitindo `SECRETARIA` e `ADMINISTRADOR`.
5. Nenhuma projeção, payload, rota, status, autorização, efeito ou auditoria do B0 é alterada.

## 5. Limites da decisão

- Regeneração e revogação ficam fora desta decisão. Não se deduz política por ausência de rota,
  por repetição da geração ou por exclusão/desativação de Pessoa.
- A matriz não altera `Pessoa.leitura`, `Pessoa.escrita`, `Pessoa.segredo` ou qualquer projeção,
  nem autoriza sanitizar resposta de negócio ou mudar payload.
- A matriz não é autorização para controle físico da catraca, sincronização remota, rotação de
  credencial ou política de armazenamento seguro.
- Qualquer mudança de papel, fluxo, emissão, retorno, regeneração, revogação ou auditoria exige
  novo ADR/issue antes de código.

## 6. Encerramento e rastreabilidade

O critério de encerramento de #96 é a presença desta matriz, com as duas credenciais e as cinco
operações cobertas, referências normativas e evidências reais apontadas. Este pacote altera apenas
este documento; o código permanece inalterado e a issue não é fechada automaticamente por este
PR.

Rastreabilidade: [API #96](https://github.com/Nexus-Evolution-Tech/SAGE-API/issues/96) → esta spec
→ R1-04 §2.1/§2.2 → projeções, rotas, operação auditada e testes citados na §1. Uma mudança futura
de desenho deve abrir ADR/issue próprio e não reutilizar esta matriz como autorização de implementação.
