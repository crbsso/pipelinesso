[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$ArquivoBase,
 [Parameter(Mandatory=$true)][string]$ArquivoConfiguracao,
 [Parameter(Mandatory=$true)][string]$DestinoJson,
 [switch]$PermitirCertificadoTemporario
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Data
$base=Get-Content -LiteralPath $ArquivoBase -Raw | ConvertFrom-Json
if($base.versao -ne 1 -or $base.origem -ne 'SQL Server Intranet'){throw 'Extracao base invalida'}
$destino=[IO.Path]::GetFullPath($DestinoJson)
if(Test-Path -LiteralPath $destino){throw 'Destino ja existe'}
$config=@{}
foreach($linha in Get-Content -LiteralPath $ArquivoConfiguracao){if($linha -match '^([^#=\s]+)=(.*)$'){$config[$Matches[1]]=$Matches[2].Trim().Trim('"').Trim("'")}}
$senha=$null; $conexao=$null
function Consultar([string]$sql){
 $cmd=$conexao.CreateCommand(); $cmd.CommandTimeout=90; $cmd.CommandText=$sql
 [void]$cmd.Parameters.Add('@inicio',[System.Data.SqlDbType]::DateTime2)
 [void]$cmd.Parameters.Add('@fim',[System.Data.SqlDbType]::DateTime2)
 $cmd.Parameters['@inicio'].Value=[datetime]::ParseExact($base.inicio_inclusivo,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
 $cmd.Parameters['@fim'].Value=[datetime]::ParseExact($base.fim_exclusivo,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
 $t=[System.Data.DataTable]::new(); $adapter=[System.Data.SqlClient.SqlDataAdapter]::new($cmd)
 try{[void]$adapter.Fill($t); foreach($row in $t.Rows){$obj=[ordered]@{}; foreach($c in $t.Columns){$obj[$c.ColumnName]=if($row[$c] -is [DBNull]){$null}else{$row[$c]}}; [pscustomobject]$obj}}
 finally{$adapter.Dispose(); $cmd.Dispose()}
}
try{
 $senha=ConvertTo-SecureString -String $config['SSO_SQL_PASSWORD_DPAPI']; $senha.MakeReadOnly()
 $builder=[System.Data.SqlClient.SqlConnectionStringBuilder]::new()
 $builder['Data Source']=$config['SSO_SQL_SERVER']; $builder['Initial Catalog']=$config['SSO_SQL_DATABASE']
 $builder['Encrypt']=$true; $builder['TrustServerCertificate']=[bool]$PermitirCertificadoTemporario
 $builder['Pooling']=$false; $builder['Connect Timeout']=10; $builder['ApplicationIntent']='ReadOnly'
 $builder['Application Name']='PortalSSO-PopulacoesCiclos-Leitura'
 $conexao=[System.Data.SqlClient.SqlConnection]::new($builder.ConnectionString)
 $conexao.Credential=[System.Data.SqlClient.SqlCredential]::new($config['SSO_SQL_USERNAME'],$senha); $conexao.Open()
 $locais=@(Consultar @'
SELECT l.id aba_id,l.id_ficha ficha_id,l.nome
FROM inspecoes.Locais l JOIN inspecoes.Fichas f ON f.id=l.id_ficha
WHERE l.id_ficha IN (1,13) AND l.deleted=0 AND f.deleted=0
AND EXISTS(SELECT 1 FROM inspecoes_bi.FichasCompletas_SESMT c WHERE c.[ID da Ficha]=l.id_ficha AND c.[ID da Aba]=l.id)
ORDER BY l.id_ficha,l.id
'@)
 $frota=@(Consultar @'
SELECT Id ativo_id,[Código Operacional] codigo,[Modelo] modelo,[Concessão] concessao,
 [Localização Nome Completo] localizacao,[Família Abreviada] grupo
FROM oem_bi.Equipamentos
WHERE [Família Abreviada] IN ('VU','VP','Plataforma')
ORDER BY Id
'@)
 $respostas=@(Consultar @'
SELECT DISTINCT r.id_inspecao FROM inspecoes.InspecaoRespostas r
JOIN inspecoes.Inspecao i ON i.id=r.id_inspecao
WHERE i.preenchido_em>=@inicio AND i.preenchido_em<@fim
'@)
 $resultado=[ordered]@{versao=1;origem='SQL Server Intranet';extraido_em=[datetime]::UtcNow.ToString('o');
 inicio_inclusivo=$base.inicio_inclusivo;fim_exclusivo=$base.fim_exclusivo;locais=$locais;frota=$frota;
 inspecoes_com_respostas=@($respostas | ForEach-Object {[long]$_.id_inspecao})}
 [IO.File]::WriteAllText($destino,(ConvertTo-Json -InputObject $resultado -Depth 8 -Compress),[Text.UTF8Encoding]::new($false))
 Write-Output ('Populacoes extraidas: '+$locais.Count+' locais; '+$frota.Count+' ativos; '+$respostas.Count+' inspecoes com respostas')
}finally{if($conexao){$conexao.Dispose()};if($senha){$senha.Dispose()}}
