# ADR-0006 — O bloqueio é controle administrativo, não barreira física

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto / escola

## Contexto

Existe, na escola, uma passagem lateral às catracas, com um segurança
posicionado ali. Ela é a rota de evacuação em emergência — o que já resolve a
questão de a catraca nunca poder ser o único caminho de saída do prédio.

A consequência dessa passagem existir é maior do que parece à primeira vista:
se um aluno determinado a sair pode simplesmente passar por ela, então o
bloqueio da catraca, por si só, não impede fisicamente ninguém de sair. Tratar
o bloqueio como se fosse uma barreira à prova de falhas seria enganar a
escola sobre o que o produto realmente garante.

## Decisão

O bloqueio na catraca não impede a saída — ele torna a saída não autorizada
visível e obriga o contato com um humano. O sistema é um detector que coloca o
segurança e a secretaria no circuito de decisão; quem de fato autoriza a saída
é uma pessoa, não o software. O segurança é parte do sistema, não um
apêndice: se a catraca recusa e o aluno vai pela passagem lateral, o
segurança precisa saber que aquela pessoa foi recusada.

## Consequências

**Positivas**
- Define corretamente o que o produto é, em vez de prometer uma garantia
  física que ele não tem
- Reduz a complexidade da Fase 4 (autorização em tempo real): como não é
  barreira física, o bloqueio não precisa ser à prova de falhas — se falhar
  aberto num caso raro, o segurança ainda está lá
- Resolve, por construção, a exigência de rota de evacuação em emergência

**Negativas / custo aceito**
- O produto depende de um humano (o segurança) agir corretamente sobre o
  aviso — se o aviso não chegar até ele, o bloqueio vira só um incômodo
  contornável
- Exige um canal de aviso visível para o segurança (tela do SAGE na guarita ou
  notificação repassada pela secretaria) que precisa existir e funcionar
  antes de a Fase 4 valer alguma coisa

**O que o código precisa respeitar**
- Queda de energia libera a catraca (fail-safe), nunca trava
- Existe um botão de "liberar tudo" no SAGE, alcançável em segundos pela
  secretaria
- Toda recusa de saída gera um aviso visível para o segurança em tempo real —
  não é suficiente registrar a recusa só em log
- O procedimento de emergência é documentado por escrito e a secretaria e o
  segurança sabem qual é
- Nenhuma peça do sistema é projetada, testada ou vendida à escola como
  "impede fisicamente a saída"

## Alternativas consideradas

### Tratar o bloqueio como barreira física obrigatória — recusada
Não corresponde à realidade da instalação (existe passagem lateral aberta com
segurança) e criaria uma falsa sensação de segurança física que o produto não
entrega.

## Referências

- `docs/arquitetura/SAGE-ROADMAP.md`
