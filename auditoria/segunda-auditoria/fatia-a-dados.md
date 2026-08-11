# Fatia A — camada de dados

## Cobertura

Análise estática da camada de persistência do `SAGE-API`: `src/config/queryBuilder.js`, `database.js`, serviços e utilitários que escrevem dados, controllers genéricos e de relatório, `database/sage.sql` e SQLs versionados. As linhas citadas foram relidas no código atual. Não foi usado dado do ambiente da escola e nenhum valor de seed, `.env`, endereço, nome de escola, credencial ou PII foi reproduzido.

## Resumo por severidade

| Severidade | Quantidade |
|---|---:|
| SEV1 | 1 |
| SEV2 | 12 |
| SEV3 | 1 |
| SEV4 | 0 |
| **Total** | **14** |

### [A-01] Chaves recebidas pelo CRUD viram identificadores SQL sem escape

- **Arquivo:** `SAGE-API/src/config/queryBuilder.js:96-103`; `SAGE-API/src/utils/generic-db-utils.js:15-38`
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O builder interpola coluna e direção de ordenação; os utilitários genéricos interpolam nomes obtidos de `Object.keys(dados)`. Placeholders protegem valores, não identificadores.

**Evidência sanitizada real**
```js
sql += ` ORDER BY ${this.orderBys.map(o => `${o.column} ${o.direction}`).join(', ')}`;
const campos = Object.keys(dados);
const query = `INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${placeholders})`;
```

**Impacto no dado**
Entrada hostil pode alterar a estrutura do SQL e ler ou modificar dados fora do campo pretendido. O alcance concreto depende do controller que encaminha o corpo.

**Como reproduzir**
Análise estática: seguir as chaves do corpo do CRUD genérico até `criarRegistro`/`atualizarRegistro`.

**Correção sugerida**
Adotar builder que escape identificadores e allowlist explícita de colunas, operadores e ordenações por entidade.

**Regra violada**
ADR-0010; identificador originado no cliente não pode ser interpolado em SQL.

### [A-02] Pessoa, vínculos de subtipo e outbox são confirmados sem transação comum

- **Arquivo:** `SAGE-API/src/services/peopleService.js:83-111`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
A pessoa-base, `Funcionario`, o subtipo e a pendência de sincronização são escritos em chamadas independentes ao pool.

**Evidência sanitizada real**
```js
const pessoa = await criarPessoaBase({ /* campos da pessoa */ });
if (tiposFuncionario.includes(tipo)) await criarFuncionarioBase(idPessoa, camposExtras);
case 'ALUNO': await criarAluno(idPessoa, camposExtras); break;
await registrarSyncPendente(idPessoa, 'CREATE');
```

**Impacto no dado**
Falha intermediária deixa discriminador sem linha filha ou cadastro local sem outbox, produzindo pessoa incompleta ou divergente da catraca.

**Como reproduzir**
Em banco sintético, induzir falha no insert do subtipo ou da fila depois de criar `Pessoa`.

**Correção sugerida**
Executar pessoa-base, vínculos e outbox na mesma transação e validar o payload antes da primeira escrita.

**Regra violada**
Escrita multi-passo deve ser atômica ou compensável; ADR-0009.

### [A-03] Importação confirma linhas parciais e chama contrato de sincronização inexistente

- **Arquivo:** `SAGE-API/src/services/importService.js:6`; `SAGE-API/src/services/importService.js:258-269`; `SAGE-API/src/services/sync.js:91`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`sync.js` exporta uma única função, mas `importService` tenta desestruturar duas funções nomeadas. Após criar uma pessoa, a chamada inexistente falha; o catch registra erro e continua o lote, sem rollback.

**Evidência sanitizada real**
```js
const { registrarSyncPendente, registrarSyncPendentesEmLote } = require('./sync');
const criado = await peopleService.criarPessoaCompleta(payload);
await registrarSyncPendentesEmLote(pessoaId, dispositivosParaSync, 'CREATE');
// sync.js
module.exports = registrarSyncPendente;
```

**Impacto no dado**
O importador pode informar erro para linha já gravada, continuar com as demais e deixar cadastros sem o contrato de sincronização esperado. Reexecuções encontram estado parcial.

**Como reproduzir**
Importar planilha sintética com ao menos uma pessoa e dispositivo destinado a sync; observar `registrarSyncPendentesEmLote` indefinido depois do commit local.

**Correção sugerida**
Definir uma API única e testada para outbox e executar validação, importação e enfileiramento numa fronteira transacional explícita.

**Regra violada**
ADR-0010; escrita em massa deve ser transacional; falha parcial não pode ser reportada como conclusão normal.

### [A-04] Segundo acesso do dia sobrescreve a chegada original

