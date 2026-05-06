// Side-effect CSS imports from the library's theme subpaths. These don't
// have TS module declarations — the loaders just trigger the bundler to
// inject the stylesheet. We declare them as untyped void modules so tsc
// stops complaining; runtime resolution is handled by Vite's CSS handler.
declare module "@surdeddd/bottom-sheet/themes/ios";
declare module "@surdeddd/bottom-sheet/themes/material";
declare module "@surdeddd/bottom-sheet/themes/vercel";

// Vite's `?raw` suffix imports a file as a string literal at build time.
// Used by demo/lib/stackblitz.ts to inline the dist bundle into the
// generated StackBlitz project (so it boots without `npm install`).
declare module "*?raw" {
  const content: string;
  export default content;
}
