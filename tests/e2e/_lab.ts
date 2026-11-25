import type { Page } from "@playwright/test";
import type { LabOptions } from "../../demo/fixtures/features";

export type Step = {
  dx?: number;
  dy?: number;
  steps?: number;
  pause?: number;
  hold?: number;
};

export const mount = (
  page: Page,
  options: LabOptions = {},
  keep = false,
): Promise<number> =>
  page.evaluate(([o, k]) => window.lab.mount(o, k), [options, keep] as const);

export const state = (page: Page, index = 0) =>
  page.evaluate(i => window.lab.state(i), index);

export const settled = (page: Page, index = 0) =>
  page.evaluate(i => window.lab.settled(i), index);

export const snapTo = async (page: Page, id: string, index = 0) => {
  await page.evaluate(
    ([s, i]) => {
      void window.lab.engine(i).snapTo(s);
    },
    [id, index] as const,
  );
  return settled(page, index);
};

export const events = (page: Page, index = 0) =>
  page.evaluate(i => window.lab.events(i), index);

export const visible = (page: Page, index = 0) =>
  page.evaluate(i => window.lab.visible(i), index);

export const viewport = (page: Page) =>
  page.evaluate(() => ({ width: innerWidth, height: innerHeight }));

export const centreOf = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export const press = async (page: Page, selector: string) => {
  const point = await centreOf(page, selector);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
};

export const move = async (
  page: Page,
  from: { x: number; y: number },
  { dx = 0, dy = 0, steps = 10, pause = 0 }: Step,
) => {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + (dx * i) / steps,
      from.y + (dy * i) / steps,
    );
    if (pause) await page.waitForTimeout(pause);
  }
  return { x: from.x + dx, y: from.y + dy };
};

export const drag = async (page: Page, selector: string, step: Step) => {
  const from = await press(page, selector);
  await move(page, from, step);
  await page.mouse.up();
  return settled(page);
};

export const SLOW = { steps: 15, pause: 60 };

export const pointerDrag = async (
  page: Page,
  selector: string,
  kind: "touch" | "mouse",
  step: Step,
) => {
  await page.evaluate(
    async ([sel, pointerType, dx, dy, steps, pause, hold]) => {
      const el = document.querySelector(sel)!;
      const wait = (ms: number): Promise<void> | void => {
        if (ms > 20) return new Promise(resolve => setTimeout(resolve, ms));
        const until = performance.now() + ms;
        while (performance.now() < until);
      };
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const fire = (type: string, cx: number, cy: number): void => {
        el.dispatchEvent(
          new PointerEvent(type, {
            clientX: cx,
            clientY: cy,
            pointerId: 11,
            pointerType,
            isPrimary: true,
            button: 0,
            bubbles: true,
            cancelable: true,
          }),
        );
      };
      fire("pointerdown", x, y);
      for (let i = 1; i <= steps; i++) {
        await wait(pause);
        fire("pointermove", x + (dx * i) / steps, y + (dy * i) / steps);
      }
      if (hold) await new Promise(resolve => setTimeout(resolve, hold));
      fire("pointerup", x + dx, y + dy);
    },
    [
      selector,
      kind,
      step.dx ?? 0,
      step.dy ?? 0,
      step.steps ?? 10,
      step.pause ?? 16,
      step.hold ?? 0,
    ] as const,
  );
  return settled(page);
};

export const touchDrag = (page: Page, selector: string, step: Step) =>
  pointerDrag(page, selector, "touch", step);

export const openLab = async (page: Page): Promise<void> => {
  await page.goto("/fixtures/features.html");
  await page.waitForFunction(() => !!window.lab);
};
