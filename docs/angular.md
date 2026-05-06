# @surdeddd/bottom-sheet · Angular (recipe)

There is no first-party Angular adapter yet — but the vanilla core integrates
cleanly with Angular 17+ standalone components in ~30 lines. The critical
concern is `NgZone`: drag events fire ~60 fps and would otherwise trigger
change detection on every frame.

## Recipe

```ts
import {
  Component,
  ElementRef,
  Inject,
  NgZone,
  PLATFORM_ID,
  signal,
  ViewChild,
  type AfterViewInit,
  type OnDestroy,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { BottomSheetEngine, type EngineState } from "@surdeddd/bottom-sheet";

@Component({
  selector: "app-bottom-sheet",
  standalone: true,
  template: `
    <div class="bs-root">
      <div class="bs-backdrop" #backdrop></div>
      <section class="bs-sheet" #sheet data-mode="bottom" role="dialog">
        <div class="bs-handle" #handle role="slider" tabindex="0">
          <ng-content select="[bsHeader]"></ng-content>
        </div>
        <div class="bs-content" #content>
          <ng-content></ng-content>
        </div>
      </section>
    </div>
  `,
  styleUrls: ["@surdeddd/bottom-sheet/styles"],
})
export class BottomSheetComponent implements AfterViewInit, OnDestroy {
  @ViewChild("sheet")    sheetEl!: ElementRef<HTMLElement>;
  @ViewChild("handle")   handleEl!: ElementRef<HTMLElement>;
  @ViewChild("content")  contentEl!: ElementRef<HTMLElement>;
  @ViewChild("backdrop") backdropEl!: ElementRef<HTMLElement>;

  readonly state = signal<EngineState>({
    size: 0, activeId: "", isDragging: false, isAnimating: false, progress: 0,
  });

  private engine: BottomSheetEngine | null = null;

  constructor(
    private zone: NgZone,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // CRITICAL: instantiate outside zone — drag fires 60fps, never re-enter zone there
    this.zone.runOutsideAngular(() => {
      this.engine = new BottomSheetEngine({
        element:         this.sheetEl.nativeElement,
        handle:          this.handleEl.nativeElement,
        scrollContainer: this.contentEl.nativeElement,
        backdrop:        this.backdropEl.nativeElement,
        snapPoints: [
          { id: "min",  size: 96 },
          { id: "half", size: "45%" },
          { id: "full", size: "85%" },
        ],
        initial: "min",
        animation: "spring",
      });

      // Re-enter zone ONLY on settled events (so signals tick at most 3x per gesture)
      const sync = () => this.zone.run(() => this.state.set(this.engine!.state));
      this.engine.on("snap",      sync);
      this.engine.on("dragstart", sync);
      this.engine.on("dragend",   sync);

      // 60fps progress stays out of zone — don't write signals here
      // Use direct DOM updates if you need progress-driven UI:
      // this.engine.on("progress", ({ value }) => this.someEl.style.opacity = String(value));
    });
  }

  ngOnDestroy() {
    this.engine?.destroy();
    this.engine = null;
  }

  snapTo(id: string) { return this.engine?.snapTo(id); }
  open()  { return this.engine?.open(); }
  close() { return this.engine?.close(); }
}
```

Use it in your templates:

```html
<app-bottom-sheet>
  <h2 bsHeader>Search</h2>
  <ul>
    <li *ngFor="let item of items">{{ item.title }}</li>
  </ul>
</app-bottom-sheet>
```

## Why no first-party adapter (yet)?

Angular's build pipeline (Ivy partial compilation, decorator metadata) needs
its own packaging story (`ng-packagr` or careful `tsup` config). Until the
project is ready to ship Angular package metadata, the recipe above is the
recommended integration. PRs welcome.

## Notes

- `runOutsideAngular` around the engine init is the load-bearing line. Without
  it, every drag pixel triggers change detection on the entire app.
- `isPlatformBrowser` guards SSR — Angular Universal would otherwise crash on
  `document` access.
- Use `signal<EngineState>` for reactive template bindings. The signal ticks
  only on settled events, so the rest of the app pays nothing during drag.
