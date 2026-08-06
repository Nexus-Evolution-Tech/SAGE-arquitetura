# ADR-0011 — Atualização blue-green com rollback automático

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O SAGE é mantido remotamente por uma pessoa que não está na escola. Uma
atualização que falhar precisa se recuperar sozinha — não há ninguém local
para reiniciar serviço, restaurar backup ou diagnosticar por que o app não
sobe. Ao mesmo tempo, o dado tratado (presença de menores, folha de ponto) não
pode ser tocado pelo mecanismo de atualização: código pode ser jogado fora e
baixado de novo, mas o dado nunca pode.

## Decisão

Código é descartável e vive em `releases/`, um diretório por versão. Dado é
sagrado e vive em `dados/`, fora do ciclo de releases. Uma junção (junction)
aponta para o release corrente e é trocada atomicamente na ativação da nova
versão. O canal de atualização é um JSON assinado (Ed25519, chave pública
embutida, chave privada nunca na máquina da escola) consultado a cada 15
minutos, distribuindo somente números de versão — nunca comandos de shell
remoto, nem para emergência.

Sequência de atualização: baixa → verifica hash → backup verificado →
migrations (sempre expand-only, nunca remover coluna na mesma versão que para
de usá-la) → troca a junction → reinicia → aguarda `/ready` responder por até
90 segundos → confirma, ou volta sozinho para a versão anterior.

## Consequências

**Positivas**
- Uma atualização que não sobe (falha no `/ready` dentro de 90 s) se desfaz
  sozinha, sem intervenção humana, em menos de 3 minutos
- O dado nunca é tocado pelo mecanismo de troca de versão — só a junction
  muda, o que é uma operação atômica
- Canal de atualização restrito a versões assinadas elimina a superfície de um
  canal de execução remota arbitrária
- Migrations expand-only permitem que o rollback funcione mesmo depois de uma
  migration já ter sido aplicada

**Negativas / custo aceito**
- Nenhum comando de shell remoto é suportado, nem para emergência — um
  problema que exigisse ação fora do escopo de "trocar versão" não tem
  atalho remoto
- Exige disciplina de nunca remover uma coluna na mesma versão em que o
  código para de usá-la (expand-only), o que adianta o trabalho de limpeza
  para uma versão futura
- Queda de internet no meio do download precisa ser tratada explicitamente
  para não deixar estado inconsistente

**O que o código precisa respeitar**
- Código em `releases/<versão>/`, nunca escrito fora dali; dado em `dados/`,
  nunca dentro de `releases/`
- Troca de versão ativa é feita só pela junction, de forma atômica
- Pacote de atualização é sempre assinado com Ed25519; assinatura inválida é
  recusado e registrado, nunca aplicado
- Verificação de hash antes de extrair qualquer pacote
- Anti-downgrade por padrão; downgrade só é aceito com `rollback: true`
  assinado
- O canal de atualização carrega somente números de versão — nunca comando de
  shell, nem em modo emergência
- Migrations são sempre expand-only: nunca removem coluna na mesma versão que
  para de usá-la
- Após ativar a versão nova, `/ready` precisa responder positivo dentro de 90
  segundos; se não responder, o sistema reverte sozinho para a versão
  anterior em até 3 minutos
- Atualização automática não solicita UAC

## Alternativas consideradas

### Sobrescrever os arquivos da versão atual in-place — recusada
Sem diretório separado por versão, não há para onde voltar em caso de falha —
rollback deixaria de ser uma troca atômica de ponteiro e passaria a exigir
reconstruir o estado anterior arquivo por arquivo.

### Canal de atualização com comandos de shell remoto — recusada
Mesmo reservado só para emergência, um canal de execução remota arbitrária é
uma superfície de ataque grave demais para um sistema tratando dado de menor,
mantido remotamente, numa máquina sem monitoramento presencial.

## Referências

- `docs/arquitetura/SAGE-plano-mestre.md`
