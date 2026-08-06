# Auditoria independente — FATIA A: camada de dados

> **Nota do orquestrador:** este é o relatório bruto do auditor. Duplicatas e severidades
> foram revistas; para conclusões factuais da onda, prevalece `ONDA1-VERIFICACAO.md`.

## Resumo de cobertura

- **Repositórios e branch:** `SAGE-API` e `SAGE`, ambos verificados em `wip/recuperacao-local-pre-auditoria`, sem alterações locais no início da auditoria.
- **Fontes normativas lidas integralmente:** ADR-0007, ADR-0010 e ADR-0011 (215 linhas).
- **Código lido:** 59 arquivos do escopo obrigatório em `SAGE-API` (todos os 17 SQLs, 23 controllers, 8 services, 3 utils, 2 arquivos de configuração, 5 scripts e `package.json`) e `SAGE/package.json`; aproximadamente **10.350 LOC** incluindo os ADRs.
- **Cruzamento estrutural:** 27 estruturas persistentes foram mapeadas: as 23 tabelas do schema-base, `FuncionarioHorario`, `system_logs`, `session_cache` e `schema_migrations`. Foram cruzados schema, normalização legada, migrations versionadas, escritores e leitores/relatórios. `system_logs` e `session_cache` não têm escritor/leitor no código funcional incluído no escopo.
- **Dumps:** `dados_etec_taboao*.sql` foram examinados somente quanto a estrutura, tabelas e colunas dos `INSERT`; nenhum valor real foi copiado ou reproduzido.
- **Camada identificada:** o backend declara `mysql2` e não declara `knex`; o frontend não possui camada de banco própria.
- **Limitações de execução:** análise estática. Não foi executado `npm test`, porque o host usa Node 18.16.1 e o backend exige Node `>=24 <25`. Também não havia uma instância MySQL de auditoria autorizada para ensaiar instalação, concorrência ou planos de execução. Rotas, middlewares e services fora da lista obrigatória não foram usados para inferir autorização ou alcance externo.
- **Confiança da fatia:** **alta** para violações estruturais, transacionais e dos ADRs; **média** para impacto quantitativo de desempenho e para caminhos que dependem da forma do schema legado de cada escola.
- **Contagem:** **21 achados** — SEV1: 8; SEV2: 10; SEV3: 3; SEV4: 0.

### [A-001] ADR-0010 não foi implementado e chaves do corpo viram identificadores SQL
- **Arquivo:** `SAGE-API/src/config/queryBuilder.js:74-109`; `SAGE-API/src/utils/generic-db-utils.js:15-38`; `SAGE-API/src/controllers/genericControllerFactory.js:93-125`; `SAGE-API/package.json:19-42`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

O projeto continua usando um query builder caseiro sobre `mysql2`, sem `knex`. Tabela, coluna, operador, ordenação, limite e offset são interpolados. Nos controllers genéricos, as chaves de `req.body` chegam a `Object.keys(dados)` e são inseridas diretamente como nomes de coluna.

**Evidência**
```js
let sql = `SELECT ${this.columns.join(', ')} FROM ${this.table}`;
sql += ` ORDER BY ${this.orderBys.map(o => `${o.column} ${o.direction}`).join(', ')}`;
sql += ` LIMIT ${this.limits}`;

const campos = Object.keys(dados);
const query = `INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${placeholders})`;
```

**Impacto no dado**

Um campo JSON malformado pode alterar a estrutura da instrução SQL em endpoints genéricos. Mesmo quando os valores usam placeholders, os identificadores não são escapados. O risco alcança tabelas de pessoas, presença, solicitações, escola, salas, cursos e dispositivos.

**Como reproduzir**

Análise estática: seguir `req.body` em `genericControllerFactory.criar/editar` até `criarRegistro/atualizarRegistro` e observar que as chaves compõem a string SQL. Confirmar em `package.json` que `knex` não está declarado.

**Correção sugerida**

Executar a decisão do ADR-0010: substituir a implementação por Knex, manter a API pública necessária, escapar identificadores e usar allowlists por entidade. Adicionar testes explícitos de identificadores hostis, ordenação e paginação.

**Regra violada**

ADR-0010 — voltar para Knex e nunca interpolar identificadores vindos do cliente.

