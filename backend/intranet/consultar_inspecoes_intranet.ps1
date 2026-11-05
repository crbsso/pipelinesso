# Portal SSO - Extracao local SQL Server/Intranet
# Consulta somente leitura. Sem escrita em banco.

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Inicio,

    [Parameter(Mandatory=$true)]
    [string]$Fim,

    [Parameter(Mandatory=$true)]
    [string]$DestinoJson,

    [switch]$PermitirCertificadoTemporario
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Data

$raiz = [IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\..")
)

$config = @{}
$envArquivo = Join-Path $raiz ".env"

if (-not (Test-Path -LiteralPath $envArquivo)) {
    throw "Arquivo .env nao encontrado."
}

foreach ($linha in Get-Content -LiteralPath $envArquivo) {
    if ($linha -match '^([^#=\s]+)=(.*)$') {
        $config[$Matches[1]] = $Matches[2]
    }
}

foreach ($chave in @(
    "SSO_SQL_SERVER",
    "SSO_SQL_DATABASE",
    "SSO_SQL_USERNAME",
    "SSO_SQL_PASSWORD_DPAPI"
)) {
    if (-not $config.ContainsKey($chave)) {
        throw "Configuracao ausente: $chave"
    }
}

$cultura = [Globalization.CultureInfo]::InvariantCulture

$dataInicio = [datetime]::ParseExact(
    $Inicio, "yyyy-MM-dd", $cultura
)
$dataFim = [datetime]::ParseExact(
    $Fim, "yyyy-MM-dd", $cultura
)

if ($dataInicio -ge $dataFim) {
    throw "Periodo invalido."
}

if (($dataFim - $dataInicio).TotalDays -gt 93) {
    throw "Limite de 93 dias por consulta."
}

$senha = $null
$conexao = $null

try {
    $senha = ConvertTo-SecureString -String `
        $config["SSO_SQL_PASSWORD_DPAPI"]
    $senha.MakeReadOnly()

    $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
    $builder["Data Source"] = $config["SSO_SQL_SERVER"]
    $builder["Initial Catalog"] = $config["SSO_SQL_DATABASE"]
    $builder["Encrypt"] = $true
    $builder["TrustServerCertificate"] = [bool]$PermitirCertificadoTemporario
    $builder["Pooling"] = $false
    $builder["Connect Timeout"] = 10
    $builder["Application Name"] = "PortalSSO-Intranet-Local"

    $conexao = [System.Data.SqlClient.SqlConnection]::new(
        $builder.ConnectionString
    )

    $conexao.Credential = [System.Data.SqlClient.SqlCredential]::new(
        $config["SSO_SQL_USERNAME"],
        $senha
    )

    $conexao.Open()

    $cmd = $conexao.CreateCommand()
    $cmd.CommandTimeout = 90

    $cmd.CommandText = @"
WITH fichas AS (
    SELECT DISTINCT
        [ID da Ficha] AS ficha_id,
        [ID da Aba] AS aba_id,
        [Nome da Ficha] AS familia,
        [Nome da Aba] AS tipo,
        [Periodicidade] AS periodicidade
    FROM inspecoes_bi.FichasCompletas_SESMT
)
SELECT
    i.[ID da Inspeção] AS id_inspecao,
    i.[ID da Ficha] AS ficha_id,
    i.[ID da Aba] AS aba_id,
    i.[ID do Ativo] AS ativo_id,
    CONVERT(varchar(27), i.[Preenchido em], 126) AS data_inspecao,
    i.[Concessão] AS concessao,
    i.[Localização Nome Completo] AS localizacao,
    f.familia,
    f.tipo,
    f.periodicidade
FROM inspecoes_bi.InspecoesCompletas_SESMT AS i
INNER JOIN fichas AS f
    ON f.ficha_id = i.[ID da Ficha]
   AND f.aba_id = i.[ID da Aba]
WHERE i.[Preenchido em] >= @inicio
  AND i.[Preenchido em] < @fim
ORDER BY
    i.[Preenchido em],
    i.[ID da Inspeção];
"@

    [void]$cmd.Parameters.Add(
        "@inicio",
        [System.Data.SqlDbType]::DateTime2
    )
    [void]$cmd.Parameters.Add(
        "@fim",
        [System.Data.SqlDbType]::DateTime2
    )

    $cmd.Parameters["@inicio"].Value = $dataInicio
    $cmd.Parameters["@fim"].Value = $dataFim

    $dados = [System.Data.DataTable]::new()
    $adaptador = [System.Data.SqlClient.SqlDataAdapter]::new($cmd)
    [void]$adaptador.Fill($dados)

    $registros = @(
        foreach ($linha in $dados.Rows) {
            $item = [ordered]@{}

            foreach ($campo in @(
                "id_inspecao",
                "ficha_id",
                "aba_id",
                "ativo_id",
                "data_inspecao",
                "concessao",
                "localizacao",
                "familia",
                "tipo",
                "periodicidade"
            )) {
                $valor = $linha[$campo]

                $item[$campo] = if (
                    $valor -is [System.DBNull]
                ) {
                    $null
                } else {
                    $valor
                }
            }

            [pscustomobject]$item
        }
    )

    $resultado = [ordered]@{
        origem = "SQL Server Intranet"
        inicio_inclusivo = $Inicio
        fim_exclusivo = $Fim
        fuso_origem = "nao_verificado"
        registros = @($registros)
    }

    $json = ConvertTo-Json `
        -InputObject $resultado `
        -Depth 6 `
        -Compress

    $destino = [IO.Path]::GetFullPath($DestinoJson)
    $pastaDestino = Split-Path -Parent $destino

    if (-not (Test-Path -LiteralPath $pastaDestino -PathType Container)) {
        throw "Diretorio de destino nao encontrado."
    }

    [IO.File]::WriteAllText(
        $destino,
        $json,
        [Text.UTF8Encoding]::new($false)
    )
}
finally {
    if ($null -ne $conexao) {
        $conexao.Dispose()
    }

    if ($null -ne $senha) {
        $senha.Dispose()
    }
}