# ADR-0014 — Fronteira de confiança e transporte

- **Status:** aceito
- **Data:** 2026-08-11
- **Contexto do achado:** `[+2A-E02]` — `nginx.conf:19-35` e `SAGE.iss:35-36` servem tudo em
  `http://` puro. Não há terminação TLS nem política de redirecionamento em lugar nenhum.

## Contexto

O SAGE roda on-premise. O dono do produto definiu o teto de implantação:

> "vai rodar localmente na máquina da secretaria, no máximo entre servidor e a máquina como
> front end, mas no máximo."

São **duas topologias, e só duas**:

- **T1 — uma máquina.** API, banco e navegador no mesmo host. É o caso comum.
- **T2 — duas máquinas.** Servidor num host, navegador da secretaria noutro, mesma LAN. É o teto.

Duas restrições do projeto mandam aqui tanto quanto a segurança:

- **Uma visita presencial.** O que quebrar depois quebra remotamente, e ninguém vai lá consertar.
- **Sem manutenção por muito tempo.** ADR-0012 já estabelece que nada operacional pode depender
  de rede externa.

## Decisão

**T1 é o padrão, e nele não existe TLS — a API escuta só em `127.0.0.1`.**

Sem fio não há escuta. Adicionar TLS ao loopback é custo de instalação e um certificado a mais
para expirar, comprando risco de campo contra uma ameaça que não existe naquela topologia.

**T2 é modo explícito de configuração, e nele TLS é obrigatório.** Ao habilitá-lo, o instalador:

1. Gera uma **CA local** e um certificado folha para o nome/IP do host, por CSPRNG, com a mesma
   ACL dos demais segredos do instalador
2. Instala a CA no store de máquina do host servidor
3. Emite um artefato único `confiar-sage.cer` + instruções, para o operador confiar a CA na
   segunda máquina
4. Passa a API a escutar na interface da LAN **apenas em TLS**, e `http://` responde redirecionamento

**Não há terceira topologia.** Nenhum caminho abre a API para fora da LAN. Suporte remoto continua
sendo o que o ADR-0012 define: saída, nunca entrada.

## Validade do certificado: 10 anos, deliberadamente

Certificado de CA pública curto é boa prática porque existe renovação automatizada e alguém de
plantão. **Aqui não existe nem um nem outro.** Um certificado de 1 ano numa máquina que ninguém
visita expira em silêncio e derruba a segunda máquina — falha remota, sem operador, exatamente
o cenário que o projeto inteiro tenta evitar.

Entre "chave longa demais" e "sistema fora do ar sem ninguém para consertar", escolho a primeira.
A mitigação é operacional, não criptográfica:

- A CA e a chave folha ficam com ACL de serviço, no mesmo nível dos segredos do banco
- O **readiness expõe a data de expiração**, e o heartbeat da R3 avisa com **180 dias** de
  antecedência — tempo de sobra para reemitir remotamente
- Reemissão é uma operação do instalador, não uma edição manual de arquivo

## Consequências

**Boas:**
- O caso comum (T1) fica com zero superfície de rede e zero certificado. É a configuração mais
  segura e a mais barata ao mesmo tempo
- O achado `E-02` fecha nos dois modos: em T1 porque não há fio, em T2 porque há TLS
- T2 é chave de configuração, não redesenho — o teto do dono do produto cabe sem reescrita

**Ruins, e assumidas:**
- Confiar a CA na segunda máquina é **passo manual**, e é o único passo do sistema que pode
  precisar de alguém competente do outro lado do telefone. Tem de estar no roteiro da visita
- CA local de 10 anos comprometida é comprometimento longo. Aceito porque o vetor exige acesso
  ao disco do servidor — quem tem isso já tem o banco
- `nginx.conf` e o atalho do `SAGE.iss` mudam nos dois modos; entram no escopo da R2

## Alternativas descartadas

- **TLS sempre, inclusive em T1.** Custo de instalação e um certificado a mais para expirar,
  contra ameaça inexistente no loopback.
- **Deixar HTTP em T2 porque "a rede é controlada".** Rede controlada não é rede confiável, e o
  que trafega é token de sessão e PII de menor de idade.
- **Túnel (SSH/WireGuard) em vez de TLS.** Mais peça para instalar, mais peça para quebrar
  remotamente, e nenhum ganho sobre TLS numa LAN de duas máquinas.
- **Certificado curto com renovação automática.** Renovação automática precisa de algo que a
  dispare e de alguém para consertar quando não disparar. Não há.

## Relação com outros ADRs

- **ADR-0012** (telemetria nunca é requisito) — este ADR mantém a regra: nenhuma entrada, só saída
- **ADR-0007** (dado com peso legal) — é o que torna o cleartext em T2 inaceitável
- **ADR-0013** (MySQL embarcado) — mesmo princípio: o banco já escuta só em loopback
