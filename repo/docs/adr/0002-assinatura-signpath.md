# ADR-0002 — Distribuir sem assinatura de código, com transparência

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** dono do produto
- **Substitui:** a intenção anterior de solicitar assinatura ao SignPath Foundation

## Contexto

O `.exe` de distribuição do SAGE é baixado e executado por uma secretária sem apoio
técnico. Um executável sem assinatura de código dispara o aviso "O Windows protegeu o seu
PC" (SmartScreen). Para uma pessoa não técnica, isso é um obstáculo real — e o aviso
existe por um bom motivo: é ele que protege contra software desconhecido.

As três rotas possíveis:

1. **Certificado comercial** — custo recorrente na faixa de R$800 a R$1500/ano para OV,
   mais caro para EV. O projeto não tem orçamento.
2. **SignPath Foundation** — assinatura gratuita para projetos open source. Exige
   repositório público, licença OSS reconhecida e build reproduzível. A aprovação leva
   semanas e depende de análise de terceiro.
3. **Distribuir sem assinar** — o aviso aparece; a pessoa precisa saber contorná-lo.

O repositório está indo para privado por causa do incidente de dados pessoais
(ver `docs/incidentes/`), o que inviabiliza o requisito de código aberto do SignPath no
momento. E a aprovação levaria semanas que o projeto não vai esperar parado.

## Decisão

**Distribuir sem assinatura de código, por ora, com transparência total sobre o motivo.**

O guia de instalação e a página de download explicam, em linguagem de usuário, que o aviso
aparece porque o projeto não possui assinatura de código. O aviso não é uma aprovação nem
uma reprovação do arquivo: a pessoa confere a origem e o SHA-256 antes de decidir com a
escola se pode prosseguir. A captura de tela só será publicada depois de validada na versão
de Windows usada pela escola.

Isso é registrado como **limitação conhecida**, não como estado final. Revisitar quando
houver orçamento, ou quando o repositório puder voltar a ser público com segurança.

## Consequências

**Positivas**
- Zero custo e zero dependência de aprovação de terceiro
- Não bloqueia o cronograma
- A transparência é honesta: a secretária entende o que está vendo em vez de ser instruída
  a ignorar um aviso de segurança

**Negativas / custo aceito**
- A secretária precisa passar por "Mais informações → Executar assim mesmo" na primeira
  instalação. Cria atrito e transmite insegurança
- Alguma política de TI corporativa bloqueia executável não assinado de forma definitiva —
  se a escola tiver essa política, esta decisão precisa ser revista com urgência
- O SmartScreen também pode marcar o download como suspeito no navegador
- Não protege contra adulteração do arquivo em trânsito. **O hash publicado é a verificação
  de integridade exigida para o modo sem assinatura** — por isso ele é obrigatório,
  rastreável ao artefato e não pode ser substituído por uma promessa de segurança

**O que o código precisa respeitar**
- O CI publica o SHA-256 de todo artefato de release, e o hash aparece na página de download
- O guia de instalação tem uma seção dedicada ao aviso do SmartScreen; uma captura de tela
  real só entra depois de validação operacional, com o motivo explicado sem jargão
- O texto nunca diz "ignore o aviso". Diz o que o aviso significa, por que aparece neste
  caso, e como conferir o hash antes de prosseguir
- O canal de atualização automática **continua exigindo assinatura Ed25519 própria**
  (ver [ADR-0011](0011-atualizacao-blue-green.md)). Não ter Authenticode não significa
  aceitar pacote não verificado: são camadas diferentes, e a segunda é inegociável

## Addendum R2-01 — alcance e operação da assinatura

Este pacote atualiza este ADR, em vez de criar um ADR sucessor: a decisão central —
distribuir sem Authenticode por ora — continua normativa. O addendum registra os controles
necessários para uma futura mudança e torna a limitação atual operável. Ele não autoriza
criar certificado, guardar chave ou alterar a CI.

### Estado normativo

- **Hoje:** o instalador continua sem assinatura Authenticode. A ausência é uma limitação
  conhecida; a página só pode liberar um artefato com versão, commit de origem e SHA-256
  conferíveis.
- **Se a decisão mudar:** nenhum artefato será tratado como assinado sem cadeia de
  certificado, timestamp e validação de revogação verificáveis. Assinatura não garante que
  o SmartScreen deixe de alertar; não há promessa de desaparecimento do alerta.
- **Separação obrigatória:** Authenticode identifica o instalador. A assinatura Ed25519 do
  JSON/canal de atualização continua sendo outra camada, com a chave privada fora da escola,
  conforme [ADR-0011](0011-atualizacao-blue-green.md). Uma não substitui a outra.

### Identidade, custódia e ciclo de vida

