import { describe, expect, it } from "vitest";
import { ENGINE_OPTION_KEYS } from "../../src/core/primitives/option-keys";
import type { EngineOptions } from "../../src/core/types";

type DomKey =
  | "element"
  | "handle"
  | "scrollContainer"
  | "backdrop"
  | "scrim"
  | "screenComponent";

type Listed = (typeof ENGINE_OPTION_KEYS)[number];
type Unlisted = Exclude<keyof EngineOptions, DomKey | Listed>;
type Assert<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

describe("the list of engine options adapters pass through", () => {
  it("names every option that is not a DOM node", () => {
    const complete: Assert<IsNever<Unlisted>> = true;
    expect(complete).toBe(true);
  });

  it("names no option twice", () => {
    expect(new Set(ENGINE_OPTION_KEYS).size).toBe(ENGINE_OPTION_KEYS.length);
  });
});
