import { hasHardwareWebGL } from "./hero-3d/capability";
import { buildPhone, type Palette } from "./hero-3d/model";
import {
  LAYER_COUNT,
  SNAP_FULL,
  SNAP_HALF,
  SNAP_PEEK,
  buildAt,
  focusOf,
  layerLift,
  litCount,
  sheetFraction,
  smooth,
  travelAt,
  type StageSpan,
} from "./hero-3d/timeline";

export type Hero3DHandle = { destroy: () => void };

export type StageLayout = "pinned" | "inline";

export type StageTargets = {
  layout: StageLayout;
  stage: HTMLElement;
  heroAnchor: HTMLElement | null;
  buildAnchor: HTMLElement;
};

export const MIN_STAGE_WIDTH = 900;

export const STAGE_MEDIA = `(min-width: ${MIN_STAGE_WIDTH}px)`;

const FOV = 24;
const DISTANCE = 17.5;
const MAX_PIXELS = 3_400_000;
const IDLE_CYCLE = [SNAP_PEEK, SNAP_HALF, SNAP_FULL, SNAP_HALF];
const IDLE_STEP_MS = 2600;
const INTRO_MS = 1100;
const STIFFNESS = 150;
const DAMPING = 20;

const HERO_POSE = { yaw: -0.46, pitch: -0.1, roll: -0.02, fill: 0.94 };
const BUILD_POSE = { yaw: -0.8, pitch: -0.28, roll: 0.02, fill: 0.7 };
const BUILD_WIDTH = 5.5;
const BUILD_SHIFT = 1.4;
const SETTLED_POSE = { yaw: -0.4, pitch: -0.12 };

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export const canRenderStage = (): boolean =>
  !prefersReducedMotion() && hasHardwareWebGL();

