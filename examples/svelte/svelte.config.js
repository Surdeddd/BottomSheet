// Minimal Svelte 5 config; vitePreprocess pulls in TS support out of the box.
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
