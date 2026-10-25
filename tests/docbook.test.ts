import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { docbookToMarkdown } from "../src/knowledge/docbook.js";
import { convertedName, originalName, publish, DOC_FILE } from "../src/knowledge/gate.js";
import { tempDir, write } from "./helpers.js";

const wrap = (body: string): string =>
  `<!-- doc/src/sgml/x.sgml -->\n<!DOCTYPE chapter PUBLIC "-//OASIS//DTD DocBook XML V4.5//EN" "x.dtd" [\n<!ENTITY a "b">\n]>\n${body}`;

describe("DocBook y SGML a Markdown", () => {
  it("los títulos siguen la profundidad de las secciones", () => {
    const md = docbookToMarkdown(
      wrap(
        `<chapter id="c"><title>Capítulo</title><sect1><title>Uno</title><para>Texto.</para><sect2><title>Dos</title><para>Más.</para></sect2></sect1></chapter>`,
      ),
    );
    expect(md).toContain("# Capítulo");
    expect(md).toContain("## Uno");
    expect(md).toContain("### Dos");
    expect(md).not.toContain("DOCTYPE");
    expect(md).not.toContain("doc/src/sgml");
  });

  it("párrafos con código, énfasis, enlaces y entidades", () => {
    const md = docbookToMarkdown(
      `<para>Usa <literal>CREATE INDEX</literal> en <productname>&postgres;</productname>&mdash;<emphasis>siempre</emphasis>. Mira <ulink url="https://example.com/x">esto</ulink> y <xref linkend="sql-select"/> &amp; &lt;b&gt; &foo;.</para>`,
    );
    expect(md).toContain("`CREATE INDEX`");
    expect(md).toContain("PostgreSQL—*siempre*");
    expect(md).toContain("[esto](https://example.com/x)");
    expect(md).toContain("(see sql-select)");
    expect(md).toContain("& <b> foo.");
  });

  it("listas, listas de definiciones y pasos", () => {
    const md = docbookToMarkdown(
      `<itemizedlist><listitem><para>a</para></listitem><listitem><para>b</para></listitem></itemizedlist>
       <orderedlist><listitem><para>uno</para></listitem><listitem><para>dos</para></listitem></orderedlist>
       <variablelist><varlistentry><term><literal>UNIQUE</literal></term><listitem><para>Comprueba duplicados.</para></listitem></varlistentry></variablelist>`,
    );
    expect(md).toContain("- a\n- b");
    expect(md).toContain("1. uno\n2. dos");
    expect(md).toContain("- **`UNIQUE`**");
    expect(md).toContain("  Comprueba duplicados.");
  });

  it("el código conserva su forma y los índices y metadatos no salen", () => {
    const md = docbookToMarkdown(
      `<refentry><refmeta><refentrytitle>CREATE INDEX</refentrytitle><manvolnum>7</manvolnum></refmeta>
       <refnamediv><refname>CREATE INDEX</refname><refpurpose>define un índice</refpurpose></refnamediv>
       <refsynopsisdiv><synopsis>CREATE INDEX name\n    ON table (col);</synopsis></refsynopsisdiv>
       <para>x<indexterm><primary>oculto</primary></indexterm></para></refentry>`,
    );
    expect(md).toContain("```\nCREATE INDEX name\n    ON table (col);\n```");
    expect(md).toContain("— define un índice");
    expect(md).not.toContain("manvolnum");
    expect(md).not.toContain("oculto");
    expect(md).not.toMatch(/CREATE INDEX 7/);
  });

  it("tablas y avisos", () => {
    const md = docbookToMarkdown(
      `<table><title>Tipos</title><tgroup cols="2"><thead><row><entry>Nombre</entry><entry>Alias</entry></row></thead><tbody><row><entry>integer</entry><entry>int4</entry></row></tbody></tgroup></table>
       <warning><para>No lo hagas.</para></warning>`,
    );
    expect(md).toContain("**Tipos**");
    expect(md).toContain("| Nombre | Alias |\n| --- | --- |\n| integer | int4 |");
    expect(md).toContain("> **Warning:** No lo hagas.");
  });

  it("aguanta SGML con etiquetas sin cerrar y el cierre corto", () => {
    const md = docbookToMarkdown(
      `<chapter><title>T</title><para>Un <literal>dato</> cualquiera.</para><para>Otro <emphasis>texto</para></chapter>`,
    );
    expect(md).toContain("Un `dato` cualquiera.");
    expect(md).toContain("Otro *texto*");
  });

  it("un documento sin nada legible da un texto vacío", () => {
    expect(docbookToMarkdown("<!-- solo un comentario -->").trim()).toBe("");
  });
});

describe("DocBook en la revisión y la publicación", () => {
  it("los .sgml y .docbook cuentan como documentación; CMakeLists no hace falta", () => {
    expect(DOC_FILE.test("ref/create_index.sgml")).toBe(true);
    expect(DOC_FILE.test("kcontrol/clock/index.docbook")).toBe(true);
    expect(DOC_FILE.test("main.c")).toBe(false);
  });

  it("publish deja el Markdown con el nombre original más «.md» y no copia lo que quedó vacío", () => {
    const capture = tempDir("evol-db-cap-");
    const ready = join(tempDir("evol-db-rdy-"), "ready");
    write(capture, "ref/a.sgml", "<chapter><title>A</title><para>hola</para></chapter>");
    write(capture, "vacio.sgml", "<!-- nada -->");
    write(capture, "guia.md", "# Guía\n");
    publish(capture, ready, ["ref/a.sgml", "vacio.sgml", "guia.md"]);
    expect(readFileSync(join(ready, "ref/a.sgml.md"), "utf8")).toContain("# A");
    expect(existsSync(join(ready, "ref/a.sgml"))).toBe(false);
    expect(existsSync(join(ready, "vacio.sgml.md"))).toBe(false);
    expect(readFileSync(join(ready, "guia.md"), "utf8")).toBe("# Guía\n");
  });

  it("del nombre convertido se vuelve al original, y un .md normal no cambia", () => {
    expect(convertedName("ref/a.sgml")).toBe("ref/a.sgml.md");
    expect(originalName("ref/a.sgml.md")).toBe("ref/a.sgml");
    expect(originalName("x/index.docbook.md")).toBe("x/index.docbook");
    expect(originalName("guia.md")).toBe("guia.md");
    expect(originalName("notas.sgml.txt")).toBe("notas.sgml.txt");
  });
});
