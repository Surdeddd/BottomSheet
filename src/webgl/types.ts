export type WebGLRendererOptions = {
  jelly?: number;
  shadow?: number;
  sheen?: number;
  glass?: number;
  liftContent?: boolean;
  dpr?: number;
  allowSoftware?: boolean;
  onUnsupported?: (reason: WebGLUnsupportedReason) => void;
};

export type WebGLUnsupportedReason =
  | "no-document"
  | "no-webgl"
  | "software-renderer"
  | "reduced-motion"
  | "context-lost";

export type SurfaceFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: [number, number, number, number];
  color: [number, number, number, number];
  shadow: number;
};
