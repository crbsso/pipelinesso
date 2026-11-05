@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "PROJETO=%~dp0"

if "%PROJETO:~-1%"=="\" (
    set "PROJETO=%PROJETO:~0,-1%"
)

set "PYTHON=%PROJETO%\.venv\Scripts\python.exe"

set "MODO="
set "AMBIENTE=MODO_NORMAL_PROD"

if not "%~1"=="" (
    if /I not "%~1"=="--teste-hml" if /I not "%~1"=="--atualizar-paineis" (
        echo ERRO: argumento nao autorizado.
        exit /b 2
    )
    if not "%~2"=="" (
        echo ERRO: argumentos extras nao permitidos.
        exit /b 2
    )
    set "MODO=%~1"
    if /I "%~1"=="--teste-hml" (
        set "AMBIENTE=TESTE_HML"
    ) else (
        set "AMBIENTE=PROD_SEM_HISTORICO"
    )
)

cd /d "%PROJETO%"

if errorlevel 1 (
    echo ERRO: pasta do projeto inacessivel.
    exit /b 2
)

if /I "%MODO%"=="--teste-hml" (
    if not exist "%PYTHON%" (
        if defined VIRTUAL_ENV (
            if exist "%VIRTUAL_ENV%\Scripts\python.exe" (
                set "PYTHON=%VIRTUAL_ENV%\Scripts\python.exe"
            )
        )
    )
)

if not exist "%PYTHON%" (
    echo ERRO: Python do ambiente virtual nao encontrado.
    echo Caminho esperado: %PYTHON%
    exit /b 2
)

if not defined LOCALAPPDATA (
    echo ERRO: LOCALAPPDATA nao definida.
    exit /b 2
)

set "BAT_RELEASE_SHA="
set "ORIGEM_SHA=HEAD_LOCAL_NAO_IMUTAVEL"

if /I "%MODO%"=="--teste-hml" (
    for /f "delims=" %%S in ('git -C "%PROJETO%" rev-parse HEAD 2^>nul') do set "BAT_RELEASE_SHA=%%S"
    if not defined BAT_RELEASE_SHA set "BAT_RELEASE_SHA=NAO_IDENTIFICADO"
) else (
    if not exist "%PROJETO%\release.sha" (
        echo ERRO: release.sha ausente.
        echo Instale um release aprovado antes do modo normal.
        exit /b 2
    )
    set /p "BAT_RELEASE_SHA="<"%PROJETO%\release.sha"
    set "ORIGEM_SHA=RELEASE_DECLARADO_NA_INSTALACAO"
)

if /I not "%MODO%"=="--teste-hml" (
    powershell.exe -NoProfile -Command "if ($env:BAT_RELEASE_SHA -match '^[0-9a-fA-F]{40}$') { exit 0 } else { exit 2 }" >nul
    if errorlevel 1 (
        echo ERRO: release.sha nao contem SHA Git valido.
        exit /b 2
    )
)

set "LOG_DIR=%LOCALAPPDATA%\PortalSSO\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if not exist "%LOG_DIR%" (
    echo ERRO: nao foi possivel criar pasta de logs.
    exit /b 2
)

set "EXEC_ID="

for /f "delims=" %%S in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss_fff"') do set "EXEC_ID=%%S"

if not defined EXEC_ID (
    echo ERRO: identificacao da execucao falhou.
    exit /b 2
)

set "BAT_LOG=%LOG_DIR%\portal_sso_%AMBIENTE%_%EXEC_ID%.log"
set "BAT_PYTHON=%PYTHON%"
set "BAT_SCRIPT=%PROJETO%\backend\executar_pipeline_sso.py"
set "BAT_MODO=%MODO%"

> "%BAT_LOG%" echo PIPELINE SSO - %AMBIENTE%
>> "%BAT_LOG%" echo SHA: %BAT_RELEASE_SHA% - %ORIGEM_SHA%
>> "%BAT_LOG%" echo PASTA: %PROJETO%

if not exist "%BAT_LOG%" (
    echo ERRO: arquivo de log nao foi criado.
    exit /b 2
)

echo ============================================================
echo PIPELINE SSO - %AMBIENTE%
echo SHA: %BAT_RELEASE_SHA% - %ORIGEM_SHA%
echo LOG: %BAT_LOG%
echo ============================================================
echo.

"%BAT_PYTHON%" -u "%PROJETO%\backend\executar_pipeline_sso_console.py"

set "CODIGO_ERRO=%ERRORLEVEL%"

>> "%BAT_LOG%" echo CODIGO_SAIDA: %CODIGO_ERRO%

echo.
echo ============================================================

if "%CODIGO_ERRO%"=="0" (
    echo PIPELINE FINALIZADO COM SUCESSO
) else (
    echo PIPELINE FINALIZADO COM ERRO
    echo Codigo de erro: %CODIGO_ERRO%
)

echo ============================================================
echo LOG: %BAT_LOG%

if /I "%SSO_BAT_PAUSE%"=="1" pause

endlocal & exit /b %CODIGO_ERRO%
