# SAGE — Sincronização com a catraca

Como a catraca e o SAGE se mantêm de acordo sobre quem pode entrar, quando, e por onde — mesmo quando um dos dois está fora do ar.

---

## 1. O que o sistema realmente é

A documentação da Control iD é explícita: em modo **standalone** (o recomendado), *"a comunicação se dará unilateralmente do servidor para cada terminal e deve se preocupar em manter os dados de usuários e regras de acesso atualizados."*

Traduzindo o que isso significa na prática:

> **A catraca é um banco de dados independente que toma decisões sozinha.**
> O SAGE não controla a catraca. O SAGE tenta convencer a catraca a concordar com ele.

Isso não é integração. É **replicação de estado entre dois bancos autônomos**, cada um com esquema próprio, sem transação distribuída, sobre uma rede que cai, com um dos lados desligado toda noite.

Se você reconhecer o problema por esse nome, a literatura inteira de sistemas distribuídos passa a valer — e o principal ensinamento dela é este:

**O inimigo não é a falha. É a divergência silenciosa.**

Falha é boa: você tenta de novo. Divergência é o veneno — a catraca acha que o aluno pode entrar às 22h, o SAGE acha que não, e ninguém descobre até alguém entrar quando não devia, ou ser barrado quando devia entrar. O sistema parece funcionando o tempo todo.

Quase tudo neste documento existe para combater divergência.

---

## 2. O grafo de objetos da Control iD

Para expressar "a turma 1B entra das 7h às 12h30 pela catraca principal", a API da Control iD exige **sete tipos de objeto e quatro tabelas de ligação**:

```
   users ──────── user_groups ──────── groups
                                          │
                                  group_access_rules
                                          │
                                          ▼
   portals ── portal_access_rules ── access_rules
                                          │
                                access_rule_time_zones
                                          │
                                          ▼
                                     time_zones
                                          │
                                          ▼
                                     time_spans
                              (horários, dias da semana, feriados)
```

Mapeando ao domínio do SAGE:

| SAGE | Control iD | Observação |
|---|---|---|
| `Pessoa` | `users` | Resolvido hoje via `CATRACA_USER_ID_OFFSET` |
| `Turma` (1B) | `groups` | Um grupo por turma |
| Aluno pertence à turma | `user_groups` | Ligação |
| Política de entrada | `access_rules` | Uma por perfil de horário |
| Turma tem política | `group_access_rules` | Ligação |
| Grade horária | `time_zones` + `time_spans` | Aqui mora a complexidade real |
| Catraca / porta | `portals` | Lido do equipamento |
| Regra vale nessa porta | `portal_access_rules` | Ligação |

**Consequência prática:** cadastrar um aluno não é uma chamada. É uma sequência ordenada de chamadas com dependências entre si. Cada uma pode falhar sozinha, deixando o aluno num estado inválido — existe na catraca, mas sem grupo, ou com grupo sem regra. Nos dois casos, ele fica de fora no portão.

Isso muda a unidade de trabalho: **o que precisa ser atômico não é a chamada, é a intenção completa** ("matricular aluno X na turma 1B").

> **Escopo real, decidido:** o SAGE não sobe a metade de baixo deste grafo — `access_rules`, `group_access_rules`, `time_zones`, `time_spans`, `portal_access_rules`. Ver **[ADR-0008 — Política mora no SAGE, identidade mora na catraca](../adr/0008-politica-no-sage-identidade-na-catraca.md)**. O grafo acima continua descrito por inteiro porque explica por que a integração é cara, e porque a leitura (`catracaImportService`) ainda precisa entender esses objetos quando alguém os cria à mão pelo software oficial da Control iD. Mas a escrita do SAGE se limita a `users`, cartões (RFID/QR) e `groups`.

---

## 3. As três leis

### Lei 1 — Estado desejado, não fila de eventos

Uma fila de mudanças (`sync_pendente`) só sabe das alterações que ela viu. Ela não sabe de:

- alguém que mexeu na catraca pelo software oficial
- um objeto que sumiu no `destroy_objects`
- uma escrita que a catraca aceitou e depois perdeu
- o que aconteceu enquanto o PC estava desligado

O modelo certo é o de **reconciliação** — o mesmo do Kubernetes:

```
  estado desejado  =  o que o SAGE diz que deveria estar na catraca
  estado observado =  o que está de fato na catraca (lido de lá)

  diferença = desejado − observado
  aplicar(diferença)
  repetir para sempre
```