| Controle | Regra ou pendência rastreável |
|---|---|
| Signatário e proprietário | **Pendente.** O dono do produto decide a rota (SignPath Foundation ou certificado comercial) e a identidade publicadora. Evidência necessária: resposta/contrato do provedor, sujeito e organização do certificado, conta proprietária e autorização de uso. Não há essa evidência neste repositório. |
| Custódia | **Pendente.** Dono: dono do produto. A chave privada deverá ficar no mecanismo seguro do provedor ou em cofre/HSM sob controle do proprietário; nunca no repositório, artefato, máquina da escola ou runner não confiável. Evidência: política de custódia, backup e recuperação do provedor, com registro de acesso. |
| Acesso mínimo | O job que compila não assina. PRs e forks não recebem segredo. A assinatura, quando autorizada, ocorre apenas em ambiente protegido, com acesso temporário e aprovação humana registrada; quem altera o artefato ou metadados não se autoaprova. Evidência: configuração protegida e log do job. |
| Rotação | Rotacionar antes da expiração e imediatamente após suspeita de comprometimento, perda de controle ou saída de pessoa autorizada. A periodicidade preventiva exata é **pendente**, sob responsabilidade do dono do produto, e exige a política do provedor como evidência. |
| Revogação | Revogar perante comprometimento, uso indevido ou perda de titularidade; registrar serial/identidade pública, motivo, data, responsável e substituição. Sem validação de cadeia, timestamp e revogação, o artefato não é promovido. |
| Recuperação | Recuperar somente pelo procedimento do provedor, com autorização humana separada e evidência auditável; não exportar a chave para “desbloquear” um runner. Se a recuperação ou a validação estiver indisponível, parar a assinatura/publicação e manter a decisão vigente, sem contornar o controle. |

### Fronteira da CI e autorização

Somente o job de release em ambiente protegido pode produzir o artefato elegível à
publicação e, no futuro, à assinatura: ele deve partir de uma tag de release protegida,
apontando para um commit já integrado em `main`, com os checks obrigatórios concluídos.
Ref de PR, branch de fork, execução manual não protegida e artefato de preview podem ser
compilados/testados, mas nunca podem assinar ou publicar.

O uso da credencial de assinatura exige aprovação humana registrada antes do job protegido.
O runner não confiável não recebe segredo, certificado exportável ou token reutilizável; um
segredo não pode aparecer em log, cache, artefato ou mensagem de erro. Falha de proteção,
aprovação ausente ou origem ambígua bloqueia o job.

### Verificação do artefato e resposta a falhas

O manifesto de release deve ligar, sem lacunas, a versão à tag/ref protegida, ao commit,
ao identificador da execução de build, ao artefato final e ao SHA-256 calculado novamente
no ambiente confiável. Antes de publicar, verificar:

1. origem e commit correspondem à ref protegida e aos checks aprovados;
2. o SHA-256 do arquivo a publicar corresponde ao manifesto e à página de download;
3. se Authenticode for esperado, a assinatura, a cadeia, o timestamp e a revogação são
   válidos; no estado atual, “ausente” é o resultado declarado, não uma assinatura válida;
4. toda validação necessária terminou com sucesso.

Qualquer divergência, assinatura inválida, timestamp ausente quando exigido, certificado
revogado ou serviço de validação indisponível é **fail-closed**: não publicar, não promover e
não recomendar execução. Uma falha descoberta depois da publicação bloqueia novos downloads
e atualizações, preserva o manifesto e as evidências (versão, commit, execução e hashes) e
abre incidente. Instalações existentes não são apagadas automaticamente; o rollback para
uma versão verificada segue [ADR-0011](0011-atualizacao-blue-green.md) e nunca toca em
`dados/`, `config/` ou `logs/`.

### Registro de evidências e pendências

- **Fato existente:** este ADR aceita distribuição sem assinatura; o ADR-0011 exige
  Ed25519 no canal de atualização; o runbook abaixo descreve a instalação e o hash. Essas
  são as fontes versionadas, não prova de um certificado ou de uma execução de CI.
- **Decisão tomada neste addendum:** manter o modo sem assinatura até decisão posterior;
  exigir origem, hash, controles de CI e fail-closed quando houver assinatura.
- **Ação externa pendente:** confirmar com a escola a política que bloqueia binário não
  assinado e obter a resposta do provedor/rota de assinatura. Dono: dono do produto.
  Evidência mínima: resposta datada ou documento do provedor arquivado fora de segredos.
  Não há prova dessas ações neste repositório.
- **Validação operacional não executada neste pacote:** download nos navegadores e versões
  de Windows da escola, conferência de hash, alerta de execução, indisponibilidade de
  revogação, incidente pós-publicação, rollback e teste de compreensão com pessoa não
  técnica. Dono da execução: Engenheiro Pleno; evidência: matriz de VMs, logs redigidos e
  captura sem dados pessoais.

## Alternativas consideradas

### SignPath Foundation — adiada, não descartada
Continua sendo a melhor rota gratuita. Inviável agora porque o repositório precisa ser
privado. Reavaliar se o projeto voltar a ser público depois da limpeza do histórico.

### Certificado comercial pago — recusada por ora
Sem orçamento. Além disso, certificado OV ainda leva semanas construindo reputação no
SmartScreen antes de o aviso parar de aparecer — o alívio não seria imediato.

### Distribuir como ZIP com `Instalar.cmd` — recusada
Contorna parte do SmartScreen, mas passa impressão de amadorismo, e o Windows ainda marca
o arquivo como originário da internet. Troca um atrito por outro, sem ganho real.

## Referências

- [`../operacao/instalacao.md`](../operacao/instalacao.md) — seção sobre o aviso do SmartScreen
- [ADR-0011](0011-atualizacao-blue-green.md) — assinatura Ed25519 do canal de atualização
