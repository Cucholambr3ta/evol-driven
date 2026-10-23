import json, sys
sys.path.insert(0, ".")
from harness import *
store = f"{PILOT}/dmcp-fts"
res = evaluate("dmcp-fts", lambda src, q: dmcp_search(store, {}, src, q))
json.dump(res, open("res_dmcp_fts.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(summarize(res), ensure_ascii=False, indent=1))