- **Arquivo:** `SAGE-API/src/services/presenceService.js:148-181`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Existe no máximo uma linha de presença por pessoa e data. Todo acesso posterior executa `UPDATE horario_chegada`, sem distinguir entrada de saída nem preservar o primeiro fato.

**Evidência sanitizada real**
```js
const [registros] = await db.query(
  'SELECT id FROM Presenca WHERE pessoa_id = ? AND data = ?', [pessoa_id, dataAcesso]
);
// se existir:
UPDATE Presenca SET horario_chegada = ?, atrasado = ? WHERE id = ?
```

**Impacto no dado**
Uma saída pode substituir a chegada e recalcular atraso/aulas perdidas com o horário errado, afetando presença e folha de ponto sem deixar trilha do valor anterior.

**Como reproduzir**
Registrar dois acessos sintéticos da mesma pessoa no mesmo dia, um na entrada e outro na saída; consultar `Presenca` após o segundo.

**Correção sugerida**
Persistir eventos imutáveis e derivar entrada/saída por regra explícita; nunca reutilizar o segundo evento como nova chegada.

**Regra violada**
ADR-0007; o fato original não pode ser sobrescrito.

### [A-05] Modelo de presença imutável não existe e a API oferece edição e exclusão

- **Arquivo:** `SAGE-API/database/sage.sql:125-136`; `SAGE-API/src/controllers/presenceController.js:1-6`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
`Presenca` não registra origem, autor, justificativa ou fato corrigido. O controller genérico expõe o conjunto padrão de CRUD sobre a tabela.

**Evidência sanitizada real**
```sql
CREATE TABLE IF NOT EXISTS Presenca (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pessoa_id INT NOT NULL,
  data DATE NOT NULL,
  horario_chegada TIME
);
```
```js
module.exports = gerarController(tabela, campos, 'presenca');
```

**Impacto no dado**
Fatos com peso administrativo podem ser editados ou apagados sem cadeia auditável; correção retroativa não é distinguível de adulteração.

**Como reproduzir**
Análise estática do schema e das rotas geradas para `presenceController`.

**Correção sugerida**
Implementar ledger append-only, autoria, motivo, vínculo de correção e view da versão vigente; proibir `UPDATE`/`DELETE` dos fatos.

**Regra violada**
ADR-0007.

### [A-06] “Começar do zero” apaga a catraca e o banco local sem transação ou backup restaurado-prova

- **Arquivo:** `SAGE-API/src/controllers/deviceController.js:522-559`; `SAGE-API/src/services/deviceService.js:338-358`
- **Severidade:** SEV1
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O fluxo esvazia objetos da catraca e depois executa uma sequência de deletes locais em autocommit. Não exige backup completo validado nem oferece compensação da catraca.

**Evidência sanitizada real**
```js
const result = await deviceService.zerarTudoNaCatraca(dispositivo);
await db.query('DELETE FROM Presenca');
await db.query('DELETE FROM Acesso');
const [r] = await db.query('DELETE FROM Pessoa');
```

**Impacto no dado**
Pode deixar a catraca inteira vazia — ninguém entra — e o banco parcialmente apagado. Presença, acessos e cadastros podem ser irrecuperáveis.

**Como reproduzir**
Em equipamento e banco descartáveis, chamar `comecar-do-zero` com as flags de remoção e induzir falha entre dois deletes.

**Correção sugerida**
Bloquear o fluxo até existir autorização forte, backup completo restaurado-prova, transação local e plano de compensação/reprovisionamento verificado.

**Regra violada**
Operação irreversível exige backup verificado; escrita multi-passo deve ser atômica; ADR-0007.

### [A-07] Outbox é melhor esforço e não há reconciliação de estado desejado versus observado

- **Arquivo:** `SAGE-API/src/services/sync.js:5-88`; `SAGE-API/src/jobs/scheduledJobs.js:94-198`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Falha ao registrar pendência é engolida. O job só processa linhas existentes; não compara periodicamente pessoas, credenciais e regras do SAGE com o estado real de cada equipamento.

**Evidência sanitizada real**
```js
} catch (err) {
  logger.errorWithStack('Erro ao registrar sync pendente', err);
}
```

**Impacto no dado**
Uma mutação local pode nunca chegar à catraca e permanecer divergente indefinidamente, inclusive autorização indevida ou recusa de uma pessoa.

**Como reproduzir**
Falhar o insert em `sync_pendente`; depois restaurar o banco e executar os jobs. Nenhum job recria a pendência ausente por comparação de estados.

**Correção sugerida**
Tornar outbox atômica com a mutação e implementar reconciliação idempotente por dispositivo, com mapa persistente e diferenças observáveis.

**Regra violada**
ADR-0009 — reconciliação, não fila como única fonte de verdade.

### [A-08] Índices e predicados dos relatórios anuais são incompatíveis

