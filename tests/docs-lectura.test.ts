import { spawnSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOPE_ARCHIVO, leerDocumento, nombreSeguro, resolverEnRaiz } from "../src/docs/lectura.js";
import { tempDir, write } from "./helpers.js";

describe("leerDocumento", () => {
  it("lee un archivo regular", () => {
    const root = tempDir();
    write(root, "a.md", "# Hola\nñandú\n");

    expect(leerDocumento(join(root, "a.md"))).toEqual({ ok: true, texto: "# Hola\nñandú\n" });
  });

  it("lee un archivo del tamaño exacto del tope y rechaza uno de un byte más", () => {
    const root = tempDir();
    write(root, "justo.md", "x".repeat(TOPE_ARCHIVO));
    write(root, "pasado.md", "x".repeat(TOPE_ARCHIVO + 1));

    expect(leerDocumento(join(root, "justo.md")).ok).toBe(true);
    expect(leerDocumento(join(root, "pasado.md"))).toMatchObject({
      ok: false,
      motivo: expect.stringMatching(/demasiado grande/),
    });
  });

  it("no sigue un enlace simbólico, ni a un archivo de dentro ni a uno de fuera", () => {
    const root = tempDir();
    const fuera = tempDir();
    write(fuera, "secreto.md", "no debe leerse");
    write(root, "real.md", "dentro");
    symlinkSync(join(fuera, "secreto.md"), join(root, "enlace-fuera.md"));
    symlinkSync(join(root, "real.md"), join(root, "enlace-dentro.md"));

    for (const nombre of ["enlace-fuera.md", "enlace-dentro.md"]) {
      const r = leerDocumento(join(root, nombre));
      expect(r.ok, nombre).toBe(false);
      expect(JSON.stringify(r), nombre).not.toContain("no debe leerse");
    }
  });

  it("rechaza una carpeta", () => {
    const root = tempDir();
    mkdirSync(join(root, "carpeta"));

    expect(leerDocumento(join(root, "carpeta"))).toMatchObject({ ok: false });
  });

  it("rechaza una FIFO sin quedarse esperando", () => {
    const root = tempDir();
    const fifo = join(root, "tuberia.md");
    const hecho = spawnSync("mkfifo", [fifo]);
    expect(hecho.status).toBe(0);

    expect(leerDocumento(fifo)).toMatchObject({ ok: false });
  });

  it("un archivo que no existe es un hallazgo, no una excepción", () => {
    const r = leerDocumento(join(tempDir(), "no-existe.md"));

    expect(r).toMatchObject({ ok: false, motivo: expect.stringMatching(/no se puede leer/) });
  });

  it("los bytes que no son UTF-8 se reemplazan en vez de lanzar", () => {
    const root = tempDir();
    writeFileSync(join(root, "roto.md"), Buffer.from([0x61, 0xff, 0xfe, 0x62]));

    const r = leerDocumento(join(root, "roto.md"));

    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.texto.startsWith("a") && r.texto.endsWith("b")).toBe(true);
  });

  it("el motivo no incluye la ruta ni el contenido", () => {
    const root = tempDir();
    write(root, "enorme.md", "SECRETO".repeat(TOPE_ARCHIVO));

    const r = leerDocumento(join(root, "enorme.md"));

    expect(JSON.stringify(r)).not.toContain("SECRETO");
    expect(JSON.stringify(r)).not.toContain(root);
  });
});