### [A-002] Credenciais de catraca são persistidas e devolvidas em texto reutilizável
- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:26-28`; `SAGE-API/src/controllers/deviceController.js:782-825`; `SAGE-API/src/services/exportService.js:36-43`; `SAGE-API/src/services/importService.js:217-229`
- **Severidade:** SEV1
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

O segredo do dispositivo faz parte das colunas normais de leitura e inserção. O quick-add grava o valor recebido sem proteção, relê o registro completo e o devolve na resposta. A exportação inclui explicitamente usuário e segredo do equipamento, e a importação aceita o mesmo dado diretamente da planilha.

**Evidência**
```js
const campos = ['id', 'nome', 'modelo', 'endereco', 'porta', 'usuario', 'senha', 'status', 'sync_enabled', 'last_health_check', 'area_id', 'numero_serial', 'created_at', 'updated_at'];
const { ip, port, usuario, senha, nome, area_id, modelo, numero_serial } = req.body;
res.status(201).json({
  message: 'Dispositivo criado',
  data: dispositivo || payload,
  conectado: !!ok
});
```

**Impacto no dado**

Credenciais que controlam equipamento físico são replicadas no banco, respostas e planilhas. Um vazamento de resposta, arquivo exportado ou dump entrega um segredo operacional reutilizável; os dois dumps estruturais também contêm `INSERT` com colunas de credencial, embora seus valores não tenham sido reproduzidos nesta auditoria.

**Como reproduzir**

Análise estática: acompanhar `req.body.senha` em `quickAdd`, a seleção por `campos` e o retorno em `data`; verificar a projeção da aba de catracas em `exportService`.

**Correção sugerida**

Tratar credencial como segredo: criptografia autenticada em repouso com chave fora do banco, redaction obrigatória em todos os DTOs, proibição em exports/dumps de negócio e rotação das credenciais já materializadas.

**Regra violada**

Regra sanitizada: nunca registrar ou reproduzir segredo/IP interno.

### [A-003] Presença legal é sobrescrita, apagável e lida sem cadeia de correção
- **Arquivo:** `SAGE-API/database/sage.sql:125-136`; `SAGE-API/src/services/presenceService.js:152-181`; `SAGE-API/src/controllers/presenceController.js:1-6`; `SAGE-API/src/controllers/relatorioController.js:670-693`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

`Presenca` não possui origem, autor, justificativa nem vínculo com registro corrigido. Um segundo evento do mesmo dia executa `UPDATE` no fato anterior. O controller genérico ainda oferece edição e exclusão, e os relatórios consultam a tabela bruta diretamente.

**Evidência**
```js
await db.query(`
  UPDATE Presenca
  SET dia_semana = ?, aulas_perdidas = ?, horario_previsto = ?, horario_chegada = ?, atrasado = ?
  WHERE id = ?
`, [
  diaSemana,
  aulasPerdidas,
  horarioPrevistoSql,
  horarioChegadaSql,
  atrasado,
  registroExistente.id
]);
```

**Impacto no dado**

O horário original pode desaparecer sem rastro; não há como demonstrar origem, responsável ou motivo de correção. Exclusões em cascata por pessoa e o CRUD genérico também permitem eliminar registros. Relatórios não sinalizam correções porque o modelo sequer as representa.

**Como reproduzir**

Análise estática: processar mentalmente dois acessos da mesma pessoa/data; o segundo encontra a linha e a sobrescreve. Verificar que `presenceController` exporta CRUD completo e que os relatórios leem `FROM Presenca`.

**Correção sugerida**

Implementar o modelo append-only do ADR-0007, com origem, `registro_corrigido_id`, autor, instante e justificativa; bloquear `UPDATE/DELETE` no banco; criar a view de versão vigente e migrar todos os relatórios para ela.

**Regra violada**

ADR-0007 — registro original nunca é sobrescrito; correção é novo fato auditável; relatórios usam a view vigente.

### [A-004] “Começar do zero” apaga presença e cadastros sem backup verificado ou transação
- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:522-564`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

Depois de zerar a catraca, o controller executa uma sequência de `DELETE` no SAGE, incluindo `Presenca`, `Acesso` e `Pessoa`. Não cria nem relê backup do banco, não abre transação e até ignora falha ao apagar `sync_pendente`.

**Evidência**
```js
if (apagarPessoasNoSistema) {
  await db.query('DELETE FROM Presenca');
  await db.query('DELETE FROM SolicitacaoAcesso');
  await db.query('DELETE FROM HorarioAula');
  await db.query('DELETE FROM Aula');
  await db.query('DELETE FROM Professor');
  await db.query('DELETE FROM Administrador');
  await db.query('DELETE FROM Terceirizado');
  await db.query('DELETE FROM Funcionario');
  await db.query('DELETE FROM Aluno');
  await db.query('DELETE FROM Responsavel');
  await db.query('DELETE FROM Acesso');
  try { await db.query('DELETE FROM sync_pendente'); } catch (_) {}
  const [r] = await db.query('DELETE FROM Pessoa');
}
```

**Impacto no dado**

Uma falha intermediária deixa o banco parcialmente esvaziado. A operação remove fatos de presença/ponto de peso legal e relações acadêmicas sem mecanismo de restauração comprovado.

**Como reproduzir**

Análise estática: falhar qualquer `DELETE` intermediário (por FK, indisponibilidade ou permissão) e observar que os anteriores já foram confirmados pelo autocommit.

**Correção sugerida**

Remover a exclusão física de presença. Para qualquer reset autorizado, exigir backup do banco, verificar o artefato por releitura/restauração de teste, registrar identidade e motivo, e executar a parte relacional numa transação única com política explícita de retenção.

**Regra violada**

Regras sanitizadas: operação irreversível exige backup verificado por releitura; escrita multi-passo usa transação; dado de presença/ponto não pode ser apagado sem rastreabilidade. ADR-0007.

