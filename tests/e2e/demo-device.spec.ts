import { expect, test, type Page } from "@playwright/test";

const SHEET = '.device-screen[data-screen="react"] .bs-sheet';

type Rgb = [number, number, number];

const press = (page: Page, selector: string): Promise<void> =>
  page.evaluate(sel => {
    (document.querySelector(sel) as HTMLElement).click();
  }, selector);

const centreDevice = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const bezel = document.querySelector(".device-bezel")!;
    const box = bezel.getBoundingClientRect();
    window.scrollTo(
      0,
      box.top + window.scrollY - Math.max(8, (innerHeight - box.height) / 2),
    );
  });
  await page.waitForFunction(
    () =>
      new Promise<boolean>(resolve => {
        const top = (): number =>
          document.querySelector(".device-frame")!.getBoundingClientRect().top;
        const before = top();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(Math.abs(top() - before) < 0.01)),
        );
      }),
  );
};

const cornerPixels = async (
  page: Page,
): Promise<{ bezel: Rgb; corners: Record<string, Rgb> }> => {
  const frame = await page.evaluate(() => {
    const box = document.querySelector(".device-frame")!.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
    };
  });
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ shot, frame }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${shot}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const at = (x: number, y: number): [number, number, number] => {
        const d = ctx.getImageData(
          Math.round(x * scale),
          Math.round(y * scale),
          1,
          1,
        ).data;
        return [d[0]!, d[1]!, d[2]!];
      };
      const inset = 2.5;
      return {
        bezel: at(frame.left - 8, (frame.top + frame.bottom) / 2),
        corners: {
          topLeft: at(frame.left + inset, frame.top + inset),
          topRight: at(frame.right - inset, frame.top + inset),
          bottomLeft: at(frame.left + inset, frame.bottom - inset),
          bottomRight: at(frame.right - inset, frame.bottom - inset),
        },
      };
    },
    { shot, frame },
  );
};

const distance = (a: Rgb, b: Rgb): number =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

test.describe("demo device", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("bs-demo-theme", "dark");
    });
    await page.goto("/");
    await page.waitForSelector(SHEET);
    await page.waitForLoadState("networkidle");
  });

  test("a blurred scrim stays inside the rounded screen", async ({ page }) => {
    await press(page, "#tg-scrim-above");
    await press(page, '[data-scrim-preset="cinematic"]');
    await press(page, '#snap-chips .chip[data-snap="half"]');
    await page.waitForFunction(sel => {
      const el = document.querySelector(sel) as HTMLElement | null;
      const size = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
      return size > 300;
    }, SHEET);
    await page.waitForTimeout(600);
    await centreDevice(page);

    const { bezel, corners } = await cornerPixels(page);
    for (const [name, colour] of Object.entries(corners)) {
      expect(distance(colour, bezel), `${name} corner`).toBeLessThan(12);
    }
  });
});
