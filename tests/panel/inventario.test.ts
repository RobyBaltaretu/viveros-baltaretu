import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leerContenido } from "../../scripts/contenido/archivos.mjs";
import {
  importarContenido,
  type EntradaImportada,
} from "../../src/server/contenido/importacion.ts";
import {
  aplicarMigraciones,
  crearRepositoriosD1,
  type Factura,
  type Repositorios,
} from "../../src/server/data/index.ts";
import {
  AJUSTES_VACIOS,
  clienteVacio,
  leerBorrador,
  nuevaFactura,
  rectificativaDe,
} from "../../src/server/facturas/facturas.ts";
import {
  descontarFactura,
  inventarioCompleto,
  inventarioCsv,
  moverInventario,
  resumenInventario,
  type FilaInventario,
} from "../../src/server/panel/inventario.ts";
import type { MovimientoInventario } from "../../src/server/data/tipos.ts";
import { d1DePrueba } from "./d1.ts";

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
  const { entradas, fotos } = await leerContenido(process.cwd());
  for (const f of fotos)
    await repos.fotos.guardar(
      { ruta: f.ruta, tipo: "image/jpeg", bytes: f.bytes },
      "t",
    );
  const lista = entradas.map((e) => ({
    coleccion: e.coleccion,
    id: e.id,
    documento: { datos: e.datos, cuerpo: e.cuerpo },
  })) as EntradaImportada[];
  await importarContenido(repos, lista, new Set(fotos.map((f) => f.ruta)), "t");
}, 30_000);
afterAll(() => cerrar());

const yo = "inv@example.com";
const hay = async (id: string) =>
  (await repos.inventario.existencias())[id] ?? {
    disponible: 0,
    desperdicio: 0,
  };

describe("inventario", () => {
  it("entradas, salidas y bajas con motivo; no se puede quitar más de lo que hay", async () => {
    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "entrada", cantidad: 50, motivo: "Producción propia" },
        yo,
      ),
    ).toMatchObject({ ok: true, disponible: 50 });
    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "baja", cantidad: 4, motivo: "Se ha muerto" },
        yo,
      ),
    ).toMatchObject({ ok: true, disponible: 46 });
    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "salida", cantidad: 6, motivo: "Regalo o muestra" },
        yo,
      ),
    ).toMatchObject({ ok: true, disponible: 40 });
    expect(await hay("yucca-elephantipes")).toMatchObject({
      disponible: 40,
      desperdicio: 4,
    });

    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "baja", cantidad: 41, motivo: "Se ha muerto" },
        yo,
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Solo hay 40"),
    });
    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "entrada", cantidad: 5, motivo: "Se ha muerto" },
        yo,
      ),
    ).toMatchObject({ ok: false });
    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "entrada", cantidad: 5, motivo: "Otro motivo" },
        yo,
      ),
    ).toMatchObject({ ok: false, error: expect.stringContaining("nota") });
    expect(
      await moverInventario(
        repos,
        "yucca-elephantipes",
        { tipo: "entrada", cantidad: 1.5, motivo: "Producción propia" },
        yo,
      ),
    ).toMatchObject({ ok: false });
    expect(
      await moverInventario(
        repos,
        "no-existe",
        { tipo: "entrada", cantidad: 1, motivo: "Producción propia" },
        yo,
      ),
    ).toMatchObject({ ok: false });

    const fila = (await inventarioCompleto(repos)).find(
      (f) => f.id === "yucca-elephantipes",
    );
    expect(fila?.existencias.disponible).toBe(40);
    expect(
      (await inventarioCompleto(repos)).find(
        (f) => f.id === "chamaerops-humilis",
      )?.existencias.disponible,
    ).toBe(0);
  });

  it("una factura emitida resta sus plantas una sola vez; la rectificativa las devuelve; las de prueba no cuentan", async () => {
    await moverInventario(
      repos,
      "chamaerops-humilis",
      { tipo: "entrada", cantidad: 30, motivo: "Producción propia" },
      yo,
    );
    const c = { ...clienteVacio("cli-inv"), nombre: "Jardinería" };
    const f: Factura = {
      ...nuevaFactura(c, yo, AJUSTES_VACIOS),
      id: "fac-inv",
      estado: "emitida",
      codigo: "F2026-0100",
      lineas: [
        {
          concepto: "Palmito",
          cantidad: 12,
          precio: 10,
          descuento: 0,
          iva: 10,
          planta: "chamaerops-humilis",
        },
        {
          concepto: "Transporte",
          cantidad: 1,
          precio: 50,
          descuento: 0,
          iva: 21,
        },
      ],
    };
    expect(await descontarFactura(repos, f, yo)).toBe(1);
    expect(await descontarFactura(repos, f, yo)).toBe(0);
    expect((await hay("chamaerops-humilis")).disponible).toBe(18);

    const r = {
      ...rectificativaDe(f, yo, AJUSTES_VACIOS),
      estado: "emitida" as const,
      codigo: "R2026-0001",
    };
    expect(await descontarFactura(repos, r, yo)).toBe(1);
    expect((await hay("chamaerops-humilis")).disponible).toBe(30);

    expect(
      await descontarFactura(
        repos,
        { ...f, id: "fac-prueba", prueba: true },
        yo,
      ),
    ).toBe(0);
    expect(
      await descontarFactura(
        repos,
        { ...f, id: "fac-borrador", estado: "borrador" },
        yo,
      ),
    ).toBe(0);
  });

  it("el borrador guarda la planta de cada línea (solo si existe en el catálogo)", () => {
    const previa = nuevaFactura(
      { ...clienteVacio("x"), nombre: "X" },
      yo,
      AJUSTES_VACIOS,
    );
    const form = new FormData();
    form.set("lineas", "2");
    for (const [i, planta] of ["chamaerops-humilis", "inventada"].entries()) {
      form.set(`l${i}.concepto`, `Línea ${i}`);
      form.set(`l${i}.cantidad`, "2");
      form.set(`l${i}.precio`, "5");
      form.set(`l${i}.iva`, "10");
      form.set(`l${i}.planta`, planta);
    }
    const { factura } = leerBorrador(form, previa, [
      { slug: "chamaerops-humilis", nombre: "Palmito", precio: 12 },
    ]);
    expect(factura.lineas.map((l) => l.planta)).toEqual([
      "chamaerops-humilis",
      undefined,
    ]);
  });
});

