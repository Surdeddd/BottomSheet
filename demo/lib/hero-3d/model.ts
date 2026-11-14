import type {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Shape,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
} from "three";
import { LAYER_COUNT, SNAP_FULL, SNAP_HALF, SNAP_PEEK } from "./timeline";

type Three = typeof import("three");

export type Role = "ink" | "paper" | "surface" | "vermillion";
export type Palette = Record<Role, number> & { dark: boolean };

export const PHONE_W = 2.5;
export const PHONE_H = 5.1;
const PHONE_D = 0.24;
const BEVEL = 0.035;
const BEZEL = 0.1;
const SCREEN_W = PHONE_W - BEZEL * 2;
const SCREEN_H = PHONE_H - BEZEL * 2;
const SCREEN_R = 0.27;
const FRONT = PHONE_D / 2 + BEVEL;
const SCREEN_BOTTOM = -SCREEN_H / 2;
const SCREEN_TOP = SCREEN_H / 2;
const LIFT_STEP = 0.78;
const HANDLE_ZONE = 0.34;
const HEADER_ZONE = 0.52;
const ROW_H = 0.42;
const ROW_GAP = 0.08;
const ROW_COUNT = 7;
const SIDE_PAD = 0.16;
const SHEET_R = 0.26;
const SLAB_DEPTH = 0.03;
const CLIP_INSET = 0.04;
const SCREEN_TOP_COLOR = 0x222c36;
const SCREEN_BOTTOM_COLOR = 0x0d1317;

export type PhoneModel = {
  rig: Group;
  width: number;
  height: number;
  setSheet: (fraction: number) => void;
  setLift: (index: number, amount: number) => void;
  setFocus: (index: number, strength: number) => void;
  setRuler: (opacity: number) => void;
  updateClip: () => void;
  repaint: (palette: Palette) => void;
  dispose: () => void;
};

