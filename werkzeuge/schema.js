// @ts-check

/*
 * Kleiner JSON-Schema-Prüfer ohne Abhängigkeiten. Unterstützt genau die Teile,
 * die klang.schema.json benutzt: $ref (lokal), type, enum, minimum, maximum,
 * required, properties, additionalProperties, items, prefixItems, minItems,
 * maxItems, oneOf. Unbekannte Schlüsselwörter werden ignoriert.
 */

/**
 * @param {any} wert
 */
function typVon(wert) {
  if (Array.isArray(wert)) {
    return "array";
  }
  if (wert === null) {
    return "null";
  }
  if (typeof wert === "number" && Number.isInteger(wert)) {
    return "integer";
  }
  return typeof wert;
}

/**
 * Prüft einen Wert gegen ein Schema und liefert Fehlermeldungen mit Pfad.
 *
 * @param {any} schema
 * @param {any} wert
 * @param {string} [pfad]
 * @param {any} [wurzel]
 * @returns {string[]}
 */
export function pruefeSchema(schema, wert, pfad = "", wurzel = schema) {
  if (schema === true || schema === undefined) {
    return [];
  }
  if (schema === false) {
    return [`${pfad || "(Wurzel)"}: hier ist kein Wert erlaubt`];
  }
  if (schema.$ref) {
    const ziel = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((/** @type {any} */ knoten, /** @type {string} */ teil) => knoten?.[teil], wurzel);
    return pruefeSchema(ziel, wert, pfad, wurzel);
  }

  const ort = pfad || "(Wurzel)";
  /** @type {string[]} */
  const fehler = [];
  const typ = typVon(wert);

  if (schema.type) {
    const passt = schema.type === typ || (schema.type === "number" && typ === "integer");
    if (!passt) {
      return [`${ort}: erwartet ${schema.type}, gefunden ${typ}`];
    }
  }
  if (schema.enum && !schema.enum.includes(wert)) {
    fehler.push(`${ort}: ${JSON.stringify(wert)} ist nicht erlaubt, möglich: ${schema.enum.join(", ")}`);
  }
  if (typeof wert === "number") {
    if (schema.minimum !== undefined && wert < schema.minimum) {
      fehler.push(`${ort}: ${wert} ist kleiner als ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && wert > schema.maximum) {
      fehler.push(`${ort}: ${wert} ist größer als ${schema.maximum}`);
    }
  }

  if (typ === "object") {
    for (const name of schema.required ?? []) {
      if (!(name in wert)) {
        fehler.push(`${ort}: Feld "${name}" fehlt`);
      }
    }
    for (const [name, inhalt] of Object.entries(wert)) {
      const unterpfad = pfad ? `${pfad}.${name}` : name;
      if (schema.properties?.[name]) {
        fehler.push(...pruefeSchema(schema.properties[name], inhalt, unterpfad, wurzel));
      } else if (schema.additionalProperties === false) {
        fehler.push(`${ort}: unbekanntes Feld "${name}"`);
      }
    }
  }

  if (typ === "array") {
    if (schema.minItems !== undefined && wert.length < schema.minItems) {
      fehler.push(`${ort}: mindestens ${schema.minItems} Einträge nötig`);
    }
    if (schema.maxItems !== undefined && wert.length > schema.maxItems) {
      fehler.push(`${ort}: höchstens ${schema.maxItems} Einträge erlaubt`);
    }
    const vorne = schema.prefixItems ?? [];
    wert.forEach((/** @type {any} */ eintrag, /** @type {number} */ i) => {
      const teilschema = i < vorne.length ? vorne[i] : schema.items;
      fehler.push(...pruefeSchema(teilschema, eintrag, `${pfad}[${i}]`, wurzel));
    });
  }

  if (schema.oneOf) {
    const varianten = schema.oneOf.map((/** @type {any} */ teil) => pruefeSchema(teil, wert, pfad, wurzel));
    const treffer = varianten.filter((/** @type {string[]} */ v) => v.length === 0).length;
    if (treffer === 0) {
      const gruende = varianten.map((/** @type {string[]} */ v, /** @type {number} */ i) => `(${i + 1}) ${v.join("; ")}`).join(" ");
      fehler.push(`${ort}: passt auf keine erlaubte Variante: ${gruende}`);
    } else if (treffer > 1) {
      fehler.push(`${ort}: passt auf mehrere Varianten, erlaubt ist genau eine`);
    }
  }
  return fehler;
}
