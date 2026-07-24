import { useEffect, useRef } from "react";
import type { BottomSheetEngine } from "../core/BottomSheetEngine";
import type { EngineOptions } from "../core/types";

type PropSyncOpts = {
  snapPoints: ReadonlyArray<{ id: string; size: number | string }>;
  allowed?: ReadonlyArray<string>;
  backdropColor?: string;
  backdropOpacity?: number;
  radius?: string | number;
  maxHeight?: string | number;
  persistent?: boolean;
  disableClose?: boolean;
  disableDrag?: boolean;
  dragFrom?: EngineOptions["dragFrom"];
  dragFromContent?: boolean;
};

export function useEnginePropSync(
  engineRef: React.RefObject<BottomSheetEngine | null>,
  opts: PropSyncOpts,
): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const allowedKey = (opts.allowed ?? opts.snapPoints.map(p => p.id)).join(
    "\x00",
  );
  const defKey = opts.snapPoints
    .map(p => `${p.id}\x01${String(p.size)}`)
    .join("\x00");
  const defApplied = useRef(false);
  useEffect(() => {
    if (!defApplied.current) {
      defApplied.current = true;
      return;
    }
    const engine = engineRef.current;
    if (!engine) return;
    const current = optsRef.current;
    engine.setSnapPoints(
      current.snapPoints as unknown as EngineOptions["snapPoints"],
      current.allowed
        ? Array.from(current.allowed as ReadonlyArray<string>)
        : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defKey]);
  useEffect(() => {
    if (!engineRef.current) return;
    const ids: string[] = opts.allowed
      ? Array.from(opts.allowed as ReadonlyArray<string>)
      : opts.snapPoints.map(p => p.id);
    engineRef.current.setAllowed(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (opts.backdropColor !== undefined) {
      engineRef.current.setScrimColor(opts.backdropColor);
    }
  }, [opts.backdropColor]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (opts.backdropOpacity !== undefined) {
      engineRef.current.setBackdropRange([0, opts.backdropOpacity]);
    }
  }, [opts.backdropOpacity]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (opts.radius !== undefined) {
      engineRef.current.setRadius(opts.radius);
    }
  }, [opts.radius]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (opts.maxHeight !== undefined) {
      engineRef.current.setMaxHeight(opts.maxHeight);
    }
  }, [opts.maxHeight]);

  useEffect(() => {
    if (opts.persistent !== undefined) {
      engineRef.current?.setPersistent(opts.persistent);
    }
  }, [opts.persistent]);

  useEffect(() => {
    if (opts.disableClose !== undefined) {
      engineRef.current?.setDisableClose(opts.disableClose);
    }
  }, [opts.disableClose]);

  useEffect(() => {
    if (opts.disableDrag !== undefined) {
      engineRef.current?.setDisableDrag(opts.disableDrag);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.disableDrag]);

  useEffect(() => {
    if (opts.dragFrom !== undefined) {
      engineRef.current?.setDragFrom(opts.dragFrom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.dragFrom]);

  useEffect(() => {
    if (opts.dragFromContent !== undefined) {
      engineRef.current?.setDragFromContent(opts.dragFromContent);
    }
  }, [opts.disableDrag]);
}
