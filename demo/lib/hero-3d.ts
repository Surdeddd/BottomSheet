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
/** How far the page scrolls before the sheet has walked the whole ladder. */
const SCROLL_TRAVEL = 900;

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
    paper: hex("--paper", 0xf4ede0),
    shell: hex("--paper-deep", 0xece2d0),
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
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

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

  // phone shell + screen
  addShape(roundedRect(PHONE_W, PHONE_H, 0.34), "shell", -0.06, 0.9);
  addOutline(roundedRect(PHONE_W, PHONE_H, 0.34), 0.02, 0.5);
  addShape(roundedRect(SCREEN_W, SCREEN_H, 0.26), "ink", -0.02, 0.08);

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

  const handle = addShape(
    roundedRect(0.62, 0.075, 0.037),
    "vermillion",
    0.11,
    1,
    sheet,
    true,
  );

  // content rows on the sheet
  const rows: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const row = addShape(
      roundedRect(SCREEN_W - 0.55, 0.16, 0.06),
      "ink",
      0.1,
      0.13,
      sheet,
      true,
    );
    rows.push(row);
  }

  const layoutSheet = (topY: number): void => {
    // topY is where the sheet's top edge sits; the body hangs below it
    sheet.position.y = topY - SHEET_H / 2;
    handle.position.y = SHEET_H / 2 - 0.16;
    rows.forEach((r, i) => {
      r.position.y = SHEET_H / 2 - 0.5 - i * 0.34;
    });
  };

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

  /** The stage is pinned, so it has to bow out once its section is behind us. */
  const FADE_START = SCROLL_TRAVEL * 1.15;
  const FADE_END = SCROLL_TRAVEL * 1.6;
  let scrollQueued = false;

  const applyScroll = (): void => {
    scrollQueued = false;
    target = snapFromScroll();
    const y = window.scrollY;
    const fade =
      y <= FADE_START
        ? 1
        : Math.max(0, 1 - (y - FADE_START) / (FADE_END - FADE_START));
    host.style.opacity = String(fade);
  };

  const onScroll = (): void => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(applyScroll);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

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
    layoutSheet(current);

    t += 0.0075;
    curX += (targetX - curX) * 0.045;
    curY += (targetY - curY) * 0.045;
    rig.rotation.y = 0.52 + curX * 0.3 + Math.sin(t) * 0.04;
    rig.rotation.x = -0.2 + curY * 0.16 + Math.cos(t * 0.8) * 0.02;
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
