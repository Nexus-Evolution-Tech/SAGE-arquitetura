# Visão do SAGE

## Definição

O SAGE é uma plataforma de presença e autorização escolar. A catraca Control iD é um
sensor e um atuador — **não é o produto**.

## Por que existe

A ETEC de Taboão da Serra usava o software genérico da Control iD, pensado para
controle de acesso predial, não para a rotina de uma secretaria escolar. Ele não gera
folha de ponto, não gera folha de presença, não sabe o que é uma turma nem o que é um
responsável, e não ajuda ninguém a decidir nada. A secretaria pediu um sistema pensado
para o trabalho dela. O SAGE é essa resposta.

## Os quatro pilares

1. **Registro fiel.** Toda entrada e saída, com hora exata, atribuída à pessoa certa.
   Sem isso, nada mais funciona.
2. **Autorização.** Quem pode entrar, quem pode sair, quando, e quem aprova a exceção —
   visitante, evento aberto, liberação de turma e, sobretudo, saída de menor.
3. **Interpretação.** Transformar registro bruto em folha de ponto, folha de presença,
   atraso, saída antecipada, falta. É onde mora o valor para a secretaria.
4. **Estratégia.** Dashboard, detecção de padrão, histórico filtrável, indicadores por
   turma.

A catraca aparece só no pilar 1 e parcialmente no 2. Isso é deliberado: no dia em que
existir outro dispositivo de monitoramento, os pilares 3 e 4 não mudam nada.

## As restrições que moldam tudo

- **O PC fica desligado toda noite.** Nada pode depender de o processo estar sempre no
  ar; tudo precisa recuperar sozinho ao ligar de novo.
- **Ninguém tecnicamente capaz está no local.** Toda mensagem de erro, toda instalação,
  toda recuperação de falha precisa funcionar sem alguém que entenda de sistema por
  perto.
- **O sistema trata dado de menor de idade.** Presença e autorização de aluno são dado
  sensível sob a LGPD; isso pesa em toda decisão de log, retenção e acesso.
- **Não existe porta aberta na rede da escola para o SAGE.** Acesso remoto e
  atualização não podem depender de abrir a rede escolar para fora.
- **O mantenedor é remoto e não tem vínculo com a escola.** É um ex-aluno, sem contrato
  formal, sustentando o sistema a distância. O produto precisa se manter sozinho na
  maior parte do tempo.

## O que o SAGE explicitamente não é

- **Não é uma barreira física.** Existe passagem lateral com segurança ao lado da
  catraca; ela é a rota de evacuação e também o caminho que uma pessoa determinada usa
  para contornar o bloqueio. O SAGE não impede fisicamente — ele torna a saída não
  autorizada visível e obriga contato com um humano.
- **Não é um sistema de disciplina automática.** Ele não pontua, não classifica e não
  gera "risco" de ninguém. Mostra o dado; a conclusão é sempre de uma pessoa.
- **Não decide sobre pessoas.** Aprovação de saída, de visitante ou de exceção é sempre
  um humano confirmando — o sistema propõe e registra, nunca decide sozinho.

## Quem usa o SAGE

- **Secretaria (usuária principal).** Registra, corrige, fecha período, aprova saída de
  menor, consulta histórico e dashboard. É para o trabalho dela que o produto existe.
- **Segurança.** Faz parte do circuito de autorização: quando a catraca recusa e a
  pessoa vai pela passagem lateral, é o segurança quem precisa saber que ela foi
  recusada.
- **Direção.** Aprova política (o que acontece quando o sistema cai, quem pode aprovar
  o quê) e responde pela escola perante a LGPD e perante o Centro Paula Souza.
- **Mantenedor remoto.** Instala, atualiza e diagnostica a distância, sem acesso físico
  e sem vínculo empregatício — precisa de telemetria, diagnóstico remoto e mensagens de
  erro que uma pessoa leiga consiga descrever por telefone.
