/**
 * Hero scene: the sheet exploded into its real layers — backdrop, scrim,
 * surface, handle, content — floating apart in depth and drawing back together
 * as you scroll. Blueprint styling (flat fills + vermillion edges) so it reads
 * as a diagram of the library rather than decoration.
 *
 * Opt-in by capability: no WebGL, reduced motion, or a hidden tab → never loads.
 * three.js is imported dynamically so the bundle cost lands only where it runs.
 */

export type Hero3DHandle = { destroy: () => void };

type Role = "ink" | "paper" | "vermillion";

type Layer = {
  z: number;
  w: number;
  h: number;
  role: Role;
  opacity: number;
  label: string;
};

/** Deliberately restrained: the stack sits beside the type, never over it. */
const LAYERS: Layer[] = [
  { z: -2.2, w: 3.1, h: 4.3, role: "ink", opacity: 0.07, label: "backdrop" },
  { z: -1.2, w: 2.9, h: 3.1, role: "ink", opacity: 0.1, label: "scrim" },
  { z: -0.1, w: 2.7, h: 2.2, role: "paper", opacity: 0.95, label: "surface" },
  { z: 0.6, w: 0.8, h: 0.12, role: "vermillion", opacity: 1, label: "handle" },
];

const ROW_COUNT = 3;

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
    paper: hex("--paper-deep", 0xece2d0),
    vermillion: hex("--vermillion", 0xc12d1c),
  };
};

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

export const initHero3D = async (
  host: HTMLElement | null,
): Promise<Hero3DHandle | null> => {
  if (!host || prefersReducedMotion() || !hasWebGL()) return null;

  const THREE = await import("three");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9.5);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const group = new THREE.Group();
  group.rotation.set(-0.42, 0.62, 0.12);
  scene.add(group);

  const disposables: { dispose: () => void }[] = [];
  const planes: { mesh: import("three").Object3D; restZ: number }[] = [];
  const fills: { mat: import("three").MeshBasicMaterial; role: Role }[] = [];
  const strokes: import("three").LineBasicMaterial[] = [];
  let palette = readPalette();

  const addPlane = (l: Layer): void => {
    const geo = new THREE.PlaneGeometry(l.w, l.h, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: palette[l.role],
      transparent: true,
      opacity: l.opacity,
      side: THREE.DoubleSide,
      depthWrite: l.opacity > 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = l.z;
    group.add(mesh);
    disposables.push(geo, mat);
    fills.push({ mat, role: l.role });
    planes.push({ mesh, restZ: l.z });

    const edges = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: palette.vermillion,
      transparent: true,
      opacity: l.label === "surface" ? 0.8 : 0.28,
    });
    const line = new THREE.LineSegments(edges, edgeMat);
    line.position.z = l.z + 0.001;
    group.add(line);
    disposables.push(edges, edgeMat);
    strokes.push(edgeMat);
    planes.push({ mesh: line, restZ: l.z });
  };

  for (const l of LAYERS) addPlane(l);

  // content rows riding just above the surface
  for (let i = 0; i < ROW_COUNT; i++) {
    const geo = new THREE.PlaneGeometry(1.9, 0.24, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: palette.ink,
      transparent: true,
      opacity: 0.14,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.28 - i * 0.45, 0.3 + i * 0.1);
    group.add(mesh);
    disposables.push(geo, mat);
    fills.push({ mat, role: "ink" });
    planes.push({ mesh, restZ: mesh.position.z });
  }

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

  // pointer parallax, normalised to the host box
  let targetX = 0;
  let targetY = 0;
  const onPointer = (e: PointerEvent): void => {
    const r = host.getBoundingClientRect();
    targetX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    targetY = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  // scroll assembles the stack: 0 = exploded, 1 = collapsed into one sheet
  let assemble = 0;
  const onScroll = (): void => {
    const r = host.getBoundingClientRect();
    const travel = Math.max(1, r.height * 0.9);
    assemble = Math.min(Math.max(-r.top / travel, 0), 1);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
  const tick = (): void => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    t += 0.0075;

    curX += (targetX - curX) * 0.045;
    curY += (targetY - curY) * 0.045;

    group.rotation.y = 0.62 + curX * 0.34 + Math.sin(t) * 0.05;
    group.rotation.x = -0.42 + curY * 0.2 + Math.cos(t * 0.8) * 0.03;

    for (const p of planes) {
      const spread = 1 - assemble;
      p.mesh.position.z = p.restZ * (0.25 + spread * 0.75);
    }
    group.position.y = Math.sin(t * 1.2) * 0.06;

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
