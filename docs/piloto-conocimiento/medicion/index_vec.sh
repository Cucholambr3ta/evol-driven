#!/bin/sh
# usage: index_vec.sh <store-name> <ollama-model>
P=$HOME/.local/share/evol/knowledge-pilot; R=$HOME/.config/evol/knowledge/ready
cd $HOME/.local/share/evol/knowledge-engines/docs-mcp-server
export DOCS_MCP_TELEMETRY=false DOCS_MCP_SCRAPER_SECURITY_FILE_ACCESS_ALLOWED_ROOTS=$R
export OPENAI_API_KEY=ollama OPENAI_API_BASE=http://127.0.0.1:11434/v1 DOCS_MCP_EMBEDDING_MODEL=$2
mkdir -p $P/$1
for pair in owasp:owasp-cheatsheets-6c87b0e typescript:typescript-handbook-2453b61 react:react-docs-ae5e480; do
  lib=${pair%%:*}; dir=${pair##*:}; s=$(date +%s)
  node_modules/.bin/docs-mcp-server scrape $lib file://$R/$dir -v 1 --replace --store-path $P/$1 --max-pages 5000 --quiet --no-logo 2>&1 | tail -2 | cut -c1-200
  echo "$1 $lib: $(( $(date +%s)-s )) s"
done
