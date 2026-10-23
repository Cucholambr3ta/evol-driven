#!/bin/sh
# usage: index_rag.sh <db-name> <hf-model>
P=$HOME/.local/share/evol/knowledge-pilot; R=$HOME/.config/evol/knowledge/ready
cd $HOME/.local/share/evol/knowledge-engines/mcp-local-rag
mkdir -p $P/$1 $P/rag-models
for dir in owasp-cheatsheets-6c87b0e typescript-handbook-2453b61 react-docs-ae5e480; do
  s=$(date +%s)
  node_modules/.bin/mcp-local-rag --db-path $P/$1 --cache-dir $P/rag-models --model-name "$2" ingest --base-dir $R $R/$dir 2>&1 | tail -3 | cut -c1-200
  echo "$1 $dir: $(( $(date +%s)-s )) s"
done
