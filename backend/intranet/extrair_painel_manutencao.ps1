[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Inicio,
 [Parameter(Mandatory=$true)][string]$Fim,
 [Parameter(Mandatory=$true)][string]$DestinoJson,
 [Parameter(Mandatory=$true)][ValidateSet("America/Sao_Paulo")][string]$ConfirmarFusoOrigem,
 [switch]$PermitirCertificadoTemporario
)
$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.Data
$raiz=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$config=@{}
foreach($linha in Get-Content -LiteralPath (Join-Path $raiz ".env")){
 if($linha -match '^([^#=\s]+)=(.*)$'){$config[$Matches[1]]=$Matches[2]}
}
$inicioData=[datetime]::ParseExact($Inicio,"yyyy-MM-dd",[Globalization.CultureInfo]::InvariantCulture)
$fimData=[datetime]::ParseExact($Fim,"yyyy-MM-dd",[Globalization.CultureInfo]::InvariantCulture)
if($inicioData.Day -ne 1 -or $fimData.Day -ne 1 -or $fimData -le $inicioData -or ($fimData-$inicioData).TotalDays -gt 93){throw "Janela mensal invalida (maximo 93 dias)"}
$destino=[IO.Path]::GetFullPath($DestinoJson)
if(Test-Path -LiteralPath $destino){throw "Destino ja existe"}
$senha=$null
$conexao=$null
function Consultar([string]$sql) {
 $cmd=$conexao.CreateCommand()
 $cmd.CommandTimeout=90
 $cmd.CommandText=$sql
 [void]$cmd.Parameters.Add("@inicio",[System.Data.SqlDbType]::DateTime2)
 [void]$cmd.Parameters.Add("@fim",[System.Data.SqlDbType]::DateTime2)
 $cmd.Parameters["@inicio"].Value=$inicioData
 $cmd.Parameters["@fim"].Value=$fimData
 $dt=[System.Data.DataTable]::new()
 $adapter=[System.Data.SqlClient.SqlDataAdapter]::new($cmd)
 try {
  [void]$adapter.Fill($dt)
  foreach($r in $dt.Rows){
   $obj=[ordered]@{}
   foreach($c in $dt.Columns){$obj[$c.ColumnName]=if($r[$c] -is [DBNull]){$null}else{$r[$c]}}
   [pscustomobject]$obj
  }
 }finally{$adapter.Dispose();$cmd.Dispose()}
}
try{
 $senha=ConvertTo-SecureString -String $config["SSO_SQL_PASSWORD_DPAPI"]
 $senha.MakeReadOnly()
 $b=[System.Data.SqlClient.SqlConnectionStringBuilder]::new()
 $b["Data Source"]=$config["SSO_SQL_SERVER"]
 $b["Initial Catalog"]=$config["SSO_SQL_DATABASE"]
 $b["Encrypt"]=$true
 $b["TrustServerCertificate"]=[bool]$PermitirCertificadoTemporario
 $b["Pooling"]=$false
 $b["Connect Timeout"]=10
 $b["Application Name"]="PortalSSO-PainelManutencao-Leitura"
 $b["ApplicationIntent"]="ReadOnly"
 $conexao=[System.Data.SqlClient.SqlConnection]::new($b.ConnectionString)
 $conexao.Credential=[System.Data.SqlClient.SqlCredential]::new($config["SSO_SQL_USERNAME"],$senha)
 $conexao.Open()
 $capturado=[datetime]::UtcNow.ToString("o")
 $dados=@(Consultar @"
WITH f AS (
 SELECT DISTINCT [ID da Ficha] ficha_id,[ID da Aba] aba_id,[Nome da Ficha] familia,[Nome da Aba] tipo,[Periodicidade] periodicidade
 FROM inspecoes_bi.FichasCompletas_SESMT
)
SELECT i.[ID da Inspeção] id_inspecao,i.[ID da Ficha] ficha_id,i.[ID da Aba] aba_id,
 i.[ID do Ativo] ativo_id,CONVERT(varchar(27),i.[Preenchido em],126) data_inspecao,
 i.[Concessão] concessao,i.[Localização Nome Completo] localizacao,f.familia,f.tipo,f.periodicidade,
 TRY_CONVERT(bigint,i.[Número da OS]) os_id
FROM inspecoes_bi.InspecoesCompletas_SESMT i
JOIN f ON f.ficha_id=i.[ID da Ficha] AND f.aba_id=i.[ID da Aba]
WHERE i.[Preenchido em]>=@inicio AND i.[Preenchido em]<@fim
ORDER BY i.[ID da Inspeção]
"@)
 $ordens=@(Consultar @"
SELECT Id os_id,[Id do Plano] plano_id,[Concessão] concessao,[Localização Nome Completo] localizacao,
 [Id do Equipamento] equipamento_id,CONVERT(varchar(10),[Data Prevista],23) data_prevista,
 CONVERT(varchar(10),[Data Prevista Original],23) data_original,
 CONVERT(varchar(10),[Data de Fim (Realizado)],23) data_final_real,[Estágio] estagio
FROM oem_bi.OrdensServicoPreventivas
WHERE [Id do Plano] IN (197,143) AND [Data Prevista]>=@inicio AND [Data Prevista]<@fim
ORDER BY Id
"@)
 $ids=($ordens | ForEach-Object {[long]$_.os_id}) -join ","
 $atividades=@()
 if($ids){
  $atividades=@(Consultar @"
SELECT Id atividade_os_id,OrdemServicoId os_id,ListaAtividadeId lista_id,AtividadeId atividade_id,status,
 CONVERT(varchar(27),DataConclusao,126) data_conclusao
FROM [CRB-SRV-BDNOVO\AAM].[Treetech.EAM.Celeo].dbo.ListaAtividadeOrdemServicoAtividade
WHERE OrdemServicoId IN ($ids) AND AtividadeId IN (7911,7913,7915,7917,7918,7919) AND COALESCE(excluido,0)=0
ORDER BY OrdemServicoId,AtividadeId
"@)
 }
 $registros=@(foreach($r in $dados){$r | Select-Object id_inspecao,ficha_id,aba_id,ativo_id,data_inspecao,concessao,localizacao,familia,tipo,periodicidade})
 $vinculos=@($dados | Select-Object id_inspecao,ficha_id,aba_id,os_id,data_inspecao)
 $resultado=[ordered]@{versao=1;origem="SQL Server Intranet";fuso_origem=$ConfirmarFusoOrigem;
  inicio_inclusivo=$Inicio;fim_exclusivo=$Fim;extraido_em=$capturado;registros=$registros;
  programacao=@{inicio=$Inicio;fim_exclusivo=$Fim;fim_realizacoes_exclusivo=$Fim;ordens=$ordens;vinculos=$vinculos};
  atividades=$atividades}
 [IO.File]::WriteAllText($destino,(ConvertTo-Json -InputObject $resultado -Depth 8 -Compress),[Text.UTF8Encoding]::new($false))
 Write-Output ("Extracao concluida: "+$registros.Count+" formularios; "+$ordens.Count+" OS; "+$atividades.Count+" atividades")
}finally{if($conexao){$conexao.Dispose()};if($senha){$senha.Dispose()}}