describe("nombreSeguro", () => {
  it("deja intacto un nombre normal, con tildes y espacios", () => {
    expect(nombreSeguro("docs/proyecto/db/esquemas ñandú.md")).toBe(
      "docs/proyecto/db/esquemas ñandú.md",
    );
  });

  it("quita las secuencias de color y de control de la terminal", () => {
    expect(nombreSeguro("\u001b[31mrojo\u001b[0m.md")).toBe("rojo.md");
    expect(nombreSeguro("\u001b]0;titulo falso\u0007a.md")).toBe("a.md");
  });

  it("sustituye saltos de línea y otros caracteres de control por «?»", () => {
    expect(nombreSeguro("a\nb\rc\td\u0000e\u007ff")).toBe("a?b?c?d?e?f");
  });

  it("sustituye las marcas bidireccionales que invierten el texto", () => {
    expect(nombreSeguro("a\u202eb\u2066c.md")).toBe("a?b?c.md");
  });

  it("trunca a 80 caracteres terminando en «…»", () => {
    const largo = nombreSeguro("x".repeat(200));

    expect([...largo]).toHaveLength(80);
    expect(largo.endsWith("…")).toBe(true);
    expect(nombreSeguro("x".repeat(80))).toBe("x".repeat(80));
  });

  it("no parte un carácter fuera del plano básico al truncar", () => {
    const largo = nombreSeguro("😀".repeat(100));

    expect([...largo]).toHaveLength(80);
    expect(largo).not.toContain("\ufffd");
  });
});

describe("resolverEnRaiz", () => {
  const raiz = tempDir();
  write(raiz, "docs/proyecto/db/a.md", "x");
  write(raiz, "docs/specs/SPEC.md", "x");
  const fuera = tempDir();
  write(fuera, "secreto.md", "x");
  symlinkSync(fuera, join(raiz, "docs", "enlace-a-fuera"));

  it("resuelve una ruta relativa que existe y dice que existe", () => {
    expect(resolverEnRaiz(raiz, "docs/proyecto", "db/a.md")).toMatchObject({
      ok: true,
      rel: "docs/proyecto/db/a.md",
      existe: true,
    });
  });

  it("una ruta de dentro que no existe sigue siendo válida, y dice que no existe", () => {
    expect(resolverEnRaiz(raiz, "docs/proyecto", "db/nuevo.md")).toMatchObject({
      ok: true,
      existe: false,
    });
  });

  it("quita el ancla y la consulta, y decodifica un solo nivel de %", () => {
    expect(resolverEnRaiz(raiz, "docs/proyecto", "db/a.md#titulo")).toMatchObject({
      ok: true,
      existe: true,
    });
    expect(resolverEnRaiz(raiz, "docs/proyecto", "db/a.md?x=1")).toMatchObject({
      ok: true,
      existe: true,
    });
    expect(resolverEnRaiz(raiz, "docs/proyecto", "db/a%2Emd")).toMatchObject({
      ok: true,
      existe: true,
    });
  });

  it.each([
    ["../specs/SPEC.md"],
    ["db/../../specs/SPEC.md"],
    ["%2e%2e/specs/SPEC.md"],
    ["%2E%2E%2Fspecs/SPEC.md"],
    ["/etc/passwd"],
    ["\\\\servidor\\carpeta"],
    ["C:\\Windows\\a.md"],
    ["//host/a.md"],
    ["file:///etc/passwd"],
    ["data:text/plain,x"],
    ["javascript:alert(1)"],
    ["db/a.md%00.png"],
    ["db/a\u0000.md"],
    ["db/a\n.md"],
    ["%zz"],
    [""],
    ["#solo-ancla"],
  ])("rechaza «%s»", (texto) => {
    expect(resolverEnRaiz(raiz, "docs/proyecto", texto)).toEqual({ ok: false });
  });

  it("rechaza una ruta que, por un enlace simbólico, sale de la raíz, exista o no el destino", () => {
    const existe = resolverEnRaiz(raiz, "docs", "enlace-a-fuera/secreto.md");
    const noExiste = resolverEnRaiz(raiz, "docs", "enlace-a-fuera/inventado.md");

    expect(existe).toEqual({ ok: false });
    expect(noExiste).toEqual(existe);
  });

  it("la misma respuesta para una ruta de fuera que existe y para una que no", () => {
    const a = resolverEnRaiz(raiz, "docs/proyecto", `../../../${fuera}/secreto.md`);
    const b = resolverEnRaiz(raiz, "docs/proyecto", "../../../../no/existe.md");

    expect(a).toEqual(b);
  });
});
