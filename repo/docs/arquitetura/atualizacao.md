# SAGE — Atualização em produção

Como uma atualização é aplicada na máquina da escola sem perder dado, e o que a pessoa que clica em "Atualizar" precisa ver. O mecanismo de troca atômica (blue-green local) que sustenta este desenho está registrado em **[ADR-0011 — Atualização blue-green](../adr/0011-atualizacao-blue-green.md)**; este documento explica o raciocínio por trás dele.

---

## A regra que resolve 90% do problema

> **Código é descartável. Dado é sagrado. Eles nunca moram no mesmo lugar.**

Essa é a ideia central, e quase todo o resto é consequência dela.

O atualizador **não pode** perder dado porque ele nunca toca na pasta de dados. Ele substitui a pasta de código inteira — joga fora e põe outra no lugar. Se a pasta de dados estivesse dentro da pasta de código, cada atualização apagaria tudo. É por isso que o layout importa tanto:

```
C:\ProgramData\SAGE\
├── releases\
│   ├── 1.4.1\        ← código. Descartável.
│   └── 1.4.2\        ← código. Descartável.
├── current  →  junção apontando para releases\1.4.2
│
├── dados\            ← SAGRADO. O atualizador nunca escreve aqui.
│   ├── mysql\
│   ├── uploads\
│   └── backups\
├── config\           ← SAGRADO.
└── logs\             ← SAGRADO.
```

A atualização é literalmente: baixar `1.4.2\`, apontar a junção para ela, reiniciar. Nada mais.

E como voltar atrás? Aponta a junção de volta para `1.4.1\`, que continua em disco. É por isso que se guardam as versões antigas — o rollback custa milissegundos.

---

## A única coisa que toca no dado: migrations

Se código e dado são separados, sobra um problema: às vezes a versão nova precisa de uma coluna nova. Aí sim o dado muda.

Como isso é tratado:

**1. O schema tem número de versão.** Uma tabela `schema_migrations` guarda quais migrations já rodaram. O sistema sabe se o banco está na versão 12, 13 ou 14.

**2. O código declara de qual schema ele precisa.**

```json
{
  "versao": "1.4.2",
  "schema_minimo": 12,
  "schema_maximo": 14
}
```

Isso é o **contrato de compatibilidade**, e é o que impede o pior cenário: binário antigo encontrando banco novo depois de um rollback. Se não bate, o app recusa subir com mensagem clara em vez de corromper dado silenciosamente.

**3. Migrations só expandem.** Nunca remova uma coluna na mesma versão que para de usá-la. Renomear `nome` para `nome_completo` vira quatro versões:

| Versão | O que faz |
|---|---|
| 1.4.2 | Cria `nome_completo`. Escreve nas duas, lê de `nome` |
| 1.4.3 | Lê de `nome_completo`. Ainda escreve nas duas |
| 1.4.4 | Para de escrever em `nome` |
| 1.5.0 | Remove `nome` — semanas depois, com tudo estável |

Chato e lento. É também a única forma de o rollback continuar funcionando. Se `nome` fosse apagada na 1.4.2 e fosse preciso voltar para a 1.4.1, a versão antiga procuraria uma coluna que não existe mais e quebraria.

**4. Backup verificado antes de qualquer migration.** Não negociável.

---

## A sequência exata

O que acontece quando alguém clica em "Atualizar":

```
FASE 1 — PREPARAÇÃO (em segundo plano, antes do clique)
  1. Consulta o canal de atualização
  2. Baixa o pacote
  3. Verifica hash SHA-256
  4. Verifica assinatura Ed25519
  5. Extrai para releases\1.4.2\ (a versão em uso continua rodando, intacta)
  6. Confere o contrato de schema
  7. Marca como PRONTA e acende o sinal na tela
     ── Se qualquer passo falhar aqui, nada aconteceu. Sistema segue normal.

FASE 2 — APLICAÇÃO (depois do clique)
  8.  Drenagem: para de aceitar requisição nova, termina as em andamento
  9.  Pausa os jobs de sincronização da catraca
  10. Backup do banco + verificação por restauração
  11. Para o app (encerramento gracioso)
  12. Roda as migrations
  13. Aponta a junção current → 1.4.2   ← ATÔMICO, o ponto de virada
  14. Sobe o app
  15. Aguarda /ready por até 90 s

FASE 3 — VEREDICTO
  16a. /ready OK  → confirma, registra, avisa o mantenedor, mantém 1.4.1 em disco
  16b. /ready NÃO → junção volta para 1.4.1, restaura o backup se houve
                    migration, sobe de novo, ALERTA VERMELHO
```

Três detalhes que separam amador de profissional:

**O download acontece antes do sinal aparecer.** O aviso "atualização disponível" só surge quando o pacote já está baixado, verificado e extraído. Clicar leva segundos e não depende da internet naquele momento. É assim que o Chrome faz — quando aparece a setinha, já está tudo pronto no disco.

**Drenagem antes de parar.** Matar o processo no meio de uma requisição deixa transação pela metade. O certo é parar de aceitar novas, esperar as atuais terminarem (com teto de tempo), e só então encerrar.

**O passo 13 é o único irreversível-ish, e é atômico.** Trocar uma junção é uma operação só do sistema de arquivos. Não existe estado "meio trocado" — é essa propriedade que o ADR-0011 formaliza como o mecanismo central da atualização.

---

## A experiência de quem clica

O que produtos maduros mostram (Chrome, VS Code, Slack):

```
┌─────────────────────────────────────────────┐
│  ● Atualização pronta para instalar         │
│                                             │
│  Versão 1.4.2                               │
│  • Corrige o registro de saída duplicado    │
│  • Melhora a velocidade dos relatórios      │
│                                             │
│  A catraca ficará parada por cerca de       │
│  40 segundos.                               │
│                                             │
│  Melhor horário: após as 18h                │
│                                             │
│  [ Instalar agora ]  [ Instalar às 18h ]    │
└─────────────────────────────────────────────┘
```

Quatro coisas que essa tela faz certo:

- **Diz o que mudou**, em português de usuário, não em commit message
- **Diz o custo** — 40 segundos com a catraca parada. Quem instala precisa saber para não clicar com fila na porta
- **Sugere horário** — o sistema conhece o calendário escolar; use isso
- **Oferece agendar** — a opção mais provável de ser escolhida

E durante a aplicação: barra com etapa nomeada ("Fazendo backup…", "Atualizando o banco…"), nunca uma barra parada sem texto.

Se der errado: **"A atualização não deu certo e o sistema voltou à versão anterior. Nada foi perdido. Código: UPD-READY-FAIL."** A pessoa precisa saber que está tudo bem — essa frase é o produto inteiro do rollback automático.

---

## Em uma frase

Código é descartável e vive em `releases\`, dado é sagrado e vive fora do alcance do atualizador, a troca de versão é uma junção que aponta para outro lugar — atômica, reversível em milissegundos — e quem clica em "Atualizar" só vê essa complexidade como custo declarado, horário sugerido e uma garantia clara de que, se algo falhar, nada se perde.
