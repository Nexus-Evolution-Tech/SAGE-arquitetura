# ADR-0009 — Reconciliação de estado, não fila de eventos

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

Em modo standalone, a catraca Control iD é um banco de dados independente que
toma decisões sozinha — o SAGE não a controla, apenas tenta convencê-la a
concordar com ele. Isso é replicação de estado entre dois bancos autônomos,
sem transação distribuída, sobre uma rede que cai, com um dos lados (o PC do
SAGE) desligado todas as noites.

Uma fila de mudanças (`sync_pendente`) só sabe das alterações que ela mesma
viu passar. Ela não sabe de alguém que mexeu na catraca pelo software oficial,
de um objeto apagado por `destroy_objects`, de uma escrita que a catraca
aceitou e depois perdeu, ou do que aconteceu enquanto o PC estava desligado. O
risco real deste domínio não é a falha — falha se tenta de novo. É a
divergência silenciosa: a catraca acha uma coisa, o SAGE acha outra, e o
sistema parece funcionando perfeitamente até alguém ser barrado ou liberado
errado no portão.

## Decisão

O modelo é o de reconciliação, o mesmo usado pelo Kubernetes: o SAGE calcula o
estado desejado a partir do próprio banco, lê o estado observado direto da
catraca, calcula a diferença, e aplica o plano resultante. A fila continua
existindo como otimização (aplica rápido o que acabou de mudar), mas quem
garante a verdade é o laço de reconciliação periódico. Cadência: reconciliação
completa uma vez por dia fora do horário letivo, mais verificação leve
(contagem de objetos por tipo) a cada hora, disparando reconciliação completa
imediata se a contagem leve divergir do esperado.

## Consequências

**Positivas**
- Detecta e corrige divergência mesmo quando ela vem de fora do SAGE (edição
  manual pelo software oficial da Control iD, perda de escrita, objeto
  apagado)
- Sobrevive ao PC ficar desligado por horas todas as noites sem acumular
  divergência silenciosa — ao religar, a reconciliação recompõe o estado
- Divergência recorrente no mesmo objeto vira sinal de que alguma escrita está
  falhando silenciosamente — informação que uma fila nunca teria revelado

**Negativas / custo aceito**
- Exige ler o estado completo da catraca periodicamente, o que tem custo de
  I/O e tempo maior que só processar uma fila
- Exige uma tabela de mapeamento de identidades com hash de estado desejado e
  observado (`catraca_mapeamento`) para saber o que comparar

**O que o código precisa respeitar**
- Toda escrita na catraca usa `create_or_update_objects`, nunca `create_objects`
  isolado — a operação precisa ser idempotente
- Reconciliação completa roda ao menos uma vez por dia, fora do horário
  letivo; verificação leve de contagem roda a cada hora
- O que não está "sob gestão do SAGE" (sem o prefixo/offset que identifica
  objetos criados pelo SAGE) nunca é removido pela reconciliação
- Se o plano de reconciliação quiser remover mais que 20% dos objetos de um
  tipo, a execução para e pede confirmação humana em vez de aplicar
- Toda rodada com plano não vazio registra a divergência com detalhe (o que
  estava diferente), não como rotina silenciosa
- Ordem de dependência respeitada ao aplicar (`time_spans` → `time_zones` →
  `access_rules` → ... → `users` → `user_groups`) e ordem inversa ao remover
- Ao trocar um aluno de grupo, a inclusão no novo grupo acontece antes da
  remoção do antigo — nunca existe um instante em que a pessoa não pertence a
  nenhum grupo
- O relógio da catraca é sincronizado a cada reconciliação; desvio acima de
  60 segundos gera alerta

## Alternativas consideradas

### Fila de eventos (`sync_pendente`) como única fonte de verdade — recusada
Só sabe do que ela mesma viu passar. Não detecta divergência introduzida fora
do fluxo do SAGE (edição manual, perda de escrita, objeto apagado), e essas
são exatamente as divergências mais perigosas porque ficam invisíveis até
alguém ser barrado ou liberado errado.

## Referências

- `docs/arquitetura/SAGE-design-sincronizacao.md`