- **Arquivo:** `SAGE-API/database/sage.sql:125-136`; `SAGE-API/src/controllers/relatorioController.js:855-868`
- **Severidade:** SEV3
- **Categoria:** desempenho
- **Depende do ambiente da escola:** SIM
- **Confiança:** média

**Sintoma**
O índice de presença começa por `data`, enquanto o relatório filtra primeiro uma pessoa; em acessos, `DATE(a.data_hora)` aplica função sobre a coluna temporal.

**Evidência sanitizada real**
```sql
CREATE INDEX idx_presenca_data_pessoa ON Presenca(data, pessoa_id);
```
```js
WHERE a.pessoa_id = ? AND DATE(a.data_hora) >= ? AND DATE(a.data_hora) <= ?
```

**Impacto no dado**
Não altera registros, mas bases grandes podem exceder a meta de relatório e aumentar contenção do banco.

**Como reproduzir**
Executar `EXPLAIN ANALYZE` com massa sintética representativa, sem dados reais.

**Correção sugerida**
Usar índice iniciado por pessoa e predicados sargáveis de intervalo (`>= início`, `< fim`).

**Regra violada**
ADR-0007 — meta de consulta anual.

### [A-09] A mesma coluna recebe UTC ingênuo e hora serializada pelo pool em UTC−03

- **Arquivo:** `SAGE-API/src/config/database.js:16-23`; `SAGE-API/src/services/accessService.js:337-350`; `SAGE-API/src/services/accessService.js:650-665`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O pool configura fuso UTC−03, mas caminhos da catraca transformam `Date` com `toISOString()` e gravam a string UTC sem marcador em `DATETIME`.

**Evidência sanitizada real**
```js
timezone: process.env.DB_TIMEZONE || '-03:00',
const data_hora_utc = data_hora.toISOString().slice(0, 19).replace('T', ' ');
```

**Impacto no dado**
Eventos equivalentes podem diferir três horas por origem e atravessar a meia-noite, alterando dia de presença, atraso, ordenação e cursor temporal.

**Como reproduzir**
Inserir em banco sintético o mesmo instante pelos caminhos manual e catraca e comparar o `DATETIME` persistido.

**Correção sugerida**
Escolher convenção única e inequívoca, converter somente nas bordas e migrar dados existentes com origem conhecida.

**Regra violada**
ADR-0007; fatos de presença não podem mudar silenciosamente por origem.

### [A-10] Promoção parcial ainda grava o ano como concluído

- **Arquivo:** `SAGE-API/src/services/promocaoAlunosService.js:179-224`; `SAGE-API/src/services/promocaoAlunosService.js:278-294`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** SIM
- **Confiança:** alta

**Sintoma**
Cada aluno é atualizado em autocommit; erros individuais são acumulados e o fluxo ainda chama `atualizarUltimoAnoPromocao`.

**Evidência sanitizada real**
```js
} catch (err) {
  resultado.erros++;
}
const resultado = await executarPromocao(options);
await atualizarUltimoAnoPromocao(anoAtual);
```

**Impacto no dado**
Parte da turma pode avançar e parte permanecer, enquanto o checkpoint impede retomada automática naquele ano.

**Como reproduzir**
Em banco sintético, falhar um update depois de ao menos um aluno promovido e consultar alunos e checkpoint.

**Correção sugerida**
Processar lote e checkpoint numa transação idempotente e não avançar o checkpoint diante de qualquer erro.

**Regra violada**
Escrita multi-passo deve ser atômica; falha parcial não é sucesso.

### [A-11] Substituição de horário fixo apaga antes de validar e pode responder sucesso parcial

- **Arquivo:** `SAGE-API/src/controllers/funcionarioHorarioController.js:53-100`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O endpoint apaga todos os horários, ignora silenciosamente dias/horas inválidos, reinsere um a um e atualiza a flag do professor sem transação.

**Evidência sanitizada real**
```js
await db.query('DELETE FROM FuncionarioHorario WHERE funcionario_id = ?', [funcionarioId]);
if (!DIAS_SEMANA.includes(dia)) continue;
if (!entrada || !saida) continue;
res.json({ message: 'Horários salvos com sucesso', /* ... */ });
```

**Impacto no dado**
Falha ou entrada inválida pode deixar escala vazia/parcial e ainda concluir; presença e atraso de funcionário passam a usar regra divergente.

**Como reproduzir**
Enviar lista com um item válido seguido de inválido, ou induzir falha no segundo insert após o delete.

**Correção sugerida**
Validar a lista inteira e substituir horários e flag em uma transação única.

**Regra violada**
Escrita multi-passo deve ser atômica; falha parcial não pode virar sucesso.

### [A-12] `Responsavel.aluno_id` não possui integridade referencial

- **Arquivo:** `SAGE-API/database/sage.sql:138-142`; `SAGE-API/src/utils/people-db-utils.js:112-119`
- **Severidade:** SEV2
- **Categoria:** dado
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
O schema cria FK apenas para `Responsavel.id`; `aluno_id` é um inteiro sem FK, e o utilitário o grava diretamente.