### [A-005] Acesso manual e acesso de catraca usam convenções de fuso diferentes na mesma coluna
- **Arquivo:** `SAGE-API/src/config/database.js:16-23`; `SAGE-API/src/services/accessService.js:49-63`; `SAGE-API/src/services/accessService.js:335-350`; `SAGE-API/src/services/accessService.js:493-530`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

O pool usa `timezone: '-03:00'`. O acesso manual passa objetos `Date`, que o driver serializa segundo esse fuso; a sincronização transforma o mesmo tipo de instante em string UTC sem marcador e grava essa string em `DATETIME`. A coluna `Acesso.data_hora` passa a misturar hora local e UTC ingênuo.

**Evidência**
```js
const data_hora_utc = data_hora.toISOString().slice(0, 19).replace('T', ' ');
const inserido = await inserirAcessoDaCatraca({
  pessoa_id,
  dispositivo_id,
  catraca_log_id: catracaLogId,
  status,
  permitido,
  metodo_auth,
  data_hora: data_hora_utc
});

await db.query(
  `INSERT INTO Acesso (pessoa_id, dispositivo_id, status, permitido, metodo_auth, data_hora, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [pessoa_id, dispositivo_id, status, permitido, metodo_auth, new Date(), new Date()]
);
```

**Impacto no dado**

Acessos equivalentes podem diferir três horas conforme a origem. Eventos próximos da meia-noite podem cair em outro dia nos relatórios, afetando entrada, saída, atraso, presença e o próprio cursor temporal de sincronização.

**Como reproduzir**

Análise estática: comparar a serialização de `new Date()` pelo pool `-03:00` com a string gerada por `toISOString()` e observar que `DATETIME` não armazena zona.

**Correção sugerida**

Escolher uma única convenção. Preferencialmente persistir instante UTC de forma inequívoca e converter apenas nas bordas, ou persistir hora civil local consistentemente; migrar dados existentes por origem/catraca e validar virada de dia e horário de verão histórico.

**Regra violada**

Regra sanitizada: dado de presença/ponto requer rastreabilidade e não pode ser alterado silenciosamente.

### [A-006] Importação de planilha confirma lotes parciais
- **Arquivo:** `SAGE-API/src/services/importService.js:236-269`; `SAGE-API/src/services/importService.js:422-489`
- **Severidade:** SEV1
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

A importação grava escola, cursos, turmas, dispositivos e pessoas sequencialmente no pool, sem conexão dedicada nem transação. Erros por pessoa são capturados e o processamento continua; a função retorna um resumo após confirmar tudo que ocorreu antes.

**Evidência**
```js
try {
  const criado = await peopleService.criarPessoaCompleta(payload);
  const pessoaId = criado?.idPessoa;
  if (pessoaId && Array.isArray(dispositivosParaSync) && dispositivosParaSync.length > 0) {
    await registrarSyncPendentesEmLote(pessoaId, dispositivosParaSync, 'CREATE');
  }
  summary.pessoas.sucesso += 1;
} catch (error) {
  summary.pessoas.erros += 1;
  summary.erros.push({ aba: 'ALUNO', nome, mensagem: error.message });
}
```

**Impacto no dado**

Falha na linha N deixa infraestrutura e pessoas das linhas anteriores gravadas, além de possíveis pessoas-base incompletas. Reexecutar depende de heurísticas de upsert e pode produzir estado diferente do arquivo original.

**Como reproduzir**

Análise estática: usar uma planilha cuja primeira pessoa seja válida e a seguinte viole uma FK/check; a primeira já foi confirmada quando a segunda falha.

**Correção sugerida**

Executar cada importação lógica em transação real por conexão dedicada/Knex, validar toda a planilha antes de escrever e fazer rollback integral ao primeiro erro. Se houver modo deliberadamente parcial, torná-lo contrato explícito separado, idempotente e nunca rotulado apenas como concluído.

**Regra violada**

ADR-0010 — importação em massa dentro de transação; regra sanitizada: escrita multi-passo usa transação e falha parcial não é sucesso.

### [A-007] Promoção anual pode ficar parcial e ainda marcar o ano como concluído
- **Arquivo:** `SAGE-API/src/services/promocaoAlunosService.js:179-224`; `SAGE-API/src/services/promocaoAlunosService.js:261-294`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**

Cada aluno é atualizado em autocommit e erros individuais são contabilizados, não revertidos. Mesmo com `resultado.erros > 0`, `executarPromocaoSeAnoMudou` tenta registrar o ano como processado. Se esse checkpoint falhar, a função apenas avisa e retorna, permitindo nova execução no mesmo ano.

**Evidência**
```js
} catch (err) {
  resultado.erros++;
  resultado.detalhes.push({
    aluno_id: aluno.aluno_id,
    turma_atual: aluno.turma_nome,
    acao: 'erro',
    motivo: err.message
  });
}

