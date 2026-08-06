# Runbook — remoção de dados pessoais do histórico do Git

**Situação:** `database/` contém dados reais de alunos da ETEC de Taboão, e os repositórios
foram públicos. Isso é um incidente de dado pessoal envolvendo menores de idade.

**Faça na ordem.** Os passos 1 e 2 são de hoje e levam minutos.

---

## Passo 0 — Não faça isto

- Não apague o arquivo com um commit novo. Isso **não** remove do histórico, e ainda
  sinaliza exatamente onde procurar
- Não reescreva o histórico com PRs abertos ou branches em voo sem avisar a equipe
- Não adie até "terminar o software". Cada dia é mais exposição, e o custo da limpeza
  cresce com o número de commits, branches e clones

---

## Passo 1 — Estancar (hoje, 2 minutos)

```bash
# Tornar privado — Settings → General → Danger Zone → Change visibility
# Faça nos DOIS repositórios: SAGE-API e SAGE
```

**Verifique forks.** Fork guarda os objetos do git de forma independente. Se existir um,
toda a limpeza abaixo é inútil enquanto ele existir.

```bash
gh api repos/Nexus-Evolution-Tech/SAGE-API/forks --jq '.[].full_name'
gh api repos/Nexus-Evolution-Tech/SAGE/forks --jq '.[].full_name'
```

Se retornar algo, resolva antes de prosseguir. Repositório privado não pode ter fork
público — mas forks criados enquanto era público **permanecem**.

---

## Passo 2 — Descobrir o alcance (hoje, 20 minutos)

Antes de limpar, saiba tudo que precisa sair. Trabalhe num clone descartável.

```bash
git clone https://github.com/Nexus-Evolution-Tech/SAGE-API.git /tmp/auditoria
cd /tmp/auditoria
```

**Todo arquivo que já existiu no histórico:**

```bash
git log --all --pretty=format: --name-only --diff-filter=A | sort -u > /tmp/todos-arquivos.txt
```

**Arquivos suspeitos por nome:**

```bash
grep -Ei '\.(sql|csv|xlsx|env|pem|key|p12|bak|dump)$|dados|alunos|pessoas|backup' /tmp/todos-arquivos.txt
```

**`.env` real já commitado alguma vez:**

```bash
git log --all --full-history --oneline -- '**/.env' '**/.env.*' '!**/.env.example'
```

**Procurar CPF, e-mail e telefone em todo o histórico:**

```bash
git grep -InE '[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}' $(git rev-list --all) -- 'database/*' | head -40
```

> Cuidado: a saída acima **mostra os dados**. Rode num terminal seu, não cole em issue,
> chat, ou log. Anote só os caminhos dos arquivos.

**Varredura de segredo com ferramenta dedicada** (gratuito):

```bash
docker run -v /tmp/auditoria:/repo zricethezav/gitleaks:latest detect \
  --source /repo --report-path /tmp/gitleaks.json --redact
```

`--redact` mascara os valores no relatório — use sempre.

**Produza a lista final** de caminhos a remover. Exemplo:

```
database/dados_etec_taboao.sql
database/backup_*.sql
exports/*.xlsx
```

---

## Passo 3 — Preparar a substituição

Antes de remover, tenha o que colocar no lugar — senão o projeto fica sem seed e o
desenvolvimento trava.

```bash
# Gerar seed sintético a partir da ESTRUTURA (não dos dados)
mysqldump --no-data -u root -p sage > database/schema.sql

# Criar database/seed-sintetico.sql com dados inventados:
#  - nomes de personagens fictícios
#  - CPFs que passam na validação mas são inválidos (ex.: 000.000.000-00 variantes)
#  - e-mails @exemplo.local
#  - volume parecido com o real (200 alunos, 20 professores, 8 turmas)
```

Regra: o seed sintético deve ser **grande o bastante para testar performance** e
**óbvio o bastante para ninguém confundir com dado real**.

Adicione ao `.gitignore` antes de qualquer coisa:

```gitignore
database/dados_*.sql
database/backup*.sql
exports/
uploads/
*.env
!.env.example
```

---

## Passo 4 — Reescrever o histórico

Use `git-filter-repo` (substituto oficial do `filter-branch`; o BFG é mais antigo).

```bash
pip install git-filter-repo
```