**Evidência sanitizada real**
```sql
CREATE TABLE IF NOT EXISTS Responsavel (
  id INT PRIMARY KEY,
  aluno_id INT,
  FOREIGN KEY (id) REFERENCES Pessoa(id) ON DELETE CASCADE
);
```

**Impacto no dado**
Um responsável pode apontar para ID inexistente ou pessoa que não é aluno, contaminando exportações e vínculos familiares.

**Como reproduzir**
Em banco sintético, inserir `Responsavel` com `aluno_id` inexistente; o schema não rejeita.

**Correção sugerida**
Diagnosticar órfãos, validar o domínio e adicionar FK para `Aluno(id)` com política de exclusão explícita.

**Regra violada**
Nunca inventar vínculo de domínio; integridade deve ser garantida no banco.

### [A-13] Evento anual referencia variáveis locais fora do escopo da procedure

- **Arquivo:** `SAGE-API/database/sage.sql:321-378`
- **Severidade:** SEV2
- **Categoria:** confiabilidade
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
As variáveis são declaradas dentro da procedure, mas o corpo do evento tenta lê-las depois de `CALL`, fora daquele escopo. O bloco também não restabelece delimitador próprio antes do evento.

**Evidência sanitizada real**
```sql
CREATE PROCEDURE atualizar_turmas_e_status()
BEGIN
  DECLARE v_atualizados INT DEFAULT 0;
END $$
DELIMITER ;
CREATE EVENT atualizar_ou_desligar_alunos
DO BEGIN
  CALL atualizar_turmas_e_status();
  SELECT CONCAT('Alunos atualizados: ', v_atualizados);
END$$
```

**Impacto no dado**
Instalação limpa pode falhar após DDL parcial e a automação anual pode não existir, deixando schema/rotina divergentes do esperado.

**Como reproduzir**
Executar o baseline em MySQL descartável e verificar criação da procedure/evento e erro de variável/delimitador.

**Correção sugerida**
Levar a rotina a migration versionada, devolver contagens por contrato válido e testar fresh install em MySQL real.

**Regra violada**
Falha parcial de instalação não pode ser tratada como baseline concluído; ADR-0011.

### [A-14] SQL versionado contém endereço e credencial operacional reutilizável

- **Arquivo:** `SAGE-API/database/dados_*.sql:29-30` (dois arquivos; nomes sanitizados porque identificam a escola)
- **Severidade:** SEV2
- **Categoria:** segurança
- **Depende do ambiente da escola:** NÃO
- **Confiança:** alta

**Sintoma**
Dois arquivos versionados inserem `endereco`, `usuario` e `senha` de dispositivo junto com dados de seed. Os valores reais foram deliberadamente omitidos desta auditoria.

**Evidência sanitizada real**
```sql
INSERT INTO sage.dispositivo
  (nome, modelo, endereco, porta, usuario, senha, numero_serial)
VALUES
  ([VALORES REMOVIDOS DA EVIDÊNCIA]);
```

**Impacto no dado**
Quem obtiver o histórico do repositório pode recuperar localização de rede e segredo reutilizável do equipamento, permitindo consulta ou alteração de dados da catraca.

**Como reproduzir**
Análise estática somente da lista de colunas e presença de literais; não copiar nem testar os valores.

**Correção sugerida**
Remover dados reais do histórico com procedimento coordenado, rotacionar credenciais, separar fixtures sintéticas e manter segredos fora do repositório.

**Regra violada**
Nunca versionar, registrar ou reproduzir credencial, endereço interno ou dado real.

## Duplicatas e consolidações

- A-03 é o achado primário da quebra de contrato em `importService`; B-08 apenas amplia a evidência pelo território de sincronização.
- A-06 registra a perda transacional local; a capacidade destrutiva e a janela operacional são consolidadas em B-12 e B-23.
- A-07 registra o efeito da outbox na camada de dados; B-10 é o achado primário da ausência de reconciliação com a catraca.
- A-04 e A-05 são distintos: o primeiro é a sobrescrita concreta de chegada; o segundo é a ausência estrutural do ledger e a superfície de edição/exclusão.

## Nada encontrado

- Não foi encontrada dependência de Knex na camada auditada; portanto não há uso parcial correto de Knex a registrar — o problema aplicável está consolidado em A-01.
- Não foi encontrada FK para `Responsavel.aluno_id`, ledger append-only de presença, transação abrangendo pessoa+subtipo+outbox ou reconciliação persistente; essas ausências já estão catalogadas, respectivamente, em A-12, A-05, A-02 e A-07.
- Não foram reproduzidos valores dos SQLs de dados, dumps, `.env` ou do ambiente da escola.
