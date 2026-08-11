# Fatia B — sincronização com a catraca

## Cobertura

Análise estática dos fluxos SAGE→catraca, catraca→SAGE, outbox, jobs, backup e destruição em `SAGE-API/src/services`, `src/utils`, `src/controllers/deviceController.js`, `src/routes/deviceRoutes.js`, `src/jobs/scheduledJobs.js` e configuração HTTP. A revisão final foi a base; achados sólidos da primeira passagem foram relidos e incorporados apenas quando confirmados no código. Evidências omitem PII, segredo, token, endereço, valores de seed e `.env`.

## Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| SEV1 | 2 |
| SEV2 | 21 |
| SEV3 | 3 |
| SEV4 | 0 |
| **Total** | **26** |

### [B-01] `create_objects` não é idempotente e o fallback não prova identidade

- **Arquivo:** `SAGE-API/src/utils/controlId-utils.js:69-95`; `SAGE-API/src/services/controlIdService.js:62-83`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Retry ou reprocessamento usa `create_objects` novamente. A resposta cai para o ID local quando não traz `ids`, sem consultar se o usuário já existe nem confirmar o ID remoto.

**Evidência sanitizada real**
```js
await axios.post(`http://${link}/create_objects.fcgi?session=${session}`, userPayload);
userId = response.data.ids?.[0] ?? novaPessoa.id;
```

**Impacto no dado**
Uma pessoa pode ficar duplicada, parcialmente criada ou vinculada ao identificador errado; falha de uma pessoa é SEV2 pela régua estrita.

**Como reproduzir**
Em catraca de teste, repetir CREATE após timeout cuja entrega seja desconhecida.

**Correção sugerida**
Persistir mapa externo, consultar por chave estável antes/depois e tornar a operação convergente.

**Regra violada**
Escrita na catraca deve ser idempotente; ADR-0009.

### [B-02] Coalescência CREATE→DELETE presume que CREATE nunca foi entregue

- **Arquivo:** `SAGE-API/src/services/sync.js:36-58`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Ao receber DELETE com CREATE pendente, a fila remove o CREATE e não cria DELETE. “Pendente” não prova “nunca entregue”: o processo pode ter enviado CREATE e morrido antes de remover a linha.

**Evidência sanitizada real**
```js
if (mapCreate.has(dispositivoId)) {
  await db.execute(`DELETE FROM sync_pendente WHERE id = ?`, [createId]);
  continue; // DELETE não é inserido
}
```

**Impacto no dado**
Pessoa excluída no SAGE pode continuar autorizada na catraca indefinidamente.

**Como reproduzir**
Entregar CREATE no equipamento, interromper antes do ACK local e então registrar DELETE.

**Correção sugerida**
Modelar estados “não enviado/em voo/confirmado/incerto” e reconciliar o estado observado antes de eliminar a intenção.

**Regra violada**
Operação incerta exige idempotência/reconciliação; ADR-0009.

### [B-03] Registro da fila engole falhas e não compartilha transação com o cadastro

- **Arquivo:** `SAGE-API/src/services/sync.js:5-88`; `SAGE-API/src/services/peopleService.js:83-111`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Toda falha da outbox é capturada e não propagada; cadastro e pendência usam commits independentes.

**Evidência sanitizada real**
```js
await registrarSyncPendente(idPessoa, 'CREATE');
// sync.js
} catch (err) {
  logger.errorWithStack('Erro ao registrar sync pendente', err);
}
```

**Impacto no dado**
O SAGE confirma uma pessoa sem trabalho durável para a catraca, deixando autorização divergente.

**Como reproduzir**
Induzir falha no insert de `sync_pendente` após o cadastro local.

**Correção sugerida**
Gravar mutação e outbox numa transação e propagar qualquer falha de persistência.

**Regra violada**
Escrita multi-passo deve ser atômica; erro não pode ser engolido.

### [B-04] Edição parcial da pessoa é convertida explicitamente em sucesso

- **Arquivo:** `SAGE-API/src/services/controlIdService.js:128-185`; `SAGE-API/src/jobs/scheduledJobs.js:172-190`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Qualquer exceção depois de parte da edição retorna `sucesso: true`; o job conclui e exclui a pendência.

**Evidência sanitizada real**
```js
} catch (error) {
  return { dispositivo: dispositivo.nome, sucesso: true, aviso: 'Update parcial' };
}
// consumidor
await db.query('DELETE FROM sync_pendente WHERE id = ?', [registro.id]);
```

**Impacto no dado**
Nome, cartões, QR ou foto de uma pessoa podem divergir do SAGE sem novo retry.

**Como reproduzir**
Fazer `modify_objects` funcionar e falhar a troca de cartão/foto.

**Correção sugerida**
Retornar falha estruturada, preservar a pendência e reconciliar cada componente antes de concluir.

**Regra violada**
Falha parcial não é sucesso; ADR-0009.

### [B-05] Falha de `destroy_objects` retorna `false`, mas o chamador declara exclusão bem-sucedida

- **Arquivo:** `SAGE-API/src/utils/controlId-utils.js:138-156`; `SAGE-API/src/services/controlIdService.js:227-249`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
`deletarUsuario` captura a falha e retorna `false`; `processarDelecaoDispositivo` não examina o retorno e devolve sucesso.

**Evidência sanitizada real**
```js
const ok = false; // retorno possível de deletarUsuario
await controlId.deletarUsuario(catracaUserId, link, session, dispositivo, resultados);
return { dispositivo: dispositivo.nome, sucesso: true };
```

**Impacto no dado**
Uma pessoa removida localmente pode continuar com acesso físico, e a outbox é eliminada.

**Como reproduzir**
Induzir erro HTTP no DELETE remoto e observar o resultado do chamador.

**Correção sugerida**
Fazer falha propagar; confirmar ausência observada antes de remover a pendência.

**Regra violada**
Erro não pode ser engolido; autorização deve convergir.

### [B-06] Exclusão de cartão recebe argumento de tipo incorreto e acessa `null` fora do `try`

- **Arquivo:** `SAGE-API/src/services/controlIdService.js:150-164`; `SAGE-API/src/utils/controlId-utils.js:203-222`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
No ramo sem RFID, `resultados` é passado onde a função espera `tipo`. Se a busca não acha cartão, `cartao.id` é lido antes do `try`; já o erro de destruição dentro do `try` é silenciado.

**Evidência sanitizada real**
```js
await controlId.deletarCartao(catracaUserId, link, sessionAdm, dispositivo, resultados);
const cartao = await obterCartaoPorTipo(id, tipo, session, link);
where: { cards: { id: cartao.id } }
```

**Impacto no dado**
Atualização de uma pessoa pode falhar ou manter credencial anterior ativa enquanto o restante já mudou.

**Como reproduzir**
Editar pessoa sem RFID e fazer a busca retornar `null` ou o destroy falhar.

**Correção sugerida**
Usar contrato tipado, tratar ausência explicitamente e propagar falha de revogação.

**Regra violada**
Troca de vínculo deve evitar janela de acesso; erro não pode ser engolido.

### [B-07] Sincronizador legado usa API deslocada e catches vazios

- **Arquivo:** `SAGE-API/src/utils/sync_catracas.js:21-55`
- **Severidade:** SEV3
- **Categoria:** manutenibilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O caminho legado usa `global.db`, omite `qr_code` no UPDATE, passa objeto no lugar do ID do dispositivo e silencia toda exceção. Não foi identificado como job ativo principal.

**Evidência sanitizada real**
```js
await editarPessoaNasCatracas(
  pessoa.id, pessoa.nome, pessoa.cartao_rfid, { dispositivoId: dispositivo.id }
);
} catch (erro) {
}
```

**Impacto no dado**
Se reativado, falha ou desloca argumentos e pode apagar a pendência. Por ser legado/sem consumidor principal confirmado, é SEV3.

**Como reproduzir**
Chamar `verificarSyncPendentes` com fixture sintética e observar os argumentos e catches.

**Correção sugerida**
Remover o caminho morto ou substituí-lo por chamada única à implementação testada.

**Regra violada**
Erro não pode ser engolido; código morto perigoso deve ser removido.

### [B-08] Importador chama exports de outbox que não existem

- **Arquivo:** `SAGE-API/src/services/importService.js:6`; `SAGE-API/src/services/importService.js:258-269`; `SAGE-API/src/services/sync.js:91`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`importService` desestrutura exports nomeados, mas `sync.js` exporta somente a função default CommonJS.

**Evidência sanitizada real**
```js
const { registrarSyncPendente, registrarSyncPendentesEmLote } = require('./sync');
module.exports = registrarSyncPendente;
```

**Impacto no dado**
A chamada falha depois de pessoa local criada, deixando importação parcial e sem fila.

**Como reproduzir**
Avaliar os exports do módulo ou importar uma pessoa com dispositivos de sync.

**Correção sugerida**
Unificar o contrato exportado e cobri-lo com teste de importação transacional.

**Regra violada**
Falha parcial não é sucesso; escrita multi-passo deve ser atômica.

### [B-09] Sincronização manual recria pessoas invisíveis e sempre responde sucesso

- **Arquivo:** `SAGE-API/src/utils/sync_catracas.js:4-19`; `SAGE-API/src/controllers/peopleController.js:251-258`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O fluxo seleciona toda `Pessoa`, sem filtro de visibilidade/status, chama CREATE para cada uma e engole erros individuais e gerais. O controller então responde sucesso.

**Evidência sanitizada real**
```js
const [pessoas] = await db.query('SELECT * FROM Pessoa');
try { await criarNovaPessoaNasCatracas(pessoa); } catch (erroPessoa) {}
res.json({ message: "Sincronização concluída com sucesso" });
```

**Impacto no dado**
Pessoas desativadas podem voltar a ter acesso; falha de uma ou de todas fica invisível.

**Como reproduzir**
Manter pessoa invisível no banco e executar a rota manual com catraca de teste.

**Correção sugerida**
Derivar conjunto desejado por política ativa e devolver resumo falho verificável por dispositivo/pessoa.

**Regra violada**
ADR-0008; autorização pertence ao SAGE; erro não pode ser engolido.

### [B-10] Não existe reconciliação, mapa persistente de identidade ou sincronização de relógio

- **Arquivo:** `SAGE-API/src/jobs/scheduledJobs.js:94-198`; `SAGE-API/src/services/controlIdService.js:90-105`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O job lê apenas `sync_pendente`; identidade remota é calculada por offset. Não há ciclo que observe usuários/credenciais/regras e corrija diferenças, nem operação de ajuste/verificação do relógio da catraca.

**Evidência sanitizada real**
```js
SELECT * FROM sync_pendente ORDER BY data_tentativa ASC LIMIT ?
const catracaUserId = USER_ID_OFFSET + Number(novaPessoa.id);
```

**Impacto no dado**
Pendência perdida, alteração externa ou relógio divergente permanece indefinidamente, afetando acesso e horários de presença.

**Como reproduzir**
Alterar estado diretamente em catraca de teste sem criar outbox e executar todos os jobs; o estado não é reparado.

**Correção sugerida**
Implementar reconciliação por dispositivo, mapa persistente e monitoramento/ajuste seguro de relógio.

**Regra violada**
ADR-0009; política no SAGE e identidade observada na catraca (ADR-0008).

### [B-11] Toda pessoa sincronizada é colocada no grupo que libera todos

- **Arquivo:** `SAGE-API/src/utils/controlId-utils.js:224-240`; `SAGE-API/src/services/controlIdService.js:71-78`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
A criação sempre grava vínculo ao grupo fixo descrito no próprio código como liberador de todos, sem usar perfil, horário ou regra do SAGE.

**Evidência sanitizada real**
```js
values: [{
  user_id: id,
  group_id: 1 // grupo default - libera todo mundo
}]
```

**Impacto no dado**
Uma pessoa pode receber autorização física mais ampla do que a política local permite.

**Como reproduzir**
Criar pessoa com perfil restrito em equipamento de teste e inspecionar `user_groups`.

**Correção sugerida**
Derivar vínculos de uma política explícita, validar referências e reconciliar permissões observadas.

**Regra violada**
ADR-0008 — política pertence ao SAGE.

### [B-12] Rotas autenticadas conseguem esvaziar a catraca inteira sem backup obrigatório

- **Arquivo:** `SAGE-API/src/routes/deviceRoutes.js:21-24`; `SAGE-API/src/controllers/deviceController.js:502-531`; `SAGE-API/src/services/deviceService.js:315-358`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`zerar-tudo` e `comecar-do-zero` chamam uma rotina que percorre todos os tipos com predicados “todos”. Nenhum dos dois exige backup completo/restauração comprovada antes da destruição.

**Evidência sanitizada real**
```js
routerExtra.post('/dispositivos/:id/zerar-tudo', autenticar, dispositivosController.zerarTudo);
const result = await deviceService.zerarTudoNaCatraca(dispositivo);
return { [objectType]: { id: { '>=': 0 } } };
```

**Impacto no dado**
Pode deixar a catraca inteira vazia e impedir a entrada de todas as pessoas; é SEV1 pela régua estrita.

**Como reproduzir**
Somente em equipamento descartável: chamar a rota e observar remoção de todos os tipos.

**Correção sugerida**
Bloquear até existir autorização administrativa forte, confirmação fora de banda, backup restaurado-prova e reprovisionamento ensaiado.

**Regra violada**
Operação irreversível exige backup verificado; ADR-0006.

### [B-13] Backup completo aceita coleções vazias após erro e não tem restauração implementada

- **Arquivo:** `SAGE-API/src/services/deviceService.js:366-401`; `SAGE-API/src/controllers/deviceController.js:573-597`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Falha de qualquer coleção vira array vazio e o arquivo é retornado normalmente com um mapa de erros. Não há fluxo correspondente que restaure o JSON completo na ordem de dependências.

**Evidência sanitizada real**
```js
} catch (err) {
  result.dados[objectType] = [];
  result.erros[objectType] = err.message;
  summary[objectType] = 0;
}
fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
```

**Impacto no dado**
Operador pode considerar protegido um equipamento cujo backup omite usuários/regras; depois de destruição, o arquivo não oferece restauração comprovada.

**Como reproduzir**
Falhar `load_objects` de um tipo e gerar backup completo; o arquivo ainda é produzido.

**Correção sugerida**
Falhar o backup se qualquer tipo obrigatório falhar, paginar, validar por releitura e provar restauração em equipamento de teste.

**Regra violada**
Backup não verificado não é backup; falha parcial não é sucesso.

### [B-14] Limpeza por prefixo pode remover todos os usuários SAGE de todas as catracas

- **Arquivo:** `SAGE-API/src/routes/deviceRoutes.js:29-31`; `SAGE-API/src/utils/controlId-utils.js:308-355`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
`DELETE /dispositivos` dispara limpeza em todos os dispositivos habilitados. Ela seleciona IDs por prefixo textual fixo e executa um `destroy_objects` por usuário, sem confirmação, backup ou escopo de dispositivo.

**Evidência sanitizada real**
```js
routerExtra.delete('/dispositivos', autenticar, dispositivosController.limparUsuarios);
const idsParaDeletar = users.map((u) => u.id)
  .filter((id) => String(id).startsWith("11"));
