# SAGE — Modelo de presença

Como o SAGE registra entrada e saída, por que o registro é imutável, e como registros brutos viram jornadas confiáveis sem nunca inventar um horário.

---

## 1. `RegistroPresenca` — o fato imutável

Cada giro de catraca, lançamento manual ou correção vira uma linha em `RegistroPresenca`. A tabela nunca é atualizada nem apagada — uma correção é sempre um novo registro que aponta para o que ela substitui.

### Campos

| Campo | Tipo | Observação |
|---|---|---|
| `pessoa_id` | INT | Quem |
| `dispositivo_id` | INT | Qual catraca gerou (nulo se `origem = MANUAL`) |
| `momento` | DATETIME | Quando |
| `sentido` | ENUM(`ENTRADA`, `SAIDA`) | Direção do movimento |
| `origem` | ENUM(`CATRACA`, `MANUAL`, `CORRECAO`, `IMPORTACAO`) | De onde o registro veio |
| `log_catraca_id` | INT, nullable | Referência ao log bruto da catraca, quando `origem = CATRACA` |
| `registro_corrigido_id` | INT, nullable | Aponta para o registro que esta linha substitui, quando `origem = CORRECAO` |
| `criado_por` | INT | Quem gravou esta linha no sistema |
| `criado_em` | DATETIME | Quando esta linha entrou no banco (não confundir com `momento`) |
| `justificativa` | TEXT, nullable | Obrigatório quando `origem = CORRECAO` |

### Índices

Para as consultas de relatório e histórico:

- `(pessoa_id, momento)`
- `(momento, sentido)`
- `(dispositivo_id, momento)`

Meta de desempenho: consulta de 12 meses de uma pessoa responde em menos de 500 ms com 500 mil registros na tabela.

### Regras invioláveis

- **`UPDATE` e `DELETE` são rejeitados.** Corrigir é inserir um novo registro com `origem = CORRECAO` e `registro_corrigido_id` apontando para o anterior.
- **Toda correção exige `criado_por` e `justificativa`.** Correção sem justificativa é rejeitada na escrita, não só na revisão.
- **Consultas usam uma view**, não a tabela crua. A view resolve a cadeia de correções e retorna, para cada fato, apenas a versão vigente — a correção mais recente daquela cadeia. Código de relatório nunca deveria fazer essa resolução na mão.

### Por que imutável

Folha de ponto afeta salário. Folha de presença afeta registro escolar. Um registro que pode ser silenciosamente sobrescrito apaga a prova de que algo diferente estava lá antes — o que é inaceitável nos dois casos. A decisão e o raciocínio completo estão em **[ADR-0007 — Dado com peso legal exige auditoria](../adr/0007-dado-com-peso-legal.md)**.

Consequência direta para quem constrói relatório: todo relatório de período mostra se houve correção naquele período, nunca esconde a cadeia atrás da versão vigente.

---

## 2. Pareamento entrada/saída

Esta é a parte que mais gera bug em sistema de presença, porque o mundo real não coopera: pessoa entra e não sai (foi embora pelo portão aberto num evento), sai sem ter entrado, passa duas vezes seguidas, a catraca perde um giro, alguém segue outro sem crachá-lo (*tailgating*).

O pareamento roda por pessoa e por dia, transformando a sequência de registros em pares (entrada, saída) mais uma lista de eventos órfãos, cada um classificado num destes cinco casos degenerados:

| Caso | Situação |
|---|---|
| `ENTRADA_SEM_SAIDA` | Entrou e não há saída até o fim do dia |
| `SAIDA_SEM_ENTRADA` | Há saída sem entrada anterior naquele dia |
| `ENTRADA_DUPLICADA` | Duas entradas seguidas, sem saída entre elas |
| `SAIDA_DUPLICADA` | Duas saídas seguidas, sem entrada entre elas |
| `INTERVALO_IMPLAUSIVEL` | Permanência menor que 1 minuto ou maior que 16 horas |

### A regra absoluta: nunca inventar horário

Um órfão **nunca** vira par com horário estimado. Não existe "provavelmente saiu ao meio-dia" nem "assumindo entrada às 7h". O órfão fica marcado como **pendência para a secretaria resolver manualmente**, e o relatório mostra a pendência explicitamente em vez de escondê-la atrás de um número que parece completo.

Esta é a regra mais importante do sistema inteiro: preencher uma lacuna com palpite é a falha mais grave possível neste projeto, porque o dado alimenta folha de ponto e registro escolar de menores de idade. Errar por omissão (mostrar a pendência) é recuperável — alguém resolve depois. Errar por invenção (mostrar um horário que não aconteceu) não é: o dado inventado se mistura ao real e não há como distinguir depois qual é qual.

Pendências ficam expostas por `GET /presenca/pendencias`, filtrável por período, turma e tipo, e aparecem com contagem no dashboard.

---

## 3. Fechamento de período

O fluxo, nesta ordem, sem pular etapa:

```
1. Sistema calcula a jornada a partir dos registros pareados (seção 2)
2. Secretaria revisa NO SISTEMA e corrige o que precisar,
   com justificativa (toda correção usa RegistroPresenca/CORRECAO)
3. Pendências de pareamento BLOQUEIAM o fechamento
4. Secretaria fecha o período  →  dados congelados
5. .docx é gerado A PARTIR do período fechado
```

Regras:

- **Pendência bloqueia fechamento.** Um período com `ENTRADA_SEM_SAIDA` ou qualquer outro caso degenerado não resolvido não pode ser fechado. Isso força a resolução antes de o dado virar documento oficial, em vez de depois.
- **Período fechado é imutável.** Nenhuma alteração de registro é aceita dentro de um período fechado.
- **Reabertura exige justificativa** e fica registrada. O relatório de um período que foi reaberto indica isso explicitamente — nunca aparenta ter sido fechado uma vez só.

---

## 4. Como o `.docx` se relaciona com isso

O documento gerado é uma **fotografia de algo já confirmado**, nunca a planilha de trabalho. A relação é de mão única: dado congelado → documento. Nunca o inverso.

Isso significa, concretamente:

- O `.docx` é gerado a partir do período fechado (passo 5 do fluxo acima) — nunca é o lugar onde alguém edita um registro.
- Se a secretaria precisasse editar diretamente no Word, a trilha de auditoria do ADR-0007 se perderia, o próximo documento gerado sobrescreveria a edição sem registro de quem/quando/por quê, e passariam a existir duas versões da verdade — a que está no banco e a que está no arquivo.
- Qualquer geração de documento **antes** do fechamento — para conferência prévia, por exemplo — carrega marca d'água **"RASCUNHO — NÃO CONFIRMADO"**, para que ninguém confunda uma prévia com o documento oficial.
- O documento final carrega período, data de geração, quem fechou, código de referência do fechamento, e marcação visual nas linhas que sofreram correção manual — a mesma informação que o relatório em tela já mostra, só que congelada no formato que a escola precisa entregar.

Esse desenho é o que garante que, um ano depois, alguém consiga reconstruir exatamente por que a folha daquele mês ficou daquele jeito — inclusive as correções — sem depender de memória de ninguém.

---

## Em uma frase

Registro de presença é fato, não interpretação editável: ele nasce imutável, correção é um fato novo que aponta para o anterior, órfão vira pendência para humano em vez de virar palpite, e o documento que a escola assina é sempre a fotografia de um período já fechado — nunca o lugar onde a verdade é escrita pela primeira vez.
