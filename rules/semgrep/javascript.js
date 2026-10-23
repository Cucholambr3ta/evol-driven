const child_process = require("child_process");
const { exec, execSync, spawn } = child_process;

function casos(user, name) {
  // ruleid: evol.js-eval
  eval(user);
  // ruleid: evol.js-eval
  new Function(user);
  // ok: evol.js-eval
  eval("1 + 1");

  // ruleid: evol.js-exec
  exec("ls " + user);
  // ruleid: evol.js-exec
  child_process.execSync(`ls ${user}`);
  // ok: evol.js-exec
  exec("ls", () => {});
  // ok: evol.js-exec
  /a/.exec("a");

  // ruleid: evol.js-spawn-shell
  spawn("ls", [user], { shell: true });
  // ok: evol.js-spawn-shell
  spawn("ls", [user]);

  // ruleid: evol.js-dynamic-require
  require(name);
  // ok: evol.js-dynamic-require
  require("node:fs");

  // ruleid: evol.js-tls-reject-unauthorized
  fetch("https://example.com", { rejectUnauthorized: false });
}
