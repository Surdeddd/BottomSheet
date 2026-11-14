import { buildQwikProbe, report } from "./qwik-probe.mjs";

const rootTsx = `/** @jsxImportSource @builder.io/qwik */
import { component$ } from "@builder.io/qwik";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik-lib";

export default component$(() => (
  <BottomSheet
    snapPoints={[
      { id: "closed", size: 0 },
      { id: "half", size: 300 },
    ]}
    initial="half"
    ariaLabel="ssr sheet"
  >
    <p>ssr content row</p>
  </BottomSheet>
));
`;

const entrySsr = `/** @jsxImportSource @builder.io/qwik */
import { renderToString } from "@builder.io/qwik/server";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik-lib";

export async function render(manifest) {
  const result = await renderToString(
    <BottomSheet
      snapPoints={[
        { id: "closed", size: 0 },
        { id: "half", size: 300 },
      ]}
      initial="half"
      ariaLabel="ssr sheet"
    >
      <p>ssr content row</p>
    </BottomSheet>,
    { containerTagName: "div", manifest },
  );
  return result.html;
}
`;

const { html, cleanup } = await buildQwikProbe({
  name: "qwik-ssr",
  rootTsx,
  entrySsr,
});
cleanup();

report("qwik-ssr-check", {
  "renders markup": html.length > 500,
  "paused container": html.includes('q:container="paused"'),
  "bs-sheet present": html.includes("bs-sheet"),
  "aria label": html.includes("ssr sheet"),
  "slot content": html.includes("ssr content row"),
});
console.log("qwik-ssr-check: consumer client+SSR flow OK");
