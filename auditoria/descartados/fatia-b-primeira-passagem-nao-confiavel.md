# Auditoria independente — FATIA B: sincronização com a catraca

## Resumo de cobertura

Auditoria estática, em leitura, da branch `wip/recuperacao-local-pre-auditoria`, cobrindo os fluxos SAGE→catraca (cadastro, alteração, remoção, fila pendente, operações administrativas e zeragem) e catraca→SAGE (polling completo, polling leve, Monitor push, importação e avanço do cursor). Foram lidos integralmente os ADRs 0005, 0006, 0008, 0009 e 0012 e todos os arquivos obrigatórios da fatia. Também foram rastreados os gatilhos de boot, cron, polling, health check e shutdown.

Foram encontrados **38 achados**: **8 SEV1**, **27 SEV2**, **3 SEV3** e **0 SEV4**.

Não foram executados testes: o host tem Node `18.16.1`, enquanto `package.json:6-7` exige Node `>=24 <25`. Em particular, não foi executado `npm test`, conforme a restrição da auditoria. As reproduções abaixo são, portanto, estáticas ou descrevem cenários controlados para ambiente compatível.

### [B-001] Logs expõem token de sessão e credencial QR
- **Arquivo:** `src/services/controlIdService.js:95-101`; `src/services/deviceService.js:85-95`; `src/config/axios.js:14-18`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O fluxo registra nome da pessoa e QR code, registra o token de sessão da catraca e ainda registra URLs que carregam esse token na query string.

**Evidência**
```js
logger.info(`Iniciando criação paralela de ${novaPessoa.nome} em ${dispositivos.length} catraca(s)\nQRCODE: ${novaPessoa.qr_code}`);
```
```js
logger.info(` Sessão criada para ${dispositivo.nome}: ${s}`);
```

**Impacto no dado**
Logs locais/telemetria passam a conter PII e credenciais reutilizáveis para acesso físico ou sessão administrativa da catraca.

**Como reproduzir**
Análise estática: criar/sincronizar uma pessoa e obter uma sessão; inspecionar a saída do logger.

**Correção sugerida**
Remover nome, QR e sessão de todas as mensagens; aplicar redator central também a URLs antes dos interceptores e testar que esses campos nunca chegam à saída.

**Regra violada**
Nunca reproduzir PII/segredo; ADR-0012 (redação de PII independente da telemetria).

### [B-002] Toda pessoa é vinculada ao grupo que “libera todo mundo”
- **Arquivo:** `src/utils/controlId-utils.js:224-233`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O provisionamento ignora tipo, idade e fluxo da pessoa e sempre cria o vínculo com `group_id: 1`, documentado no próprio código como grupo que libera todos.

**Evidência**
```js
const groupPayload = {
  object: "user_groups",
  values: [{
    user_id: id,
    group_id: 1 // grupo default - libera todo mundo
  }]
};
```

**Impacto no dado**
Alunos menores e outras identidades que exigem postura restritiva podem receber a mesma política autônoma e permissiva de funcionários, inclusive quando o SAGE estiver desligado.

**Como reproduzir**
Em equipamento de teste onde o grupo 1 seja permissivo, sincronizar um aluno e inspecionar `user_groups`.

**Correção sugerida**
Calcular a política mínima por fluxo/tipo no SAGE e vincular o grupo correto; falhar fechado quando a configuração necessária estiver ausente.

**Regra violada**
Decisão de segurança sem configuração falha fechada; ADR-0005; ADR-0008.

### [B-003] Criação é não idempotente e deixa estado parcial sem compensação
- **Arquivo:** `src/services/controlIdService.js:60-78`; `src/utils/controlId-utils.js:69-95`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Usuário, credenciais e grupo são escritos em passos independentes com `create_objects`. Se cartão ou grupo falhar após o usuário, não há rollback; a nova tentativa começa recriando o usuário já existente.

**Evidência**
```js
await controlId.criarUsuario(catracaUserId, novaPessoa, link, session, dispositivo, resultados);
if (novaPessoa.cartao_rfid && novaPessoa.cartao_rfid.length === 8) {
  const value = await gerarCardValue(novaPessoa.cartao_rfid);
  await controlId.criarCartao(catracaUserId, value, link, session, dispositivo, resultados);
}
await controlId.criarCartao(catracaUserId, qr_code, link, session, dispositivo, resultados);
await controlId.criarGrupo(catracaUserId, link, session, dispositivo, resultados);
```

**Impacto no dado**
A catraca pode ficar com usuário sem credencial/grupo ou com duplicatas; a fila pode entrar em falha permanente ao repetir o primeiro passo.

**Como reproduzir**
Em equipamento de teste, induzir falha no terceiro ou quarto POST e executar novamente o mesmo CREATE.

**Correção sugerida**
Usar `create_or_update_objects` com chaves estáveis, verificar estado observado após cada plano e implementar compensação/reconciliação para passos dependentes.

**Regra violada**
Escrita na catraca deve ser idempotente; escrita multi-passo deve ser atômica ou compensável; ADR-0009.

### [B-004] Edição parcial é convertida explicitamente em sucesso
- **Arquivo:** `src/services/controlIdService.js:174-184`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Qualquer exceção durante a edição — inclusive após remover uma credencial — é devolvida como `sucesso: true`.

**Evidência**
```js
} catch (error) {
  logger.warn(`Update parcial em ${dispositivo.nome}: ${error.message}`);
  return {
    dispositivo: dispositivo.nome,
    sucesso: true,
    aviso: 'Update parcial'
  };
}
```

**Impacto no dado**
O chamador remove a pendência e anuncia conclusão mesmo com nome, cartão, QR ou foto divergentes.

**Como reproduzir**
Induzir erro na criação do novo QR após uma alteração; observar retorno de sucesso e remoção da pendência pelo job.

