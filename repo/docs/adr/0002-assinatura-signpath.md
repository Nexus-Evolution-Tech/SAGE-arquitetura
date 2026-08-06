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
aparece porque o projeto não possui certificado pago, e não porque o programa seja
perigoso. Mostram o print exato da tela, indicam onde clicar, e publicam o SHA-256 do
arquivo para quem quiser conferir.

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
- Não protege contra adulteração do arquivo em trânsito. **O hash publicado passa a ser a
  única verificação de integridade disponível** — por isso ele é obrigatório, não opcional

**O que o código precisa respeitar**
- O CI publica o SHA-256 de todo artefato de release, e o hash aparece na página de download
- O guia de instalação tem uma seção dedicada ao aviso do SmartScreen, com captura de tela
  real e o motivo explicado sem jargão
- O texto nunca diz "ignore o aviso". Diz o que o aviso significa, por que aparece neste
  caso, e como conferir o hash antes de prosseguir
- O canal de atualização automática **continua exigindo assinatura Ed25519 própria**
  (ver [ADR-0011](0011-atualizacao-blue-green.md)). Não ter Authenticode não significa
  aceitar pacote não verificado: são camadas diferentes, e a segunda é inegociável

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
