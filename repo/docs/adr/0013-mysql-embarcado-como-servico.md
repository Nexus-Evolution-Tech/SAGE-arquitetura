# ADR-0013 — MySQL embarcado no instalador, como serviço do Windows

- **Status:** Aceito
- **Data:** 2026-08-06
- **Decide:** arquiteto
- **Supersede:** [ADR-0001](./0001-mysql-embarcado.md)

## Contexto

O ADR-0001 decidiu que o MySQL seria **baixado do site oficial na primeira execução**, ficaria
em `dados\mysql`, escutaria na porta **33306** e seria mantido por um **supervisor próprio**,
sem serviço do Windows.

A auditoria de 2026-08-06 (achado H-011) constatou que a implementação faz o oposto, em todos
os quatro pontos: o ZIP do MySQL de ~281 MB é **embutido** no `.exe`, o runtime fica em
`%ProgramFiles%\SAGE\runtime\mysql`, o datadir em `%ProgramData%\SAGE\mysql\data`, a porta é
**3307** e existe um **serviço Windows** `SAGEMySQL` via WinSW, com dependência `SAGEAPI →
SAGEMySQL`.

Só uma das duas pode valer. Escolher o ADR custaria semanas refazendo o que já funciona;
escolher a implementação custa este documento.

## Decisão

**A implementação vence. O ADR-0001 fica superado.**

1. **MySQL embarcado no instalador**, não baixado no primeiro run
2. **Serviço do Windows** (`SAGEMySQL`, WinSW, LocalService com service SID), com dependência
   da API sobre ele
3. **Porta 3307**, apenas em `127.0.0.1`
4. Runtime em `%ProgramFiles%\SAGE\runtime\mysql`; **datadir em `%ProgramData%\SAGE\mysql\data`**

## Justificativa

**Sobre o download no primeiro run.** A instalação acontece numa escola cuja rede é
desconhecida, com uma secretária não-técnica na frente da tela e uma única visita presencial
possível. Depender de baixar 280 MB do site da Oracle no pior momento possível — durante a
instalação, sem ninguém técnico por perto — troca um problema resolvido por um risco de
campo. Embutir torna a instalação determinística e offline.

**Sobre o serviço do Windows.** O PC é desligado toda noite. Serviço com `recovery` e
dependência declarada sobe na ordem certa depois do boot, sem processo intermediário que possa
morrer. O supervisor próprio previsto no ADR-0001 continua útil para a **aplicação**, mas para
o banco o serviço é mais simples e mais confiável.

**Sobre a porta.** 3307 versus 33306 é irrelevante tecnicamente — ambas evitam a 3306 padrão.
Mudar agora só criaria migração sem ganho. Fica 3307, com a ressalva do parágrafo seguinte.

## Consequências

**Positivas:** instalação offline e determinística; sobrevive ao reboot noturno sem
supervisor intermediário; o datadir continua fora de `releases\`, preservando a regra do
ADR-0011 de que atualização não toca em dado.

**Negativas e aceitas:**
- O `.exe` fica com ~281 MB a mais. Aceitável: é distribuído uma vez, por download único
- Colisão na porta 3307 só é descoberta tarde na instalação. **Mitigação obrigatória:** a
  verificação de porta entra no preflight, antes de qualquer escrita (ver H-005)

**Pendência que este ADR NÃO resolve e que continua aberta:** o próprio
`installer/windows/artifacts.json` declara `signatureVerification: pending` e
`redistribution: legal-review-required` para o MySQL. Redistribuir o binário da Oracle dentro
de um instalador tem condições de licença que ninguém verificou. **Isto não bloqueia o
desenvolvimento, mas bloqueia a distribuição pública** — e precisa de resposta antes de o
`.exe` sair para qualquer lugar além da escola piloto. Registrado como item do dono do produto,
não do implementador.

## Alternativas descartadas

- **Manter o ADR-0001 e refazer a implementação:** semanas de trabalho para trocar um desenho
  que funciona por outro com mais pontos de falha em campo
- **Trocar por banco com licença permissiva (PostgreSQL):** resolveria a pendência de
  redistribuição, mas exigiria reescrever todo o acesso a dados, migrations e o instalador.
  Desproporcional agora; se a licença virar impedimento real, reabrir como decisão nova
