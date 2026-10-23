import json, os, re, subprocess, sys, time, statistics
from urllib.parse import unquote
HOME = os.path.expanduser("~")
REPO = f"{HOME}/Projects/evol-driven"
READY = f"{HOME}/.config/evol/knowledge/ready"
PILOT = f"{HOME}/.local/share/evol/knowledge-pilot"
DMCP = f"{HOME}/.local/share/evol/knowledge-engines/docs-mcp-server"
RAG = f"{HOME}/.local/share/evol/knowledge-engines/mcp-local-rag"
Q = json.load(open(f"{REPO}/docs/piloto-conocimiento/preguntas.json"))
LIB = {"owasp": "owasp", "typescript": "typescript", "react": "react"}

def norm(s):  # compare headings without markup
    s = re.sub(r"\{/\*.*?\*/\}", "", s)
    return re.sub(r"[`\\*_#]", "", s).strip().lower()

def dmcp_search(store, env_extra, source, query, limit=10):
    env = {**os.environ, "DOCS_MCP_TELEMETRY": "false", **env_extra}
    for k in ("OPENAI_API_KEY", "OPENAI_API_BASE", "DOCS_MCP_EMBEDDING_MODEL"):
        if k not in env_extra: env.pop(k, None)
    r = subprocess.run([f"{DMCP}/node_modules/.bin/docs-mcp-server", "search", LIB[source], query, "-v", "1", "-l", str(limit),
                        "--output", "json", "--store-path", store, "--quiet", "--no-logo"], capture_output=True, text=True, env=env, timeout=300)
    out = r.stdout.strip()
    i = out.find("[")
    try: items = json.loads(out[i:]) if i >= 0 else []
    except Exception: raise RuntimeError(f"salida ilegible: {out[:200]} | {r.stderr[:200]}")
    prefix = None
    res = []
    for it in items:
        url = it["url"]
        m = re.search(r"/ready/[^/]+/(.*)$", url)
        res.append({"archivo": unquote(m.group(1)) if m else unquote(url), "contenido": it.get("content", "")})
    return res

DIRS = {"owasp": "owasp-cheatsheets-6c87b0e", "typescript": "typescript-handbook-2453b61", "react": "react-docs-ae5e480"}

def rag_search(db, model, source, query, limit=10):
    env = {**os.environ, "BASE_DIR": READY}
    r = subprocess.run([f"{RAG}/node_modules/.bin/mcp-local-rag", "--db-path", db, "--cache-dir", f"{PILOT}/rag-models", "--model-name", model,
                        "query", "--scope", f"{READY}/{DIRS[source]}", "--limit", str(limit), query],
                       capture_output=True, text=True, env=env, timeout=300)
    out = r.stdout
    i = out.find("\n[\n")
    if i < 0 and out.lstrip().startswith("[]"): return []
    try: items = json.loads(out[i + 1:])
    except Exception: raise RuntimeError(f"salida ilegible: {out[-300:]} | {r.stderr[:200]}")
    res = []
    for it in items:
        m = re.search(r"/ready/[^/]+/(.*)$", it["filePath"])
        heads = " | ".join(h for hp in it.get("sourceContext", {}).get("headingPaths", []) for h in hp)
        res.append({"archivo": m.group(1) if m else it["filePath"], "contenido": "## " + heads + "\n" + it.get("text", "")})
    return res

def evaluate(name, search):
    rows = []
    t0 = time.time()
    for p in Q["preguntas"]:
        q = re.sub(r"[¿?¡!]", "", p["pregunta"])
        t = time.time()
        res = search(p["fuente"], q)
        dt = time.time() - t
        exp = p["esperado"]
        rank_doc = next((i + 1 for i, r in enumerate(res) if r["archivo"] == exp["archivo"]), None)
        rank_sec = next((i + 1 for i, r in enumerate(res) if r["archivo"] == exp["archivo"] and norm(exp["seccion"]) in norm(r["contenido"])), None)
        rows.append({"id": p["id"], "fuente": p["fuente"], "tipo": p["tipo"], "rank_doc": rank_doc, "rank_seccion": rank_sec,
                     "resultados": len(res), "segundos": round(dt, 2), "top": [r["archivo"] for r in res[:5]]})
    return {"montaje": name, "segundos_total": round(time.time() - t0, 1), "preguntas": rows}

def summarize(result):
    def agg(rows):
        n = len(rows)
        rec5 = sum(1 for r in rows if r["rank_doc"] and r["rank_doc"] <= 5) / n
        mrr = sum((1 / r["rank_doc"]) for r in rows if r["rank_doc"]) / n
        sec5 = sum(1 for r in rows if r["rank_seccion"] and r["rank_seccion"] <= 5) / n
        return {"n": n, "recall@5": round(rec5, 3), "MRR": round(mrr, 3), "seccion@5": round(sec5, 3),
                "mediana_s": round(statistics.median(r["segundos"] for r in rows), 2)}
    rows = result["preguntas"]
    out = {"montaje": result["montaje"], "total": agg(rows)}
    for k in ("tipo", "fuente"):
        out["por_" + k] = {v: agg([r for r in rows if r[k] == v]) for v in sorted({r[k] for r in rows})}
    return out
