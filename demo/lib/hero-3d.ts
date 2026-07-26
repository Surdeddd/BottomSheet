/**
 * Hero scene: the package itself, in 3D — a phone with a sheet that travels
 * between real snap points on a spring, the same shape of motion the engine
 * produces. Dashed rules mark each snap level, the handle rides the sheet, and
 * the whole rig tilts with the pointer.
 *
 * Opt-in by capability: no WebGL, reduced motion, or a hidden tab → never
 * loads. three.js is a dynamic import, so its weight lands only where the scene
 * actually runs.
 */

import type {
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Shape,
} from "three";

export type Hero3DHandle = { destroy: () => void };

type Role = "ink" | "paper" | "vermillion" | "shell";

/** Fractions of screen height, mirroring a typical snapPoints config. */
const SNAPS = [0.16, 0.46, 0.88];
/**
 * How far the page scrolls before the sheet has walked the whole ladder.
 * Deliberately long — at 900 the ladder was over before the reader had taken
 * the hero in, which made the motion feel twitchy rather than deliberate.
 */
const SCROLL_TRAVEL = 1800;

const PHONE_W = 2.5;
const PHONE_H = 5.1;
const SCREEN_W = PHONE_W - 0.22;
const SCREEN_H = PHONE_H - 0.3;

/** Desktop only: a phone does not need a WebGL context spending its battery. */
const MIN_STAGE_WIDTH = 900;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const hasWebGL = (): boolean => {
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ??
      c.getContext("webgl") ??
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
};

const readPalette = (): Record<Role, number> => {
  const cs = getComputedStyle(document.documentElement);
  const hex = (name: string, fallback: number): number => {
    const raw = cs.getPropertyValue(name).trim();
    if (!raw) return fallback;
    const probe = document.createElement("span");
    probe.style.color = raw;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+/g);
    probe.remove();
    if (!rgb || rgb.length < 3) return fallback;
    return (+rgb[0]! << 16) | (+rgb[1]! << 8) | +rgb[2]!;
  };
  return {
    ink: hex("--ink", 0x1a1614),
    paper: hex("--scene-surface", 0xf7f2e8),
    shell: hex("--scene-shell", 0xe3d8c4),
    vermillion: hex("--vermillion", 0xc12d1c),
  };
};

