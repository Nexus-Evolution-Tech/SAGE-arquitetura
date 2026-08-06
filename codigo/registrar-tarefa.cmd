@echo off
REM ===========================================================================
REM  SAGE - Registro do supervisor no Agendador de Tarefas do Windows
REM ===========================================================================
REM
REM  Executar UMA VEZ, como administrador (o clique de UAC que a secretaria da).
REM  Depois disso o sistema sobe sozinho a cada boot, sem nunca mais pedir
REM  elevacao - por isso a instalacao fica em C:\ProgramData e nao em
REM  C:\Program Files.
REM
REM  Este script e idempotente: pode rodar de novo sem quebrar nada.
REM ===========================================================================

setlocal

set "RAIZ=C:\ProgramData\SAGE"
set "NOME_TAREFA=SAGE"
set "USUARIO=SYSTEM"

echo.
echo  === SAGE - Instalacao do servico ===
echo.

REM --- Verifica elevacao ---------------------------------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRO] Este script precisa ser executado como Administrador.
    echo         Clique com o botao direito e escolha "Executar como administrador".
    echo.
    pause
    exit /b 1
)

REM --- Verifica se a instalacao existe -------------------------------------
if not exist "%RAIZ%\current\supervisor.js" (
    echo  [ERRO] Nao encontrei %RAIZ%\current\supervisor.js
    echo         Instale os arquivos do SAGE antes de registrar a tarefa.
    echo.
    pause
    exit /b 1
)

if not exist "%RAIZ%\current\node.exe" (
    echo  [AVISO] node.exe nao encontrado em %RAIZ%\current
    echo          O sistema vai depender do Node instalado na maquina, o que
    echo          significa que uma atualizacao do Windows pode quebra-lo.
    echo          Recomendado: empacotar o node.exe junto com a aplicacao.
    echo.
)

REM --- Cria a estrutura de dados (fora da pasta de release) ----------------
if not exist "%RAIZ%\dados"   mkdir "%RAIZ%\dados"
if not exist "%RAIZ%\logs"    mkdir "%RAIZ%\logs"
if not exist "%RAIZ%\config"  mkdir "%RAIZ%\config"

REM --- Permissoes ----------------------------------------------------------
REM  A pasta inteira precisa ser gravavel pelo SYSTEM para o auto-update
REM  funcionar sem elevacao. O .env recebe ACL restrita logo abaixo.
icacls "%RAIZ%" /grant "SYSTEM:(OI)(CI)F" /T >nul 2>&1

REM  sage.env guarda JWT_SECRET, senha do banco e SMTP: so SYSTEM e Administradores.
if exist "%RAIZ%\config\sage.env" (
    icacls "%RAIZ%\config\sage.env" /inheritance:r >nul 2>&1
    icacls "%RAIZ%\config\sage.env" /grant "SYSTEM:F" "Administradores:F" >nul 2>&1
    icacls "%RAIZ%\config\sage.env" /grant "Administrators:F" >nul 2>&1
    echo  [OK] Permissoes restritas aplicadas em config\sage.env
)

REM --- Remove tarefa anterior, se houver ------------------------------------
schtasks /Query /TN "%NOME_TAREFA%" >nul 2>&1
if %errorLevel% equ 0 (
    echo  [..] Removendo registro anterior da tarefa...
    schtasks /End    /TN "%NOME_TAREFA%" >nul 2>&1
    schtasks /Delete /TN "%NOME_TAREFA%" /F >nul 2>&1
)

REM --- Cria a tarefa --------------------------------------------------------
REM  /SC ONSTART  = ao iniciar o sistema (resolve o PC ser desligado toda noite)
REM  /RU SYSTEM   = roda sem usuario logado
REM  /RL HIGHEST  = privilegio suficiente para gerenciar o proprio diretorio
echo  [..] Registrando a tarefa "%NOME_TAREFA%"...
schtasks /Create ^
    /TN "%NOME_TAREFA%" ^
    /TR "\"%RAIZ%\current\node.exe\" \"%RAIZ%\current\supervisor.js\"" ^
    /SC ONSTART ^
    /RU "%USUARIO%" ^
    /RL HIGHEST ^
    /F >nul

if %errorLevel% neq 0 (
    echo  [ERRO] Falha ao registrar a tarefa.
    pause
    exit /b 1
)

REM --- Ajustes que o schtasks /Create nao expoe -----------------------------
REM  Reiniciar a tarefa a cada 1 min, ate 999 vezes, se ela terminar.
REM  Esta e a rede de seguranca de ultimo recurso: se o proprio supervisor
REM  morrer (nao deveria), o Windows o ressuscita.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$t = Get-ScheduledTask -TaskName '%NOME_TAREFA%';" ^
  "$t.Settings.RestartInterval = 'PT1M';" ^
  "$t.Settings.RestartCount = 999;" ^
  "$t.Settings.ExecutionTimeLimit = 'PT0S';" ^
  "$t.Settings.DisallowStartIfOnBatteries = $false;" ^
  "$t.Settings.StopIfGoingOnBatteries = $false;" ^
  "$t.Settings.StartWhenAvailable = $true;" ^
  "$t.Settings.MultipleInstances = 'IgnoreNew';" ^
  "Set-ScheduledTask -InputObject $t | Out-Null" >nul 2>&1

if %errorLevel% neq 0 (
    echo  [AVISO] Nao foi possivel aplicar os ajustes finos via PowerShell.
    echo          A tarefa funciona, mas sem reinicio automatico dela mesma.
)

REM --- Inicia agora ---------------------------------------------------------
echo  [..] Iniciando o SAGE...
schtasks /Run /TN "%NOME_TAREFA%" >nul 2>&1

echo.
echo  === Instalacao concluida ===
echo.
echo   Tarefa:  %NOME_TAREFA%
echo   Log:     %RAIZ%\dados\supervisor.log
echo   Painel:  http://localhost:3000
echo.
echo   Comandos uteis:
echo     schtasks /Query /TN "%NOME_TAREFA%" /V /FO LIST    (ver status)
echo     schtasks /End   /TN "%NOME_TAREFA%"                (parar)
echo     schtasks /Run   /TN "%NOME_TAREFA%"                (iniciar)
echo.
echo   Aguarde cerca de 1 minuto e verifique:
echo     http://localhost:3000/ready
echo.

pause
endlocal
