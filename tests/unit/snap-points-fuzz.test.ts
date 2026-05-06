import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  findNearest,
  allowedRange,
  findDragSettleTarget,
  type ResolvedSnap,
} from "../../src/core/primitives/snap-points";

// Generates a non-empty list of unique-id, ascending-size snaps
// (matches resolveSnapList's post-sort invariant) with at least one
// element so we never feed the production code a degenerate empty pool.
const arbSnaps = fc
  .uniqueArray(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 6 }),
      size: fc.integer({ min: 0, max: 2000 }),
    }),
    { minLength: 1, maxLength: 8, selector: s => s.id },
  )
  .map<ResolvedSnap[]>(arr => [...arr].sort((a, b) => a.size - b.size));

// Pick a non-empty subset of ids from the given snap list.
const arbAllowedSubsetOf = (snaps: ResolvedSnap[]) =>
  fc
    .subarray(snaps.map(s => s.id), { minLength: 1 })
    .map(ids => [...new Set(ids)]);

const RUNS = { numRuns: 100 };

describe("findNearest — property invariants", () => {
  it("returns a snap from the input pool (never invents one)", () => {
    fc.assert(
      fc.property(arbSnaps, fc.integer({ min: -500, max: 3000 }), (snaps, v) => {
        const allowed = snaps.map(s => s.id);
        const out = findNearest(v, snaps, allowed);
        expect(out).not.toBeNull();
        expect(snaps).toContainEqual(out);
      }),
      RUNS,
    );
  });

  it("minimises |target - snap.size| over allowed pool (direction=0, bias=0)", () => {
    fc.assert(
      fc.property(
        arbSnaps.chain(snaps =>
          fc.tuple(
            fc.constant(snaps),
            arbAllowedSubsetOf(snaps),
            fc.integer({ min: -500, max: 3000 }),
          ),
        ),
        ([snaps, allowed, v]) => {
          const out = findNearest(v, snaps, allowed)!;
          const pool = snaps.filter(s => allowed.includes(s.id));
          const minDist = Math.min(...pool.map(s => Math.abs(v - s.size)));
          expect(Math.abs(v - out.size)).toBe(minDist);
        },
      ),
      RUNS,
    );
  });

  it("returns null when allowed-filtered pool is empty", () => {
    fc.assert(
      fc.property(arbSnaps, fc.integer({ min: -500, max: 3000 }), (snaps, v) => {
        // Forbid every id in the input by passing a disjoint allowed list.
        expect(findNearest(v, snaps, ["__nope__"])).toBeNull();
      }),
      RUNS,
    );
  });
});

describe("allowedRange — property invariants", () => {
  it("min <= max and both correspond to snaps in the allowed pool", () => {
    fc.assert(
      fc.property(
        arbSnaps.chain(snaps =>
          fc.tuple(fc.constant(snaps), arbAllowedSubsetOf(snaps)),
        ),
        ([snaps, allowed]) => {
          const { min, max } = allowedRange(snaps, allowed);
          expect(min).toBeLessThanOrEqual(max);
          const pool = snaps.filter(s => allowed.includes(s.id));
          const sizes = pool.map(s => s.size);
          expect(sizes).toContain(min);
          expect(sizes).toContain(max);
        },
      ),
      RUNS,
    );
  });

  it("empty allowed pool returns identity {0,0} range", () => {
    fc.assert(
      fc.property(arbSnaps, snaps => {
        const r = allowedRange(snaps, []);
        expect(r).toEqual({ min: 0, max: 0 });
      }),
      RUNS,
    );
  });
});

describe("findDragSettleTarget — property invariants", () => {
  // Sub-threshold + zero direction → pass-through to activeId snap.
  // (delta=0, velocity=0 puts us in the no-intent branch that returns
  // findById(activeId, resolved) regardless of allowed list.)
  it("zero delta + zero velocity returns the active snap", () => {
    fc.assert(
      fc.property(
        arbSnaps.chain(snaps =>
          fc.tuple(
            fc.constant(snaps),
            arbAllowedSubsetOf(snaps),
            fc.constantFrom(...snaps.map(s => s.id)),
          ),
        ),
        ([snaps, allowed, activeId]) => {
          const out = findDragSettleTarget({
            delta: 0,
            velocity: 0,
            pointerKind: "touch",
            size: snaps.find(s => s.id === activeId)!.size,
            activeId,
            allowed,
            resolved: snaps,
            maxAxisSize: 1000,
            flickVelocity: 0.65,
            dragThreshold: 18,
          });
          expect(out?.id).toBe(activeId);
        },
      ),
      RUNS,
    );
  });

  // Above-threshold drag (delta beyond dragThresh OR velocity past flick) →
  // routes through findNearest, which only returns from the allowed pool.
  it("above-threshold settles to a snap in the allowed pool", () => {
    fc.assert(
      fc.property(
        arbSnaps.chain(snaps =>
          fc.tuple(
            fc.constant(snaps),
            arbAllowedSubsetOf(snaps),
            fc.constantFrom(...snaps.map(s => s.id)),
            fc.integer({ min: -3000, max: 3000 }),
          ),
        ),
        ([snaps, allowed, activeId, size]) => {
          const out = findDragSettleTarget({
            delta: 200, // well above dragThreshold
            velocity: 1.5, // above flickVelocity
            pointerKind: "touch",
            size,
            activeId,
            allowed,
            resolved: snaps,
            maxAxisSize: 1000,
            flickVelocity: 0.65,
            dragThreshold: 18,
          });
          // Allowed pool is non-empty by construction, so output must be there.
          expect(out).not.toBeNull();
          expect(allowed).toContain(out!.id);
        },
      ),
      RUNS,
    );
  });

  // Strong upward flick (positive velocity) never settles BELOW the starting
  // size: speedBias pushes the search target upward so findNearest can only
  // tie or move up. (Equality is allowed when the start sits on a snap or
  // when ties between equidistant snaps resolve to the first/lower one — the
  // engine's loop uses strict `<`, so ties keep the lower snap.)
  it("strong positive-velocity flick never settles below the starting size", () => {
    fc.assert(
      fc.property(
        arbSnaps.chain(snaps =>
          fc.tuple(fc.constant(snaps), arbAllowedSubsetOf(snaps)),
        ),
        ([snaps, allowed]) => {
          const pool = snaps.filter(s => allowed.includes(s.id));
          const size = 0; // start at the bottom — only direction is up
          const out = findDragSettleTarget({
            delta: 200,
            velocity: 5, // huge flick, speedBias maxes out
            pointerKind: "touch",
            size,
            activeId: pool[0]!.id,
            allowed,
            resolved: snaps,
            maxAxisSize: 1000,
            flickVelocity: 0.65,
            dragThreshold: 18,
          });
          expect(out).not.toBeNull();
          expect(out!.size).toBeGreaterThanOrEqual(size);
        },
      ),
      RUNS,
    );
  });
});
