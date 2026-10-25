// Old Hungarian (Rovás) glyphs — always render with var(--font-runes).
// Capital letters of the Unicode block U+10C80–U+10CB2.
export const ROVAS_CAPITALS = Array.from({ length: 0x33 }, (_, i) => String.fromCodePoint(0x10c80 + i))
