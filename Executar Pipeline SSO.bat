@echo off

set "PROJETO=C:\Users\vinicius.brum\Documents\1.0ProjetosCeleo\pipelinesso"
set "PYTHON=%PROJETO%\.venv\Scripts\python.exe"

cd /d "%PROJETO%"

echo ============================================================
echo PIPELINE SSO
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

echo Iniciando pipeline...
echo.

"%PYTHON%" "%PROJETO%\executar_pipeline.py"

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

exit /b %CODIGO_ERRO%