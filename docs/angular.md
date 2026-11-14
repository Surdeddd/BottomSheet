# Angular

There is no Angular package. There are two ways to use the sheet, and both are
short.

## The custom element

The [custom element](web-component.md) works in an Angular template once the
component allows unknown elements:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";
import "@surdeddd/bottom-sheet/element";

@Component({
  selector: "app-filters",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <button (click)="$any(sheet).open()">Filters</button>

    <bottom-sheet
      #sheet
      snap-points="closed:0,open:fit"
      focus-trap="true"
      (snap)="active.set($any($event).detail.id)"
    >
      <h2 slot="header">Filters</h2>
      <ng-content />
    </bottom-sheet>
  `,
})
export class FiltersComponent {
  readonly active = signal("closed");
}
```

The element carries its own styles, and `(snap)`, `(opened)`, `(closed)` and
the rest are ordinary DOM events. `$any()` is there because the template sees
the element as a plain `HTMLElement`.

Do not bind the per-frame events, `drag` and `progress`, in a template: each
one would run change detection.

In an app that still runs on zone.js, the element registers its pointer
listeners inside the Angular zone, so a drag asks for change detection on
every move. With `OnPush` components that costs little. If it shows up in a
profile, use the engine directly, as below, or switch the app to zoneless
change detection, which is the default from Angular 21.

With server rendering, the import must not run on the server. Load it in the
browser only:

```ts
import { afterNextRender } from "@angular/core";

constructor() {
  afterNextRender(() => import("@surdeddd/bottom-sheet/element"));
}
```

## The engine in a component

For markup of your own, create the engine in a component. The one rule is to
create it outside the Angular zone: a drag fires on every frame, and inside
the zone each frame would run change detection.

```ts
import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { BottomSheetEngine, type EngineState } from "@surdeddd/bottom-sheet";

@Component({
  selector: "app-bottom-sheet",
  standalone: true,
  template: `
    <div class="bs-root">
      <div class="bs-backdrop" #backdrop></div>
      <section class="bs-sheet" #sheet data-mode="bottom" aria-label="Places">
        <div class="bs-handle" #handle role="slider" tabindex="0" aria-label="Resize sheet"></div>
        <div class="bs-content" #content><ng-content /></div>
      </section>
    </div>
  `,
})
export class BottomSheetComponent implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>("sheet");
  private readonly handle = viewChild.required<ElementRef<HTMLElement>>("handle");
  private readonly content = viewChild.required<ElementRef<HTMLElement>>("content");
  private readonly backdrop = viewChild.required<ElementRef<HTMLElement>>("backdrop");

  private engine: BottomSheetEngine | null = null;
  readonly state = signal<EngineState | null>(null);

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        const engine = new BottomSheetEngine({
          element: this.sheet().nativeElement,
          handle: this.handle().nativeElement,
          scrollContainer: this.content().nativeElement,
          backdrop: this.backdrop().nativeElement,
          snapPoints: [
            { id: "peek", size: 96 },
            { id: "half", size: "45dvh" },
            { id: "full", size: "90%" },
          ],
          initial: "peek",
        });
        const sync = () => this.zone.run(() => this.state.set({ ...engine.state }));
        engine.on("snap", sync);
        engine.on("dragstart", sync);
        engine.on("dragend", sync);
        sync();
        this.engine = engine;
      });
    });
  }

  snapTo(id: string) {
    return this.engine?.snapTo(id);
  }

  ngOnDestroy() {
    this.engine?.destroy();
  }
}
```

`afterNextRender` runs in the browser only, so the component is safe to render
on the server. The signal is written when the sheet settles and when a drag
starts or ends, never during the motion.

Add the stylesheet once, in `angular.json`:

```json
"styles": ["node_modules/@surdeddd/bottom-sheet/dist/styles.css", "src/styles.css"]
```

The example uses signal queries and `afterNextRender`. On an Angular version
without them, use `@ViewChild` with `ngAfterViewInit`, and guard the body with
`isPlatformBrowser`. In a zoneless app `runOutsideAngular` does nothing and
can stay.