**Correção sugerida**
Retornar falha, manter a pendência e registrar quais passos convergiram; confirmar o estado final por releitura.

**Regra violada**
Nunca retornar sucesso após falha parcial; escrita multi-passo deve ser atômica ou compensável.

### [B-005] Falha ao excluir usuário é ignorada pelo chamador
- **Arquivo:** `src/utils/controlId-utils.js:138-155`; `src/services/controlIdService.js:238-249`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`deletarUsuario` captura a falha e retorna `false`; `processarDelecaoDispositivo` não testa o retorno e declara sucesso.

**Evidência**
```js
} catch (err) {
  const detalhesErro = err.response?.data || err.message;
  resultados.push({ dispositivo: dispositivo.nome, sucesso: false, erro: detalhesErro });
  userSuccess = false;
}
return userSuccess;
```

**Impacto no dado**
Pessoa removida no SAGE pode continuar habilitada na catraca enquanto a pendência é apagada.

**Como reproduzir**
Fazer `destroy_objects` falhar em equipamento de teste e processar uma pendência DELETE.

**Correção sugerida**
Propagar a exceção ou testar obrigatoriamente `false`; só remover a pendência após releitura confirmar ausência.

**Regra violada**
Nunca engolir erro nem retornar sucesso após falha parcial; confirmação de convergência ausente.

### [B-006] Troca de credencial cria janela sem acesso e pode duplicar cartão
- **Arquivo:** `src/services/controlIdService.js:150-164`; `src/utils/controlId-utils.js:203-221`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
RFID e QR antigos são apagados antes da criação dos novos. A remoção de cartão engole erro; se nenhum cartão do tipo for encontrado, `cartao.id` é acessado antes do `try`.

**Evidência**
```js
await controlId.deletarCartao(catracaUserId, link, sessionAdm, dispositivo, 'QRCODE');
await controlId.criarCartao(catracaUserId, value, link, session, dispositivo, resultados);
```

**Impacto no dado**
Uma falha entre os passos deixa a pessoa sem acesso; uma falha de remoção ocultada seguida de criação pode deixar credenciais duplicadas válidas.

**Como reproduzir**
Induzir timeout no POST de criação após a exclusão, ou editar uma pessoa sem cartão do tipo procurado.

**Correção sugerida**
Criar/confirmar a nova credencial antes de remover a antiga e tornar a operação compensável e idempotente.

**Regra violada**
Trocar vínculo deve evitar janela sem acesso; escrita multi-passo deve ser atômica ou compensável.

### [B-007] Escritas principais ignoram cliente com timeout e retry
- **Arquivo:** `src/utils/controlId-utils.js:1-14`; `src/config/axios.js:5-11`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O módulo de escrita importa `axios` diretamente, enquanto timeout e retry estão apenas na instância de `src/config/axios.js`.

**Evidência**
```js
const axios = require('axios');

const obterSessaoAdmin = async (ip, usuario, senha) => {
  const res = await axios.post(`http://${ip}/login.fcgi`, {
