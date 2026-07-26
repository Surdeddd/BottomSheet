export type WebGLRendererOptions = {
  jelly?: number;
  shadow?: number;
  sheen?: number;
  glass?: number;
  liftContent?: boolean;
  dpr?: number;
  onUnsupported?: (reason: WebGLUnsupportedReason) => void;
};

export type WebGLUnsupportedReason =
  | "no-document"
  | "no-webgl"
  | "reduced-motion"
  | "context-lost";

export type SurfaceFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: [number, number, number, number];
  shadow: number;
};
