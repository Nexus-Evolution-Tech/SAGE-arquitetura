# Manutenção remota

**Contexto:** o SAGE roda num PC Windows dentro da escola, desligado toda noite, operado por
uma secretária não-técnica e mantido remotamente por alguém sem acesso físico, sem VPN e sem
orçamento. Este documento descreve como saber que algo quebrou, ver o que quebrou e consertar
sem estar lá.

---

## 1. O princípio: nada entra, tudo sai

Não há VPN, não há porta aberta, não há ninguém técnico do outro lado dentro da escola.

**Portanto: nada nunca entra. Tudo sempre sai.**

Toda comunicação é iniciada de dentro da escola, via HTTPS de saída (porta 443, que qualquer
rede escolar libera). O PC da escola fala com a internet; a internet nunca fala com o PC.

Consequência direta: não existe agente de monitoramento instalado à parte — **o próprio SAGE é
o agente.** O processo Node que roda em produção é também o canal de manutenção.

```
                    ESCOLA (sem porta aberta)
   ┌────────────────────────────────────────────────┐
   │  PC Windows                                    │
   │  ┌──────────────────────────────────────────┐  │
   │  │  SAGE (node.exe empacotado)              │  │
   │  │   ├─ heartbeat  ──────────────────────────┼──┼──►  healthchecks.io
   │  │   ├─ logs (limpos) ───────────────────────┼──┼──►  Grafana Cloud
   │  │   ├─ erros (limpos) ──────────────────────┼──┼──►  Sentry
   │  │   └─ updater (poll) ──────────────────────┼──┼──►  GitHub Releases
   │  └──────────────────────────────────────────┘  │
   │            │ LAN                                │
   │        [ Catraca Control iD ]                   │
   └────────────────────────────────────────────────┘
              Nenhuma seta entra. Todas saem.
```

Este documento cobre, nesta ordem: saber que quebrou, ver o que quebrou, e consertar sem estar
lá.

---

## 2. Saber que quebrou

A camada de maior valor e mais barata. Implemente primeiro.

### 2.1 Heartbeat (healthchecks.io, grátis)

O problema específico deste ambiente: **o PC é desligado todo dia.** Não dá para alertar em
"sistema offline" — isso dispararia um alarme falso toda noite. É preciso ter janelas de
expectativa separadas para cada tipo de silêncio, em vez de um único check "está vivo?".

Três checks separados no healthchecks.io:

| Check | Período | Grace | O que significa se falhar |
|---|---|---|---|
| `sage-vivo` | 5 min | 15 min | App caiu **durante o horário escolar** |
| `sage-boot-diario` | 1 dia | 4 h | O PC não ligou hoje — pode ser feriado ou pode ser problema |
| `sage-sync-catraca` | 30 min | 90 min | O app está de pé mas **perdeu a catraca** |

O terceiro check é o mais importante e o mais esquecido: um sistema de controle de acesso pode
estar "no ar" e completamente cego para o hardware. Do ponto de vista de quem usa, isso é
indistinguível de estar funcionando — até alguém pedir um relatório e faltarem semanas de
registros.

```js
// src/services/heartbeat.js
const PINGS = {
  vivo: process.env.HC_URL_VIVO,
  boot: process.env.HC_URL_BOOT,
  sync: process.env.HC_URL_SYNC
};

async function ping(nome, status = '') {
  const url = PINGS[nome];
  if (!url) return;                      // nunca derruba o app
  try {
    await fetch(`${url}${status}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    // silêncio proposital: falha de telemetria não é falha de negócio
  }
}
```

Configure o `sage-vivo` para só alertar em horário escolar. E ligue o ping ao `/ready` — nunca
pingue "estou bem" enquanto o readiness está falhando:

```js
// a cada 5 min
const pronto = await checkReadiness();
await ping('vivo', pronto.ok ? '' : '/fail');
```

Alerta chega por e-mail, grátis, sem cartão. Este único item tira a operação da cegueira total.

### 2.2 O sinal que a secretária dá de graça

Um indicador no topo do painel que ela consiga ler ao telefone:

```
┌──────────────────────────────────────┐
│  Sistema: OK          Catraca: OK    │
│  Última sincronização: há 2 minutos  │
│  Código de status: A7                │
└──────────────────────────────────────┘
```

O "código de status" resume em 2 caracteres o estado (banco, catraca, fila pendente, versão).
Ao telefone, basta pedir esse código — ele diz mais do que dez minutos de "não está funcionando
direito".

---

## 3. Ver o que quebrou

### 3.1 Logs saem da escola — mas limpos

O transporte de log tem, **antes dele**, uma camada de redação obrigatória.

Isto não é opcional. No instante em que um log com CPF de aluno sai do prédio da escola e vai
para um serviço de terceiro, existe um vazamento — mesmo que ninguém leia. Trate a redação como
infraestrutura, não como boa prática.

```js
// src/config/redact.js
const CAMPOS_PROIBIDOS = [
  'cpf', 'rg', 'nome', 'email', 'telefone', 'senha', 'password',
  'token', 'authorization', 'foto', 'imagem', 'endereco',
  'nome_responsavel', 'qrcode', 'rfid'
];

const PADROES = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,      '[EMAIL]'],
  [/\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[TEL]'],
  [/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/g,  'Bearer [JWT]']
];

