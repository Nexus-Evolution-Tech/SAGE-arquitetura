# Requisitos — o pedido original da secretaria

Este documento registra fielmente o que a secretaria da ETEC de Taboão da Serra pediu,
organizado por tema. Não acrescenta requisito que não está no material de origem. Para
o raciocínio de arquitetura por trás de cada resposta, ver [`roadmap.md`](./roadmap.md);
para a definição de produto, ver [`visao.md`](./visao.md).

## Substituição do sistema genérico

| Pedido | Por quê | Onde entra |
|---|---|---|
| Sistema personalizado no lugar do genérico da Control iD | O software padrão resolve controle de acesso predial, não a rotina de uma secretaria escolar — não gera folha, não conhece turma, não ajuda a decidir nada | Motivação de fundo do projeto inteiro, não uma fase isolada |

## Registro de presença

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Controlar entrada e saída de alunos e funcionários | Base de tudo: sem isso nenhuma folha, indicador ou autorização funciona | Fase 1 — WP-02 (modelo de presença), WP-03 (pareamento entrada/saída) |
| Saber o horário exato de entrada e saída de cada pessoa | Insumo direto de folha de ponto e folha de presença | Fase 1 — WP-02, Pilar 1 (Registro fiel) |

## Folhas automáticas

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Folha de ponto automática (funcionários) | Elimina apontamento manual de horário, que hoje é trabalho repetitivo da secretaria | Fase 3 — WP-08 |
| Folha de presença automática (alunos) | Mesmo motivo, para registro escolar em vez de folha salarial | Fase 3 — WP-07 |

Ambas seguem o modelo de **atestação com humano no circuito**: o sistema calcula a
partir dos registros pareados, a secretaria revisa e corrige com justificativa, e só
então o período é fechado e o documento gerado. O `.docx` é sempre fotografia de um
período já confirmado — nunca a planilha de trabalho.

## Autorização

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Aprovar ou não pessoas de fora (visitantes), como em ambiente profissional | Controle de quem circula na escola | Fase 4 — WP-14 |
| Impedir que menor saia sozinho em horário de aula; ser notificada da tentativa; aprovar a saída depois de já ter falado com o responsável | O caso crítico do produto — segurança de criança | Fase 4 — WP-13. Postura de falha: fora do ar, o sistema **bloqueia** a saída (nunca o oposto) |
| Programar exceções: liberar uma turma inteira (passeio, dia sem aula) | Evita aprovar aluno por aluno num evento programado | Fase 4 — WP-15 |
| Abrir para o público em eventos | A escola realiza eventos abertos à comunidade | Fase 4 — WP-15, regra "evento aberto" |
| Aprovar alunos fora do horário de aula | Não detalhado no material de origem — ver decisão em aberto abaixo | **Sem pacote de trabalho dedicado** |

## Indicadores e histórico

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Dashboard: quantos faltaram, quantos vieram, turmas com mais falta | Visão do dia sem precisar cruzar planilha | Fase 3 — WP-10 |
| Clicar numa pessoa e ver todo o histórico dela, filtrável por atraso, saída antecipada e falta | Hoje isso exige garimpo manual em registro solto | Fase 3 — WP-09 |
| Detectar padrão (ex.: funcionário que atrasa toda sexta) | Transforma dado bruto em sinal útil para gestão | Fase 3 — WP-11. Mostra o dado; a conclusão fica sempre com o humano — não vira pontuação automática de pessoa |

## Grade horária

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Criar horários de aula com validação de conflito (professor não pode estar em dois lugares; turma dividida em parte A e parte B) | Evita erro manual na montagem da grade | Já existe e está correto — confirmado no roadmap, não é trabalho novo |
| Futuro: montagem assistida da grade | Grade automática completa é problema de satisfação de restrições, NP-difícil; o caminho realista é sugestão assistida, não otimização automática | Fase 6 — WP-16 |

## Multi-dispositivo

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Futuro: mais dispositivos de monitoramento além da catraca | Ampliar cobertura além do portão | Fase 6 — WP-17. A arquitetura já suporta (`Dispositivo` é tabela própria); o trabalho real é interface e modelagem de área |

## Interface

| Pedido | Por quê | Fase / pacote |
|---|---|---|
| Interface repensada, estratégica, legível para qualquer secretaria | A interface atual não comunica o que importa no primeiro olhar | Trilha paralela a partir da Fase 3, não pacote único no fim |

---

## Decisões em aberto

Itens que dependem de resposta da escola ou da direção antes de virarem trabalho de
engenharia. Nenhum tem requisito inventado — são lacunas reais no pedido original.

- **Aprovar alunos fora do horário de aula.** A secretaria pediu, mas o material de
  origem não detalha a regra (quem aprova, em que condição, se é caso a caso ou por
  exceção programada). Não há pacote de trabalho dedicado; precisa ser definido antes
  da Fase 4.
- **Formato oficial de folha de ponto do Centro Paula Souza.** Se existir um modelo
  obrigatório, o `.docx` gerado precisa seguir um template `.dotx` batendo com o
  oficial. Confirmar antes do WP-08.
- **Se o funcionário assina a folha de ponto.** Muda o layout do documento (linha de
  ciência). Confirmar antes do WP-08.
- **Ciclo de fechamento da folha de ponto** — mensal ou quinzenal. Confirmar antes do
  WP-08.
- **Quem pode aprovar a saída de menor e como isso fica registrado.** Definir com a
  direção, por escrito, antes da Fase 4 (WP-12).
- **O que a escola aceita como comportamento quando o SAGE está fora do ar.** A regra
  padrão (bloquear saída de menor, liberar entrada) está definida no roadmap; falta a
  direção validar por escrito e a secretaria conhecer o procedimento manual de
  contingência (WP-12).
- **Parceria com o Centro Paula Souza para múltiplos dispositivos.** Sem essa parceria
  confirmada, o item não deve receber investimento (Fase 6, WP-17).
