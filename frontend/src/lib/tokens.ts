/**
 * Pixel art token definitions.
 * Each token is a 16×16 grid where each cell is a colour key or '.' (transparent).
 *
 * Palette:
 *  R=#FF4757  O=#FF7F50  Y=#FFD93D  G=#6BCB77
 *  B=#4ECDC4  U=#5C7AEA  V=#A855F7  W=#FFFFFF
 *  K=#111111  S=#C8D6E5  N=#FFB8A0  L=#D4FF00
 *  M=#FF6B9D  D=#8B6914  T=#FF9F43
 */

export const PALETTE: Record<string, string> = {
  R: "#FF4757", O: "#FF7F50", Y: "#FFD93D", G: "#6BCB77",
  B: "#4ECDC4", U: "#5C7AEA", V: "#A855F7", W: "#FFFFFF",
  K: "#111111", S: "#C8D6E5", N: "#FFB8A0", L: "#D4FF00",
  M: "#FF6B9D", D: "#8B6914", T: "#FF9F43",
  ".": "transparent",
};

export type StandardTokenKey = "wizard" | "rocket" | "fox" | "knight" | "shark" | "bull" | "ghost" | "dragon";
export type CustomTokenKey = "p_ati" | "p_finn" | "p_ritz" | "p_esele" | "p_nugith" | "p_alex" | "p_usmaan";
export type TokenKey = StandardTokenKey | CustomTokenKey;

export const CUSTOM_TOKEN_KEYS: CustomTokenKey[] = [
  "p_ati", "p_finn", "p_ritz", "p_esele", "p_nugith", "p_alex", "p_usmaan",
];

export const CUSTOM_TOKEN_LABELS: Record<CustomTokenKey, string> = {
  p_ati:    "ati",
  p_finn:   "finn",
  p_ritz:   "ritz",
  p_esele:  "esele",
  p_nugith: "nugith",
  p_alex:   "alex",
  p_usmaan: "usmaan",
};

export function isCustomToken(key: TokenKey): key is CustomTokenKey {
  return key.startsWith("p_");
}