const resultado = await executarPromocao(options);
if (!apenasSimulacao) {
  await atualizarUltimoAnoPromocao(anoAtual);
}
```

**Impacto no dado**

Uma turma pode ser promovida parcialmente e não ser retomada após o checkpoint. No cenário inverso, falha silenciosa do checkpoint permite rerodar e avançar o mesmo aluno mais de uma série ou concluí-lo. Não existe histórico da turma/status anterior nem autor da reversão em massa.

**Como reproduzir**

Análise estática: provocar erro após alguns `UPDATE Aluno`; observar que os anteriores permanecem e o fluxo continua até o checkpoint. Alternativamente, falhar o write de `ConfigSistema` e observar retorno sem erro.

**Correção sugerida**

Executar seleção bloqueada, atualizações e checkpoint numa única transação idempotente; abortar quando qualquer aluno falhar; persistir histórico de promoção/reversão com lote, ano, operador e valores anterior/novo.

**Regra violada**

Regras sanitizadas: escrita multi-passo usa transação; nunca engolir erro nem reportar falha parcial como sucesso; escrita deve preservar histórico.

### [A-008] Instalação limpa falha ao criar o evento anual e deixa DDL parcial
- **Arquivo:** `SAGE-API/database/sage.sql:321-380`; `SAGE-API/scripts/setup-database.js:81-164`; `SAGE-API/scripts/setup-database.js:342-364`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

Depois de restaurar `DELIMITER ;` para a procedure, `sage.sql` inicia `CREATE EVENT` sem trocar novamente o delimitador. O parser do setup encerra qualquer statement cuja linha termine em `;`; portanto ele corta o evento no `CALL ...;`. O bloco também referencia, fora da procedure, variáveis locais dela.

**Evidência**
```sql
CREATE EVENT atualizar_ou_desligar_alunos
ON SCHEDULE
    EVERY 1 YEAR
    STARTS TIMESTAMP(CONCAT(YEAR(CURDATE()) + 1, '-01-01 00:00:00'))
DO
BEGIN
    CALL atualizar_turmas_e_status();
    SELECT CONCAT('Alunos atualizados: ', v_atualizados) AS Atualizados,
           CONCAT('Alunos desligados: ', v_desligados) AS Desligados;
END$$
```

**Impacto no dado**

O primeiro setup limpo cria várias tabelas e a procedure por autocommit, falha no evento e aborta antes do baseline. O banco fica parcialmente instalado; uma segunda execução percorre um caminho diferente porque basta `Pessoa` existir para pular o schema-base.

**Como reproduzir**

Análise estática determinística: aplicar a regra `trimmed.endsWith(';')` do parser às linhas do evento. Em banco vazio, o statement enviado termina após o `CALL`, antes do `END`.

**Correção sugerida**

Remover procedure/evento do baseline ou corrigi-los em migration versionada e testada em MySQL real. Fazer instalação limpa em banco descartável como teste obrigatório e evitar DDL parcial fora do ledger.

**Regra violada**

Regra sanitizada: nunca reportar falha parcial como sucesso; escrita multi-passo usa transação quando aplicável.

### [A-009] Normalização fora do ledger executa DROP COLUMN e quebra expand-only
- **Arquivo:** `SAGE-API/scripts/setup-database.js:177-198`; `SAGE-API/database/migration_dispositivo_sync_enabled.sql:44-61`; `SAGE-API/scripts/migration-runner.js:97-105`
- **Severidade:** SEV1
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**

`normalizarLegado` executa todo arquivo `migration_*.sql` do diretório raiz antes de registrar o baseline, portanto essas alterações não têm uma entrada individual com checksum/status. Uma delas remove imediatamente colunas antigas.

**Evidência**
```sql
SET @sql = IF(@tem_nova = 1 AND @tem_orfa = 1,
  'ALTER TABLE Dispositivo DROP COLUMN sincronizar',
  'SELECT ''sem coluna orfa (sincronizar)''');
