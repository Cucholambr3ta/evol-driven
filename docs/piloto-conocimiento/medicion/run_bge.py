import json, sys, subprocess
sys.path.insert(0, ".")
from harness import *
name, model = sys.argv[1], sys.argv[2]
store = f"{PILOT}/{name}"
env = {"OPENAI_API_KEY": "ollama", "OPENAI_API_BASE": "http://127.0.0.1:11434/v1", "DOCS_MCP_EMBEDDING_MODEL": model,
       "DOCS_MCP_SCRAPER_SECURITY_FILE_ACCESS_ALLOWED_ROOTS": READY}
res = evaluate(name, lambda src, q: dmcp_search(store, env, src, q))
json.dump(res, open(f"res_{name}.json", "w"), ensure_ascii=False, indent=1)
d = summarize(res)
print("TOTAL", d["total"])
for k in ("por_tipo", "por_fuente"):
    for n, v in d[k].items(): print(k[4:], n, {a: b for a, b in v.items() if a != "n"})