A fila continua útil como otimização (aplica rápido o que acabou de mudar). Mas quem garante a verdade é o **laço de reconciliação periódico**, que lê a catraca inteira e conserta o que estiver torto. Sem ele, a divergência se acumula em silêncio.

Cadência sugerida: reconciliação completa uma vez por dia, fora do horário letivo, mais uma verificação leve (contagem de objetos por tipo) a cada hora. Se a contagem leve divergir do esperado, dispara a reconciliação completa na hora.

### Lei 2 — Idempotência sempre

`create_objects` chamado duas vezes cria dois objetos. Numa rede que cai no meio de uma requisição, você **não sabe** se ela chegou — e vai reenviar.

A API tem `create_or_update_objects` (*Criar ou Modificar Objetos*). **Use esse, sempre, em vez de `create`.** Toda operação de escrita precisa poder ser repetida sem efeito colateral. Isso sozinho elimina uma classe inteira de bug.

### Lei 3 — Mapa explícito de identidades

Hoje as pessoas são resolvidas por aritmética: `catracaUserId = OFFSET + pessoa.id`. Funciona para `users`, e é engenhoso. Mas não resolve grupos, regras, time_zones e portais — e a reconciliação vai precisar saber qual objeto da catraca corresponde a qual entidade do SAGE.

Crie uma tabela de mapeamento de verdade:

```sql
CREATE TABLE catraca_mapeamento (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  dispositivo_id INT NOT NULL,
  tipo_objeto    VARCHAR(40) NOT NULL,   -- users, groups...
  entidade_sage  VARCHAR(40) NOT NULL,   -- Pessoa, Turma...
  id_sage        INT NOT NULL,
  id_catraca     BIGINT NOT NULL,
  hash_desejado  CHAR(64),               -- do payload que deveria estar lá
  hash_observado CHAR(64),               -- do que foi lido de lá
  sincronizado_em DATETIME,
  UNIQUE KEY (dispositivo_id, tipo_objeto, id_sage),
  UNIQUE KEY (dispositivo_id, tipo_objeto, id_catraca)
);
```

Os dois campos de hash são o coração da detecção de divergência: se `hash_desejado != hash_observado`, aquele objeto está torto e precisa ser reescrito. A comparação é barata e não depende de comparar campo a campo.

---

## 4. Ordem de aplicação

Dependências mandam. Criar na ordem, apagar na ordem inversa:

```
CRIAR / ATUALIZAR              APAGAR (inverso)
 1. time_spans                  1. portal_access_rules
 2. time_zones                  2. access_rule_time_zones
 3. access_rules                3. group_access_rules
 4. access_rule_time_zones      4. user_groups
 5. groups                      5. access_rules
 6. group_access_rules          6. time_zones
 7. portal_access_rules         7. time_spans
 8. users                       8. groups
 9. user_groups                 9. users
10. cards / qrcodes            10. cards / qrcodes (antes de users)
```

> `portals` são lidos do equipamento, nunca criados — eles representam o hardware físico.

O `catracaImportService` já tem `getOrdemImportacaoSage()` para o sentido catraca→SAGE. A ordem acima é a referência completa para o sentido inverso — mas, por conta do [ADR-0008](../adr/0008-politica-no-sage-identidade-na-catraca.md), a implementação atual só precisa cobrir os passos 5 a 10: `groups`, `users`, `user_groups` e `cards/qrcodes`. Os passos 1 a 4 e 6 a 7 ficam documentados aqui para o dia em que a decisão do ADR-0008 for revisitada, não porque o código precise deles hoje.

---

## 5. Divergência: detectar e reparar

O laço de reconciliação, em pseudocódigo:

```
para cada dispositivo:
    observado ← ler todos os tipos de objeto da catraca
    desejado  ← montar a partir do banco do SAGE

    plano = []
    para cada objeto em desejado:
        se não existe em observado          → plano += CRIAR
        senão se hash difere                → plano += ATUALIZAR
    para cada objeto em observado:
        se não existe em desejado
           e está sob gestão do SAGE        → plano += REMOVER

    se plano vazio:
        registrar "convergido", pingar heartbeat de sync
    senão:
        registrar a divergência COM DETALHE
        aplicar plano na ordem de dependência
        reler e confirmar convergência
```

Três detalhes que fazem diferença:

