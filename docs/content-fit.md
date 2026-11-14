# Content at every snap point

By default the end of a long list is reachable only when the sheet is fully
open. `fitContentToSnap` makes it reachable at every snap point, and keeps the
footer on screen with it.

```tsx
<BottomSheet snapPoints={points} fitContentToSnap footer={<Checkout />}>
  <LongList />
</BottomSheet>
```

## Why it is off by default

The sheet is always as tall as its largest snap point and is moved with a
transform. That is what keeps a drag off the layout path. The cost is that
below the largest point, the bottom of the scroll area sits under the edge of
the screen, by exactly `largest point − current size`. At a half point you
can scroll, but the last rows never come into view, and the footer is down
there with them.

For a sheet that people pull all the way up to read, that is the native
behaviour and it is fine. For a sheet that is used at half height, turn the
option on.

## What it does

At rest, the scroll area ends at the edge of the screen. The last row, a
focused field and the scrollbar are all in the visible part, the thumb is
sized for what you can see, and the footer sits at the bottom of that part.

While the sheet moves, the scroll area goes back to its full height, with a
spacer at its end, so the rows below the edge are already laid out when a
drag reveals them. The footer rides the edge of the screen with a transform.
That is one layout when the motion starts and one when it ends, none in
between, so the motion itself stays on the compositor. A list that was
scrolled to its end stays where it is on screen while the sheet moves.

On a point too short to hold both the list and the footer, the footer slides
under the screen edge and does not cover the handle.

## Scrolling with a finger

Making the end of the list reachable and letting a finger scroll to it are two
separate things. A swipe that starts on the content drags the sheet until it
reaches its largest point, and only then scrolls the list. A mouse wheel or a
trackpad scrolls at any point; a finger does not.

To scroll at a half point with a finger, give content swipes to the list and
leave the handle and the header for moving the sheet:

```tsx
<BottomSheet snapPoints={points} fitContentToSnap dragFromContent={false}>
  <LongList />
</BottomSheet>
```

`dragFromContent` can also be set per snap point. This keeps the pull-up
gesture on a small peek and frees the list from half upwards:

```ts
const points = [
  { id: "peek", size: 120 },
  { id: "half", size: "50%", dragFromContent: false },
  { id: "full", size: "90%", dragFromContent: false },
];
```

## Limits

- It applies to `bottom` sheets.
- It expects the scroll area to be the growing child of the sheet's flex
  column, the way `.bs-content` is.
- On the [slim core](../README.md#slim-core) it is a feature to add:
  `contentFitFeature()` from `@surdeddd/bottom-sheet/features`.

## With markup of your own

For a scroll container that is not `.bs-content`, the engine gives you the two
values the stylesheet uses. `data-bs-fit-content` on the sheet is `rest` or
`moving`, and `--bs-content-inset` is the height that is hidden:

```css
.bs-sheet[data-bs-fit-content="rest"] .my-list {
  max-height: calc(100% - var(--bs-content-inset));
}
.bs-sheet[data-bs-fit-content="moving"] .my-list {
  padding-bottom: var(--bs-content-inset);
}
```

## With the WebGL renderer

The [WebGL renderer](webgl.md) gets the same layout. During a drag it lifts
the list into a texture that follows the list's scroll position, so a list
held at its end stays put there as well.