```

**Impacto no dado**
Login administrativo e todas as operações de usuário/cartão/grupo podem aguardar indefinidamente e não recebem o backoff/teto configurado, bloqueando workers e favorecendo sobreposição de jobs.

**Como reproduzir**
Apontar para um destino que aceite conexão e não responda; a chamada usa o timeout padrão ilimitado do axios.

**Correção sugerida**
Usar uma única instância configurada; aplicar retry somente a operações idempotentes e timeout por classe de operação.

**Regra violada**
Timeout adequado e retry com backoff/teto; escrita na catraca deve ser idempotente.

### [B-008] Falha ao registrar pendência é engolida
- **Arquivo:** `src/services/sync.js:75-88`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Se a gravação em `sync_pendente` falhar, o serviço só registra log e resolve normalmente; criação/edição/remoção local segue respondendo sucesso.

**Evidência**
```js
} catch (err) {
  logger.errorWithStack('Erro ao registrar sync pendente', err);
}
```

**Impacto no dado**
Mudança aceita no SAGE pode nunca chegar à catraca e não existir qualquer item persistido para retry.

**Como reproduzir**
Induzir erro de banco durante o INSERT da pendência e executar criação ou edição de pessoa.

**Correção sugerida**
Propagar a falha e envolver mutação local + outbox em uma transação; não anunciar sincronização iniciada sem outbox persistida.

**Regra violada**
Nunca engolir erro; escrita multi-passo deve ser atômica ou compensável.

### [B-009] Job de pendências não reivindica linha, pode sobrepor e não tem backoff/teto
- **Arquivo:** `src/jobs/scheduledJobs.js:95-106`; `src/jobs/scheduledJobs.js:185-190`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O cron dispara a cada minuto sem mutex. Ele seleciona linhas sem lock/status de processamento e, em falha, apenas incrementa `retry_count`; o próximo ciclo seleciona imediatamente a mesma linha, sem usar contagem, `last_attempt`, backoff ou teto.

**Evidência**
```js
const cronExpression = process.env.SYNC_CHECK_INTERVAL || '*/1 * * * *';
return cron.schedule(cronExpression, async () => {
```
```js
await db.query(
  'UPDATE sync_pendente SET retry_count = retry_count + 1, last_attempt = ?, error_message = ? WHERE id = ?',
```

**Impacto no dado**
Duas execuções podem aplicar o mesmo CREATE simultaneamente; com os endpoints não idempotentes, isso produz duplicidade ou falha recorrente e sobrecarga contínua.

**Como reproduzir**
Fazer um processamento durar mais de um minuto e observar duas callbacks selecionarem a mesma pendência.

**Correção sugerida**
Reivindicar itens atomicamente (`FOR UPDATE SKIP LOCKED`/estado leased), impedir auto-overlap e calcular `next_attempt_at` com backoff, jitter e teto/estado terminal visível.

**Regra violada**
Retry ausente ou sem backoff/teto; escrita na catraca deve ser idempotente.

### [B-010] Reconciliação periódica e sincronização de relógio não existem
- **Arquivo:** `src/jobs/scheduledJobs.js:291-302`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Os jobs iniciados cobrem fila, health, access logs, polling, promoção e backup; não há job diário de reconciliação do estado desejado/observado, verificação horária de contagens nem sincronização/alerta de relógio. A busca por `create_or_update_objects` no código de produção não encontra chamada.

**Evidência**
```js
const jobs = {
  syncPendentes: verificarSyncPendentesJob(),
  healthCheck: healthCheckCatracasJob(),
  syncAcessos: sincronizarAcessosJob(),
  monitorPolling: pollingMonitoramentoJob(),
  promocaoAlunos: promocaoAlunosJob(),
  backupBanco: backupBancoJob()
};
```

**Impacto no dado**
Alterações manuais, perda de escrita ou objetos removidos no equipamento permanecem silenciosamente divergentes, podendo conservar ou retirar acesso físico indevidamente.

**Como reproduzir**
Análise estática; adicionalmente, alterar um usuário diretamente na catraca e observar que nenhuma rotina compara estado completo ou contagens.

**Correção sugerida**
Implementar reconciler diário fora do horário letivo, verificação leve horária, ownership SAGE, limite de remoção de 20%, plano detalhado, ordem de dependências e ajuste/alerta de relógio.

**Regra violada**
ADR-0009.

### [B-011] Polling pode concorrer com zeragem apesar da trava declarada
- **Arquivo:** `src/services/accessService.js:458-487`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O full sync consulta `isDeviceZerando`, mas o polling leve não. O comentário do controlador afirma que a marca bloqueia “sync/polling”, o que não corresponde ao código.

**Evidência**
```js
if (globalState.isDeviceZerando(dispositivo.id)) {
  resultados.push({ dispositivo: dispositivo.nome, acessosSincronizados: 0, ignorado: true, motivo: 'zerando logs' });
  continue;
}
```
```js
for (const dispositivo of dispositivos) {
  if (!isSyncEnabled(dispositivo?.sync_enabled)) {
    continue;
  }
  const resultado = await sincronizarAcessos(dispositivo, { monitorOnly: true });
```

**Impacto no dado**
Durante backup/zeragem, polling pode abrir sessão, ler/inserir em paralelo ou pressionar o equipamento, interferindo na operação irreversível e na consistência do cursor/banco.

**Como reproduzir**
Iniciar zeragem e aguardar o próximo intervalo de 20 segundos; o polling não consulta a marca.

**Correção sugerida**
Adotar lock por dispositivo compartilhado por polling, full sync, push administrativo e zeragem; aguardar operações em voo antes de destruir.

**Regra violada**
Escrita multi-passo deve ser atômica ou compensável; operação irreversível exige controle seguro.

### [B-012] Cursor avança sobre logs que não foram persistidos
- **Arquivo:** `src/services/accessService.js:312-323`; `src/services/accessService.js:405-418`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Logs inválidos ou de pessoa ainda inexistente são descartados antes do INSERT, mas no fim o cursor recebe o maior `id` de todos os logs brutos, não o maior confirmado no banco.

**Evidência**
```js
const logIds = logs.map((l) => inteiroPositivoSeguro(l?.id)).filter((id) => id != null);
if (logIds.length > 0) {
  const maxLogId = Math.max(...logIds);
  const currentMax = dispositivo.ultimo_log_id_sincronizado != null ? Number(dispositivo.ultimo_log_id_sincronizado) : 0;
  const newMax = Math.max(maxLogId, currentMax);
  await db.query(
    'UPDATE Dispositivo SET ultimo_log_id_sincronizado = ? WHERE id = ?',
    [newMax, dispositivo.id]
  );
}
```

**Impacto no dado**
Quando a pessoa for cadastrada/importada depois, o log anterior não será buscado novamente; presença e histórico ficam permanentemente incompletos.

**Como reproduzir**
Gerar no equipamento um log para `user_id` ainda ausente no SAGE, rodar full sync, cadastrar a pessoa e rodar novamente.

**Correção sugerida**
Manter quarantine/dead-letter persistente para logs não resolvidos e avançar o cursor somente até uma fronteira contínua confirmada, nunca sobre lacunas.

**Regra violada**
Nunca descartar dado cedo; nunca inventar convergência; ADR-0009.

### [B-013] Acesso e presença não são atômicos e a deduplicação impede reparo
- **Arquivo:** `src/services/accessService.js:343-355`; `src/services/accessService.js:392-397`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O acesso é inserido antes da atualização de presença. Se `verificarEAtribuirPresenca` falhar, a próxima sincronização detecta o acesso duplicado e executa `continue`, sem recalcular a presença.

**Evidência**
```js
const inserido = await inserirAcessoDaCatraca({
  pessoa_id,
  dispositivo_id,
  catraca_log_id: catracaLogId,
  status,
  permitido,
  metodo_auth,
  data_hora: data_hora_utc
});
if (!inserido) {
  ignoradosDuplicata++;
  continue;
}
```

**Impacto no dado**
O histórico mostra o acesso, mas frequência/atraso pode ficar ausente definitivamente.

**Como reproduzir**
Induzir falha de banco no cálculo de presença após o INSERT de Acesso e repetir a sync.

**Correção sugerida**
Usar transação local ou uma etapa idempotente de projeção reparável que rode também para acessos já existentes.

**Regra violada**
Escrita multi-passo deve ser atômica ou compensável.

### [B-014] Portal desconhecido é inventado como saída
- **Arquivo:** `src/services/accessService.js:39-47`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Qualquer `portal_id` diferente dos dois valores globais configurados vira `SAIDA` (salvo o número 1), mesmo sem mapeamento por dispositivo.

**Evidência**
```js
if (pid === SAIDA_PORTAL_ID) return 'SAIDA';
if (pid === ENTRADA_PORTAL_ID) return 'ENTRADA';
return pid === 1 ? 'ENTRADA' : 'SAIDA';
```

**Impacto no dado**
Em equipamentos com IDs/sentidos diferentes, entradas são registradas como saídas, corrompendo presença e decisões posteriores.

**Como reproduzir**
Enviar log de equipamento de teste com portal não igual aos valores globais.

**Correção sugerida**
Persistir mapeamento por dispositivo/portal lido do equipamento; para portal desconhecido, preservar o evento em estado não classificado e alertar.

**Regra violada**
Nunca inventar dado; payload/sentido deve ser transformado corretamente.

### [B-015] Método de autenticação é inferido apenas pelo comprimento
- **Arquivo:** `src/services/accessService.js:29-37`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O método é marcado `QR_CODE` se o valor string tiver oito caracteres; qualquer outro caso, inclusive valor vazio ou autenticação biométrica/senha, vira `CARTAO_RFID`.

**Evidência**
```js
function mapearMetodo(value) {
  return String(value).length === 8 ? 'QR_CODE' : 'CARTAO_RFID';
}
```

**Impacto no dado**
Auditoria e relatórios atribuem o acesso ao método errado; valores RFID de oito dígitos também podem ser classificados como QR.

**Como reproduzir**
Processar logs de teste com `card_value` vazio, RFID de oito dígitos e método biométrico.

**Correção sugerida**
Mapear o campo/evento explícito do equipamento; se não houver evidência suficiente, armazenar `DESCONHECIDO` em vez de inferir.

**Regra violada**
Nunca inventar dado; `metodo_auth` deve ser transformado corretamente.

### [B-016] Push descarta evento usando relógio local do servidor
- **Arquivo:** `src/services/accessService.js:598-640`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O Monitor rejeita evento com base em `Date.now()` e numa janela local de cinco minutos, em vez de tomar o relógio do equipamento como referência decisória.

**Evidência**
```js
const maxEventAgeSeconds = parseInt(process.env.MONITOR_MAX_EVENT_AGE_SECONDS || '300', 10);
const nowUnix = Math.floor(Date.now() / 1000);
if (maxEventAgeSeconds > 0 && (nowUnix - time > maxEventAgeSeconds || time > nowUnix + 60)) {
  result.ignorados++;
  continue;
}
```

**Impacto no dado**
Desvio de relógio ou atraso de entrega elimina o evento do caminho em tempo real e o aviso operacional; apenas um polling posterior pode recuperá-lo.

**Como reproduzir**
Ajustar o relógio do equipamento de teste em mais de 60 segundos à frente ou atrasar o POST por mais de cinco minutos.

**Correção sugerida**
Não descartar por relógio local; deduplicar por `(dispositivo, log_id)`, preservar o timestamp do equipamento e alertar sobre desvio.

**Regra violada**
Relógio decisório é o do equipamento; ADR-0009.

### [B-017] Monitor push ignora `sync_enabled`
- **Arquivo:** `src/services/accessService.js:569-596`; `src/controllers/deviceController.js:796-810`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O callback resolve o dispositivo selecionando apenas `id, nome` e processa os logs sem consultar `sync_enabled`. No quick-add, o dispositivo pode ser criado com sync desligada e mesmo assim o Monitor é configurado.

**Evidência**
```js
const [dispositivosRows] = await db.query(
  'SELECT id, nome FROM Dispositivo WHERE control_id_device_id = ? LIMIT 1',
  [deviceIdControlId]
);
dispositivo_id = dispositivosRows[0]?.id;
```

**Impacto no dado**
Desabilitar sincronização não interrompe a ingestão via push; o operador recebe um estado diferente do solicitado.

**Como reproduzir**
Desabilitar sync de um dispositivo com push configurado e enviar uma notificação DAO válida.

**Correção sugerida**
Resolver e validar `sync_enabled` antes de qualquer processamento, aplicando a mesma função `isSyncEnabled` dos outros caminhos.

**Regra violada**
Sincronização desabilitada deve ser respeitada.

### [B-018] Callback confirma HTTP 200 mesmo quando o processamento falha
- **Arquivo:** `src/routes/notificationRoutes.js:22-34`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Erros por item permanecem em `resultado.erros`, mas a resposta usa `ok: true`; uma exceção total também retorna HTTP 200 com `ok: false`.

**Evidência**
```js
res.status(200).json({ ok: true, ...resultado });
} catch (error) {
  logger.error(`[MONITOR DAO] Erro ao processar notificação: ${error.message}`);
  res.status(200).json({ ok: false, error: error.message });
}
```

**Impacto no dado**
O emissor pode considerar o lote entregue e não repetir eventos que o SAGE não persistiu.

**Como reproduzir**
Induzir falha de banco no callback e observar status HTTP 200.

**Correção sugerida**
Só confirmar sucesso quando todo o lote durável estiver persistido; usar status de falha retryable e/ou inbox durável antes do ACK.

**Regra violada**
Nunca retornar sucesso após falha parcial; nunca engolir erro.

### [B-019] Rotas de zeragem contornam backup e trava contra perda
- **Arquivo:** `src/controllers/deviceController.js:438-465`; `src/controllers/deviceController.js:502-531`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Além do fluxo protegido `zerarLogs`, existem `zerarPorTipo`, `zerarTudo` e `comecarDoZero` que chamam destruição diretamente. `zerarPorTipo(access_logs)` não gera backup nem executa `avaliarPerdaDeLogs`; as rotas totais também não fazem backup.

**Evidência**
```js
const result = await deviceService.zerarPorTipo(dispositivo, objectType);
if (!result.ok) return res.status(502).json({ message: result.message || 'Falha ao zerar' });
await db.query('UPDATE Dispositivo SET ultimo_log_id_sincronizado = NULL WHERE id = ?', [id]);
return res.json({ message: 'Logs da catraca zerados.', changes: result.changes });
```

**Impacto no dado**
Logs ainda não sincronizados e toda a configuração/identidade da catraca podem ser apagados irreversivelmente sem cópia verificável ou confirmação informada.

**Como reproduzir**
Chamar a rota de zeragem por tipo para `access_logs` ou a rota de zeragem total em equipamento de teste com dados.

**Correção sugerida**
Centralizar todas as destruições num único guard obrigatório, com backup verificado, confirmação proporcional, lock por dispositivo e checagem de dados não sincronizados.

**Regra violada**
Operação irreversível exige backup verificado por releitura; ADR-0009 (limite/ownership de remoção).

### [B-020] Backup de logs não é relido nem usa paginação estável antes da destruição
- **Arquivo:** `src/services/deviceService.js:424-453`; `src/controllers/deviceController.js:288-309`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O backup pagina por `offset` sem ordem explícita sobre um conjunto mutável e considera sucesso apenas quando o stream termina. Não relê/valida o JSONL, não compara contagem/fronteiras e o controlador segue imediatamente para `destroy_objects`.

**Evidência**
```js
const body = {
  object: 'access_logs',
  limit: CHUNK_SIZE,
  offset
};
```
```js
backupResult = await deviceService.gerarBackupLogsCatraca(dispositivo);
const zerarResult = await deviceService.zerarAccessLogsCatraca(dispositivo);
```

**Impacto no dado**
Um arquivo truncado, com páginas repetidas/puladas ou semanticamente inválido pode ser aceito como backup e a fonte destruída em seguida.

**Como reproduzir**
Alterar o conjunto de logs durante a paginação ou truncar/corromper o arquivo após o fechamento; não existe etapa que detecte a divergência antes da exclusão.

**Correção sugerida**
Paginar por chave (`id`) com ordem fixa e snapshot/fronteira; reler o arquivo, validar cada linha, IDs, contagem e checksum antes de permitir zeragem.

**Regra violada**
Operação irreversível exige backup verificado por releitura.

### [B-021] Zeragem total continua após falhas e deixa equipamento parcialmente apagado
- **Arquivo:** `src/services/deviceService.js:338-358`
- **Severidade:** SEV1
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Ao falhar a remoção de um tipo, o laço registra o erro e continua destruindo os tipos seguintes. Não há compensação nem restauração.

**Evidência**
```js
const res = await destroyObjectsOnCatraca(dispositivo, objectType, where);
summary[objectType] = res.ok ? (res.changes ?? 0) : 0;
if (!res.ok) erros.push(`${objectType}: ${res.message}`);
```

**Impacto no dado**
O grafo de regras/identidades pode terminar sem dependências essenciais, criando bloqueios indevidos ou liberações incorretas.

**Como reproduzir**
Induzir falha em um tipo intermediário e observar que o laço prossegue para os demais.

**Correção sugerida**
Exigir backup restaurável, validar plano antes de executar, parar na primeira falha e restaurar/compensar na ordem correta.

**Regra violada**
Nunca seguir como sucesso após falha parcial; escrita multi-passo deve ser atômica ou compensável.

### [B-022] Backup completo substitui falha por lista vazia e retorna sucesso
- **Arquivo:** `src/services/deviceService.js:383-401`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Falha ao ler qualquer tipo vira `[]`; o arquivo é gravado e a função retorna normalmente com contagem zero.

**Evidência**
```js
} catch (err) {
  logger.warn(`[BACKUP COMPLETO] ${dispositivo.nome}: ${objectType} falhou: ${err.message}`);
  result.dados[objectType] = [];
  result.erros = result.erros || {};
  result.erros[objectType] = err.message;
  summary[objectType] = 0;
}
```

**Impacto no dado**
Uma indisponibilidade é indistinguível de coleção realmente vazia para consumidores desatentos, e o arquivo parcial pode ser tratado como restauração válida.

**Como reproduzir**
Fazer um `load_objects` falhar durante backup completo e observar retorno resolvido/download do arquivo.

**Correção sugerida**
Falhar o backup inteiro, manter manifesto de completude e verificar por releitura/contagens antes de marcá-lo válido.

**Regra violada**
Nunca engolir erro; operação irreversível exige backup verificado por releitura.

### [B-023] API permite apagar `portals`, que deveriam ser somente leitura
- **Arquivo:** `src/controllers/deviceController.js:365-387`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`portals` aparece explicitamente na allowlist de exclusão e é enviado a `destroy_objects`.

**Evidência**
```js
const allowedForDelete = ['users', 'areas', 'groups', 'cards', 'qrcodes', 'access_rules', 'portals', 'time_zones', 'time_spans', 'scheduled_unlocks'];
```

**Impacto no dado**
O SAGE pode apagar representação do hardware físico e quebrar regras/direção vinculadas ao portal.

**Como reproduzir**
Em equipamento de teste, chamar a exclusão de objeto com `objectType=portals`.

**Correção sugerida**
Remover `portals` de toda operação de criação/exclusão e tratá-los exclusivamente como estado observado do equipamento.

**Regra violada**
Operação irreversível exige backup verificado; ADR-0008 (`portals` representam o hardware físico e pertencem ao estado observado do equipamento).

### [B-024] “Começar do zero” apaga o banco em passos sem transação
- **Arquivo:** `src/controllers/deviceController.js:530-559`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Após zerar a catraca, o controlador executa uma longa sequência de DELETEs/UPDATEs no SAGE sem transação ou compensação; um erro intermediário deixa apenas parte do domínio apagada.

**Evidência**
```js
await db.query('DELETE FROM Presenca');
await db.query('DELETE FROM SolicitacaoAcesso');
await db.query('DELETE FROM HorarioAula');
await db.query('DELETE FROM Aula');
await db.query('DELETE FROM Professor');
```

**Impacto no dado**
Pode restar banco referencialmente/institucionalmente incompleto após a catraca já ter sido destruída, sem caminho automático de retorno.

**Como reproduzir**
Induzir falha em um DELETE intermediário no ambiente de teste.

**Correção sugerida**
Bloquear a operação sem backup verificado de ambos os lados; executar mutações locais em transação e definir restauração/compensação da catraca.

**Regra violada**
Escrita multi-passo deve ser atômica ou compensável; operação irreversível exige backup verificado.

### [B-025] Sincronização manual de todas as pessoas engole todos os erros
- **Arquivo:** `src/utils/sync_catracas.js:4-18`; `src/controllers/peopleController.js:251-257`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O laço ignora cada erro individual e o catch externo também é vazio. O controlador sempre responde “concluída com sucesso”.

**Evidência**
```js
for (const pessoa of pessoas) {
  try {
    await criarNovaPessoaNasCatracas(pessoa);
  } catch (erroPessoa) {
    // Ignora erros de sincronização individual
  }
}
```

**Impacto no dado**
Uma sincronização pode falhar para todas as pessoas sem retorno, alerta ou pendência confiável, mantendo a catraca vazia/divergente.

**Como reproduzir**
Executar a rota com catraca indisponível; a função resolve e o endpoint responde sucesso.

**Correção sugerida**
Retornar resumo por pessoa/dispositivo, falhar quando houver qualquer erro e registrar outbox/reconciliação durável.

**Regra violada**
Nunca engolir erro nem retornar sucesso após falha parcial.

### [B-026] Rotação de QR fica apenas no SAGE e usa gerador sem unicidade
- **Arquivo:** `src/controllers/peopleController.js:234-245`; `src/utils/gerarNumero8Digitos.js:2-4`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O endpoint troca o QR local, mas o registro de UPDATE está comentado. O novo valor é criado com `Math.random()` sem verificação de colisão no banco/catraca.

**Evidência**
```js
const qrcode = gerarNumero8Digitos();
await db.query(query, [qrcode, id]);
// await registrarSyncPendente(id, 'UPDATE');
```

**Impacto no dado**
O QR mostrado pelo SAGE pode não abrir a catraca, o QR antigo pode continuar válido e dois usuários podem receber a mesma credencial.

**Como reproduzir**
Gerar novo QR para pessoa já sincronizada e inspecionar a fila/catraca; a fila não recebe UPDATE.

**Correção sugerida**
Gerar credencial criptograficamente forte, impor unicidade, persistir mutação + outbox atomicamente e só revogar a antiga após confirmar a nova.

**Regra violada**
Trocar vínculo deve evitar janela sem acesso; escrita multi-passo deve ser atômica ou compensável.

### [B-027] Upload facial usa ID deslocado como nome de arquivo e silencia falha
- **Arquivo:** `src/utils/controlId-utils.js:256-270`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O chamador fornece o ID da catraca (`offset + pessoa.id`) ao conversor de arquivo local, e qualquer erro de leitura/upload é ignorado.

**Evidência**
```js
const fotoBase64 = await converterImagemPorUserId(id); // AQUI EU TO PASSANDO O ID DA CATRACA, PRECISO CONVERTER PRO ID DO BANCO
```
```js
} catch (err) {
  // Ignora erros - arquivo não encontrado ou falha no upload
}
```

**Impacto no dado**
Fotos podem nunca chegar ao equipamento, enquanto a edição é anunciada como sucesso; autenticação facial pode negar acesso ou manter imagem anterior.

**Como reproduzir**
Editar pessoa com foto local nomeada pelo ID SAGE e módulo facial habilitado.

**Correção sugerida**
Passar separadamente `pessoaId` e `catracaUserId`, propagar falha e confirmar a imagem observada antes de concluir.

**Regra violada**
Nunca engolir erro; confirmação de convergência ausente.

### [B-028] Importação catraca→SAGE retorna conclusão após falhas de leitura
- **Arquivo:** `src/services/catracaImportService.js:38-52`; `src/services/catracaImportService.js:105-108`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Falhas ao carregar `areas` e `users` são acumuladas em `result.erros`, mas a função continua, registra resumo normal e resolve; o controlador responde que a importação foi concluída.

**Evidência**
```js
} catch (e) {
  result.erros.push(`areas: ${e.message}`);
}
try {
  const resUsers = await deviceService.loadObjectsFromCatraca(dispositivo, 'users', {});
  catracaUsers = resUsers.data || [];
} catch (e) {
  result.erros.push(`users: ${e.message}`);
}
```

**Impacto no dado**
Restauração/importação pode terminar vazia ou parcial e ser tratada operacionalmente como bem-sucedida.

**Como reproduzir**
Induzir falha em um dos `load_objects` e chamar a rota de importação.

**Correção sugerida**
Falhar a operação se qualquer fonte obrigatória não puder ser lida; usar transação/staging e só publicar após validar completude.

**Regra violada**
Nunca retornar sucesso após falha parcial; nunca engolir erro.

### [B-029] Importação deduplica por nome e não preserva identidade da catraca
- **Arquivo:** `src/services/catracaImportService.js:76-100`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Usuários são considerados iguais por `(unidade_id, nome)`, QR é derivado de `registration` e todo novo usuário recebe tipo padrão `ALUNO`; não é persistido mapeamento do `user.id` da catraca e não é criada a linha correspondente em `Aluno`.

**Evidência**
```js
const [[existe]] = await db.query(
  'SELECT id FROM Pessoa WHERE unidade_id = ? AND nome = ? LIMIT 1',
  [unidade_id, nome]
);
```

**Impacto no dado**
Homônimos são fundidos/omitidos; identidades e credenciais podem deixar de corresponder; uma Pessoa tipada como ALUNO pode ficar sem seu registro filho.

**Como reproduzir**
Importar dois usuários homônimos com IDs/credenciais diferentes ou um usuário não aluno.

**Correção sugerida**
Criar tabela de mapeamento estável equipamento↔Pessoa, importar credenciais das coleções corretas e exigir classificação explícita/staging antes de criar o subtipo em transação.

**Regra violada**
Nunca inventar dado; ADR-0008; ADR-0009 (mapeamento de identidades).

### [B-030] Criação de pessoa e outbox não é transacional
- **Arquivo:** `src/services/peopleService.js:83-110`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Pessoa base, tabelas de funcionário/subtipo e pendência de sync são gravadas em chamadas independentes, sem transação.

**Evidência**
```js
const pessoa = await criarPessoaBase({
  nome, foto, rg, cpf, telefone, email, tipo,
  unidade_id: camposExtras.unidade_id || null,
  qr_code: camposExtras.qr_code || gerarNumero8Digitos(),
  cartao_rfid: camposExtras.cartao_rfid || null,
  senha_acesso: camposExtras.senha_acesso ? await hashSenha(camposExtras.senha_acesso) : null,
  data_nascimento
});
```

**Impacto no dado**
Falha no subtipo deixa Pessoa órfã; falha na outbox deixa pessoa válida sem sincronização, e retries de API podem tomar caminhos diferentes.

**Como reproduzir**
Induzir falha no INSERT de tabela filha ou de `sync_pendente` após criar Pessoa.

**Correção sugerida**
Executar base, subtipo e outbox na mesma transação, com rollback integral.

**Regra violada**
Escrita multi-passo deve ser atômica ou compensável.

### [B-031] Offset de identidade tem padrões conflitantes
- **Arquivo:** `src/services/controlIdService.js:11-12`; `src/services/accessService.js:7-26`
- **Severidade:** SEV3
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Provisionamento usa padrão `110000000`, enquanto ingestão e diagnóstico usam `111000000`. O fallback de “últimos sete dígitos” mascara o problema apenas para IDs locais menores.

**Evidência**
```js
const USER_ID_OFFSET = parseInt(process.env.CATRACA_USER_ID_OFFSET || '110000000');
```
```js
const USER_ID_OFFSET = parseInt(process.env.CATRACA_USER_ID_OFFSET || '111000000');
```

**Impacto no dado**
Ao alcançar IDs locais de sete dígitos, logs podem ser associados a outra Pessoa ou descartados; instâncias com configuração parcial também divergem.

**Como reproduzir**
Sem variável de ambiente, calcular o ID de catraca para uma Pessoa com ID `1000000` e aplicar a conversão do ingest.

**Correção sugerida**
Centralizar a transformação numa única configuração validada e persistir mapeamento explícito em vez de inferir por corte decimal.

**Regra violada**
Conversão de identidade deve ser consistente; ADR-0009.

### [B-032] Descoberta em rede /8 pode esgotar memória e bloquear o processo
- **Arquivo:** `src/services/networkDiscoveryService.js:30-43`; `src/services/networkDiscoveryService.js:87-105`
- **Severidade:** SEV2
- **Categoria:** desempenho
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
`expandCidr` materializa todos os hosts e depois cria uma Promise por host/porta antes de aplicar o limite de execução. Em uma interface privada `/8`, isso representa milhões de strings e dezenas de milhões de tarefas.

**Evidência**
```js
const ips = [];
for (let i = startOffset; i < endOffset; i++) {
  ips.push(intToIp(baseInt + i));
}
```

**Impacto no dado**
O processo pode consumir toda a memória/CPU e interromper sync, polling e registro de acesso.

**Como reproduzir**
Em ambiente isolado, solicitar descoberta de uma rede privada `/8` e observar a alocação antes de as requisições terminarem.

**Correção sugerida**
Impor prefixo mínimo/limite de hosts, iterar de forma lazy e manter apenas `concurrency` tarefas vivas.

**Regra violada**
Nenhuma — é qualidade (disponibilidade/desempenho).

### [B-033] Ordem declarada contradiz dependências e inclui criação de portal
- **Arquivo:** `src/config/syncOrder.js:6-23`
- **Severidade:** SEV3
- **Categoria:** manutenibilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
A ordem declarada coloca `time_zones` antes de `time_spans` e inclui `portals` entre objetos a criar. No código atual a constante não é consumida por um provisionador, mas é exportada como referência operacional.

**Evidência**
```js
const ORDEM_CRIACAO_NA_CATRACA = [
  'time_zones',
  'time_spans',
  'areas',
  'groups',
  'access_rules',
```

**Impacto no dado**
Qualquer fluxo que passe a usar essa configuração pode violar dependências e tentar criar representação de hardware, produzindo plano inválido ou perigoso.

**Como reproduzir**
Análise estática da constante exportada versus a ordem normativa do ADR.

**Correção sugerida**
Corrigir para a ordem de dependências aceita, excluir `portals` da criação e adicionar teste que derive/verifique o grafo.

**Regra violada**
ADR-0008; ADR-0009.

### [B-034] Coalescência da fila permite CREATE e DELETE duplicados
- **Arquivo:** `src/services/sync.js:9-21`; `src/services/sync.js:52-80`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
A consulta de deduplicação carrega apenas CREATE/UPDATE. O código só ignora um CREATE existente quando a nova operação é UPDATE; um novo CREATE é sempre inserido. DELETE também é sempre inserido, sem procurar DELETE pendente.

**Evidência**
```js
if (mapCreate.has(dispositivoId) && operation === 'UPDATE') {
  logger.debug(`Ignorando UPDATE para dispositivo ${dispositivoId} porque já existe CREATE`);
  continue;
}
```
```js
await db.execute(
  `INSERT INTO sync_pendente (pessoa_id, dispositivo_id, operation, data_tentativa)
   VALUES (?, ?, ?, ?)`,
  [pessoaId, dispositivoId, operation, new Date()]
);
```

**Impacto no dado**
O mesmo comando pode ser executado mais de uma vez; combinado com `create_objects`, isso gera duplicidade/falha e resultados divergentes por dispositivo.

**Como reproduzir**
Chamar `registrarSyncPendente` duas vezes com a mesma pessoa e operação CREATE ou DELETE e consultar a fila.

**Correção sugerida**
Definir máquina de estados/coalescência completa, constraint única adequada e upsert transacional da outbox.

**Regra violada**
Escrita na catraca deve ser idempotente; deduplicação deve ser robusta.

### [B-035] Pendências offline/desabilitadas bloqueiam indefinidamente o restante da fila
- **Arquivo:** `src/jobs/scheduledJobs.js:103-107`; `src/jobs/scheduledJobs.js:147-162`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
O lote sempre pega os 50 registros mais antigos por `data_tentativa`. Para dispositivo desabilitado ou offline, o job atualiza `last_attempt`/contador, mas não altera `data_tentativa` nem exclui/reagenda a linha.

**Evidência**
```js
const [pendentesResult] = await db.query(
  'SELECT * FROM sync_pendente ORDER BY data_tentativa ASC LIMIT ?',
  [parseInt(process.env.SYNC_BATCH_SIZE || '50')]
);
```

**Impacto no dado**
Com um lote inteiro antigo indisponível, mudanças mais novas de dispositivos saudáveis nunca são selecionadas.

**Como reproduzir**
Criar 50 pendências antigas para dispositivo offline e uma posterior para dispositivo online; executar o job repetidamente.

**Correção sugerida**
Selecionar apenas itens cujo `next_attempt_at <= now`, reprogramar falhas com backoff e particionar/fair-share por dispositivo.

**Regra violada**
Retry deve ter backoff/teto; nenhuma falha de um dispositivo deve mascarar/bloquear os demais.

### [B-036] Falha estruturada da sync é registrada como conclusão normal
- **Arquivo:** `src/jobs/scheduledJobs.js:21-33`; `src/services/accessService.js:205-219`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Falha de sessão/leitura resolve como objeto `sucesso: false`; o job não examina esse campo, soma zero acessos e registra mensagem normal de sincronização.

**Evidência**
```js
const resultados = await accessService.sincronizarTodosAcessos();
const totalSync = resultados.reduce((acc, r) => acc + (r.acessosSincronizados || 0), 0);
logger.info(`${totalSync} acessos sincronizados`);
```

**Impacto no dado**
Operação pode parecer saudável quando uma ou mais catracas não foram lidas; alertas/contadores de falha não refletem o estado real.

**Como reproduzir**
Deixar uma catraca indisponível e executar o cron de sync; o serviço devolve falha estruturada e o job encerra sem entrar no catch.

**Correção sugerida**
Inspecionar todos os resultados, marcar rodada parcial como falha, emitir alerta por dispositivo e preservar contexto para retry.

**Regra violada**
Nunca retornar/reportar sucesso após falha parcial.

### [B-037] Shutdown fecha o banco sem aguardar jobs em voo
- **Arquivo:** `index.js:140-191`; `src/jobs/scheduledJobs.js:313-321`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
`pararJobs` apenas impede novos disparos; as Promises das callbacks já iniciadas não são rastreadas. O shutdown aguarda 200 ms e fecha o pool, com encerramento forçado em cinco segundos.

**Evidência**
```js
if (jobs) {
  pararJobs(jobs);
  logger.info('✓ Jobs agendados parados');
}
await new Promise(resolve => setTimeout(resolve, 200));
db.end((err) => {
```

**Impacto no dado**
Sync, backup ou processamento de pendência em andamento pode ser cortado entre passos, deixando cursor/outbox/estado da catraca parcialmente aplicados.

**Como reproduzir**
Iniciar uma operação de catraca com duração superior a 200 ms e enviar SIGTERM.

**Correção sugerida**
Rastrear Promises em voo, bloquear novos trabalhos, aguardar drenagem com timeout compatível e só então fechar banco/Redis; operações retomáveis devem conservar checkpoint durável.

**Regra violada**
Escrita multi-passo deve ser atômica ou compensável; nunca engolir falha parcial.

### [B-038] Device ID desconhecido é atribuído ao único dispositivo cadastrado
- **Arquivo:** `src/services/accessService.js:582-595`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Quando não encontra `control_id_device_id`, o Monitor aceita qualquer `device_id` se houver exatamente um dispositivo no banco e atribui os logs a ele.

**Evidência**
```js
if (todos.length === 1) {
  dispositivo_id = todos[0].id;
  logger.debug(`[MONITOR DAO] device_id ${deviceIdControlId} mapeado para único dispositivo id ${dispositivo_id}`);
}
```

**Impacto no dado**
Evento de equipamento não mapeado é gravado sob a catraca errada, contaminando deduplicação, presença, relatórios e trilha por dispositivo.

**Como reproduzir**
Com apenas um dispositivo cadastrado, enviar payload válido com outro `device_id`.

**Correção sugerida**
Exigir mapeamento explícito e único; colocar eventos desconhecidos em quarantine e alertar sem atribuí-los.

**Regra violada**
Nunca inventar dado; log não pode ser atribuído ao dispositivo errado.
