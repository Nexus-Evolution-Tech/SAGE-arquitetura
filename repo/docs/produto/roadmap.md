# SAGE — Roadmap Mestre

> Este documento manda nos pacotes de trabalho, na ordem e nos critérios de aceite. Se
> algo aqui conflitar com outro documento técnico, este vence — exceto ADRs, que
> registram decisão de arquitetura já tomada e valem por si.
>
> Commitar em `docs/produto/` (este documento) e `docs/arquitetura/` (documentos
> técnicos) antes de qualquer agente começar a trabalhar.

Índice de todos os documentos do projeto: [`docs/README.md`](../README.md).

O que o SAGE é e por que existe está em [`visao.md`](./visao.md). O pedido original da
secretaria, requisito por requisito, está em [`requisitos.md`](./requisitos.md). Este
documento cobre só a execução: fases, pacotes de trabalho, ordem e critérios de aceite.

**Correção importante:** [`../arquitetura/sincronizacao.md`](../arquitetura/sincronizacao.md)
recomenda catraca permissiva. Isso vale para **entrada**. Para **saída de menor**, vale
o oposto — ver [ADR-0005](../adr/0005-postura-de-falha-por-fluxo.md).

---

## 1. Decisões de arquitetura

As decisões que valem para todo o projeto viraram ADRs individuais em `docs/adr/`.
Leia todas antes de tocar em qualquer fluxo de autorização ou sincronização com a
catraca:

- [ADR-0005 — Postura de falha por fluxo](../adr/0005-postura-de-falha-por-fluxo.md)
- [ADR-0006 — O bloqueio é controle administrativo, não barreira física](../adr/0006-bloqueio-e-controle-administrativo.md)
- [ADR-0007 — Dado com peso legal exige auditoria](../adr/0007-dado-com-peso-legal.md)
- [ADR-0008 — Política mora no SAGE, identidade mora na catraca](../adr/0008-politica-no-sage-identidade-na-catraca.md)

A regra de ouro que atravessa todas: **o SAGE é sempre quem libera, nunca quem
bloqueia.** Se o SAGE cair, o mundo fica no estado seguro por padrão.

---

## 2. Como a operação funciona

**Papéis:**

- **Arquiteto (Claude/Opus):** define o quê e o porquê, escreve as especificações,
  revisa a entrega. Não escreve código de produção.
- **Implementador (GPT):** executa a especificação. Não decide arquitetura. Em dúvida,
  pergunta em vez de inventar.
- **Revisor (Claude Code + Opus):** confere a entrega contra os critérios de aceite
  antes do merge.
- **Você:** dono do produto. Decide prioridade, negocia com a escola, aprova o merge.

**Estratégia de branches:**

```
main                    ← protegida, só recebe merge revisado
 ├── docs/arquitetura   ← PRIMEIRO PASSO: commitar todos os documentos técnicos
 ├── docs/produto       ← commitar visão, requisitos e roadmap
 ├── wp/00-emergencia   ← correções que não podem esperar
 ├── wp/01-seguranca
 ├── wp/02-observabilidade
 └── ...                ← uma branch por pacote, um PR por branch
```

**Ciclo de cada pacote:**

1. Você abre a issue do pacote (template "Pacote de trabalho") e a branch
   correspondente
2. O agente implementador lê a issue e implementa, abrindo PR
3. O revisor confere contra os critérios de aceite
4. Você traz o diff + saída dos testes de volta para mim
5. Eu reviso arquitetura, segurança e comportamento em falha
6. Merge

**Regra que economiza muito retrabalho:** um pacote por vez. Não paralelize antes da
Fase 2 — os pacotes iniciais mexem nas mesmas fundações e vão gerar conflito.

---

## 3. As fases

```
FASE 0  Parar o sangramento           ██                    3-5 dias
FASE 1  Confiar no dado               ████████              2-3 semanas
FASE 2  Enxergar de longe             ████                  1-2 semanas
FASE 3  O que a secretaria pediu      ████████████          4-6 semanas
FASE 4  Autorização em tempo real     ████████              3-4 semanas
FASE 5  Empacotar e distribuir        ████████              3-4 semanas
FASE 6  Inteligência                  ████████████          contínuo
```

Estimativas para uma pessoa orquestrando agentes. Otimista se a catraca cooperar,
pessimista se não.

---

## FASE 0 — Parar o sangramento

**Por que primeiro:** existem bugs em produção corrompendo dado em silêncio. Qualquer
feature construída em cima de dado errado nasce errada.

### WP-00a — Harness de teste `[PRÉ-REQUISITO DE TUDO]`