const readPalette = (): Palette => {
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
    surface: hex("--scene-surface", 0xfffaf0),
    vermillion: hex("--vermillion", 0xc12d1c),
    dark: document.documentElement.dataset.theme === "dark",
  };
};

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const initHero3D = async (
  targets: StageTargets,
): Promise<Hero3DHandle | null> => {
  if (!canRenderStage()) return null;
  const { layout, stage, heroAnchor, buildAnchor } = targets;
  const host = layout === "pinned" ? stage : buildAnchor;

  const THREE = await import("three");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 4, 60);
  camera.position.set(0, 0, DISTANCE);
  const worldHeight = 2 * DISTANCE * Math.tan((FOV * Math.PI) / 360);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearAlpha(0);
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7a892, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-4, 5, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf3ebe2, 0.75);
  rim.position.set(5, -2, -4);
  scene.add(rim);

  const model = buildPhone(THREE, readPalette());
  const rig = model.rig;
  scene.add(rig);

  const legend = Array.from(
    document.querySelectorAll<HTMLElement>(".asm-item"),
  );
  const legendList = document.querySelector<HTMLElement>(".assembly-legend");
  let litShown = -1;
  const paintLegend = (lit: number): void => {
    if (lit === litShown) return;
    litShown = lit;
    legend.forEach((item, i) => item.classList.toggle("is-live", i < lit));
    legendList?.style.setProperty(
      "--asm-progress",
      `${Math.round((lit / LAYER_COUNT) * 100)}%`,
    );
  };

  const span: StageSpan = { stickStart: 0, stickEnd: 0 };
  let width = 1;
  let height = 1;
  let hostLeft = 0;
  let hostTop = 0;

  const measure = (): void => {
    const box = host.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    const area = width * height;
    const cap = Math.sqrt(MAX_PIXELS / area);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2, cap));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (layout === "pinned") {
      const rail = buildAnchor.parentElement ?? buildAnchor;
      const railBox = rail.getBoundingClientRect();
      const stickyTop = parseFloat(getComputedStyle(buildAnchor).top) || 0;
      const railTop = railBox.top + window.scrollY;
      span.stickStart = Math.max(0, railTop - stickyTop);
      span.stickEnd = Math.max(
        span.stickStart,
        railTop + railBox.height - buildAnchor.offsetHeight - stickyTop,
      );
    }
    dirty = true;
  };

  let dirty = true;
  let travel = layout === "pinned" ? 0 : 1;
  let build = 0;
  const heroBox = { x: 0, y: 0, w: 0, h: 0 };
  const buildBox = { x: 0, y: 0, w: 0, h: 0 };

  const readLayout = (): void => {
    dirty = false;
    const box = host.getBoundingClientRect();
    hostLeft = box.left;
    hostTop = box.top;
    if (layout === "pinned") {
      travel = travelAt(window.scrollY, span);
      build = buildAt(window.scrollY, span);
      const b = buildAnchor.getBoundingClientRect();
      buildBox.x = b.left + b.width / 2;
      buildBox.y = b.top + b.height / 2;
      buildBox.w = b.width;
      buildBox.h = b.height;
      const h = heroAnchor?.getBoundingClientRect();
      heroBox.w = h?.width ?? 0;
      heroBox.h = h?.height ?? 0;
      heroBox.x = h ? h.left + h.width / 2 : buildBox.x;
      heroBox.y = h ? h.top + h.height / 2 : buildBox.y;
      return;
    }
    const vh = window.innerHeight;
    const from = vh * 0.82;
    const to = vh * 0.08;
    build = Math.min(Math.max((from - box.top) / (from - to), 0), 1);
    buildBox.x = box.left + box.width / 2;
    buildBox.y = box.top + box.height / 2;
    buildBox.w = box.width;
    buildBox.h = box.height;
  };

  const markDirty = (): void => {
    dirty = true;
  };
  window.addEventListener("scroll", markDirty, { passive: true });

  const ro = new ResizeObserver(measure);
  ro.observe(host);
  ro.observe(buildAnchor);
  if (stage.parentElement) ro.observe(stage.parentElement);
  window.addEventListener("resize", measure);
  measure();

  const repaint = (): void => model.repaint(readPalette());
  const themeObserver = new MutationObserver(repaint);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  let pointerX = 0;
  let pointerY = 0;
  const onPointer = (e: PointerEvent): void => {
    if (e.pointerType === "touch") return;
    pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let onScreen = true;
  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) onScreen = entry.isIntersecting;
      if (onScreen) wake();
    },
    { rootMargin: "10% 0px" },
  );
  io.observe(host);
  const onVisibility = (): void => {
    if (!document.hidden) wake();
  };
  document.addEventListener("visibilitychange", onVisibility);

  let raf = 0;
  let last = 0;
  let clock = 0;
  let fraction = SNAP_PEEK;
  let velocity = 0;
  let idleIndex = 0;
  let idleAt = performance.now() + INTRO_MS + 500;
  let lookX = 0;
  let lookY = 0;
  const started = performance.now();

  const frame = (now: number): void => {
    raf = 0;
    if (!onScreen || document.hidden) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    clock += dt;
    if (dirty) readLayout();

    if (travel < 0.05 && now >= idleAt) {
      idleIndex = (idleIndex + 1) % IDLE_CYCLE.length;
      idleAt = now + IDLE_STEP_MS;
    }
    const target = sheetFraction(travel, build, IDLE_CYCLE[idleIndex]!);
    const steps = Math.max(1, Math.round(dt / 0.004));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      velocity += ((target - fraction) * STIFFNESS - velocity * DAMPING) * h;
      fraction += velocity * h;
    }
    model.setSheet(fraction);

    for (let i = 0; i < LAYER_COUNT; i++) {
      model.setLift(i, layerLift(travel, build, i));
      model.setFocus(i, travel >= 1 ? focusOf(build, i) : 0);
    }
    model.setRuler(1 - smooth(travel * 2.4));
    paintLegend(travel >= 1 || layout === "inline" ? litCount(build) : 0);

    const intro = smooth((now - started) / INTRO_MS);
    const e = smooth(travel);
    const settle = smooth((build - 0.86) / 0.14);
    const unit = worldHeight / height;
    const heroShown = heroBox.w > 1 && heroBox.h > 1;
    const from = heroShown ? heroBox : buildBox;
    const fit = (box: typeof heroBox, fill: number, span: number): number =>
      Math.min(
        (box.h * unit * fill) / model.height,
        (box.w * unit * 0.96) / span,
      );
    const buildScale = fit(buildBox, BUILD_POSE.fill, BUILD_WIDTH);
    const heroScale = heroShown
      ? fit(heroBox, HERO_POSE.fill, model.width)
      : buildScale * 0.9;
    const scale = mix(heroScale, buildScale, e);
    const cx = mix(from.x, buildBox.x + (BUILD_SHIFT * buildScale) / unit, e);
    const cy = mix(from.y, buildBox.y, e);
    const x = (cx - hostLeft - width / 2) * unit;
    const y = -(cy - hostTop - height / 2) * unit;

    lookX += (pointerX - lookX) * Math.min(dt * 4, 1);
    lookY += (pointerY - lookY) * Math.min(dt * 4, 1);
    const calm = 1 - e * 0.6;
    const yaw =
      mix(HERO_POSE.yaw, mix(BUILD_POSE.yaw, SETTLED_POSE.yaw, settle), e) +
      lookX * 0.2 * calm +
      Math.sin(clock * 0.7) * 0.035 * calm -
      Math.atan(x / DISTANCE) +
      (1 - intro) * 0.9;
    const pitch =
      mix(HERO_POSE.pitch, mix(BUILD_POSE.pitch, SETTLED_POSE.pitch, settle), e) +
      lookY * 0.1 * calm +
      Math.cos(clock * 0.55) * 0.02 * calm +
      Math.atan(y / DISTANCE);
    rig.rotation.set(pitch, yaw, mix(HERO_POSE.roll, BUILD_POSE.roll, e));
    rig.scale.setScalar(scale * (0.9 + intro * 0.1));
    rig.position.set(x, y + Math.sin(clock * 1.1) * 0.05 * scale * calm, 0);
    rig.updateMatrixWorld();
    model.updateClip();

    const shown = heroShown ? 1 : smooth((travel - 0.3) / 0.5);
    renderer.domElement.style.opacity = String(Math.min(intro, shown));
    renderer.render(scene, camera);
  };

  const wake = (): void => {
    if (raf) return;
    last = 0;
    dirty = true;
    raf = requestAnimationFrame(frame);
  };
  wake();

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", markDirty);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      legend.forEach(item => item.classList.remove("is-live"));
      legendList?.style.removeProperty("--asm-progress");
      model.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
