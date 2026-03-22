$filePath = "e:\CHILLY\phone\qiaqiao-phone\src\utils\ai\prompts_private.js"
$content = Get-Content -Path $filePath -Raw -Encoding UTF8
Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
Write-Host "File rewritten with UTF8 encoding"