// Each string is a row of 16 chars
const TOKENS: Record<StandardTokenKey, string[]> = {
  wizard: [
    "....VVVVVV......",
    "...VVVVVVVV.....",
    "..VV.VVVVV.VV...",
    ".VVVVVVVVVVVV...",
    ".VVVVVVVVVVVV...",
    "..VVVVVVVVVV....",
    "...WWWWWWWW.....",
    "...WLLWWLLW.....",
    "...WWWWWWWW.....",
    "...WWWWWWWW.....",
    "....WWWWWW......",
    "...UUUUUUUU.....",
    "..UUUUUUUUUU....",
    "..UUUUUUUUUU....",
    ".UUUUUUUUUUUU...",
    "................",
  ],
  rocket: [
    ".....WWWW.......",
    "....WRRRRW......",
    "...WRRRRRRRW....",
    "...WRRRRRRR W...",
    "..WRRRRRRRRW....",
    "..WRRRRRRRRW....",
    "..WRRRRRRRRW....",
    "..WRRRRRRRRW....",
    "...WBBBBBBBW....",
    "...WBBBBBBBW....",
    "....WWWWWWW.....",
    "...ORWWWWWRO....",
    "..ORRWWWWWRRO...",
    ".OORRWWWWWRROO..",
    "................",
    "................",
  ],
  fox: [
    "R..............R",
    "RR............RR",
    "RRR..WWWWW..RRR.",
    "RRRR.WNNNW.RRRR.",
    "RRRR.NWWNW.RRRR.",
    ".RRR.NNNNN.RRR..",
    ".RRR.NKKNK.RRR..",
    "..RRRRNNNRRR....",
    "..RRRRNNNRRR....",
    "...RRRRRRRRR....",
    "....RRRRRRRR....",
    "....RRRTTTTT....",
    "....RRTTTTT.....",
    ".....RTTTTT.....",
    "......TTTT......",
    "................",
  ],
  knight: [
    "....SSSSSS......",
    "...SSSSSSSS.....",
    "..SSSSSSSSSS....",
    "..SWSSSSSWSS....",
    "..SSWWWWWSS.....",
    "...SWWWWWWS.....",
    "...SSSSSSSS.....",
    "....UUUUUU......",
    "...UUUUUUUU.....",
    "..UUUUUUUUUU....",
    "..UUUUUUUUUU....",
    "..UUUUUUUUUU....",
    "...UUUUUUUU.....",
    "....UUUUUU......",
    "................",
    "................",
  ],
  shark: [
    "................",
    ".......BB.......",
    ".....BBBBBBB....",
    "....BBBBBBBBB...",
    "..BBBBBWKWBBBB..",
    ".BBBBBBBBBBBBB..",
    "BBBBBBBBBBBBBB..",
    "BBBBBBBBBBBBBBB.",
    "BBBBBBBBBBBBBBB.",
    ".BBBBBBBBBBBBB..",
    "..BBBBBBBBBBB...",
    "...BBBBBBBBBB...",
    "....BBBBB.BBB...",
    ".....BBB...BBB..",
    "................",
    "................",
  ],
  bull: [
    "RR..........RR..",
    ".RR........RR...",
    ".RRR......RRR...",
    "..RRRRRRRRRR....",
    "..RRRRRRRRRR....",
    "..RRNNNNNRRR....",
    "..RNNNNNNNRR....",
    "..RNNNKNNNRR....",
    "..RNNNNNNNRR....",
    "..RRRRRRRRRR....",
    "...RRRRRRRRR....",
    "....RRRRRRRR....",
    "....RR....RR....",
    "....RR....RR....",
    "....RR....RR....",
    "................",
  ],
  ghost: [
    "....WWWWWWWW....",
    "..WWWWWWWWWWWW..",
    ".WWWWWWWWWWWWWW.",
    ".WWWWWWWWWWWWWW.",
    "WWWWWWWWWWWWWWWW",
    "WWWWBBWWWWBBWWWW",
    "WWWBBBWWWWBBBWWW",
    "WWWWBBWWWWBBWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WW.WWW.WW.WWW.WW",
    "W...WW.WW.WW...W",
    "................",
    "................",
  ],
  dragon: [
    "..G.............",
    ".GGG............",
    "GGGGG..VVVV.....",
    "GGGGG.VVVVVVV...",
    ".GGGVVVVVVVVVV..",
    "..GVVVVVLVVVVV..",
    "...VVVVVLLVVVVV.",
    "..VVVVVVVVVVVVV.",
    ".VVVVVVVVVVVVVV.",
    "VVVVVVVVVVVVVVV.",
    "VVVVVVVVVVVVVVV.",
    ".VVVVVVVVVVVVV..",
    "..VVVVV.VVVVV...",
    "..VVV....VVV....",
    "..VV......VV....",
    "................",
  ],
};

export function drawToken(
  ctx: CanvasRenderingContext2D,
  key: StandardTokenKey,
  size: number,
) {
  const grid = TOKENS[key];
  const cellSize = size / 16;
  ctx.clearRect(0, 0, size, size);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const ch = grid[row]?.[col] ?? ".";
      if (ch === ".") continue;
      ctx.fillStyle = PALETTE[ch] ?? "#FF00FF"; // magenta = missing key
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
}

export const TOKEN_KEYS: TokenKey[] = [
  "wizard", "rocket", "fox", "knight", "shark", "bull", "ghost", "dragon",
];

export const TOKEN_LABELS: Record<TokenKey, string> = {
  wizard: "Wizard",
  rocket: "Rocket",
  fox:    "Fox",
  knight: "Knight",
  shark:  "Shark",
  bull:   "Bull",
  ghost:  "Ghost",
  dragon: "Dragon",
};
