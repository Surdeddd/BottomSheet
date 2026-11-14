import { useRef } from "react";

export type ElementRef = {
  (node: HTMLElement | null): void;
  readonly current: HTMLElement | null;
};

type Holder = {
  (node: HTMLElement | null): void;
  current: HTMLElement | null;
};

export const useElementRef = (): ElementRef => {
  const holder = useRef<Holder | null>(null);
  if (!holder.current) {
    const assign = ((node: HTMLElement | null): void => {
      assign.current = node;
    }) as Holder;
    assign.current = null;
    holder.current = assign;
  }
  return holder.current;
};