**Por que primeiro:** o WP-00 exige "teste de regressão que falha antes e passa
depois" em sete bugs. Hoje não existe infraestrutura para isso — sem banco de teste,
sem seed, sem stub da catraca. Mandar o agente atacar os bugs agora produz um de dois
resultados: ele diz que não consegue testar, ou inventa um teste que não exercita o
caminho real e passa por vacuidade. Você ganha um check verde que não prova nada.

O prompt deste pacote está na issue correspondente.

**Critérios de aceite:**
- [ ] `npm ci && npm run test:db:setup && npm test` funciona numa máquina limpa
- [ ] `test:db:setup` recusa rodar se `DB_NAME` não terminar em `_teste`
- [ ] Seed não contém nenhum dado que possa ser de pessoa real
- [ ] Stub responde os sete modos de falha
- [ ] `test:redacao` reprova quando um CPF sintético atravessa o logger
- [ ] CI verde no workflow `.github/workflows/ci.yml`

---

### WP-00 — Correções de emergência

O prompt deste pacote está na issue correspondente. Cobre sete bugs no repositório
SAGE-API: offset divergente entre módulos, argumentos trocados na edição de catraca,
falha reportada como sucesso, fila de sincronização pendente desligada, recursão por
dependência circular, blocos `catch` vazios e tipo errado de argumento na exclusão de
cartão. Cada um em commit separado, com teste que reproduz a falha antes da correção.

**Critérios de aceite:**
- [ ] Teste que prova: offset é o mesmo nos dois módulos, com e sem variável de
  ambiente
- [ ] Teste que prova: pendente de UPDATE preserva o QR original
- [ ] Teste que prova: falha na edição retorna `sucesso: false`
- [ ] Teste que prova: pendente é gravado quando a sessão falha
- [ ] Nenhum `catch` vazio no diretório `src/` (verificável por lint)
- [ ] `obterSessao` não chama `verificarSyncPendentes`

**Ação imediata sua, hoje:** confira o `.env` da máquina da escola. Se
`CATRACA_USER_ID_OFFSET` não estiver definido, os logs já estão sendo atribuídos
errado. Anote qual valor está lá antes de mudar qualquer coisa.

---

## FASE 1 — Confiar no dado

**Por que agora:** os pilares 3 e 4 são interpretação. Interpretação de dado errado
produz folha de ponto errada, que vira problema trabalhista.

### WP-01 — Segurança de acesso

Autorização por perfil, fail-closed nos diagnósticos, volta ao Knex (transações), rate
limit, cookie httpOnly. Detalhes em [`../operacao/instalacao.md`](../operacao/instalacao.md), WP-0.

> Hoje qualquer token válido apaga qualquer pessoa. Antes de expor mais
> funcionalidade, feche isso.

### WP-02 — Modelo de presença auditável

Implementa o modelo de presença conforme ADR-0007 (registro imutável + correção
rastreável): tabela `RegistroPresenca` com origem, correção sempre em novo registro
que aponta para o anterior, view de versão vigente, e índices para as consultas de
relatório. O prompt deste pacote está na issue correspondente.

**Critérios de aceite:**
- [ ] Teste: UPDATE ou DELETE em `RegistroPresenca` é rejeitado
- [ ] Teste: correção cria novo registro e a view retorna a versão vigente
- [ ] Teste: correção sem justificativa é rejeitada
- [ ] Consulta de 12 meses de uma pessoa responde em < 500 ms com 500 mil registros

### WP-03 — Pareamento entrada/saída `[SUBESTIMADO]`

> **Este é o pacote que mais gera bug em sistema de presença.** O mundo real não
> coopera: pessoa entra e não sai (foi embora pelo portão aberto no evento), sai sem
> ter entrado, passa duas vezes, a catraca perde um giro, alguém carona atrás de
> outro.

Pareia registros em jornadas diárias, tratando explicitamente os casos degenerados
(entrada sem saída, saída sem entrada, entrada duplicada, saída duplicada, intervalo
implausível). Nunca inventa dado — órfão vira pendência para a secretaria resolver
manualmente, nunca um horário estimado. O prompt deste pacote está na issue
correspondente.

**Critérios de aceite:**
- [ ] Teste para cada um dos cinco casos degenerados
- [ ] Teste: nenhum horário é inventado ou estimado em nenhum caminho
- [ ] Teste: dia com 200 pessoas e 600 eventos é pareado em < 2 s
- [ ] Pendências aparecem no dashboard com contagem

### WP-04 — Reconciliação com a catraca

