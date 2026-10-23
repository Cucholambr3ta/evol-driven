import json, sys
sys.path.insert(0, ".")
from harness import *
name, model = sys.argv[1], sys.argv[2]
db = f"{PILOT}/{name}"
res = evaluate(name, lambda src, q: rag_search(db, model, src, q))
json.dump(res, open(f"res_{name}.json", "w"), ensure_ascii=False, indent=1)
d = summarize(res)
print("TOTAL", d["total"])
for k in ("por_tipo", "por_fuente"):
    for n, v in d[k].items(): print(k[4:], n, {a: b for a, b in v.items() if a != "n"})