export const buildPhone = (THREE: Three, initial: Palette): PhoneModel => {
  let palette = initial;
  const disposables: { dispose: () => void }[] = [];
  type Tintable = Material & { color: { setHex: (hex: number) => void } };
  const tinted: { mat: Tintable; role: Role }[] = [];

  const localClip = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    -(SCREEN_BOTTOM + CLIP_INSET),
  );
  const worldClip: Plane = localClip.clone();

  const roundedRect = (
    w: number,
    h: number,
    r: number,
    topOnly = false,
  ): Shape => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    const rb = topOnly ? 0 : r;
    s.moveTo(x + r, y + h);
    s.lineTo(x + w - r, y + h);
    s.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    s.lineTo(x + w, y + rb);
    s.quadraticCurveTo(x + w, y, x + w - rb, y);
    s.lineTo(x + rb, y);
    s.quadraticCurveTo(x, y, x, y + rb);
    s.lineTo(x, y + h - r);
    s.quadraticCurveTo(x, y + h, x + r, y + h);
    return s;
  };

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const flat = (
    role: Role | number,
    opacity = 1,
    clipped = false,
  ): MeshBasicMaterial => {
    const mat = track(
      new THREE.MeshBasicMaterial({
        color: typeof role === "number" ? role : palette[role],
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
        side: THREE.DoubleSide,
        clippingPlanes: clipped ? [worldClip] : null,
      }),
    );
    if (typeof role !== "number") tinted.push({ mat, role });
    return mat;
  };

  const stroke = (
    role: Role,
    opacity: number,
    clipped = false,
  ): LineBasicMaterial => {
    const mat = track(
      new THREE.LineBasicMaterial({
        color: palette[role],
        transparent: true,
        opacity,
        depthWrite: false,
        clippingPlanes: clipped ? [worldClip] : null,
      }),
    );
    tinted.push({ mat, role });
    return mat;
  };

  const plate = (
    shape: Shape,
    mat: Material,
    parent: Object3D,
    x = 0,
    y = 0,
    z = 0,
  ): Mesh => {
    const mesh = new THREE.Mesh(track(new THREE.ShapeGeometry(shape, 10)), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const loop = (
    shape: Shape,
    mat: LineBasicMaterial,
    parent: Object3D,
    x = 0,
    y = 0,
    z = 0,
  ): void => {
    const geo = track(
      new THREE.BufferGeometry().setFromPoints(shape.getPoints(12)),
    );
    const line = new THREE.LineLoop(geo, mat);
    line.position.set(x, y, z);
    parent.add(line);
  };

  const bar = (
    w: number,
    h: number,
    mat: Material,
    parent: Object3D,
    left: number,
    y: number,
    z = 0,
  ): Mesh => plate(roundedRect(w, h, h / 2), mat, parent, left + w / 2, y, z);

  const rig: Group = new THREE.Group();

  const shadowTexture = ((): Texture => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.12,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.42)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return track(new THREE.CanvasTexture(canvas));
  })();
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      color: 0x000000,
      transparent: true,
      opacity: palette.dark ? 0.55 : 0.26,
      depthWrite: false,
    }),
  );
  const shadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(PHONE_W * 1.9, PHONE_H * 1.42)),
    shadowMat,
  );
  shadow.position.set(0.22, -0.34, -PHONE_D / 2 - 0.5);
  shadow.renderOrder = -2;
  rig.add(shadow);

  const bodyMat: MeshStandardMaterial = track(
    new THREE.MeshStandardMaterial({
      color: palette.ink,
      roughness: 0.58,
      metalness: 0.18,
    }),
  );
  tinted.push({ mat: bodyMat, role: "ink" });
  const bodyGeo = track(
    new THREE.ExtrudeGeometry(
      roundedRect(PHONE_W - BEVEL * 2, PHONE_H - BEVEL * 2, 0.36 - BEVEL),
      {
        depth: PHONE_D,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: BEVEL,
        bevelSegments: 5,
        curveSegments: 20,
      },
    ),
  );
  bodyGeo.translate(0, 0, -PHONE_D / 2);
  rig.add(new THREE.Mesh(bodyGeo, bodyMat));

  const button = (x: number, y: number, h: number): void => {
    const geo = track(new THREE.BoxGeometry(0.05, h, 0.1));
    const mesh = new THREE.Mesh(geo, bodyMat);
    mesh.position.set(x, y, 0);
    rig.add(mesh);
  };
  button(PHONE_W / 2 + 0.012, 0.9, 0.52);
  button(-PHONE_W / 2 - 0.012, 1.15, 0.3);
  button(-PHONE_W / 2 - 0.012, 0.72, 0.3);

  const screenGeo: BufferGeometry = track(
    new THREE.ShapeGeometry(roundedRect(SCREEN_W, SCREEN_H, SCREEN_R), 14),
  );
  {
    const top = new THREE.Color(SCREEN_TOP_COLOR);
    const bottom = new THREE.Color(SCREEN_BOTTOM_COLOR);
    const pos = screenGeo.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const mixed = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - SCREEN_BOTTOM) / SCREEN_H;
      mixed.copy(bottom).lerp(top, t);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }
    screenGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  const screenMat = track(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = FRONT + 0.001;
  rig.add(screen);

  bar(
    0.44,
    0.03,
    flat("paper", 0.34),
    rig,
    -0.22,
    PHONE_H / 2 - BEZEL / 2,
    FRONT + 0.002,
  );

  const app: Group = new THREE.Group();
  app.position.z = FRONT + 0.004;
  rig.add(app);
  const left = -SCREEN_W / 2 + 0.2;
  const light = (opacity: number): MeshBasicMaterial => flat(0xf4ede0, opacity);
  bar(0.26, 0.04, light(0.7), app, left, SCREEN_TOP - 0.2);
  bar(0.34, 0.04, light(0.5), app, SCREEN_W / 2 - 0.2 - 0.34, SCREEN_TOP - 0.2);
  bar(0.62, 0.035, flat(0xff8f7d, 0.95), app, left, SCREEN_TOP - 0.5);
  bar(1.18, 0.14, light(0.94), app, left, SCREEN_TOP - 0.7);
  bar(1.55, 0.05, light(0.42), app, left, SCREEN_TOP - 0.92);
  bar(1.1, 0.05, light(0.42), app, left, SCREEN_TOP - 1.04);
  const cardY = SCREEN_BOTTOM + SCREEN_H * SNAP_PEEK + 0.5;
  plate(roundedRect(SCREEN_W - 0.4, 0.56, 0.12), light(0.09), app, 0, cardY);
  plate(
    roundedRect(0.3, 0.3, 0.08),
    flat("vermillion"),
    app,
    left + 0.28,
    cardY,
    0.002,
  );
  bar(0.9, 0.06, light(0.85), app, left + 0.56, cardY + 0.07, 0.002);
  bar(1.15, 0.045, light(0.4), app, left + 0.56, cardY - 0.07, 0.002);

  type Layer = {
    anchor: Group;
    pane: Group;
    guides: Object3D;
    focus: LineBasicMaterial;
    guideMat: LineBasicMaterial;
    tag: Sprite;
    tagMat: SpriteMaterial;
    lift: number;
  };

  const tagTexture = (text: string): Texture => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = '500 36px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(text, 64, 34);
    return track(new THREE.CanvasTexture(canvas));
  };
  const layers: Layer[] = [];

  const makeLayer = (
    index: number,
    corners: [number, number][],
    outline: Shape | null,
    clipped: boolean,
    outlineX = 0,
    outlineY = 0,
    tagY = 0,
  ): Layer => {
    const anchor: Group = new THREE.Group();
    anchor.position.z = FRONT + 0.008 + index * 0.004;
    const pane: Group = new THREE.Group();
    anchor.add(pane);
    const focus = stroke("vermillion", 0, clipped);
    if (outline) loop(outline, focus, pane, outlineX, outlineY, 0.004);
    const guideMat = stroke("vermillion", 0, clipped);
    const pts = corners.flatMap(([x, y]) => [
      new THREE.Vector3(x, y, 0),
      new THREE.Vector3(x, y, 1),
    ]);
    const guides = new THREE.LineSegments(
      track(new THREE.BufferGeometry().setFromPoints(pts)),
      guideMat,
    );
    guides.visible = false;
    anchor.add(guides);
    const tagMat = track(
      new THREE.SpriteMaterial({
        map: tagTexture(`0${index + 1}`),
        color: palette.vermillion,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    tinted.push({ mat: tagMat, role: "vermillion" });
    const tag = new THREE.Sprite(tagMat);
    tag.scale.set(0.5, 0.25, 1);
    tag.position.set(SCREEN_W / 2 - 0.26, tagY + 0.17, 0);
    tag.renderOrder = 40;
    tag.visible = false;
    anchor.add(tag);
    rig.add(anchor);
    pane.renderOrder = 10 + index;
    const layer = { anchor, pane, guides, focus, guideMat, tag, tagMat, lift: 0 };
    layers.push(layer);
    return layer;
  };

  const rect = (w: number, h: number, cx = 0, cy = 0): [number, number][] => [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];

  const screenShape = roundedRect(SCREEN_W, SCREEN_H, SCREEN_R);
  const backdrop = makeLayer(
    0,
    rect(SCREEN_W, SCREEN_H),
    screenShape,
    false,
    0,
    0,
    SCREEN_TOP,
  );
  const backdropMat = flat(0x05070a, 0);
  plate(screenShape, backdropMat, backdrop.pane);
  loop(screenShape, stroke("ink", 0.22), backdrop.pane, 0, 0, 0.002);

  const unit = roundedRect(SCREEN_W, 1, 0.001);
  const scrim = makeLayer(
    1,
    rect(SCREEN_W, 1, 0, 0.5),
    unit,
    false,
    0,
    0.5,
    1,
  );
  const scrimMat = flat(0xd9e2ea, 0.2);
  plate(unit, scrimMat, scrim.pane, 0, 0.5);
  loop(unit, stroke("ink", 0.2), scrim.pane, 0, 0.5, 0.002);

  const surface = makeLayer(
    2,
    [
      [-SCREEN_W / 2, 0],
      [SCREEN_W / 2, 0],
    ],
    null,
    false,
  );
  const slabMat: MeshStandardMaterial = track(
    new THREE.MeshStandardMaterial({
      color: palette.surface,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  tinted.push({ mat: slabMat, role: "surface" });

  const halfW = SCREEN_W / 2;
  const bottomCap = new THREE.Shape();
  bottomCap.moveTo(-halfW, SCREEN_R);
  bottomCap.lineTo(halfW, SCREEN_R);
  bottomCap.quadraticCurveTo(halfW, 0, halfW - SCREEN_R, 0);
  bottomCap.lineTo(-halfW + SCREEN_R, 0);
  bottomCap.quadraticCurveTo(-halfW, 0, -halfW, SCREEN_R);
  const slab = (shape: Shape, lift: number): Mesh => {
    const geo = track(
      new THREE.ExtrudeGeometry(shape, {
        depth: SLAB_DEPTH,
        bevelEnabled: false,
        curveSegments: 12,
      }),
    );
    geo.translate(0, lift, -SLAB_DEPTH);
    const mesh = new THREE.Mesh(geo, slabMat);
    surface.pane.add(mesh);
    return mesh;
  };
  slab(roundedRect(SCREEN_W, SHEET_R, SHEET_R, true), -SHEET_R / 2);
  const slabBody = slab(roundedRect(SCREEN_W, 1, 0.0001), -0.5);
  slabBody.position.y = -SHEET_R + 0.002;
  const slabFoot = slab(bottomCap, 0);

  const arc = (
    from: [number, number],
    via: [number, number],
    to: [number, number],
  ): Vector2[] =>
    new THREE.QuadraticBezierCurve(
      new THREE.Vector2(...from),
      new THREE.Vector2(...via),
      new THREE.Vector2(...to),
    ).getPoints(8);
  const topEdge = [
    ...arc([-halfW, -SHEET_R], [-halfW, 0], [-halfW + SHEET_R, 0]),
    ...arc([halfW - SHEET_R, 0], [halfW, 0], [halfW, -SHEET_R]),
  ];
  const footEdge = [
    ...arc([-halfW, SCREEN_R], [-halfW, 0], [-halfW + SCREEN_R, 0]),
    ...arc([halfW - SCREEN_R, 0], [halfW, 0], [halfW, SCREEN_R]),
  ];
  const sideEdge = [new THREE.Vector2(0, 0), new THREE.Vector2(0, -1)];
  const polyline = (points: Vector2[]): BufferGeometry =>
    track(new THREE.BufferGeometry().setFromPoints(points));
  const topGeo = polyline(topEdge);
  const footGeo = polyline(footEdge);
  const sideGeo = polyline(sideEdge);
  const silhouette = (mat: LineBasicMaterial, z: number): Object3D[] => {
    const top = new THREE.Line(topGeo, mat);
    const foot = new THREE.Line(footGeo, mat);
    const left = new THREE.Line(sideGeo, mat);
    const right = new THREE.Line(sideGeo, mat);
    left.position.set(-halfW, -SHEET_R, z);
    right.position.set(halfW, -SHEET_R, z);
    top.position.z = z;
    foot.position.z = z;
    surface.pane.add(top, foot, left, right);
    return [foot, left, right];
  };
  const edges = [
    silhouette(stroke("ink", 0.26), 0.002),
    silhouette(surface.focus, 0.004),
  ];
  const fitSurface = (height: number): void => {
    const body = Math.max(height - SHEET_R - SCREEN_R, 0.0001);
    slabBody.scale.y = body + 0.004;
    slabFoot.position.y = -height;
    for (const [foot, left, right] of edges) {
      foot!.position.y = -height;
      left!.scale.y = body;
      right!.scale.y = body;
    }
  };

  const zoneShape = roundedRect(SCREEN_W - 0.12, HANDLE_ZONE, 0.14);
  const handle = makeLayer(
    3,
    rect(SCREEN_W - 0.12, HANDLE_ZONE, 0, -HANDLE_ZONE / 2 - 0.03),
    zoneShape,
    true,
    0,
    -HANDLE_ZONE / 2 - 0.03,
  );
  plate(
    roundedRect(0.5, 0.07, 0.035),
    flat("vermillion", 1, true),
    handle.pane,
    0,
    -0.16,
    0.002,
  );
  loop(
    zoneShape,
    stroke("ink", 0.16, true),
    handle.pane,
    0,
    -HANDLE_ZONE / 2 - 0.03,
    0.001,
  );
  const headerTop = -HANDLE_ZONE - 0.1;
  const headerLeft = left - 0.04;
  const headerInk = flat("ink", 0.9, true);
  const headerMuted = flat("ink", 0.4, true);
  bar(1.02, 0.11, headerInk, handle.pane, headerLeft, headerTop - 0.08, 0.002);
  bar(1.3, 0.04, headerMuted, handle.pane, headerLeft, headerTop - 0.27, 0.002);

  const rowsTop = -HANDLE_ZONE - HEADER_ZONE;
  const rowsHeight = ROW_COUNT * (ROW_H + ROW_GAP) - ROW_GAP;
  const rowW = SCREEN_W - SIDE_PAD * 2;
  const content = makeLayer(
    4,
    rect(rowW, rowsHeight, 0, rowsTop - rowsHeight / 2),
    roundedRect(rowW, rowsHeight, 0.09),
    true,
    0,
    rowsTop - rowsHeight / 2,
    rowsTop,
  );
  const rowStroke = stroke("ink", 0.2, true);
  const dotMat = flat("vermillion", 1, true);
  const titleMat = flat("ink", 0.82, true);
  const subMat = flat("ink", 0.36, true);
  const rowShape = roundedRect(rowW, ROW_H, 0.09);
  const dotShape = roundedRect(0.24, 0.24, 0.07);
  for (let i = 0; i < ROW_COUNT; i++) {
    const y = rowsTop - ROW_H / 2 - i * (ROW_H + ROW_GAP);
    loop(rowShape, rowStroke, content.pane, 0, y, 0.001);
    plate(dotShape, dotMat, content.pane, -rowW / 2 + 0.24, y, 0.002);
    const textLeft = -rowW / 2 + 0.46;
    const titleW = 0.72 + ((i * 37) % 5) * 0.09;
    const subW = 1.0 + ((i * 53) % 4) * 0.1;
    bar(titleW, 0.06, titleMat, content.pane, textLeft, y + 0.065, 0.002);
    bar(subW, 0.042, subMat, content.pane, textLeft, y - 0.075, 0.002);
  }

  const ruler: Group = new THREE.Group();
  ruler.position.set(PHONE_W / 2 + 0.26, 0, 0);
  rig.add(ruler);
  const rulerLine = stroke("ink", 0.3);
  const rulerTick = stroke("ink", 0.55);
  const rulerMark = flat("vermillion", 0.99);
  const segment = (
    a: [number, number],
    b: [number, number],
    mat: LineBasicMaterial,
    parent: Object3D,
  ): void => {
    const geo = track(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a[0], a[1], 0),
        new THREE.Vector3(b[0], b[1], 0),
      ]),
    );
    parent.add(new THREE.Line(geo, mat));
  };
  segment([0, SCREEN_BOTTOM], [0, SCREEN_TOP], rulerLine, ruler);
  for (const snap of [SNAP_PEEK, SNAP_HALF, SNAP_FULL]) {
    const y = SCREEN_BOTTOM + SCREEN_H * snap;
    segment([-0.07, y], [0.07, y], rulerTick, ruler);
  }
  const marker = plate(
    roundedRect(0.2, 0.05, 0.025),
    rulerMark,
    ruler,
    0,
    0,
    0.001,
  );
  const rulerBase = [
    { mat: rulerLine, base: 0.3 },
    { mat: rulerTick, base: 0.55 },
    { mat: rulerMark, base: 0.99 },
  ];

  const setSheet = (fraction: number): void => {
    const top = SCREEN_BOTTOM + SCREEN_H * fraction;
    surface.anchor.position.y = top;
    handle.anchor.position.y = top;
    content.anchor.position.y = top;
    const scrimFoot = top - SHEET_R;
    scrim.anchor.position.y = scrimFoot;
    const gap = Math.max(SCREEN_TOP - scrimFoot, 0.0001);
    scrim.pane.scale.y = gap;
    scrim.guides.scale.y = gap;
    scrim.tag.position.y = gap + 0.17;
    marker.position.y = top;
    fitSurface(top - SCREEN_BOTTOM);
    const dim = Math.min(Math.max((fraction - 0.24) / 0.5, 0), 1);
    backdropMat.opacity = 0.56 * dim;
  };

  const setLift = (index: number, amount: number): void => {
    const layer = layers[index];
    if (!layer || layer.lift === amount) return;
    layer.lift = amount;
    const z = amount * LIFT_STEP * (index + 1);
    layer.pane.position.z = z;
    layer.guides.visible = z > 0.01;
    layer.guides.scale.z = Math.max(z, 0.0001);
    layer.guideMat.opacity = 0.42 * Math.min(amount * 3, 1);
    layer.tag.visible = amount > 0.02;
    layer.tag.position.z = z;
    layer.tagMat.opacity = Math.min(amount * 2, 1);
  };

  const setFocus = (index: number, strength: number): void => {
    const layer = layers[index];
    if (layer) layer.focus.opacity = strength;
  };

  const setRuler = (opacity: number): void => {
    ruler.visible = opacity > 0.01;
    for (const item of rulerBase) item.mat.opacity = item.base * opacity;
  };

  const updateClip = (): void => {
    worldClip.copy(localClip).applyMatrix4(rig.matrixWorld);
  };

  const repaint = (next: Palette): void => {
    palette = next;
    for (const item of tinted) item.mat.color.setHex(palette[item.role]);
    shadowMat.opacity = palette.dark ? 0.55 : 0.26;
  };

  setSheet(SNAP_PEEK);
  for (let i = 0; i < LAYER_COUNT; i++) setLift(i, 0);

  return {
    rig,
    width: PHONE_W + 0.7,
    height: PHONE_H,
    setSheet,
    setLift,
    setFocus,
    setRuler,
    updateClip,
    repaint,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
};