export const initHero3D = async (
  host: HTMLElement | null,
): Promise<Hero3DHandle | null> => {
  if (!host || prefersReducedMotion() || !hasWebGL()) return null;
  if (window.innerWidth < MIN_STAGE_WIDTH) return null;

  const THREE = await import("three");
  let palette = readPalette();

  /** Rounded rectangle centred on the origin; `top`/`bottom` pick which corners round. */
  const roundedRect = (
    w: number,
    h: number,
    r: number,
    corners: "all" | "top" = "all",
  ): Shape => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    const rt = r;
    const rb = corners === "all" ? r : 0;
    s.moveTo(x + rt, y + h);
    s.lineTo(x + w - rt, y + h);
    s.quadraticCurveTo(x + w, y + h, x + w, y + h - rt);
    s.lineTo(x + w, y + rb);
    s.quadraticCurveTo(x + w, y, x + w - rb, y);
    s.lineTo(x + rb, y);
    s.quadraticCurveTo(x, y, x, y + rb);
    s.lineTo(x, y + h - rt);
    s.quadraticCurveTo(x, y + h, x + rt, y + h);
    return s;
  };

  const scene = new THREE.Scene();
  // closer and wider: the phone was reading as a thumbnail in the corner
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 6.9);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  // The sheet slides in from below the screen; clip it at the screen edge so it
  // is masked by the phone instead of hanging out of the shell.
  renderer.localClippingEnabled = true;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const rig: Group = new THREE.Group();
  rig.rotation.set(-0.2, 0.52, 0.06);
  scene.add(rig);

  const disposables: { dispose: () => void }[] = [];
  const fills: { mat: MeshBasicMaterial; role: Role }[] = [];
  const strokes: LineBasicMaterial[] = [];

  const localClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), SCREEN_H / 2);
  const screenClip = localClip.clone();
  const clipFor = (clipped: boolean) => (clipped ? [screenClip] : null);

  const addShape = (
    shape: Shape,
    role: Role,
    z: number,
    opacity = 1,
    parent: Object3D = rig,
    clipped = false,
  ): Mesh => {
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: palette[role],
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      clippingPlanes: clipFor(clipped),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = z;
    parent.add(mesh);
    disposables.push(geo, mat);
    fills.push({ mat, role });
    return mesh;
  };

  const addOutline = (
    shape: Shape,
    z: number,
    opacity: number,
    parent: Object3D = rig,
    clipped = false,
  ): void => {
    const pts = shape.getPoints(48);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: palette.vermillion,
      transparent: true,
      opacity,
      clippingPlanes: clipFor(clipped),
    });
    const line = new THREE.Line(geo, mat);
    line.position.z = z;
    parent.add(line);
    disposables.push(geo, mat);
    strokes.push(mat);
  };

  // phone shell — doubled with a slight offset so the body reads as having
  // thickness rather than being a cut-out
  const shellMesh = addShape(
    roundedRect(PHONE_W, PHONE_H, 0.34),
    "shell",
    -0.06,
    0.9,
  );
  const shellBack = addShape(
    roundedRect(PHONE_W, PHONE_H, 0.34),
    "ink",
    -0.14,
    0.16,
  );
  shellBack.position.x = 0.05;
  shellBack.position.y = -0.05;
  addOutline(roundedRect(PHONE_W, PHONE_H, 0.34), 0.02, 0.5);

  // hardware detail: notch bar and side button
  const notch = addShape(roundedRect(0.72, 0.1, 0.05), "ink", 0.04, 0.55);
  notch.position.y = PHONE_H / 2 - 0.18;
  const sideButton = addShape(roundedRect(0.05, 0.34, 0.025), "ink", -0.05, 0.4);
  sideButton.position.set(PHONE_W / 2 + 0.02, 0.55, -0.05);

  // volume pair on the opposite edge
  for (const [i, y] of [0.72, 0.34].entries()) {
    const vol = addShape(roundedRect(0.045, 0.22, 0.022), "ink", -0.05, 0.34);
    vol.position.set(-PHONE_W / 2 - 0.02, y, -0.05);
    vol.name = `vol-${i}`;
  }

  // camera dot and speaker slit inside the notch
  const lens = addShape(roundedRect(0.07, 0.07, 0.035), "ink", 0.05, 0.75);
  lens.position.set(0.22, PHONE_H / 2 - 0.18, 0.05);
  const speaker = addShape(roundedRect(0.26, 0.035, 0.017), "ink", 0.05, 0.5);
  speaker.position.set(-0.05, PHONE_H / 2 - 0.18, 0.05);

  // home indicator at the foot of the screen
  const homeBar = addShape(roundedRect(0.62, 0.045, 0.022), "ink", 0.05, 0.3);
  homeBar.position.y = -SCREEN_H / 2 + 0.12;

  // a soft contact shadow so the device sits on the page, not against it
  const shadow = addShape(
    roundedRect(PHONE_W * 0.92, PHONE_H * 0.97, 0.34),
    "ink",
    -0.3,
    0.07,
  );
  shadow.position.set(0.14, -0.12, -0.3);
  const screenMesh = addShape(
    roundedRect(SCREEN_W, SCREEN_H, 0.26),
    "ink",
    -0.02,
    0.08,
  );

  // snap-level rules across the screen
  for (const frac of SNAPS) {
    const y = -SCREEN_H / 2 + SCREEN_H * frac;
    const pts: import("three").Vector3[] = [];
    const segments = 13;
    for (let i = 0; i < segments; i++) {
      const x0 = -SCREEN_W / 2 + (SCREEN_W / segments) * i;
      pts.push(new THREE.Vector3(x0, y, 0));
      pts.push(new THREE.Vector3(x0 + SCREEN_W / segments / 2, y, 0));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: palette.vermillion,
      transparent: true,
      opacity: 0.32,
    });
    const seg = new THREE.LineSegments(geo, mat);
    seg.position.z = 0.03;
    rig.add(seg);
    disposables.push(geo, mat);
    strokes.push(mat);
  }

  // the sheet: its own group so the whole thing slides as one
  const sheet: Group = new THREE.Group();
  rig.add(sheet);
  const SHEET_H = SCREEN_H;
  addShape(
    roundedRect(SCREEN_W, SHEET_H, 0.24, "top"),
    "paper",
    0.06,
    1,
    sheet,
    true,
  );
  addOutline(
    roundedRect(SCREEN_W, SHEET_H, 0.24, "top"),
    0.09,
    0.75,
    sheet,
    true,
  );

  // Handle and rows are siblings of the sheet, not children: as children they
  // inherited the sheet's explode offset on top of their own and the stack
  // sprayed apart. They follow the sheet in layout instead.
  const handle = addShape(
    roundedRect(0.62, 0.075, 0.037),
    "vermillion",
    0.11,
    1,
    rig,
    true,
  );

  const rowsGroup: Group = new THREE.Group();
  rig.add(rowsGroup);
  const rows: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const row = addShape(
      roundedRect(SCREEN_W - 0.55, 0.16, 0.06),
      "ink",
      0.1,
      0.13,
      rowsGroup,
      true,
    );
    rows.push(row);
  }

  /** topY is the sheet's top edge; body, handle and rows all hang off it. */
  const layoutSheet = (topY: number): void => {
    sheetBaseY = topY - SHEET_H / 2;
    sheet.position.y = sheetBaseY + sheetOffsetY;
    handle.position.y = topY - 0.16 + handleOffsetY;
    rowsGroup.position.y = topY + rowsOffsetY;
    rows.forEach((r, i) => {
      r.position.y = -0.5 - i * 0.34;
    });
  };
  let sheetBaseY = 0;
  let sheetOffsetY = 0;
  let handleOffsetY = 0;
  let rowsOffsetY = 0;

  const screenBottom = -SCREEN_H / 2;
  const topFor = (frac: number): number => screenBottom + SCREEN_H * frac;

  let current = topFor(SNAPS[0]!);
  let target = current;
  let velocity = 0;
  layoutSheet(current);

  /**
   * Scroll drives which snap the sheet is heading for — reading the page walks
   * the sheet up its ladder, so the scene demonstrates the engine instead of
   * looping at the viewer.
   */
  const snapFromScroll = (): number => {
    const t = Math.min(Math.max(window.scrollY / SCROLL_TRAVEL, 0), 1);
    const idx = Math.min(
      SNAPS.length - 1,
      Math.floor(t * SNAPS.length + 0.0001),
    );
    return topFor(SNAPS[idx]!);
  };
  target = snapFromScroll();
  current = target;

  /**
   * Second act: while the anatomy section is pinned, the same rig pulls apart
   * into its layers and the legend lights up in step. One WebGL context does
   * both jobs — the scene the reader already met is the one taking itself apart.
   */
  const anatomy = document.getElementById("assembly");
  const legend = Array.from(
    document.querySelectorAll<HTMLElement>(".asm-item"),
  );
  const legendList = document.querySelector<HTMLElement>(".assembly-legend");
  // An even fan, not a scatter: equal steps in depth with a matching rise, so
  // the stack opens like a technical exploded view and stays countable.
  const STEP_Z = 0.92;
  const STEP_Y = 0.42;
  const explodeOrder: Object3D[] = [
    shellMesh,
    screenMesh,
    sheet,
    handle,
    rowsGroup,
  ];
  /**
   * The section assembles rather than explodes: each layer flies in from its
   * own edge of the frame and lands, so the sheet is built in front of the
   * reader instead of being torn apart. Pulling apart read as breakage; this
   * reads as construction, which is what the copy actually claims.
   */
  const ENTRY_FROM: { x: number; y: number; z: number }[] = [
    { x: -3.4, y: 1.1, z: -1.6 }, // backdrop — in from the left
    { x: 3.2, y: -1.3, z: -0.9 }, // scrim — in from the right
    { x: 0, y: -3.6, z: 0.7 }, // surface — up from below, like a real sheet
    { x: 0.4, y: 3.0, z: 1.2 }, // handle — down from above
    { x: 3.6, y: 1.8, z: 1.6 }, // content — in from the top right
  ];
  const explodeTargets = explodeOrder.map((obj, i) => ({
    obj,
    z: ENTRY_FROM[i]!.z,
    y: ENTRY_FROM[i]!.y,
    x: ENTRY_FROM[i]!.x,
  }));
  const restState = explodeTargets.map(t => ({
    z: t.obj.position.z,
    y: t.obj.position.y,
    x: t.obj.position.x,
  }));
  /** Per-layer progress, staggered so the stack lands piece by piece. */
  const layerProgress = (t: number, i: number): number => {
    const span = 0.52;
    const start = (i / explodeOrder.length) * (1 - span);
    return Math.min(Math.max((t - start) / span, 0), 1);
  };
  let explode = 0;
  let explodeShown = 0;

  /** 0 while the section is still ahead, 1 once it has been scrolled through. */
  const explodeFromScroll = (): number => {
    if (!anatomy) return 0;
    const r = anatomy.getBoundingClientRect();
    const travel = Math.max(1, r.height - window.innerHeight * 0.5);
    return Math.min(Math.max(-r.top / travel, 0), 1);
  };

  const FADE_TAIL = 0.14;
  let scrollQueued = false;

  /**
   * The stage is fixed, so anything below it in the hero — the stats row —
   * would slide underneath as the page moves. Track the hero instead until it
   * has left, and only then pin: the scene rides out with its own section and
   * never crosses the numbers.
   */
  const PINNED_TOP = 88;
  let pinned = false;
  const applyStagePosition = (): void => {
    // Pin only once the anatomy section reaches the pin line. Before that the
    // stage rides inside the hero, so the stats row below it can never slide
    // beneath a fixed element.
    const anatomyTop = anatomy
      ? anatomy.getBoundingClientRect().top
      : Number.POSITIVE_INFINITY;
    const shouldPin = anatomyTop <= PINNED_TOP;
    if (shouldPin === pinned) return;
    pinned = shouldPin;
    host.classList.toggle("is-pinned", pinned);
  };

  const applyScroll = (): void => {
    scrollQueued = false;
    applyStagePosition();
    target = snapFromScroll();
    explode = explodeFromScroll();

    // hold the stage while the anatomy section is live, then let it go
    const fade =
      explode <= 1 - FADE_TAIL
        ? 1
        : Math.max(0, 1 - (explode - (1 - FADE_TAIL)) / FADE_TAIL);
    host.style.opacity = String(fade);

    legend.forEach((item, i) => {
      const lit = explode > (i + 0.35) / legend.length;
      item.classList.toggle("is-live", lit);
    });
    legendList?.style.setProperty(
      "--asm-progress",
      `${Math.round(explode * 100)}%`,
    );
  };

  const onScroll = (): void => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(applyScroll);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  applyScroll();

  const repaint = (): void => {
    palette = readPalette();
    for (const f of fills) f.mat.color.setHex(palette[f.role]);
    for (const s of strokes) s.color.setHex(palette.vermillion);
  };
  const themeObserver = new MutationObserver(repaint);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  let width = 0;
  let height = 0;
  const resize = (): void => {
    const r = host.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let targetX = 0;
  let targetY = 0;
  const onPointer = (e: PointerEvent): void => {
    const r = host.getBoundingClientRect();
    targetX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    targetY = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) visible = e.isIntersecting;
    },
    { threshold: 0.01 },
  );
  io.observe(host);
  const onVisibility = (): void => {
    visible = !document.hidden;
  };
  document.addEventListener("visibilitychange", onVisibility);

  let raf = 0;
  let t = 0;
  let curX = 0;
  let curY = 0;
  /**
   * Entrance: the rig swings in from a steeper angle and settles, so the scene
   * arrives rather than being suddenly present. Purely additive on top of the
   * scroll-driven pose, and it is over within a second.
   */
  let intro = 0;
  const INTRO_MS = 1100;
  const introStart = performance.now();
  const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
  const STIFFNESS = 150;
  const DAMPING = 20;

  const tick = (): void => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;

    // critically-ish damped spring, the engine's own settle shape
    const dt = 1 / 60;
    const accel = (target - current) * STIFFNESS - velocity * DAMPING;
    velocity += accel * dt;
    current += velocity * dt;

    // eased here rather than per-scroll event so the assembly glides
    explodeShown += (explode - explodeShown) * 0.09;
    explodeTargets.forEach((tgt, i) => {
      const rest = restState[i]!;
      // 1 = scattered off-frame, 0 = landed in place
      const away = 1 - layerProgress(explodeShown, i);
      const ease = away * away;
      tgt.obj.position.x = rest.x + tgt.x * ease;
      tgt.obj.position.z = rest.z + tgt.z * ease;
      // each piece rights itself as it lands, so parts arrive rather than slide
      tgt.obj.rotation.z = ease * (i % 2 === 0 ? -0.22 : 0.22);
      tgt.obj.rotation.x = ease * 0.3;
      // sheet-borne layers take their offset through layout, so they stay aligned
      if (tgt.obj === sheet) sheetOffsetY = tgt.y * ease;
      else if (tgt.obj === handle) handleOffsetY = tgt.y * ease;
      else if (tgt.obj === rowsGroup) rowsOffsetY = tgt.y * ease;
      else tgt.obj.position.y = rest.y + tgt.y * ease;
      // fade each piece in as it arrives
      const alpha = 1 - away;
      tgt.obj.traverse(node => {
        const m = (node as { material?: { opacity: number; transparent: boolean; userData: { base?: number } } }).material;
        if (!m) return;
        if (m.userData.base === undefined) m.userData.base = m.opacity;
        m.transparent = true;
        m.opacity = m.userData.base * alpha;
      });
    });
    layoutSheet(current);

    t += 0.0075;
    curX += (targetX - curX) * 0.045;
    curY += (targetY - curY) * 0.045;
    // pull the rig broadside as it comes apart, so the layers read as layers
    intro = easeOut(
      Math.min((performance.now() - introStart) / INTRO_MS, 1),
    );
    const entry = 1 - intro;

    rig.rotation.y =
      0.52 + curX * 0.3 + Math.sin(t) * 0.04 + explodeShown * 0.46 + entry * 0.7;
    rig.rotation.x =
      -0.2 + curY * 0.16 + Math.cos(t * 0.8) * 0.02 - explodeShown * 0.12 -
      entry * 0.25;
    rig.rotation.z = explodeShown * 0.05 + entry * 0.1;
    // ease back as it opens up, so the wider spread still stays in frame
    rig.scale.setScalar((1 - explodeShown * 0.2) * (0.82 + intro * 0.18));
    rig.position.x = entry * 0.9;
    rig.position.y = Math.sin(t * 1.2) * 0.05;

    // clipping planes live in world space, so re-derive it from the tilted rig
    rig.updateMatrixWorld();
    screenClip.copy(localClip).applyMatrix4(rig.matrixWorld);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
