import { describe, it, expect } from "vitest";
import {
  extractTransitRows,
  extractNegativeStockRows,
  excelDateToDate,
  transitAging,
  transitRisk,
  columnLetterToIndex,
  isVL06ITransit,
  isMB52Stock,
} from "../engine";
import type { ImportRecord } from "../../types";

function mkImport(headers: string[], rows: Record<string, unknown>[], type: string): ImportRecord {
  return {
    id: "test",
    file_type: type,
    file_name: "test.xlsx",
    sheet_names: ["Sheet1"],
    headers: { Sheet1: headers },
    row_count: rows.length,
    status: "recognized",
    rows,
    imported_at: new Date().toISOString(),
  };
}

const VL06I_HEADERS = [
  "Delivery Date", "Plant", "", "External Delivery", "Material", "Article",
  "Description", "Delivery Quantity", "", "", "", "", "", "", "", "", "",
  "", "", "", "", "", "", "", "", "", "Hierarchy Node 3",
];

describe("columnLetterToIndex", () => {
  it("converts A to 0, K to 10, N to 13, AA to 26", () => {
    expect(columnLetterToIndex("A")).toBe(0);
    expect(columnLetterToIndex("K")).toBe(10);
    expect(columnLetterToIndex("N")).toBe(13);
    expect(columnLetterToIndex("AA")).toBe(26);
  });
});

describe("excelDateToDate", () => {
  it("converts Excel serial 45000 to a Date", () => {
    const d = excelDateToDate(45000);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2023);
  });

  it("parses dd/mm/yyyy text dates", () => {
    const d = excelDateToDate("15/06/2023");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(15);
    expect(d!.getUTCMonth()).toBe(5);
  });

  it("returns null for empty/invalid", () => {
    expect(excelDateToDate("")).toBeNull();
    expect(excelDateToDate(null)).toBeNull();
  });
});

describe("transitRisk", () => {
  it("0-2 days = ok", () => { expect(transitRisk(0)).toBe("ok"); expect(transitRisk(2)).toBe("ok"); });
  it("3-7 days = attention", () => { expect(transitRisk(3)).toBe("attention"); expect(transitRisk(7)).toBe("attention"); });
  it("8+ days = action", () => { expect(transitRisk(8)).toBe("action"); expect(transitRisk(30)).toBe("action"); });
});

describe("VL06I detection", () => {
  it("detects VL06I Transit headers", () => {
    expect(isVL06ITransit(VL06I_HEADERS)).toBe(true);
  });

  it("rejects unrelated headers", () => {
    expect(isVL06ITransit(["SKU", "Price", "Store"])).toBe(false);
  });
});

describe("MB52 detection", () => {
  it("detects MB52 Stock headers", () => {
    expect(isMB52Stock(["Style", "Material", "Description", "Department", "Unrestricted"])).toBe(true);
  });

  it("is case/space tolerant", () => {
    expect(isMB52Stock(["STYLE", "Material", "Description", "Department", "Unrestricted"])).toBe(true);
    expect(isMB52Stock(["style", "material", "description", "department", "unrestricted"])).toBe(true);
  });
});

function mkRow(headers: string[], vals: (string | number)[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  headers.forEach((h, i) => { r[h] = vals[i] ?? ""; });
  return r;
}

describe("extractTransitRows — sum of Delivery Quantity (column N)", () => {
  it("sums exact quantities, ignoring empty quantity cells", () => {
    const rows = [
      mkRow(VL06I_HEADERS, ["2023-06-01", "", "", "INV001", "SKU1", "STY1", "Desc1", 10, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "D100"]),
      mkRow(VL06I_HEADERS, ["2023-06-02", "", "", "INV002", "SKU2", "STY2", "Desc2", 25, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "D100"]),
      mkRow(VL06I_HEADERS, ["2023-06-03", "", "", "INV003", "SKU3", "STY3", "Desc3", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "D100"]),
    ];
    const imp = mkImport(VL06I_HEADERS, rows, "transit");
    const extracted = extractTransitRows(imp);
    expect(extracted.length).toBe(2);
    const sum = extracted.reduce((a, r) => a + r.quantity, 0);
    expect(sum).toBe(35);
  });
});

describe("extractNegativeStockRows — strictly K < 0", () => {
  const MB52_HEADERS = ["Style", "Material", "Description", "Department", "E", "F", "G", "H", "I", "J", "Unrestricted"];

  it("counts only rows with K < 0", () => {
    const rows = [
      mkRow(MB52_HEADERS, ["STY1", "SKU1", "Desc1", "D100", "", "", "", "", "", "", -5]),
      mkRow(MB52_HEADERS, ["STY2", "SKU2", "Desc2", "D100", "", "", "", "", "", "", 10]),
      mkRow(MB52_HEADERS, ["STY3", "SKU3", "Desc3", "D200", "", "", "", "", "", "", -3]),
      mkRow(MB52_HEADERS, ["STY4", "SKU4", "Desc4", "D200", "", "", "", "", "", "", 0]),
    ];
    const imp = mkImport(MB52_HEADERS, rows, "stock");
    const neg = extractNegativeStockRows(imp);
    expect(neg.length).toBe(2);
    expect(neg[0].quantity).toBe(-5);
    expect(neg[1].quantity).toBe(-3);
  });

  it("does not count zero as negative", () => {
    const rows = [mkRow(["Style", "Material", "Description", "Department", "E", "F", "G", "H", "I", "J", "Unrestricted"], ["STY1", "SKU1", "Desc1", "D100", "", "", "", "", "", "", 0])];
    const imp = mkImport(["Style", "Material", "Description", "Department", "E", "F", "G", "H", "I", "J", "Unrestricted"], rows, "stock");
    expect(extractNegativeStockRows(imp).length).toBe(0);
  });
});

describe("absence of fictive data without import", () => {
  it("returns empty array when no rows", () => {
    const imp = mkImport(VL06I_HEADERS, [], "transit");
    expect(extractTransitRows(imp)).toEqual([]);
  });

  it("returns empty for empty MB52", () => {
    const MB52_HEADERS = ["Style", "Material", "Description", "Department", "E", "F", "G", "H", "I", "J", "Unrestricted"];
    const imp = mkImport(MB52_HEADERS, [], "stock");
    expect(extractNegativeStockRows(imp)).toEqual([]);
  });
});

describe("transitAging >= 8 days", () => {
  it("computes age from a date 10 days ago", () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    expect(transitAging(old)).toBeGreaterThanOrEqual(9);
    expect(transitAging(old)).toBeLessThanOrEqual(10);
  });

  it("returns 0 for today", () => {
    expect(transitAging(new Date())).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(transitAging(null)).toBe(0);
  });
});