```

**Impacto no dado**
Na convenção atual, o filtro pode abranger todos os usuários provisionados e deixar todas as catracas vazias — ninguém entra.

**Como reproduzir**
Somente em equipamentos descartáveis populados com IDs sintéticos do prefixo, chamar a rota.

**Correção sugerida**
Remover a rota genérica e exigir seleção explícita por identidade mapeada, escopo único, prévia, backup restaurado-prova e confirmação forte.

**Regra violada**
Operação irreversível exige backup verificado; ADR-0006 e ADR-0009.

### [B-15] Sessão da catraca é registrada integralmente em log

- **Arquivo:** `SAGE-API/src/services/deviceService.js:83-95`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Após login, o valor retornado em `response.data.session` é interpolado em mensagem de nível `info`.

**Evidência sanitizada real**
```js
const session = response.data?.session;
logger.info(`Sessão criada para o dispositivo: [TOKEN REMOVIDO]`);
```

**Impacto no dado**
Quem lê os logs pode reutilizar a sessão enquanto válida para consultar ou alterar objetos no equipamento.

**Como reproduzir**
Análise estática; não gerar nem copiar token real.

**Correção sugerida**
Nunca logar sessão; aplicar redaction estrutural a URL/query e campos de autenticação e rotacionar logs/segredos já expostos.

**Regra violada**
Nunca registrar segredo ou token.

### [B-16] Nome da pessoa e QR reutilizável são gravados em log

- **Arquivo:** `SAGE-API/src/services/controlIdService.js:95-119`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O fluxo de criação registra nome e QR completo em nível informativo, inclusive em mensagens de falha e sucesso.

**Evidência sanitizada real**
```js
logger.info(`Iniciando criação de [NOME REMOVIDO]\nQRCODE: [CREDENCIAL REMOVIDA]`);
logger.warn(`Falha ao criar [NOME REMOVIDO]`);
```

**Impacto no dado**
Logs passam a conter PII de pessoa possivelmente menor e uma credencial de acesso reutilizável.

**Como reproduzir**
Análise estática; não executar com cadastro real.

**Correção sugerida**
Usar identificadores técnicos não sensíveis e redaction obrigatória; QR nunca deve entrar em log.

**Regra violada**
Nunca registrar PII ou credencial.

### [B-17] Defaults divergentes de offset quebram a conversão de identidade

- **Arquivo:** `SAGE-API/src/services/controlIdService.js:11-12`; `SAGE-API/src/services/accessService.js:8`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Provisionamento e ingestão usam defaults numéricos diferentes para `CATRACA_USER_ID_OFFSET`. Os valores concretos foram omitidos da evidência.

**Evidência sanitizada real**
```js
// controlIdService.js
const USER_ID_OFFSET = parseInt(process.env.CATRACA_USER_ID_OFFSET || '[DEFAULT-A]');
// accessService.js
const USER_ID_OFFSET = parseInt(process.env.CATRACA_USER_ID_OFFSET || '[DEFAULT-B]');
```

**Impacto no dado**
Um usuário provisionado pode ser convertido para outra pessoa ou descartado na ingestão; o defeito pode aparecer somente além de certa faixa de IDs.

**Como reproduzir**
Sem variável configurada, aplicar ida e volta a IDs sintéticos crescentes e encontrar o primeiro em que não há bijeção.

**Correção sugerida**
Centralizar configuração validada e substituir inferência aritmética por mapa persistente equipamento↔pessoa.

**Regra violada**
ADR-0009 — mapeamento explícito e consistente.

### [B-18] Pilhas de timeout/retry se sobrepõem e parte das chamadas não tem timeout

- **Arquivo:** `SAGE-API/src/config/axios.js:5-75`; `SAGE-API/src/services/deviceService.js:24-30`; `SAGE-API/src/utils/controlId-utils.js:81-85`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O cliente configurado possui retry linear; `deviceService` adiciona outra camada de retry. Já `controlId-utils` usa `axios` cru em operações mutáveis, sem timeout explícito nem idempotência.

**Evidência sanitizada real**
```js
const instance = axios.create({ timeout: parseInt(process.env.CATRACA_TIMEOUT || '10000') });
return instance(config); // retry
await axios.post(`http://${link}/create_objects.fcgi?session=${session}`, userPayload);
```

**Impacto no dado**
Pode prolongar overload, sobrepor jobs e repetir mutações incertas. É SEV3 conforme a régua específica de retry/overload.

**Como reproduzir**
Simular 503/timeouts e contar duração e número de tentativas por caminho.

**Correção sugerida**
Usar um único cliente, orçamento total por operação, backoff com jitter e retry apenas de operações idempotentes ou reconciliáveis.

**Regra violada**
Retry deve ter backoff/teto e respeitar idempotência.

### [B-19] Foto opcional é buscada pelo ID remoto e qualquer falha é ignorada

- **Arquivo:** `SAGE-API/src/utils/controlId-utils.js:256-270`; `SAGE-API/src/services/controlIdService.js:166-169`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O conversor de arquivo local recebe o ID deslocado da catraca, não o ID local usado no nome do arquivo. O catch descarta falha de leitura ou upload.

**Evidência sanitizada real**
```js
const fotoBase64 = await converterImagemPorUserId(id); // id remoto
} catch (err) {
  // Ignora arquivo ausente ou falha no upload
}
```

**Impacto no dado**
Foto pode permanecer antiga ou ausente sem alerta. Como imagem é opcional e há outros métodos de acesso, é SEV3.

**Como reproduzir**
Editar pessoa com arquivo sintético nomeado pelo ID local e módulo facial habilitado.

**Correção sugerida**
Separar `pessoaId` de `catracaUserId`, registrar estado de capacidade e tornar falha observável sem invalidar métodos alternativos.

**Regra violada**
Erro não pode ser engolido; convergência deve ser observável.

### [B-20] `CATRACA_MIN_LOG_ID` global descarta logs válidos por dispositivo

- **Arquivo:** `SAGE-API/src/services/accessService.js:132-140`; `SAGE-API/src/services/accessService.js:256-278`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Um único piso de ID vindo do processo é aplicado a todas as catracas antes de resolver identidade ou persistir o evento. Equipamentos têm sequências próprias.

**Evidência sanitizada real**
```js
const MIN_ID = parseInt(process.env.CATRACA_MIN_LOG_ID || '0', 10);
const passam = logs.filter((l) => Number(l.id) > MIN_ID).length;
```

**Impacto no dado**
Se o piso for maior que o maior ID de um equipamento, todos os logs dele são ignorados; presença e ponto ficam incompletos enquanto a catraca continua girando.

**Como reproduzir**
Com logs sintéticos de dois dispositivos em faixas diferentes, definir piso válido para um e maior que todos os IDs do outro.

**Correção sugerida**
Remover o piso global e manter checkpoint por dispositivo, com migração/gap auditável e armazenamento bruto antes de filtros.

**Regra violada**
Nunca perder evento de presença; ADR-0007 e ADR-0009.

### [B-21] Cursor avança sobre logs descartados e impede recuperação posterior

- **Arquivo:** `SAGE-API/src/services/accessService.js:327-333`; `SAGE-API/src/services/accessService.js:405-422`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Log cuja pessoa não existe é ignorado, mas o cursor final usa o maior ID de todos os logs recebidos, não o maior evento persistido contiguamente.

**Evidência sanitizada real**
```js
if (!pessoa) { ignoradosPessoa++; continue; }
const logIds = logs.map((l) => inteiroPositivoSeguro(l?.id));
const maxLogId = Math.max(...logIds);
await db.query('UPDATE Dispositivo SET ultimo_log_id_sincronizado = ? WHERE id = ?', [maxLogId, dispositivo.id]);
```

**Impacto no dado**
Quando a pessoa for cadastrada depois, o acesso antigo não será pedido novamente e ficará perdido para presença/folha.

**Como reproduzir**
Enviar logs sintéticos consecutivos, deixando a pessoa do primeiro inexistente; verificar que o cursor ultrapassa ambos.

**Correção sugerida**
Persistir evento bruto em quarantine ou parar no primeiro gap; só avançar checkpoint confirmado e reconciliável.

**Regra violada**
Nunca perder dado; ADR-0007 e ADR-0009.

### [B-22] `Acesso` e `Presenca` não são atômicos

- **Arquivo:** `SAGE-API/src/controllers/accessController.js:26-69`; `SAGE-API/src/services/accessService.js:343-392`; `SAGE-API/src/services/accessService.js:676-708`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O acesso é inserido/contabilizado antes de `verificarEAtribuirPresenca`. Se a presença falha, não há rollback; no Monitor, `processados` já foi incrementado.

**Evidência sanitizada real**
```js
const inserido = await inserirAcessoDaCatraca(/* ... */);
acessosSincronizados++;
await verificarEAtribuirPresenca(pessoa_id, data_hora);
```

**Impacto no dado**
Relatórios baseados em `Acesso` e `Presenca` divergem para a mesma passagem; retry pode não reparar por deduplicação do acesso.

**Como reproduzir**
Induzir falha na escrita de presença depois de inserir acesso sintético.

**Correção sugerida**
Usar transação comum ou presença como projeção idempotente com outbox e estado explícito de processamento.

**Regra violada**
Escrita multi-passo deve ser atômica; ADR-0007.

### [B-23] Há uma janela não protegida entre backup e destruição dos logs

- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:286-321`; `SAGE-API/src/services/deviceService.js:409-459`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O backup termina, só depois o estado “zerando” é marcado e ainda existe espera antes de `destroy_objects`. A catraca continua aceitando passagens; eventos criados após o último chunk do backup e antes do delete não entram no arquivo.