Conforme [`../arquitetura/sincronizacao.md`](../arquitetura/sincronizacao.md), reduzido
ao escopo do [ADR-0008](../adr/0008-politica-no-sage-identidade-na-catraca.md): usuários,
cartões, QR, grupos. Inclui tabela de mapeamento com hash de estado, escrita
idempotente via `create_or_update_objects`, teto de segurança para remoções, e
sincronização do relógio da catraca.

---

## FASE 2 — Enxergar de longe

Sem isso você entrega features às cegas. Detalhes em
[`../operacao/manutencao-remota.md`](../operacao/manutencao-remota.md).

### WP-05 — Telemetria

Redação de PII com teste que reprova vazamento, Winston → Grafana, Sentry com
`beforeSend`, heartbeat nos três checks, indicador de status legível ao telefone.

### WP-06 — Support bundle e catálogo de erros

Conforme [`../operacao/diagnostico.md`](../operacao/diagnostico.md),
Parte 2. Códigos de erro estáveis, identificador de ocorrência na tela, bundle
determinístico com manifesto.

---

## FASE 3 — O que a secretaria pediu

Aqui o produto aparece. Cada pacote entrega algo que ela usa no mesmo dia. Ver
[`requisitos.md`](./requisitos.md) para o pedido original por trás de cada um.

### WP-07 — Folha de presença de alunos

Presença por aula, cruzando jornada com grade horária. Falta, atraso, saída
antecipada. Exportação. Correção manual com justificativa.

### WP-08 — Folha de ponto de funcionários

Jornada diária, totais, atraso, saída antecipada.

**Modelo: atestação com humano no circuito.** O sistema propõe, a secretaria confirma,
a responsabilidade é dela. O SAGE é instrumento de apoio, não autor da folha.

**Fluxo obrigatório — nesta ordem:**

```
1. Sistema calcula a jornada a partir dos registros pareados (WP-03)
2. Secretaria revisa NO SISTEMA e corrige o que precisar,
   com justificativa (WP-02 registra quem/quando/por quê)
3. Pendências de pareamento BLOQUEIAM o fechamento
4. Secretaria fecha o período  →  dados congelados
5. .docx é gerado A PARTIR do período fechado
```

**A regra que não pode ser invertida:** o `.docx` é fotografia de algo já confirmado,
nunca a planilha de trabalho. Se ela editar no Word, perde-se a trilha de auditoria, o
documento seguinte regenera sem as correções, e passam a existir duas versões da
verdade.

**Fechamento de período:**
- Período fechado é imutável
- Reabertura exige justificativa e fica registrada
- Relatório de período reaberto indica que houve reabertura

**O documento gerado carrega:**
- Período, data de geração, quem fechou, código de referência
- Marcação visual das linhas que sofreram correção manual
- Marca d'água **"RASCUNHO — NÃO CONFIRMADO"** em qualquer geração antes do fechamento

**Antes de implementar, confirmar com a escola** (ver decisões em aberto em
[`requisitos.md`](./requisitos.md)):
- [ ] Existe formato obrigatório de folha de ponto do Centro Paula Souza? Se sim,
  gerar por template `.dotx` batendo com o oficial
- [ ] O funcionário assina também? Muda o layout (linha de ciência)
- [ ] Qual o ciclo de fechamento — mensal, quinzenal?

**Atenção — não implemente cálculo de saldo legal.** Banco de horas, hora extra e
compensação têm regra trabalhista e convenção coletiva. Entregue registro fiel e
totais brutos. Cálculo de saldo só com alguém de RH validando a regra por escrito.

**Critérios de aceite:**
- [ ] Teste: período com pendência de pareamento não fecha
- [ ] Teste: período fechado rejeita alteração de registro
- [ ] Teste: reabertura exige justificativa e é registrada
- [ ] Teste: geração antes do fechamento sai com marca d'água de rascunho
- [ ] Teste: linha corrigida manualmente aparece marcada no `.docx`

### WP-09 — Histórico da pessoa

A tela que ela descreveu: clicar numa pessoa e ver todos os dias, com filtros por
atraso, saída antecipada, falta. Ordenável, exportável.

### WP-10 — Dashboard estratégico

Faltas do dia, turmas com mais falta, presença por período, pendências de pareamento.
Cada número clicável para a lista que o origina.

### WP-11 — Detecção de padrão

O caso que ela deu: "esse funcionário atrasa toda sexta". Agrupamento por dia da
semana, por período, com destaque de recorrência.

> **Cuidado de produto:** isso vira insumo de decisão disciplinar sobre pessoas.
> Mostre o dado e deixe a conclusão para o humano. Nada de "risco" ou pontuação
> automática de pessoas.

---

## FASE 4 — Autorização em tempo real

