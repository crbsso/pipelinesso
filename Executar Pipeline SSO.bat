@echo off
setlocal

set "PROJETO=%~dp0"

if "%PROJETO:~-1%"=="\" (
    set "PROJETO=%PROJETO:~0,-1%"
)

set "PYTHON=%PROJETO%\.venv\Scripts\python.exe"

cd /d "%PROJETO%"

echo ============================================================
echo PIPELINE SSO - EXECUCAO GLOBAL
echo ============================================================
echo.

if not exist "%PYTHON%" (
    echo ERRO: Python do ambiente virtual nao encontrado.
    echo.
    echo Caminho esperado:
    echo %PYTHON%
    echo.
    pause
    exit /b 1
)

"%PYTHON%" "%PROJETO%\backend\executar_pipeline_sso.py"

set "CODIGO_ERRO=%ERRORLEVEL%"

echo.
echo ============================================================

if "%CODIGO_ERRO%"=="0" (
    echo PIPELINE FINALIZADO COM SUCESSO
) else (
    echo PIPELINE FINALIZADO COM ERRO
    echo Codigo de erro: %CODIGO_ERRO%
)

echo ============================================================
echo.
pause

endlocal & exit /b %CODIGO_ERRO%