describe("resumen del inventario", () => {
  const fila = (
    id: string,
    disponible: number,
    disponibilidad = "disponible",
    precio: number | null = 10,
    ultimo = "2026-10-10T10:00:00Z",
  ): FilaInventario => ({
    id,
    nombre: id.toUpperCase(),
    disponibilidad,
    precio,
    existencias: {
      disponible,
      desperdicio: 0,
      ultimo: disponible || ultimo ? ultimo : "",
    },
  });
  let n = 0;
  const mov = (
    planta: string,
    tipo: MovimientoInventario["tipo"],
    cantidad: number,
    fecha: string,
    motivo = "x",
    referencia: string | null = null,
  ): MovimientoInventario => ({
    id: ++n,
    planta,
    tipo,
    cantidad,
    motivo,
    nota: "",
    referencia,
    fecha: `${fecha}T10:00:00Z`,
    email: yo,
  });

  it("cifras, avisos, meses y repartos", () => {
    const filas = [
      fila("a", 100, "disponible", 12.5),
      fila("b", 3, "agotado", null),
      fila("c", 0),
      fila("d", 20, "disponible", 5, "2026-05-01T10:00:00Z"),
    ];
    const movs = [
      mov("a", "entrada", 120, "2026-10-02"),
      mov("a", "salida", -10, "2026-10-03", "Factura F-1", "factura:1:0"),
      mov("a", "entrada", 2, "2026-10-04", "Rectificativa R-1", "factura:2:0"),
      mov("a", "salida", -4, "2026-10-05", "Regalo o muestra"),
      mov("a", "baja", -8, "2026-10-06", "Se ha muerto"),
      mov("c", "baja", -2, "2026-09-06", "Helada o golpe de calor"),
      mov("c", "baja", -1, "2026-09-07", "Se ha muerto"),
      mov("c", "entrada", 99, "2025-01-01"),
    ];
    const r = resumenInventario(filas, movs, "2026-10-19");
    expect(r).toMatchObject({
      unidades: 123,
      valor: 1350,
      sinPrecio: 1,
      especies: 4,
      conExistencias: 3,
    });
    expect(r.sinStockEnWeb.map((f) => f.id)).toEqual(["c"]);
    expect(r.agotadasConStock.map((f) => f.id)).toEqual(["b"]);
    expect(r.pocas.map((f) => f.id)).toEqual(["b"]);
    expect(r.paradas.map((f) => f.id)).toEqual(["d"]);
    expect(r.meses.map((m) => m.clave)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(r.esteMes).toMatchObject({
      entradas: 120,
      vendidas: 8,
      salidas: 4,
      bajas: 8,
    });
    expect(r.mesPasado).toMatchObject({ bajas: 3 });
    expect(r.tasaDesperdicio).toBe(47.8);
    expect(r.bajasPorMotivo).toEqual([
      { nombre: "Se ha muerto", valor: 9 },
      { nombre: "Helada o golpe de calor", valor: 2 },
    ]);
    expect(r.masVendidas).toEqual([{ nombre: "A", valor: 8 }]);
    expect(r.masExistencias[0]).toEqual({
      nombre: "A",
      valor: 100,
      detalle: "desde 12,5 €/ud",
    });
    expect(resumenInventario([], [], "2026-01-05").tasaDesperdicio).toBeNull();
  });

  it("CSV para Excel", () => {
    const csv = inventarioCsv([{ ...fila("a", 7), nombre: "Olivo; grande" }]);
    expect(csv.startsWith("\ufeffPlanta;Disponibles")).toBe(true);
    expect(csv).toContain('"Olivo; grande";7;0;disponible;10;2026-10-10');
  });
});