**A parte de maior valor e maior risco.** Não comece sem o
[ADR-0006](../adr/0006-bloqueio-e-controle-administrativo.md) resolvido.

### WP-12 — Análise de viabilidade `[FAZER PRIMEIRO]`

Antes de qualquer código:

- [ ] Confirmar liberação de emergência da catraca (físico, testado)
- [ ] Confirmar se o modelo suporta modo Pro / autorização remota
- [ ] Medir latência da decisão: quanto tempo entre o giro e a resposta do servidor?
- [ ] Definir com a direção, por escrito: o que acontece quando o SAGE está fora do ar
- [ ] Definir quem pode aprovar saída de menor e como isso é registrado

Sem esses cinco, a fase não começa.

### WP-13 — Saída de menor com aprovação

Menor tenta sair em horário de aula → catraca bloqueia → SAGE notifica a secretaria em
tempo real (você já tem socket.io) → ela aprova ou nega → aprovação libera a saída →
tudo registrado com quem aprovou e quando.

**Fora do ar = bloqueado.** Nunca o contrário.

### WP-14 — Visitantes

Cadastro temporário, aprovação, validade, expiração automática, registro de quem
autorizou.

### WP-15 — Exceções programadas

Liberar turma por passeio, dia sem aula, evento aberto ao público. Com validade,
escopo e registro de quem programou.

---

## FASE 5 — Empacotar e distribuir

Conforme [`../operacao/instalacao.md`](../operacao/instalacao.md): MySQL
embarcado, preflight, instalador, updater com rollback, landing page, assinatura
SignPath.

**Fazer hoje, fora de ordem:** submeter o pedido ao SignPath Foundation. Leva semanas e
não pode ser o gargalo do fim.

---

## FASE 6 — Inteligência

### WP-16 — Montagem assistida de grade

O que você já tem (bloquear professor em dois lugares, tratar turma partida em A/B) é
validação de conflito e está certo.

**Sobre a grade automática:** montar horário escolar completo é um problema de
satisfação de restrições, NP-difícil, e é uma área de pesquisa com décadas de
literatura. Não trate como "mais uma feature".

O caminho realista, em ordem:
1. Validação de conflito em tempo real (você já tem)
2. Sugestão de encaixe: dado um vazio, quais professores cabem ali
3. Preenchimento assistido: o sistema propõe, o humano aceita ou recusa
4. Só então, se ainda fizer sentido, otimização automática completa

Os passos 2 e 3 entregam quase todo o valor com uma fração do custo. O 4 pode nunca
ser necessário.

### WP-17 — Múltiplos dispositivos

A arquitetura já suporta (`Dispositivo` é tabela). O trabalho real é a interface e a
modelagem de áreas. Depende de parceria com o CPS — não invista antes de existir.

---

## 4. Interface

Repensar a interface por completo é trilha paralela a partir da Fase 3, não pacote
único no fim.

O princípio: **a tela inicial responde três perguntas antes de qualquer clique** —
está tudo funcionando? o que precisa da minha atenção agora? como foi hoje? Todo o
resto é navegação.

O que a secretaria descreveu é, essencialmente, um sistema de **perguntas sobre
pessoas e tempo**. Se cada número do dashboard for clicável e levar à lista que o
originou, e cada lista for filtrável pelos mesmos critérios, ela consegue responder
perguntas que ninguém antecipou. Isso vale mais que dez telas específicas.

---

## 5. Primeiros três passos, concretamente

1. **Hoje:** commitar todos os documentos em `docs/arquitetura/` e `docs/produto/` na
   `main`. Sem isso os agentes trabalham sem contexto.
2. **Hoje:** verificar o `CATRACA_USER_ID_OFFSET` no `.env` da escola e anotar o valor
   atual.
3. **Esta semana:** branch `wp/00-emergencia`, abrir a issue do WP-00, revisar, merge.

Depois disso, um pacote por vez, na ordem. Quando trouxer o PR de volta, traga o diff,
a saída dos testes e uma nota do que foi decidido diferente — encurta muito a revisão.

---

## 6. O que eu quero que você tenha em mente

O escopo que a secretaria descreveu é grande, e dá vertigem quando visto de uma vez.
Mas repare: **a Fase 3 inteira só depende de ter registro fiel.** Não depende da
catraca fazer nada inteligente, não depende do instalador, não depende de autorização
em tempo real.

Se as fases 0 e 1 forem bem feitas, a secretaria já ganha folha de ponto, folha de
presença, histórico e dashboard — que é a maior parte do que ela pediu. O resto é
incremento sobre uma base que funciona.

Comece pelo registro fiel. Todo o resto é consequência.