```

**Impacto no dado**

O upgrade pode apagar dados de configuração antes da ativação da nova versão. Se houver rollback de código, a versão anterior pode depender da coluna removida. Como o DROP fica agregado ao baseline, não há ledger granular que demonstre qual transformação ocorreu ou permita diagnóstico preciso.

**Como reproduzir**

Análise estática: partir de schema com `sync_enabled` e uma coluna antiga; `normalizarLegado` escolhe e executa o `DROP COLUMN` antes de `schema_migrations` registrar o checkpoint 0000.

**Correção sugerida**

Congelar o baseline legado e mover qualquer evolução para migrations versionadas, uma por versão. Fazer somente expand na versão corrente; deprecar, observar e remover coluna apenas em versão futura compatível com rollback e depois de backup verificado.

**Regra violada**

ADR-0011 — migrations sempre expand-only; regra sanitizada: migration destrutiva é proibida e operação irreversível exige backup verificado.

### [A-010] Erros de coluna duplicada podem mascarar colunas faltantes no legado
- **Arquivo:** `SAGE-API/scripts/setup-database.js:141-165`; `SAGE-API/database/melhorias_sistema.sql:8-19`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**

O executor ignora qualquer erro cuja mensagem contenha `Duplicate column name`. Há `ALTER TABLE` que adicionam várias colunas de uma vez. Se uma já existir e outra faltar, o MySQL rejeita a instrução inteira; o executor ignora o erro como se toda a convergência tivesse ocorrido.

**Evidência**
```js
if (!error.message.includes('already exists') &&
    !error.message.includes('Duplicate key name') &&
    !error.message.includes('Duplicate column name') &&
    !error.message.includes("doesn't exist in table")) {
  throw error;
}
```
```sql
ALTER TABLE sync_pendente
ADD COLUMN error_message TEXT NULL AFTER operation,
ADD COLUMN retry_count INT DEFAULT 0 AFTER error_message,
ADD COLUMN last_attempt DATETIME NULL AFTER retry_count;
```

**Impacto no dado**

Schemas parcialmente migrados podem continuar sem colunas requeridas e mesmo assim avançar para o baseline. Instalação limpa e atualização existente deixam de convergir para a mesma estrutura.

**Como reproduzir**

Análise estática: considerar `sync_pendente.error_message` existente e `retry_count` ausente. O `ALTER` falha por duplicidade da primeira coluna, nenhuma adição é aplicada e a exceção é ignorada.

**Correção sugerida**

Inspecionar cada coluna/índice em `information_schema` e aplicar alterações unitárias idempotentes. Após cada migration, validar assinatura completa do schema antes de marcar o baseline.

**Regra violada**

Regra sanitizada: nunca engolir erro nem reportar falha parcial como sucesso.

### [A-011] Criação e edição de pessoa podem deixar subtipo e fila de sync incompletos
- **Arquivo:** `SAGE-API/src/services/peopleService.js:56-111`; `SAGE-API/src/utils/people-db-utils.js:71-184`; `SAGE-API/src/utils/people-db-utils.js:309-360`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

Pessoa-base, `Funcionario`, subtipo e `sync_pendente` são escritos por chamadas independentes ao pool. A edição também atualiza `Pessoa`, `Funcionario` e subtipo sequencialmente, sem transação.

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
const idPessoa = pessoa.id;
if (tiposFuncionario.includes(tipo)) {
  await criarFuncionarioBase(idPessoa, camposExtras);
}
switch (tipo) {
  case 'ALUNO': await criarAluno(idPessoa, camposExtras); break;
  // ...
}
await registrarSyncPendente(idPessoa, 'CREATE');
```

**Impacto no dado**

Falha de FK/check ou indisponibilidade após o primeiro insert deixa `Pessoa.tipo` sem sua linha obrigatória em `Aluno`/`Funcionario`/subtipo. Leitores fazem joins ou assumem o subtipo e passam a omitir ou tratar incorretamente a pessoa.

**Como reproduzir**

Análise estática: criar funcionário com dados-base válidos e subtipo inválido; `Pessoa` e possivelmente `Funcionario` já estarão confirmados quando a última inserção falhar.

**Correção sugerida**

Passar um transaction handle por todas as funções de pessoa e confirmar somente após subtipo e outbox de sincronização estarem consistentes. Validar payload integral antes da primeira escrita.

**Regra violada**

Regra sanitizada: escrita multi-passo usa transação.

### [A-012] Registro de acesso e derivação de presença não são atômicos
- **Arquivo:** `SAGE-API/src/controllers/accessController.js:26-72`; `SAGE-API/src/services/accessService.js:493-533`; `SAGE-API/src/services/accessService.js:676-709`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

O acesso é inserido e confirmado antes de calcular presença. Se `presenceService` falhar, o endpoint manual devolve 500 embora o acesso exista. No Monitor DAO, `processados` é incrementado antes da presença e permanece incrementado mesmo quando o catch registra erro.

**Evidência**
```js
await db.query(
  `INSERT INTO Acesso (pessoa_id, dispositivo_id, status, permitido, metodo_auth, data_hora, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [pessoa_id, dispositivo_id, status, permitido, metodo_auth, new Date(), new Date()]
);
```
```js
await verificarEAtribuirPresenca(pessoa_id, data_hora instanceof Date ? data_hora : new Date(data_hora));
```

**Impacto no dado**

`Acesso` e `Presenca` divergem. Relatórios então alternam entre tabela de presença e fallback de acesso, podendo apresentar resultados diferentes para a mesma passagem; o cliente também pode repetir uma requisição que “falhou” e gerar novo acesso.

**Como reproduzir**

Análise estática: provocar falha na escrita de `Presenca` após `INSERT Acesso`; o insert anterior usa autocommit e não é revertido.

**Correção sugerida**

Definir a fronteira consistente: inserir acesso e fato de presença na mesma transação, ou tornar presença uma projeção idempotente via outbox/worker com estado explícito. Nunca responder falha total quando houve commit parcial sem informar o identificador persistido.

**Regra violada**

Regras sanitizadas: escrita multi-passo usa transação; nunca reportar falha parcial como sucesso ou falha total enganosa.

### [A-013] Cursor de sincronização avança sobre logs sem pessoa e os perde permanentemente
- **Arquivo:** `SAGE-API/src/services/accessService.js:327-333`; `SAGE-API/src/services/accessService.js:405-423`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**

Logs cujo `pessoa_id` ainda não existe são ignorados. Ao final, o cursor é avançado para o maior ID de todos os logs recebidos, não apenas os persistidos.

**Evidência**
```js
if (!pessoa) {
  ignoradosPessoa++;
  logger.debug(`[SYNC] Ignorando: user_id=${log.user_id} → pessoa_id=${pessoa_id} não existe`);
  continue;
}