**"Sob gestão do SAGE".** Nunca apague da catraca o que você não criou. Pode haver um cadastro de zelador feito à mão pelo software oficial. Marque o que é seu — o offset dos `users` já faz isso; replique a ideia para `groups`, com prefixo de nome.

**Divergência é evento de log, não rotina silenciosa.** Toda vez que o plano não vier vazio, registre o que estava diferente. Divergência recorrente no mesmo objeto significa que alguma escrita está falhando de forma silenciosa — e essa é a informação mais valiosa que você pode ter.

**Teto de segurança.** Se o plano quiser remover mais que N objetos (digamos, 20% do total), **não execute** — alerte e peça confirmação. Isso protege contra o pior caso possível: um bug no cálculo do estado desejado esvaziando a catraca inteira e trancando a escola.

---

## 6. Estado atual do código

Este documento descreve o desenho correto. O código hoje está longe dele — registrar isso aqui evita que alguém leia as seções acima e assuma que já é assim.

**`controlIdService.js` cria apenas quatro coisas:** usuário, cartão RFID, cartão QR e grupo. Mais nada. Não existe, em nenhum lugar do código, criação de `time_zones`, `time_spans`, `access_rules` ou `group_access_rules`. Isso é consistente com o [ADR-0008](../adr/0008-politica-no-sage-identidade-na-catraca.md) — essa metade do grafo não deveria mesmo subir — mas é coincidência, não decisão registrada até este ADR existir: o código nunca implementou essa parte, e o ADR apenas confirmou depois que não implementar era o caminho certo.

**A fila `sync_pendente` está desligada.** As chamadas a `registrarSyncPendente` estão comentadas em todo o `controlIdService.js`, mas `verificarSyncPendentes` continua lendo a tabela como se ela estivesse sendo alimentada. Na prática, pendências não são gravadas — a rede-de-segurança da Lei 1 (fila como otimização) não existe hoje, e sem o laço de reconciliação completo também não implementado, não há nenhuma malha de proteção contra divergência.

**Falha reportada como sucesso.** `processarEdicaoDispositivo` captura exceção internamente e retorna `{ sucesso: true, aviso: 'Update parcial' }`. Isso viola a Lei 2 e o princípio geral do projeto (falha parcial é falha, nunca sucesso com aviso): uma escrita que falhou fica marcada como concluída, e nada tenta de novo.

**O offset diverge entre módulos.** `controlIdService.js` usa `110000000` como default de `CATRACA_USER_ID_OFFSET`; `deviceController.js` usa `111000000`. Quando a variável de ambiente não está definida, o mesmo `pessoa_id` produz dois `catracaUserId` diferentes dependendo de qual módulo fez a conta — o que faz um log lido da catraca ser atribuído à pessoa errada.

Esses quatro pontos são o conteúdo de WP-00 no roadmap (correções de emergência) e a base de WP-04 (reconciliação, no escopo reduzido do ADR-0008). Nenhuma seção deste documento — laço de reconciliação, mapa de identidades, teto de segurança — existe implementada ainda; tudo isso é o desenho a construir, não o estado atual.

---

## 7. A postura de falha, decidida

O design original deste documento levantava, sem resolver, a pergunta: quando alguém tenta entrar fora do horário e o sistema não pode confirmar a regra a tempo, a catraca deve barrar ou deixar passar e registrar?

Essa decisão foi tomada e está registrada em dois ADRs:

- **[ADR-0005 — Postura de falha por fluxo](../adr/0005-postura-de-falha-por-fluxo.md)** define que não existe uma postura única: entrada de aluno e funcionário libera e registra; saída de menor em horário de aula e entrada de visitante bloqueiam. O SAGE é sempre quem *libera*, nunca quem *bloqueia* — se ele cair, o mundo fica no estado seguro por padrão.
- **[ADR-0006 — Bloqueio e controle administrativo](../adr/0006-bloqueio-e-controle-administrativo.md)** define o que o bloqueio significa na prática: a escola tem uma passagem lateral com segurança, então o bloqueio na catraca não impede fisicamente a saída — ele a torna visível e obriga contato com um humano. Isso simplifica o que a catraca precisa garantir sozinha, porque ela não é a única barreira.

Essas duas decisões definem o modelo de `access_rules` que, quando a decisão do ADR-0008 for revisitada, seria empurrado para a catraca. Qualquer trabalho de sincronização que toque em regra de horário ou postura de falha deve partir desses dois ADRs, não reabrir a discussão.

---

## 8. Três armadilhas específicas deste domínio

