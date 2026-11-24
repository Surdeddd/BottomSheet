export const ROWS = Array.from({ length: 100 }, (_, i) => i + 1);

export const POINTS = [
  { id: "closed", size: 0, label: "Closed" },
  { id: "half", size: "50%", label: "Half open" },
  { id: "full", size: "85%" },
];

export const TRAP = new URLSearchParams(location.search).has("trap");

export type AdapterHandle = {
  open: (id: string) => Promise<unknown>;
  close: () => Promise<unknown>;
};

export const hostFor = (name: string): HTMLElement => {
  const host = document.createElement("div");
  host.dataset.adapter = name;
  document.body.append(host);
  return host;
};
