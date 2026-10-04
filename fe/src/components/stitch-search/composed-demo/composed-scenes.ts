// Illustrative composed-demo fixtures for the landing hero.
// Local data only: never fetched, never presented as live search. Shapes
// follow the roadmap requirement (anchor + modification text + Top-K);
// field names stay provisional until the composed contract ticket lands.

export type GarmentShape = "dress" | "maxi" | "shirt" | "shorts" | "tee";

export interface DemoGarment {
  id: string;
  name: string;
  category: string;
  shape: GarmentShape;
  cloth: string;
  clothDark: string;
}

export interface ComposedPreset {
  /** Staged modification text, exactly as shown in the demo bar. */
  text: string;
  /** Fixture similarity scores, descending = displayed rank order. */
  scores: [number, number, number];
}

export interface DemoScene {
  query: string;
  items: [DemoGarment, DemoGarment, DemoGarment];
}

export interface ComposedScene {
  /** Reference anchor garment (the "attached photo" of the demo). */
  anchor: DemoGarment;
  presets: [ComposedPreset, ComposedPreset, ComposedPreset];
  results: [DemoGarment, DemoGarment, DemoGarment];
  k: number;
}

const SCENES: [DemoScene, DemoScene] = [
  {
    query: "quần áo đi biển",
    items: [
      {
        id: "beach-shirt",
        name: "Áo sơ mi linen nam",
        category: "Áo",
        shape: "shirt",
        cloth: "#bcd7ea",
        clothDark: "#8fb4d4",
      },
      {
        id: "beach-shorts",
        name: "Quần short kaki",
        category: "Quần / váy rời",
        shape: "shorts",
        cloth: "#e7d7b8",
        clothDark: "#cbb98f",
      },
      {
        id: "beach-tee",
        name: "Áo thun oversize",
        category: "Áo",
        shape: "tee",
        cloth: "#f1f2f4",
        clothDark: "#d3d7dd",
      },
    ],
  },
  {
    query: "váy linen",
    items: [
      {
        id: "linen-shift",
        name: "Váy linen suông",
        category: "Trang phục liền",
        shape: "dress",
        cloth: "#f4efe4",
        clothDark: "#d9cfb6",
      },
      {
        id: "linen-maxi",
        name: "Váy maxi xếp ly",
        category: "Trang phục liền",
        shape: "maxi",
        cloth: "#e0a27e",
        clothDark: "#c17f57",
      },
      {
        id: "linen-pinafore",
        name: "Đầm linen cổ vuông",
        category: "Trang phục liền",
        shape: "dress",
        cloth: "#c9cba3",
        clothDark: "#a3a678",
      },
    ],
  },
];

export const COMPOSED_SCENES: [ComposedScene, ComposedScene] = [
  {
    anchor: SCENES[0].items[0],
    results: SCENES[0].items,
    k: 3,
    presets: [
      { text: "đổi sang màu navy", scores: [0.918, 0.884, 0.869] },
      { text: "tay dài hơn", scores: [0.893, 0.871, 0.854] },
      { text: "vải linen mỏng nhẹ", scores: [0.905, 0.888, 0.862] },
    ],
  },
  {
    anchor: SCENES[1].items[0],
    results: SCENES[1].items,
    k: 3,
    presets: [
      { text: "dáng midi, eo cao", scores: [0.935, 0.902, 0.896] },
      { text: "màu terracotta", scores: [0.921, 0.897, 0.88] },
      { text: "cổ vuông, tay ngắn", scores: [0.909, 0.885, 0.873] },
    ],
  },
];

export const COMPOSED_QUERIES = [SCENES[0].query, SCENES[1].query] as const;
