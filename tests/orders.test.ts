import { describe, it, expect } from "vitest";
import { groupAndSortRegistrations, Registration } from "../lib/orders";

const makeDate = (minsAgo: number) => new Date(Date.now() - minsAgo * 60 * 1000);

describe("groupAndSortRegistrations", () => {
  it("groups by sku and sorts groups by latest timestamp desc, and items desc", () => {
    const regs: Registration[] = [
      { id: "1", sku: "A", customerName: "c1", whatsapp: "1", variation: "v1", timestamp: makeDate(5), status: "pending" },
      { id: "2", sku: "A", customerName: "c2", whatsapp: "2", variation: "v2", timestamp: makeDate(15), status: "pending" },
      { id: "3", sku: "B", customerName: "c3", whatsapp: "3", variation: "v3", timestamp: makeDate(2), status: "completed" },
      { id: "4", sku: "C", customerName: "c4", whatsapp: "4", variation: "v4", timestamp: makeDate(30), status: "pending" },
    ];

    const groups = groupAndSortRegistrations(regs, { view: "all" });

    // Groups should be ordered by latest timestamp: B (2min), A (5min), C (30min)
    expect(groups.map((g) => g.sku)).toEqual(["B", "A", "C"]);

    // Items within group A should be sorted desc by timestamp (id 1 then 2)
    const groupA = groups.find((g) => g.sku === "A")!;
    expect(groupA.items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("applies view filter: pending only", () => {
    const regs: Registration[] = [
      { id: "1", sku: "A", customerName: "c1", whatsapp: "1", variation: "v1", timestamp: makeDate(5), status: "pending" },
      { id: "2", sku: "B", customerName: "c2", whatsapp: "2", variation: "v2", timestamp: makeDate(2), status: "completed" },
    ];

    const groups = groupAndSortRegistrations(regs, { view: "pending" });
    expect(groups.map((g) => g.sku)).toEqual(["A"]);
  });

  it("applies sku search filter (partial, case-insensitive)", () => {
    const regs: Registration[] = [
      { id: "1", sku: "R2026-AAA", customerName: "c1", whatsapp: "1", variation: "v1", timestamp: makeDate(5), status: "pending" },
      { id: "2", sku: "R2026-BBB", customerName: "c2", whatsapp: "2", variation: "v2", timestamp: makeDate(2), status: "pending" },
    ];

    const groups = groupAndSortRegistrations(regs, { searchSku: "aaa" });
    expect(groups.map((g) => g.sku)).toEqual(["R2026-AAA"]);
  });
});