**Evidência sanitizada real**
```js
backupResult = await deviceService.gerarBackupLogsCatraca(dispositivo);
globalState.setZerandoDispositivo(id, true);
await new Promise((r) => setTimeout(r, delayAposBackupMs));
await deviceService.zerarAccessLogsCatraca(dispositivo);
```

**Impacto no dado**
A rota elimina a coleção inteira de logs e pode apagar definitivamente passagens ocorridas na janela; a restauração não as recupera. A catraca continua girando, portanto a consequência é perda silenciosa de dado (SEV2), não indisponibilidade total.

**Como reproduzir**
Em catraca de teste, produzir um log depois do backup concluir e antes do destroy; comparar backup e estado após limpeza.

**Correção sugerida**
Bloquear ingest/destruição por protocolo no equipamento, capturar delta final verificável e só destruir após confirmar persistência/restauração de todos os IDs.

**Regra violada**
Operação irreversível exige backup restaurado-prova; ADR-0007.

### [B-24] Importação catraca→SAGE perde a identidade externa e deduplica por nome

- **Arquivo:** `SAGE-API/src/services/catracaImportService.js:76-102`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O importador ignora `u.id`, procura pessoa por `(unidade_id, nome)`, deriva QR de `registration` e insere `Pessoa` sem mapa equipamento↔pessoa nem linha de subtipo.

