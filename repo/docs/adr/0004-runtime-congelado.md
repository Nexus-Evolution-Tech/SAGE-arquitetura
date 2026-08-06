# ADR-0004 — Runtime congelado, sem depender do sistema

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O SAGE roda numa máquina que ninguém da equipe de desenvolvimento controla.
Não há garantia de qual versão do Node (se alguma) está instalada no sistema,
e o comportamento do SAGE não pode depender disso — nem mudar sozinho se
alguém instalar ou desinstalar Node na máquina por outro motivo. Da mesma
forma, dependências de npm resolvidas por intervalo de versão (`^1.2.3`) podem
puxar uma versão diferente entre o build que foi testado e o que a escola
recebe, sem ninguém decidir isso conscientemente.

## Decisão

O `node.exe` usado pelo SAGE é uma versão fixa, baixada e validada por hash,
que mora na pasta do próprio release — o SAGE nunca usa o Node do sistema.
Todas as dependências de npm são fixadas em versão exata, sem `^` nem `~`, com
`package-lock.json` commitado, e a instalação sempre usa `npm ci`.

## Consequências

**Positivas**
- Desinstalar ou atualizar o Node do sistema não afeta o SAGE
- O que foi testado em CI é bit a bit o que roda na escola
- Elimina uma classe inteira de bug "funciona aqui, não funciona lá"

**Negativas / custo aceito**
- Atualizar a versão do Node ou de uma dependência é um ato deliberado, não
  automático — exige decisão e novo release
- O runtime do Node soma peso ao pacote de distribuição (mitigado por ser
  baixado no primeiro run, não embarcado — mesmo padrão do ADR-0001)

**O que o código precisa respeitar**
- `node.exe` fixo, baixado e validado por hash, na pasta do release — nunca o
  Node global da máquina
- `package.json` sem `^` ou `~` em nenhuma dependência
- `package-lock.json` sempre commitado e usado
- Instalação e CI sempre com `npm ci`, nunca `npm install`
- Teste de aceite: desinstalar o Node do sistema não afeta o funcionamento do
  SAGE

## Alternativas consideradas

### Depender do Node já instalado na máquina — recusada
Sem controle sobre qual versão (ou se nenhuma) está presente, e sujeito a
mudar por ação de terceiros na mesma máquina.

### Versões de dependência por intervalo (`^`) — recusada
Builda diferente do que foi testado sempre que uma dependência publica uma
nova versão dentro do intervalo, sem ninguém decidir isso conscientemente.

## Referências

- `docs/arquitetura/SAGE-plano-mestre.md`
