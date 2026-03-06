@echo off
for /f "tokens=*" %%t in ('gh auth token') do set GITHUB_PERSONAL_ACCESS_TOKEN=%%t
npx -y @modelcontextprotocol/server-github