**Evidência sanitizada real**
```js
SELECT id FROM Pessoa WHERE unidade_id = ? AND nome = ? LIMIT 1
INSERT INTO Pessoa (nome, unidade_id, qr_code, tipo, visivel) VALUES (?, ?, ?, ?, 1)
```

**Impacto no dado**
Homônimos podem ser fundidos/omitidos; acessos futuros não conseguem resolver a identidade original; pessoa marcada ALUNO pode não ter `Aluno`.

**Como reproduzir**
Importar dois usuários sintéticos homônimos com IDs remotos distintos.

**Correção sugerida**
Importar para staging, persistir chave externa por dispositivo e exigir classificação/subtipo transacional antes de publicar.

**Regra violada**
Nunca inventar identidade; ADR-0008 e ADR-0009.

### [B-25] Importação catraca→SAGE retorna conclusão após leituras e inserts parciais

- **Arquivo:** `SAGE-API/src/services/catracaImportService.js:38-52`; `SAGE-API/src/services/catracaImportService.js:54-108`; `SAGE-API/src/controllers/deviceController.js:473-495`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Falhas ao carregar coleções ou inserir itens são acumuladas em `result.erros`; o serviço continua e resolve. O controller sempre diz que a importação foi concluída.

**Evidência sanitizada real**
```js
} catch (e) {
  result.erros.push(`users: ${e.message}`);
}
return result;
// controller
message: 'Importação da catraca para o SAGE concluída'
```

