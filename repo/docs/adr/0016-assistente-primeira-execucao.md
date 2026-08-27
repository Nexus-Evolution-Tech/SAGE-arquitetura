# ADR-0016 — Contrato do assistente de primeira execução

- **Status:** proposta para revisão
- **Data:** 2026-08-26
- **Pacote:** R2-02, etapa 1 — [issue #16](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/issues/16)
- **Base:** R2-01 integrado em `d330622`

## 1. Escopo e fatos de entrada

Este documento define o contrato do assistente antes de API, frontend, migrations,
instalador ou E2E. Ele não afirma que o assistente, a varredura ou a confirmação na
catraca já existam.

Fatos que governam este contrato:

- R2 é uma instalação de uma escola. O escopo é mono-escola e multiusuário; não há
  multi-tenant nem escopo adicional por unidade nas consultas.
- R1 define somente `ADMINISTRADOR` e `SECRETARIA`. Bootstrap é
  `preAutenticacao(motivo)`, pois a credencial está sendo criada; não é um terceiro papel.
- A catraca e o SAGE são bancos autônomos. O SAGE mantém estado desejado e deve ler o
  estado observado para identificar convergência; não existe transação distribuída.
- A escrita documentada na catraca se limita a identidade, cartões, QR e grupos. `portals`
  são lidos do equipamento; políticas detalhadas de horário não são criadas por este fluxo.

## 2. Decisões

### 2.1 Escopo e autorização

O estado do assistente pertence ao contexto da instalação e à sua escola, não ao
navegador nem a uma sessão individual. Uma instalação não pode selecionar, consultar ou
alterar dados de outra escola.

O primeiro passo usa a declaração R1 `preAutenticacao()` somente enquanto o sistema não
estiver configurado. A guarda deve ser a de R1, inclusive recusa de nova inicialização
quando já houver configuração, loopback-only, `GET_LOCK`, rate limit e resposta
indistinguível para falhas de login. Depois de criada a conta, cada operação do assistente
precisa de rota com declaração explícita de autorização; ausência de declaração nega.

| Ator/papel sustentado por R1 | Pode fazer | Não pode fazer |
|---|---|---|
| `preAutenticacao()` | Criar a configuração inicial e a primeira conta `ADMINISTRADOR`, apenas enquanto o sistema não estiver configurado | Ser tratado como acesso anônimo geral ou continuar inicializando uma instalação configurada |
| `ADMINISTRADOR` | Tudo que R1 atribui ao papel, incluindo gestão de usuários, configuração e operações destrutivas | Não há uma restrição adicional criada por este ADR |
| `SECRETARIA` | Operação diária: consultar e alterar dados de negócio, corrigir com justificativa, aprovar liberação e fechar período | Não pode acessar rotas de configuração, destrutivas ou de gestão administrativa |

O assistente não amplia a ACL de R1, não cria papel somente-leitura e não transforma a
interface em autoridade de autorização. Se um passo misturar configuração administrativa
com escrita de negócio, a API deverá separar as operações ou abrir decisão própria; este
ADR não escolhe a permissão por intuição.

### 2.2 Ordem normativa e vínculo com dados

Todos os pré-requisitos da linha anterior devem estar concluídos. O passo seguinte é
bloqueado enquanto qualquer passo anterior estiver pendente, parcial, em erro ou sem
evidência suficiente.

| Ordem | Passo e pré-condição | Dados criados ou atualizados no SAGE |
|---:|---|---|
| 1 | **Escola e conta `ADMINISTRADOR`**. Sistema ainda não configurado. A conta não depende de `Pessoa`, que só aparece no passo 8. | `UnidadeEscolar` e o primeiro `Usuario` `ADMINISTRADOR`, conforme R1; o estado do assistente guarda apenas referências, nunca a senha digitada. |
| 2 | **Área**. Escola e conta do passo 1 concluídas. | Registro de `Área` e seus vínculos existentes com a escola; nenhum vínculo é inferido se não houver FK/contrato. |
| 3 | **Catraca**. Área concluída; descoberta automática deve terminar com um dispositivo selecionado ou erro explícito. | `Dispositivo` existente ou novo registro lógico conforme o contrato vigente, e a referência ao dispositivo selecionado. `portals` não são criados pelo SAGE. |
| 4 | **Curso**. Área concluída. | Registro de `Curso` e os vínculos exigidos pelo schema existente. |
| 5 | **Turma**. Curso e Área concluídos. | Registro de `Turma` e os vínculos de curso/área previstos no domínio; não se cria turma órfã por fallback. |
| 6 | **Empresa**. Turma concluída. | Registro de `Empresa`, antes de qualquer pessoa terceirizada que dependa dela. |
| 7 | **Sala**. Escola e os vínculos anteriores necessários concluídos. | Registro de `Sala` e seus campos/vínculos existentes; este ADR não resolve a duplicidade documental de `/sala` e `/salas`. |
| 8 | **Pessoas**. Turma, Empresa e Sala concluídas quando forem pré-requisitos da pessoa. | `Pessoa` e somente os vínculos de `Turma`, `Empresa` ou `Sala` sustentados pelo domínio; referências de identidade para a sincronização são por ID. |

O passo 8 só pode avançar após a persistência dos dados escolares. A eventual presença de
uma pessoa na catraca é verificada separadamente, na seção 2.5; cadastro no SAGE não é
confirmação de hardware.

### 2.3 Estado persistido

O próximo pacote de API deve materializar um agregado de estado do assistente no servidor.
O nome da tabela, endpoint e forma de migração não são decididos aqui. O modelo lógico
obrigatório é:

```text
escopo da instalação/escola
versão do contrato
estado global
passo atual
para cada passo: status, IDs das entidades, tentativa, timestamps,
                 último código de erro e identificador de ocorrência
descoberta: status, dispositivo selecionado, quantidade de candidatos, resultado resumido
sincronização: estado desejado, estado observado/convergente ou pendência
```

Os estados globais são `NAO_INICIADO`, `EM_ANDAMENTO`, `PARCIAL`, `BLOQUEADO`,
`PRONTO_LOGICO` e `CONCLUIDO`. Cada passo usa `PENDENTE`, `EM_EXECUCAO`, `CONCLUIDO`,
`FALHA_RETENTATIVA` ou `BLOQUEADO`. `PARCIAL`, `FALHA_RETENTATIVA` e `BLOQUEADO` nunca
podem ser apresentados como sucesso.

O estado contém IDs internos e referências técnicas, não cópias de payloads. É proibido
persistir nele senha, token, credencial de catraca, nome, CPF, RG, e-mail, telefone,
endereço, foto, QR ou número de cartão. O `Usuario` continua sujeito ao armazenamento
próprio de credencial definido por R1; o assistente nunca duplica essa credencial no seu
estado ou em log.

### 2.4 Transições, retomada e idempotência

- `NAO_INICIADO` passa a `EM_ANDAMENTO` ao iniciar o passo 1. Só um passo elegível pode
  estar em execução.
- Um passo passa a `CONCLUIDO` somente após sua escrita local e validação de sucesso. Se
  o resultado for desconhecido, permanece parcial até releitura/reconciliação; nunca se
  presume sucesso por a requisição ter sido interrompida.
- Falha transitória volta a `FALHA_RETENTATIVA` dentro de um orçamento finito e
  persistido. Erro determinístico, autorização ausente, pré-condição inválida ou
  orçamento esgotado passa a `BLOQUEADO`.
- Todos os oito passos concluídos produzem `PRONTO_LOGICO`. `CONCLUIDO` exige também a
  evidência de convergência da identidade na catraca definida na seção 2.5.
- Fechar o navegador descarta somente a projeção visual. Ao abrir de novo, a tela lê o
  estado do servidor e retorna ao primeiro passo não concluído.
- Após reiniciar a máquina, um passo que estava `EM_EXECUCAO` é tratado como resultado
  desconhecido. A API relê por identidade estável antes de repetir a operação; sem prova
  suficiente, deixa o estado parcial/bloqueado para intervenção autorizada.
- Cada operação deve ter uma identidade estável por instalação, passo e entidade. Retry
  relê o registro e o ID salvo antes de inserir. Não é permitido deduplicar pessoa por
  nome, nem dispositivo por nome ou IP. Se o domínio não oferecer chave estável, a
  operação para e registra a pendência em vez de duplicar.
- Escritas na catraca, quando houver contrato específico, usarão
  `create_or_update_objects`; este ADR não cria comando remoto. Não existe rollback
  destrutivo automático de dados já confirmados sem contrato de compensação.

Este ADR não inventa uma transação para os oito passos nem uma transação distribuída com a
catraca. O pacote de API deve manter a regra de transação para cada escrita multi-passo que
já a exigir, definir sua fronteira local e, em qualquer falha parcial, persistir a falha
sem anunciar sucesso.

### 2.5 Descoberta da catraca e significado de “conhece pessoas”

A descoberta usa o `networkDiscoveryService` existente como ponto de integração. A tela
não pede IP: varre somente a rede local conhecida pelo host, no recorte `/24` previsto no
runbook, com prazo global de até 30 segundos. Não há varredura externa nem espera sem limite.
O timeout individual de cada probe deve ser limitado no pacote de API para respeitar esse
prazo global.

Zero candidatos, candidatos ambíguos, ausência de interface, permissão de rede, timeout
ou erro de leitura são falhas visíveis e não conclusão. O retry reutiliza o estado do
passo; ao esgotar seu orçamento, grava código de erro estável e fica `BLOQUEADO`.
Para retomar, o estado guarda status, instante, quantidade de candidatos, dispositivo
selecionado quando houver e código de erro. Não guarda captura bruta de rede, payload,
credencial ou dado pessoal; qualquer configuração técnica necessária fica no contrato
protegido de `Dispositivo`, não em uma cópia do assistente.

“Catraca conhece pessoas” tem três significados distintos:

1. **Persistência lógica:** `Pessoa`, seus vínculos e IDs de identidade foram salvos no
   SAGE.
2. **Estado desejado:** o SAGE registrou que `users`, grupos, vínculos, cartões e QR
   correspondentes devem convergir no dispositivo. A tabela de mapeamento e a
   reconciliação descritas na arquitetura ainda precisam ser entregues.
3. **Estado observado:** uma leitura do equipamento e a comparação com o desejado
   demonstraram convergência. Só este nível permite `CONCLUIDO` e a frase “a catraca
   conhece pessoas”.

Persistência lógica ou pendência de sincronização não pode ser exibida como confirmação
física. Se o próximo contrato ainda não puder ler e confirmar o equipamento, o assistente
fica em `PRONTO_LOGICO`/`BLOQUEADO`, nunca em sucesso final. O botão “liberar acesso” não
ganha controle físico da catraca por este ADR; qualquer atuação real exige nova
especificação/ADR, validação de hardware e pacote próprio.

## 3. Falha, conclusão e dados sensíveis

Falha de autenticação, pré-condição, validação, descoberta, persistência ou comunicação
nega avanço. A mensagem pode mostrar código estável e identificador de ocorrência, sem
stack trace ou dado pessoal. Logs e estado registram IDs técnicos e contexto mínimo; não
registram payload cru, senha, token, credencial ou PII.

Se uma etapa posterior falhar, os passos anteriores permanecem marcados como concluídos e
o agregado fica `PARCIAL`/`BLOQUEADO` até retomada. Não se apagam registros confirmados para
simular uma instalação totalmente atômica. Qualquer compensação ou rollback de entidade
exige contrato próprio. `CONCLUIDO` só é permitido com todas as pré-condições, passos e
evidências satisfeitos.

## 4. Critério verificável de máquina limpa e evidência

O critério futuro de máquina limpa é um snapshot descartável, sem instalação SAGE
anterior, sem serviços `SAGEAPI`/`SAGEMySQL`, sem runtime, dados, configuração ou logs
anteriores. Nesse snapshot, o teste deve:

1. executar o preflight e a instalação previstos, sem dados reais;
2. criar a escola e a conta admin uma única vez;
3. executar os oito passos na ordem, interrompendo navegador e máquina entre passos;
4. retomar sem perder estado, sem duplicar qualquer entidade e sem avançar sobre erro;
5. demonstrar descoberta dentro do limite e o estado lógico/observado da catraca com
   simulador;
6. registrar o primeiro acesso como `RegistroPresenca` imutável, com `origem=CATRACA`,
   `pessoa_id`, `dispositivo_id`, `momento`, `sentido` e `log_catraca_id` válidos, sem
   horário estimado; e
7. verificar que a tela mostra o status dos acessos, sem atribuir efeito físico ao botão
   de liberação.

Este pacote **não executou** instalação limpa, varredura, simulador, hardware real ou E2E.
O teste contra hardware real não pertence ao CI; a validação futura deve usar o simulador
e reservar qualquer confirmação física para pacote próprio.

## 5. Dependências, riscos e fora de escopo

**Dependências:** contrato de usuários e autorização da R1; correções e laboratório que
tornem R2 seguro; R2-01; [ADR-0013](./0013-mysql-embarcado-como-servico.md);
[ADR-0014](./0014-fronteira-de-confianca-e-transporte.md); [sincronização](../arquitetura/sincronizacao.md);
[presença](../arquitetura/presenca.md); e o runbook de [instalação](../operacao/instalacao.md).
O `networkDiscoveryService` é citado no roadmap, mas sua integração na tela continua sem
execução comprovada. A decisão documental de [Sala](./0015-superficie-sala.md) permanece
pendente de revisão externa.

**Riscos:** ausência de chave estável para idempotência; resultado desconhecido entre SAGE
e catraca; rede local fora do prazo; divergência de schema de `Sala`; capacidade e
comportamento do equipamento ainda não validados; e exposição acidental de PII ou segredo
em estado, mensagem ou log.

**Fora de escopo:** código de API, frontend, migrations, instalador, workflow, importação
de grade/horários (R2-03), etapa remota (R2-04), reconciliação completa, comandos reais na
catraca, criação de `portals`, política detalhada de acesso, atuação física do botão e
E2E executado.

## 6. Pendências e evidências do próximo pacote de API

O próximo pacote deve apresentar, com testes nomeados e dados sintéticos:

- schema/endpoint do agregado, enumerações, concorrência e orçamento de retry;
- chaves estáveis, restrições únicas e comportamento de releitura sem duplicação;
- ACL de cada rota pela classificação R1 e teste de falha fechada;
- fronteiras transacionais locais, estados parciais e retomada após crash;
- integração do `networkDiscoveryService`, prazo `/24`, timeout, seleção e erros;
- diferenciação testável entre `PRONTO_LOGICO`, estado desejado e estado observado;
- sincronização idempotente contra simulador, sem alegar confirmação de hardware real;
- teste de redação que rejeite PII, credenciais, tokens e payloads crus em estado/log; e
- evidência posterior do E2E de máquina limpa até o primeiro `RegistroPresenca`.

## Referências

- [Plano pós-auditoria](../../../PLANO-POS-AUDITORIA.md)
- [Roadmap de releases, R2-02](../../../ROADMAP-RELEASES.md)
- [Roadmap mestre](../produto/roadmap.md)
- [AGENTS.md](../../AGENTS.md)
- [R1 — Usuários e autorização](../../../specs/R1-usuarios-e-autorizacao.md)
- [ADR-0005 — Postura de falha por fluxo](./0005-postura-de-falha-por-fluxo.md)
- [ADR-0006 — Bloqueio e controle administrativo](./0006-bloqueio-e-controle-administrativo.md)
- [ADR-0011 — Atualização blue-green](./0011-atualizacao-blue-green.md)
- [Issue #16](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/issues/16)

## Addendum R2-02A — contrato do estado do onboarding

- **Data:** 2026-08-27
- **Pacote:** R2-02A — [issue #18](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/issues/18)
- **Base:** ADR-0016 integrado em `22a6093`
- **Natureza:** decisão documental para o pacote de persistência, leitura e retomada;
  não inicia implementação.

Este addendum detalha o contrato da seção 2 sem substituir suas decisões. O agregado
`OnboardingState` será persistido em `onboarding_state`, com uma única instância para o
contexto da instalação e sua escola. A identidade desse contexto é derivada pelo servidor;
`school_id` não é aceito em rota, query ou corpo, nem serve para o cliente escolher outro
escopo. Uma restrição única e a criação concorrente devem preservar esse invariante.

### Projeção pública e controle de concorrência

O sucesso de `GET /onboarding` retorna somente a projeção abaixo. A ordem de
`passos_concluidos` é a ordem normativa do ADR; não há IDs de entidades, timestamps,
descoberta, mensagens de negócio ou qualquer outro campo nessa resposta.

```json
{
  "status": "NAO_INICIADO",
  "passo_atual": null,
  "passos_concluidos": [],
  "proximo_passo": "ESCOLA_CONTA_ADMINISTRADOR",
  "versao": 0
}
```

`versao` é um inteiro monotônico, começa em `0` e pertence ao agregado. Cada transição
persistida incrementa-o uma vez, na mesma transação; leitura e retomada idempotente não o
incrementam. Uma mutação deve carregar `If-Match: "<versao>"`. Cabeçalho ausente ou malformado
é pré-condição não atendida; versão obsoleta não pode sobrescrever o estado. Se a requisição
repetida já estiver refletida no estado persistido, retorna a projeção vigente sem nova
escrita; caso contrário, a concorrência é rejeitada sem alterar `versao`.

### Rotas e identificadores de passo

`GET /onboarding` lê o agregado do escopo da instalação e também retorna `NAO_INICIADO`.
`POST /onboarding/steps/{step}/resume` não recebe payload de negócio: o caminho identifica
o passo e a resposta bem-sucedida é a mesma projeção de estado. Os identificadores estáveis
de `{step}` e seus valores na projeção são:

| Ordem | `{step}` | Valor do estado |
|---:|---|---|
| 1 | `escola-conta-administrador` | `ESCOLA_CONTA_ADMINISTRADOR` |
| 2 | `area` | `AREA` |
| 3 | `catraca` | `CATRACA` |
| 4 | `curso` | `CURSO` |
| 5 | `turma` | `TURMA` |
| 6 | `empresa` | `EMPRESA` |
| 7 | `sala` | `SALA` |
| 8 | `pessoas` | `PESSOAS` |

O `resume` só aceita o passo atual retentável ou o próximo passo quando todos os seus
pré-requisitos estiverem concluídos. No estado inicial, somente o passo 1 é elegível e a
primeira chamada o leva a `EM_ANDAMENTO`. Repetir o mesmo passo não cria outra instância,
não duplica entidade e retorna o estado vigente. Passo inválido, fora de ordem ou sem
pré-condição é rejeitado; nenhuma transição rejeitada altera o agregado.

### Autorização, dados e fronteiras do R2-02A

As duas rotas exigem declaração explícita de autorização conforme a ACL da R1; não criam
papel novo. O fluxo de configuração é administrativo e não concede acesso de configuração
à `SECRETARIA`. Não existe endpoint anônimo presumido neste contrato: o uso de
`preAutenticacao()` para o primeiro acesso sem credencial precisa de decisão própria antes
de ser ligado a qualquer rota.

O estado não contém PII, credenciais, segredos, payloads crus ou dados da catraca. O
`resume` deste pacote não escreve `UnidadeEscolar`, `Usuario` ou qualquer outra entidade de
negócio, não dispara descoberta, sincronização nem o botão de liberar acesso. R2-02A cobre
somente a persistência de `OnboardingState`, sua leitura e a transição de início/retomada;
a escrita da escola e da conta do passo 1 fica para R2-02B.

Erros de autenticação e autorização seguem R1; erros de pré-condição, passo ou transição
seguem o envelope e os códigos estáveis já adotados, sem revelar escopo ou dado sensível.
Falha ou rejeição nunca retorna sucesso. O próximo pacote de API só começa depois que este
addendum estiver integrado.
