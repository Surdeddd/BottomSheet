export const ROWS = Array.from({ length: 100 }, (_, i) => i + 1);

export const POINTS = [
  { id: "closed", size: 0 },
  { id: "half", size: "50%" },
  { id: "full", size: "85%" },
];

export type AdapterHandle = {
  open: (id: string) => Promise<void>;
  close: () => Promise<void>;
};

export const hostFor = (name: string): HTMLElement => {
  const host = document.createElement("div");
  host.dataset.adapter = name;
  document.body.append(host);
  return host;
};