**Impacto no dado**
Restauração/importação pode criar apenas parte das áreas/pessoas e ser tratada operacionalmente como sucesso.

**Como reproduzir**
Falhar `load_objects` de usuários ou um insert intermediário em ambiente sintético.

**Correção sugerida**
Falhar ao perder fonte obrigatória, usar staging/transação e publicar somente depois de validar completude e identidade.

**Regra violada**
Falha parcial não é sucesso; escrita multi-passo deve ser atômica.

### [B-26] Jobs de sync podem concorrer entre si e com outras operações

- **Arquivo:** `SAGE-API/src/jobs/scheduledJobs.js:16-52`; `SAGE-API/src/jobs/scheduledJobs.js:94-198`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Callbacks de cron/intervalo são `async`, mas não há mutex, flag de execução ou claim atômico. O polling pode disparar novamente com execução anterior ativa; duas instâncias também selecionam as mesmas pendências antes de excluí-las.

**Evidência sanitizada real**
```js
return setInterval(async () => {
  await accessService.sincronizarTodosAcessosMonitor();
}, MONITOR_POLLING_INTERVAL_MS);
const [pendentesResult] = await db.query(
  'SELECT * FROM sync_pendente ORDER BY data_tentativa ASC LIMIT ?'
);
```

**Impacto no dado**
Operações duplicadas e cursores concorrentes podem produzir falso sucesso, remoção indevida de outbox ou divergência por dispositivo.

