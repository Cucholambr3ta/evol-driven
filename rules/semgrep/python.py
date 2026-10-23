import os
import pickle
import subprocess

import requests
import yaml


def casos(user, data, name):
    # ruleid: evol.py-shell-true
    subprocess.run("ls " + user, shell=True)
    # ok: evol.py-shell-true
    subprocess.run(["ls", user])

    # ruleid: evol.py-os-system
    os.system(user)
    # ok: evol.py-os-system
    os.system("ls")

    # ruleid: evol.py-eval-exec
    eval(user)
    # ruleid: evol.py-eval-exec
    exec(user)
    # ok: evol.py-eval-exec
    eval("1 + 1")

    # ruleid: evol.py-pickle
    pickle.loads(data)

    # ruleid: evol.py-yaml-load
    yaml.load(data)
    # ok: evol.py-yaml-load
    yaml.load(data, Loader=yaml.SafeLoader)
    # ok: evol.py-yaml-load
    yaml.safe_load(data)

    # ruleid: evol.py-tls-verify-false
    requests.get("https://example.com", verify=False)
    # ok: evol.py-tls-verify-false
    requests.get("https://example.com")

    # ruleid: evol.py-dynamic-import
    __import__(name)
    # ok: evol.py-dynamic-import
    __import__("json")
