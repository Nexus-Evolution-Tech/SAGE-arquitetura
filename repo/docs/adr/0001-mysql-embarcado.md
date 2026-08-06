# ADR-0001 — MySQL embarcado, sem instalador MSI

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O SAGE roda num PC Windows dentro da escola, instalado por uma secretária sem
conhecimento técnico e mantido remotamente por alguém a quilômetros de distância.
O `.exe` de distribuição precisa deixar o banco de dados funcionando sem suporte
presencial.

O instalador MSI oficial da Oracle é a maior fonte de falha de primeiro run:
exige Visual C++ Redistributable, entra em conflito com qualquer instância de
MySQL já presente na máquina, e falha de formas que não dá para diagnosticar a
30 km de distância. O próprio CI do projeto já falhou no recovery de uma
instalação via MSI.

Empacotar o MySQL dentro do `.exe` também não serve: adicionaria mais de 200 MB
ao instalador e criaria obrigação de redistribuição sob a licença GPLv2.

## Decisão

O SAGE gerencia o próprio `mysqld`, baixado em ZIP da URL oficial da Oracle no
primeiro run (não embarcado no `.exe`), validado por SHA-256 e extraído para
`dados/mysql/bin`. Roda em porta dedicada `33306` (nunca `3306`), ouvindo
somente em `127.0.0.1`. Não existe instalador MSI nem serviço do Windows para o
banco — o supervisor do próprio SAGE inicia e encerra o `mysqld`.

## Consequências

**Positivas**
- Nunca conflita com uma instância de MySQL já instalada na máquina (porta e
  bind dedicados)
- `.exe` de distribuição fica em torno de 15 MB
- A Oracle continua sendo quem distribui o MySQL — o SAGE fica fora da cadeia
  de redistribuição GPLv2
- Cache local: se o ZIP já existe e o hash bate, não baixa de novo

**Negativas / custo aceito**
- Primeiro run exige internet. Sem internet, a instalação para com mensagem
  clara (`SETUP-NET-01`) em vez de terminar pela metade
- Encerramento incorreto do `mysqld` (kill forçado) corrompe InnoDB — o
  supervisor precisa sempre encerrar via `mysqladmin shutdown` e esperar o
  processo sair de fato

**O que o código precisa respeitar**
- Porta `33306`, nunca `3306`
- `bind-address=127.0.0.1` obrigatório, verificável por `netstat`
- `innodb_flush_log_at_trx_commit=1` — o PC é desligado no botão todo dia,
  durabilidade vale mais que velocidade
- `datadir` em `C:\ProgramData\SAGE\dados\mysql`, fora da pasta de release
- Encerramento sempre via `mysqladmin shutdown`, nunca `taskkill /F` no
  `mysqld`
- Download verifica SHA-256 antes de extrair; hash divergente aborta sem
  extrair nada
- `sage_app` (usuário de runtime) não tem `DROP`, `GRANT` nem `FILE` — só
  `SELECT, INSERT, UPDATE, DELETE`

## Alternativas consideradas

### Instalador MSI oficial da Oracle — recusada
Maior fonte de falha de primeiro run: exige VC++ Redistributable, conflita com
instância existente, falha de formas não diagnosticáveis remotamente.

### Embarcar o MySQL dentro do `.exe` — recusada
Adiciona mais de 200 MB ao instalador e cria obrigação de redistribuição
GPLv2 para o projeto.

## Referências

- `docs/arquitetura/SAGE-plano-mestre.md`