### O relógio da catraca

Em standalone, **a catraca aplica as janelas de horário usando o relógio dela**, não o do PC. Se ele derivar cinco minutos, as regras entram em vigor na hora errada. Se derivar horas, o caos é silencioso e total.

A API tem `Alterar data e hora`. Sincronize o relógio da catraca a cada reconciliação, e alerte se o desvio passar de 60 segundos. É barato e evita um bug que seria brutal de diagnosticar remotamente.

### Feriados e calendário escolar

`time_spans` aceita feriados. Escola tem recesso, ponto facultativo, semana de prova, sábado letivo, jogos internos. Se ninguém mantiver esse calendário, o sistema barra alunos num sábado de reposição — ou libera geral num feriado.

Como o ADR-0008 mantém `time_spans` fora da catraca por enquanto, esse risco específico está momentaneamente neutralizado — mas volta a valer no dia em que a política de horário for empurrada para o equipamento. Decida então quem mantém o calendário.

### Limite de capacidade do equipamento

Todo terminal tem teto de usuários, regras e logs. Um modelo antigo pode ter limites baixos, e uma ETEC passa fácil de mil alunos.

**Item obrigatório da visita:** descobrir a capacidade real do equipamento e comparar com o número de alunos. Se estourar, a arquitetura de grupos muda — e é melhor saber antes de escrever o código.

---

## 9. Como testar isso sem o hardware

Este é o tipo de lógica em que o simulador **realmente** entrega valor, mesmo sem captura do hardware real — porque aqui o que se testa é a própria máquina de estados, não o comportamento do firmware.

Cenários que o simulador precisa cobrir:

- [ ] Catraca vazia → reconciliação popula tudo, na ordem certa
- [ ] Catraca com objeto a mais (criado à mão) → **não é removido** (não é gerido pelo SAGE)
- [ ] Catraca com objeto divergente → é corrigido
- [ ] Falha no meio do plano → estado parcial é detectado e reparado na rodada seguinte
- [ ] Mesma operação aplicada duas vezes → nenhum duplicado (idempotência)
- [ ] Plano quer remover 80% → é bloqueado pelo teto de segurança
- [ ] Relógio da catraca 2 h adiantado → detectado e corrigido
- [ ] Aluno muda de turma → sai do grupo antigo, entra no novo, sem janela em que fica sem regra
- [ ] Aluno é desligado → perde acesso, mas o histórico de acesso permanece
- [ ] PC desligado 12 h → ao voltar, reconcilia e importa os logs do período

O penúltimo merece atenção: **trocar de grupo não pode ter um instante em que o aluno não pertence a nenhum.** Se a reconciliação remover primeiro e adicionar depois, e falhar no meio, o aluno fica sem acesso. Adicione ao novo antes de remover do antigo.

---

## 10. Impacto no plano mestre

No roadmap, este trabalho é **WP-04 — Reconciliação com a catraca**, reduzido ao escopo definido pelo [ADR-0008](../adr/0008-politica-no-sage-identidade-na-catraca.md): usuários, cartões e grupos — não o grafo de regras inteiro. Dentro desse escopo, o que falta construir:

- Tabela de mapeamento e hashes de estado (Lei 3)
- Construtor de estado desejado a partir do banco do SAGE
- Leitor de estado observado da catraca
- Motor de diferença e plano ordenado
- Aplicador idempotente com teto de segurança
- Simulador cobrindo os cenários da seção 9
- Sincronização de relógio
- Painel de divergência (o que está torto e há quanto tempo)

O último item é o que dá paz remotamente: uma tela que responde **"a catraca e o sistema estão de acordo?"** com sim ou não, e há quanto tempo. Ligada ao heartbeat `sage-sync-catraca`, ela avisa por e-mail quando a divergência persistir — que é exatamente o modo de falha silencioso que este documento inteiro existe para caçar.

Antes de qualquer um desses itens, valem as correções de WP-00 descritas na seção 6: sem elas, reconciliar não conserta nada — só reafirma o estado torto com mais frequência.

---

## Em uma frase

Isto não é mandar comandos para uma catraca — é manter dois bancos de dados autônomos de acordo sobre uma política de acesso, sem transação distribuída e com um dos lados desligado toda noite. Trate como replicação de estado com reconciliação contínua, e o sistema fica robusto. Trate como fila de comandos, e ele diverge em silêncio até alguém ser barrado injustamente no portão.