const logIds = logs.map((l) => inteiroPositivoSeguro(l?.id)).filter((id) => id != null);
const maxLogId = Math.max(...logIds);
const currentMax = dispositivo.ultimo_log_id_sincronizado != null ? Number(dispositivo.ultimo_log_id_sincronizado) : 0;
const newMax = Math.max(maxLogId, currentMax);
await db.query(
  'UPDATE Dispositivo SET ultimo_log_id_sincronizado = ? WHERE id = ?',
  [newMax, dispositivo.id]
);
```

**Impacto no dado**

Se a pessoa for cadastrada/importada depois, esses acessos não voltam a ser solicitados à catraca. O histórico de entrada/saída e a presença derivada ficam incompletos sem possibilidade automática de recuperação.

**Como reproduzir**

Análise estática: receber logs IDs 10 e 11, com pessoa apenas para o 11. O 10 é ignorado, o cursor vai a 11 e a próxima busca por ID maior não recupera 10.

**Correção sugerida**

Persistir o evento bruto antes de resolver a pessoa, com estado `pendente_identidade`, ou não avançar além do primeiro gap não resolvido. Expor reconciliação e métricas sem descartar o fato original.

**Regra violada**

Regra sanitizada: nunca inventar/perder dado; dado de presença/ponto exige rastreabilidade.

### [A-014] Falha ao gravar outbox de sincronização é engolida
- **Arquivo:** `SAGE-API/src/services/sync.js:5-88`; `SAGE-API/src/services/peopleService.js:67-78`; `SAGE-API/src/controllers/peopleController.js:129-149`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

`registrarSyncPendente` envolve toda a operação em `try/catch`, registra log e não relança nem retorna falha. Chamadores usam `await` e seguem devolvendo criação/atualização bem-sucedida.

**Evidência**
```js
} catch (err) {
  logger.errorWithStack('Erro ao registrar sync pendente', err);
}
```

**Impacto no dado**

O cadastro local muda sem a outbox necessária para atualizar catracas. A pessoa pode continuar autorizada, negada ou identificada com dados antigos no equipamento, enquanto a API informa sucesso.

**Como reproduzir**

Análise estática: falhar qualquer insert/delete de `sync_pendente`; a Promise resolve normalmente e o controller responde sucesso.

**Correção sugerida**

Fazer a outbox parte da mesma transação da mutação de pessoa e relançar falhas. Se sincronização for assíncrona, retornar estado pendente/degradado explícito e observável, nunca sucesso irrestrito.

**Regra violada**

Regra sanitizada: nunca engolir erro nem reportar falha parcial como sucesso.

### [A-015] Importação da catraca cria “ALUNO” sem linha em Aluno
- **Arquivo:** `SAGE-API/src/services/catracaImportService.js:76-102`; `SAGE-API/src/services/presenceService.js:82-97`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

A importação insere somente em `Pessoa`, mas grava `tipo` como `ALUNO` por padrão (ou qualquer tipo fornecido). Não cria `Aluno`, `Funcionario` ou demais subtipos. O cálculo de presença de aluno exige a linha em `Aluno` e retorna sem registrar quando ela não existe.

**Evidência**
```js
const tipoPadrao = options.tipo_pessoa || 'ALUNO';
await db.query(
  'INSERT INTO Pessoa (nome, unidade_id, qr_code, tipo, visivel) VALUES (?, ?, ?, ?, 1)',
  [nome, unidade_id, qr_code, tipoPadrao]
);
```

**Impacto no dado**

O banco contém discriminador e subtipo divergentes. Alunos importados somem de joins acadêmicos, não têm turma/divisão e não recebem presença; outros tipos podem quebrar as mesmas suposições.

**Como reproduzir**

Análise estática: importar um usuário inexistente com defaults e depois seguir `presenceService` para `SELECT turma_id, divisao FROM Aluno`; nenhuma linha é encontrada e a função retorna.

**Correção sugerida**

Usar o mesmo serviço transacional de criação de pessoa/subtipo, exigir dados mínimos do subtipo ou importar inicialmente como entidade neutra/pendente de classificação que não se apresente como aluno válido.

**Regra violada**

Regra sanitizada: nunca inventar dado; escrita multi-passo usa transação.

### [A-016] Schemas legados de Sala e HorarioAula não convergem ao contrato atual
- **Arquivo:** `SAGE-API/database/melhorias_sistema.sql:67-105`; `SAGE-API/database/sage.sql:190-205`; `SAGE-API/database/sage.sql:257-275`; `SAGE-API/database/migration_horario_aula_horario.sql:1-13`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**

O caminho legado cria `Sala` sem `unidade_id`, enquanto o schema-base e o controller a utilizam. Ele cria `HorarioAula.horario` como `TIME` e sem `divisao`; o schema-base usa `VARCHAR(11)` no formato intervalo e exige `divisao`. A migration declarada para convergir `horario` contém apenas comentários.

**Evidência**
```sql
CREATE TABLE IF NOT EXISTS HorarioAula (
  id INT AUTO_INCREMENT PRIMARY KEY,
  turma_id INT NOT NULL,
  aula_id INT NOT NULL,
  dia_semana ENUM ('SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA') NOT NULL,
  horario TIME NOT NULL,
  sala_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
```

**Impacto no dado**

Uma escola atualizada a partir de schema parcial pode receber estrutura incompatível com os inserts/leitores atuais: intervalos como `07:30-08:20` não cabem em `TIME`, `divisao` não existe e salas não podem ser associadas à unidade. Instalação limpa e upgrade não convergem.

**Como reproduzir**

Análise estática: partir de legado sem essas duas tabelas, executar `melhorias_sistema.sql` e comparar o resultado com `sage.sql` e com o insert de `horarioAulaController`.

**Correção sugerida**

Definir uma assinatura canônica por tabela e criar migrations versionadas expand-only que adicionem as colunas/representação nova, façam backfill validado e só depois migrem leitores/escritores.

**Regra violada**

ADR-0011 — migrations expand-only; regra sanitizada: não reportar schema parcialmente convergido como sucesso.

### [A-017] Regras de horário dependem de check-then-write e substituição sem transação
- **Arquivo:** `SAGE-API/src/controllers/horarioAulaController.js:91-105`; `SAGE-API/src/controllers/horarioAulaController.js:254-307`; `SAGE-API/src/controllers/funcionarioHorarioController.js:53-89`; `SAGE-API/database/sage.sql:257-275`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

Conflitos de turma/professor/sala são consultados e depois inseridos, sem transação, lock ou restrição única correspondente. Para horário fixo, o endpoint apaga todos os horários, reinsere um a um e só então atualiza `Professor.usar_horario_fixo`, também sem transação.

**Evidência**
```js
const ehDuplicada = await validarDuplicadaTurma(turmaId, diaDb, horario, divNorm);
```
```js
const [result] = await db.query(
  `
  INSERT INTO HorarioAula
    (turma_id, aula_id, dia_semana, horario, divisao, sala_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `,
  [turmaId, aulaId, diaDb, horario, divNorm, salaFinal]
);
```
```js
await db.query('DELETE FROM FuncionarioHorario WHERE funcionario_id = ?', [funcionarioId]);
for (const h of horarios) {
  const dia = (h.dia_semana || '').toUpperCase();
  if (!DIAS_SEMANA.includes(dia)) continue;

  const entrada = toHoraSql(h.hora_entrada);
  const saida = toHoraSql(h.hora_saida);
  if (!entrada || !saida) continue;

  await db.query(
    `INSERT INTO FuncionarioHorario (funcionario_id, dia_semana, hora_entrada, hora_saida)
     VALUES (?, ?, ?, ?)`,
    [funcionarioId, dia, entrada, saida]
  );
}
```

**Impacto no dado**

Duas requisições concorrentes podem criar o mesmo slot ou conflitos. Falha após o delete de horário fixo deixa escala vazia/parcial e flag divergente, afetando cálculo de atraso/presença.

**Como reproduzir**

Análise estática de concorrência: duas transações leem “sem duplicata” antes de qualquer insert e ambas gravam; o schema não contém `UNIQUE` para o slot. Para substituição, falhar o segundo insert após o delete.

**Correção sugerida**

Enforçar invariantes possíveis com índices únicos e tratar colisão no banco. Executar validação bloqueada e gravação numa transação; substituir horários fixos atomicamente.

**Regra violada**

Regra sanitizada: escrita multi-passo usa transação.

### [A-018] Unicidade de identidade existe apenas como consulta prévia
- **Arquivo:** `SAGE-API/src/services/peopleService.js:29-50`; `SAGE-API/database/sage.sql:100-123`; `SAGE-API/database/sage.sql:144-155`; `SAGE-API/database/melhorias_sistema.sql:33-42`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

O serviço tenta deduplicar pessoa por documentos, email, cartão ou RA com um `SELECT` anterior ao insert. O schema não declara unicidade para esses identificadores; `melhorias_sistema.sql` cria somente índices comuns.

**Evidência**
```js
const sqlPessoa = `SELECT id FROM Pessoa WHERE ${checks.join(' OR ')} LIMIT 1`;
const [rowsPessoa] = await db.query(sqlPessoa, params);
```
```sql
CREATE INDEX idx_pessoa_cpf ON Pessoa(cpf);
CREATE INDEX idx_pessoa_cartao_rfid ON Pessoa(cartao_rfid);
```

**Impacto no dado**

Requisições concorrentes podem cadastrar duas pessoas para a mesma identidade. Futuros upserts escolhem arbitrariamente a primeira (`LIMIT 1`), dividindo histórico de acesso, presença e vínculos escolares entre IDs.

**Como reproduzir**

Análise estática de concorrência: duas criações simultâneas executam o `SELECT` antes de qualquer `INSERT`; ambas não encontram linha e ambas gravam porque não há `UNIQUE`.

**Correção sugerida**

Definir formalmente quais identificadores são únicos e em qual escopo/unidade; limpar duplicatas com procedimento auditável e adicionar restrições únicas. Substituir check-then-insert por operação atômica que trate colisão.

**Regra violada**

Regra sanitizada: nunca inventar dado; escrita multi-passo usa transação.

### [A-019] Consultas anuais não têm índice compatível e aplicam função sobre data indexada
- **Arquivo:** `SAGE-API/database/sage.sql:125-136`; `SAGE-API/database/melhorias_sistema.sql:28-31`; `SAGE-API/src/controllers/relatorioController.js:712-740`; `SAGE-API/src/controllers/relatorioController.js:855-868`
- **Severidade:** SEV3
- **Categoria:** desempenho
- **Depende do ambiente da escola:** SIM
- **Confiança:** média

**Sintoma**

O único índice de presença é `(data, pessoa_id)`, mas o histórico de 12 meses filtra primeiro por uma pessoa e depois por intervalo. Em `Acesso`, há índice `(pessoa_id, data_hora)`, porém relatórios usam `DATE(data_hora)`, impedindo range seek normal na segunda coluna.

**Evidência**
```sql
CREATE INDEX idx_presenca_data_pessoa ON Presenca(data, pessoa_id);
```
```js
WHERE a.pessoa_id = ? AND DATE(a.data_hora) >= ? AND DATE(a.data_hora) <= ?
```

**Impacto no dado**

Com centenas de milhares de eventos, relatórios por pessoa/período fazem mais leitura que o necessário e podem exceder a meta de 500 ms do ADR-0007. Sob carga, isso também aumenta contenção e tempo de resposta de operações críticas.

**Como reproduzir**

Análise estática; confirmar em ambiente de teste com `EXPLAIN ANALYZE` e 500 mil linhas sintéticas, sem dados reais.

**Correção sugerida**

Adicionar índice orientado a `(pessoa_id, data)` para presença e reescrever filtros de acesso como limites sargáveis (`>= início`, `< dia seguinte`) sem função na coluna. Validar a meta com massa sintética.

**Regra violada**

ADR-0007 — consulta de 12 meses de uma pessoa em menos de 500 ms com 500 mil registros.

### [A-020] Fotos e referências no banco são alteradas em ordem não compensável
- **Arquivo:** `SAGE-API/src/controllers/schoolPhotoController.js:52-72`; `SAGE-API/src/controllers/areaController.js:39-73`; `SAGE-API/src/services/peopleService.js:189-228`
- **Severidade:** SEV3
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

Na foto de escola, a linha é inserida com nome temporário, o arquivo é movido e só depois o caminho é atualizado. Em área/pessoa, o arquivo antigo é apagado antes de validar/mover o novo e antes do update no banco. Os catches removem no máximo o temporário e não restauram arquivo antigo, linha ou caminho.

**Evidência**
```js
const [result] = await db.query(
  'INSERT INTO UnidadeFoto (unidade_id, tipo, caminho, descricao) VALUES (?, ?, ?, ?)',
  [unidade_id, tipo, req.file.filename, descricao]
);
fs.renameSync(antigoCaminho, novoCaminho);
await db.query('UPDATE UnidadeFoto SET caminho = ? WHERE id = ?', [caminhoRelativo, result.insertId]);
```

**Impacto no dado**

Falha de filesystem ou banco deixa linha apontando para arquivo inexistente/temporário, ou arquivo sem referência. Na substituição, a foto anterior pode ser perdida mesmo quando a operação retorna erro.

**Como reproduzir**

Análise estática: falhar `renameSync` após o insert, ou falhar o `UPDATE` após o rename; não existe rollback relacional nem compensação completa.

**Correção sugerida**

Usar staging com nome único, verificar o arquivo novo por releitura, atualizar referência em transação e só remover o anterior após commit. Em falha, executar compensação explícita e verificável.

**Regra violada**

Regras sanitizadas: escrita multi-passo usa transação; operação irreversível exige backup/verificação adequada.

### [A-021] Responsavel.aluno_id não possui integridade referencial
- **Arquivo:** `SAGE-API/database/sage.sql:138-142`; `SAGE-API/src/utils/people-db-utils.js:112-119`; `SAGE-API/src/services/exportService.js:60-73`
- **Severidade:** SEV3
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**

`Responsavel.aluno_id` é gravado como inteiro, mas a tabela declara FK somente de `Responsavel.id` para `Pessoa.id`. O vínculo com `Aluno` não é validado pelo banco.

**Evidência**
```sql
CREATE TABLE IF NOT EXISTS Responsavel (
    id INT PRIMARY KEY,
    aluno_id INT,
    FOREIGN KEY (id) REFERENCES Pessoa(id) ON DELETE CASCADE
);
```

**Impacto no dado**

É possível persistir responsável ligado a ID inexistente ou a uma pessoa que não é aluno. O export faz `LEFT JOIN Pessoa` e materializa o vínculo inválido como aluno ausente, ocultando a corrupção em vez de rejeitá-la.

**Como reproduzir**

Análise estática: `criarResponsavel` aceita `dados.aluno_id` e insere sem consulta; como não há FK nessa coluna, um ID arbitrário é aceito.

**Correção sugerida**

Validar o vínculo no serviço e adicionar FK para `Aluno(id)` com política de exclusão definida pelo domínio. Antes da constraint, diagnosticar e corrigir órfãos sem inventar associações.

**Regra violada**

Regra sanitizada: nunca inventar dado.