**Como reproduzir**
Fazer uma execução durar além do intervalo e observar duas callbacks; ou iniciar duas instâncias contra a mesma fila sintética.

**Correção sugerida**
Adicionar lock/lease por job e dispositivo, claim transacional (`SKIP LOCKED` ou equivalente) e métricas de sobreposição.

**Regra violada**
Job não pode concorrer consigo mesmo; escrita deve ser idempotente. Este achado pode ser referenciado também pela fatia D, sem criar novo defeito.

## Duplicatas e consolidações

- B-08 é duplicata de A-03; A-03 é o ID primário porque a quebra se materializa na importação de dados.
- B-03 cruza A-02/A-07, mas mantém causa própria na persistência da outbox; A-07 aponta para B-10 como achado primário da ausência de reconciliação.
- B-12 consolida a capacidade de esvaziar a catraca; A-06 preserva separadamente a falta de transação e a destruição do banco local. B-23 é a janela específica do fluxo de logs e não duplica a ausência total de backup obrigatório de B-12.
- B-21 e B-20 produzem perda de logs por causas diferentes: o piso global descarta antes do processamento; o cursor atravessa eventos rejeitados depois da leitura.
- B-22 trata atomicidade `Acesso`→`Presenca`; A-04 trata sobrescrita de chegada e A-05 o modelo mutável. São causas independentes.
- B-24 e B-25 são distintos: perda de identidade mesmo em execução sem erro versus sucesso após execução parcial.
- B-26 pode aparecer na fatia D como problema de scheduler; deve permanecer um único achado, com B-26 como referência desta implementação de sync.

## Nada encontrado

- Não foi encontrado ciclo de importação efetivo entre `sync_catracas.js` e `controlIdService.js`; há comentário suspeitando do ciclo, mas o sentido inverso não existe no código relido.
- Não foi encontrada reconciliação periódica, mapa persistente de identidade externa, restauração do backup completo nem sincronização/verificação do relógio da catraca; as ausências estão consolidadas em B-10, B-13 e B-24.
- Não foi encontrado mecanismo que torne `create_objects` idempotente ou que diferencie entrega desconhecida de não entrega; isso está consolidado em B-01/B-02.
- Não foram usados valores reais de configuração, token, QR, nome, endereço, seed ou `.env` em qualquer evidência.
