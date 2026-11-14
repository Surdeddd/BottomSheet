# Recipes

Worked examples of common sheets. Each is one page, written for React unless
it says otherwise, and uses nothing outside the public API.

| Recipe | What it shows |
| --- | --- |
| [Filter panel](./filter-panel.md) | A panel that stays on screen: `setAllowed` without a closed point |
| [Checkout drawer](./checkout-drawer.md) | Refusing to close while a payment is in flight, with `before-snap` |
| [Comment thread](./comment-thread.md) | A scrolling list inside the sheet, and an input docked above the keyboard |
| [Comment composer](./comment-composer.md) | Growing to full height when the field takes focus |
| [Navigation drawer](./navigation-drawer.md) | A left-edge drawer with a pull tab and a menu button |
| [Media mini player](./media-mini-player.md) | A strip that is always there and pulls up into full controls |
| [Image gallery](./image-gallery.md) | A grid in a sheet that expands to full screen |
| [Wallet: send money](./wallet-send-money.md) | A flow of several steps, guarded on the way back |
| [Programmatic drag](./programmatic-drag.md) | Moving the sheet from code with `dragTo()`: previews, scrubbing, entrances |
| [A sheet from JSON](./json-config.md) | `<BottomSheetFromConfig>` for sheets described by a CMS or a flag |

The guide for your framework: [React](../react.md) · [Vue](../vue.md) ·
[Svelte](../svelte.md) · [Solid](../solid.md) · [Qwik](../qwik.md) ·
[Preact](../preact.md) · [Custom element](../web-component.md) ·
[Vanilla](../vanilla.md).