**Avise a equipe antes.** Depois disso, todo clone existente fica inválido e precisa ser
refeito. Combine uma janela em que ninguém tenha trabalho não commitado.

```bash
# 1. Clone espelhado (obrigatório — pega TODAS as refs, branches e tags)
git clone --mirror https://github.com/Nexus-Evolution-Tech/SAGE-API.git sage-api-limpo.git
cd sage-api-limpo.git

# 2. Guarde uma cópia de segurança OFFLINE, fora de qualquer nuvem
cp -r . ~/backup-sage-api-antes-limpeza.git

# 3. Remover os caminhos de todo o histórico
git filter-repo \
  --path database/dados_etec_taboao.sql \
  --path-glob 'database/backup*.sql' \
  --path-glob 'exports/*' \
  --invert-paths

# 4. Conferir que sumiu
git log --all --oneline -- database/dados_etec_taboao.sql   # deve vir vazio
git grep -IE '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}' $(git rev-list --all) | head

# 5. Publicar
git remote add origin https://github.com/Nexus-Evolution-Tech/SAGE-API.git
git push --force --mirror origin
```

Repita para o repositório `SAGE`.

---

## Passo 5 — O passo que quase todo mundo esquece

**Force push não apaga os objetos no GitHub.** Commits ficam acessíveis por URL direta de
SHA por tempo indeterminado. Alguém com o hash antigo continua conseguindo ler o arquivo.

Abra um chamado no GitHub Support pedindo *garbage collection*:

> Assunto: Request permanent removal of sensitive data from repository history
>
> We have rewritten the history of `Nexus-Evolution-Tech/SAGE-API` and
> `Nexus-Evolution-Tech/SAGE` to remove files containing personal data of minors.
> Please run garbage collection to permanently purge the unreachable objects and any
> cached views. Affected paths: `database/dados_etec_taboao.sql` and related.

Sem esse passo a limpeza é parcial.

---

## Passo 6 — Depois da reescrita

- [ ] Toda a equipe **apaga o clone local e clona de novo**. Não faça `git pull` — traria os
  objetos de volta
- [ ] PRs abertos precisam ser refeitos a partir da nova base
- [ ] Referências de commit em issues antigas vão apontar para SHA inexistente. Normal
- [ ] Aproveite e apague as branches antigas que não têm mais uso (`git branch -r` para listar)
- [ ] Rotacione toda credencial que possa ter passado pelo histórico: senha do MySQL,
  `JWT_SECRET`, senha da catraca, SMTP
- [ ] Rode o gitleaks de novo no repositório limpo para confirmar

---

## Passo 7 — Impedir que volte

Adicione ao CI (ver `.github/workflows/ci.yml`) um passo de varredura que **reprova o PR**
se encontrar padrão de CPF, e-mail real ou segredo no diff.

Instale um hook local:

```bash
# .git/hooks/pre-commit
#!/bin/sh
if git diff --cached --name-only | grep -qE 'database/dados_|\.env$|backup.*\.sql'; then
  echo "BLOQUEADO: arquivo com possível dado real."
  echo "Se for realmente necessário, use --no-verify e justifique no commit."
  exit 1
fi
```

---

## Passo 8 — Comunicar

A escola é a **controladora** dos dados; o mantenedor é o **operador**. Quem decide o que fazer
é ela, mas ela só decide se souber.

Leve por escrito, de forma factual e sem drama:

- O que foi exposto (tipos de dado, quantas pessoas aproximadamente, quais categorias)
- Por quanto tempo, e em que condição (repositório público no GitHub)
- O que já foi feito (privado, histórico reescrito, GC solicitado, credenciais rotacionadas)
- O que foi feito para não repetir (gitignore, CI, hook, seed sintético)
- Que a decisão sobre comunicar titulares e ANPD é da escola

*Isto não é orientação jurídica.* Vale a escola consultar quem cuida de proteção de dados no
Centro Paula Souza — instituição desse porte costuma ter encarregado (DPO) designado.

---

## Registro do incidente

Crie `docs/incidentes/2026-08-dados-historico-git.md` com a linha do tempo, o que foi feito
e o que mudou no processo. Não é burocracia: é o documento que demonstra que houve tratamento
diligente, e é o que será útil se alguém perguntar daqui a dois anos.
