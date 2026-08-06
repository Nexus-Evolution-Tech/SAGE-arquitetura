# ADR-0003 — O instalador nunca assume o estado da máquina

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O instalador do SAGE roda em máquinas de escola que ninguém do time controla
previamente. Pode ser uma instalação limpa, um upgrade sobre uma versão
anterior do próprio SAGE, ou uma máquina com outro MySQL já rodando na porta
padrão. Como quem executa o instalador não é técnico e quem mantém o sistema
está remoto, uma instalação que falha na metade — ou que assume um estado que
não existe — deixa a máquina num estado pior do que antes, sem ninguém local
capaz de consertar.

## Decisão

O instalador detecta o estado real da máquina antes de agir e se adapta a ele:
instalação limpa, upgrade preservando `dados/`, ou coexistência com um MySQL de
terceiro já em execução. Nenhuma escrita em disco acontece antes de todas as
verificações de preflight passarem.

## Consequências

**Positivas**
- Instalação sobre versão anterior preserva os dados existentes
- Coexiste com MySQL de terceiro na porta 3306 sem conflito, porque o SAGE usa
  porta própria (ver ADR-0001)
- Instalação que não vai dar certo é recusada antes de escrever qualquer byte,
  em vez de falhar pela metade

**Negativas / custo aceito**
- O preflight (dez verificações) precisa rodar antes de qualquer outra coisa,
  o que adiciona etapas e tempo ao início da instalação
- Cada modo (limpo / upgrade / coexistência) precisa de caminho de código e
  teste próprios

**O que o código precisa respeitar**
- Nenhuma escrita em disco antes do preflight completo passar
- Preflight cobre, no mínimo: versão do Windows, espaço livre (≥ 5 GB),
  permissão de escrita em `C:\ProgramData`, portas 3000 e 33306 livres,
  internet e proxy, VC++ Redistributable, desvio do relógio (< 5 min), detecção
  de instalação anterior, antivírus bloqueando, IP local
- Cada verificação tem código de erro único e rastreável a uma linha do código
  (`SYS-01`, `PORT-01`, `TIME-01`, etc.)
- Detecção de instalação anterior ativa modo upgrade e preserva `dados/`
- Rodar o instalador duas vezes seguidas é seguro (idempotente)
- Falha em qualquer passo do ledger desfaz os passos anteriores na ordem
  inversa (ver ADR-0011 para o mecanismo de atualização; aqui vale para a
  instalação inicial)

## Alternativas consideradas

### Assumir instalação limpa e falhar se algo divergir — recusada
Mais simples de implementar, mas qualquer desvio do assumido (upgrade, MySQL
de terceiro) vira falha pela metade numa máquina sem suporte técnico local —
exatamente o cenário que o projeto existe para evitar.

## Referências

- `docs/arquitetura/SAGE-plano-mestre.md`