function limpar(valor, profundidade = 0) {
  if (profundidade > 6) return '[fundo]';
  if (typeof valor === 'string') {
    return PADROES.reduce((s, [re, sub]) => s.replace(re, sub), valor);
  }
  if (Array.isArray(valor)) return valor.map(v => limpar(v, profundidade + 1));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) =>
      CAMPOS_PROIBIDOS.includes(k.toLowerCase())
        ? [k, '[REDIGIDO]']
        : [k, limpar(v, profundidade + 1)]
    ));
  }
  return valor;
}
```

Aplique como `format` do Winston, **antes** de qualquer transporte. Mantenha um teste que
reprova se um CPF sintético atravessar — dez linhas que protegem juridicamente o projeto.

**Regra de ouro para o resto do código:** logue `pessoa_id=4821`, nunca `pessoa=João Silva`.
IDs são inúteis para quem vaza e suficientes para depurar, porque o banco está disponível
quando for preciso cruzar.

**Destino:** Grafana Cloud (plano free, 50 GB de log, 14 dias de retenção) via Winston HTTP
para o Loki. A internet da escola vai cair — se o transporte falhar, ele **não pode** derrubar
o app nem estourar memória. Use fila em disco com teto (50 MB, descarta o mais antigo). Nunca
segure log em memória sem limite.

### 3.2 Erros com contexto (Sentry, plano free)

Logs dizem *que* quebrou. Sentry dá stack trace, versão, breadcrumbs e agrupamento por
assinatura — sem isso, mil ocorrências do mesmo bug afogam em ruído. 5.000 eventos/mês grátis é
mais do que este sistema usa.

Configuração inegociável:

```js
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,           // NUNCA true
  release: process.env.API_VERSION,
  environment: 'escola-taboao',
  beforeSend(evento) {
    return limpar(evento);         // mesma redação dos logs
  }
});
```

O `release` é o que faz isso valer: ao publicar a v1.4.2, se os erros dispararem, o Sentry
mostra que começaram exatamente nela — é o sinal de rollback.

---

## 4. Consertar sem estar lá

### 4.1 O canal de controle: GitHub como servidor

Não há servidor próprio e não há orçamento para um. Não é preciso nenhum dos dois.

**O SAGE consulta, a cada 15 minutos, um arquivo JSON num repositório público.** Esse arquivo
diz qual versão deve estar rodando. Se for diferente da atual, o app baixa o release do GitHub,
valida e aplica.

```json
// https://raw.githubusercontent.com/SEU-USER/sage-releases/main/canal.json
{
  "versao_alvo": "1.4.2",
  "url": "https://github.com/.../sage-1.4.2.zip",
  "sha256": "a3f9...",
  "assinatura": "MEUCIQ...",
  "emitido_em": "2026-08-04T12:00:00Z",
  "instalacao": "etec-taboao"
}
```

Custo: zero. Infraestrutura para manter: zero. Disponibilidade: a do GitHub.

### 4.2 Este canal é poderoso — trate-o como tal

Um mecanismo que baixa e executa código remotamente é, tecnicamente, um backdoor. A diferença
entre "atualizador legítimo" e "backdoor" é inteiramente disciplina de engenharia. Nenhum
destes pontos é negociável:

- **Assinatura obrigatória.** Par de chaves Ed25519. A chave pública vai embutida no app; a
  privada fica **só com o mantenedor**, fora do repositório, fora da máquina da escola. Nenhum
  pacote sem assinatura válida é aplicado. Sem isso, quem comprometer a conta do GitHub
  controla o sistema da escola.
- **Verificação de hash** antes de descompactar.
- **Sem comandos arbitrários.** O canal só transporta *versões*. Nunca implementar "execute
  este shell" — nem em emergência. No dia em que existir, terá sido criada uma execução remota
  de código numa máquina com dados de menores.
- **Anti-downgrade.** Recusa versão menor que a instalada, exceto se o JSON trouxer
  `rollback: true` explícito e assinado.
- **Registro em log** de toda atualização aplicada, com versão, horário e hash.
- **A escola precisa saber que isso existe.** Um mecanismo de atualização remota não divulgado,
  num sistema com dados de menores, é o tipo de coisa que precisa estar no acordo por escrito
  com a direção antes de existir em produção.

> **Recomendação prática:** fixe versões exatas de todas as dependências (sem `^`), commit o
> `package-lock.json`, use sempre `npm ci` em campo, e empacote o `node.exe` junto da aplicação
> com hash validado. Assim nenhuma atualização do Windows, nenhum release novo de dependência e
> nenhum Node instalado na máquina muda o runtime sob os pés do sistema em produção. Ver
> [ADR-0004 — Runtime congelado](../adr/0004-runtime-congelado.md).

### 4.3 Auto-start e auto-restart: o supervisor

Sem instalar NSSM, WinSW ou qualquer serviço de terceiro — o **Agendador de Tarefas do
Windows** já resolve, nativamente:

```
Gatilho:  Ao iniciar o sistema  (resolve o PC ser desligado toda noite)
Ação:     C:\ProgramData\SAGE\current\node.exe supervisor.js
Config:   Reiniciar a tarefa a cada 1 minuto, até 999 vezes
          Executar mesmo sem usuário logado
```

O `supervisor.js` é próprio do projeto, tem ~60 linhas, e faz: sobe o app como processo filho,
monitora `/ready`, reinicia se morrer, aplica backoff exponencial para não entrar em loop de
crash, e reporta ao heartbeat. Zero dependências externas, zero instalação adicional.

### 4.4 Quando é preciso mesmo ver a tela

Para o caso raro e desesperado: **Assistência Rápida** (Quick Assist), nativa do Windows 10/11.
A secretária abre, lê um código de 6 dígitos ao telefone, e o mantenedor entra e vê a tela.

É atendido — ela precisa estar lá —, o que é uma limitação e também uma proteção: ninguém
acessa aquele PC sem alguém da escola autorizar na hora. Para este contexto, é a propriedade
certa.
