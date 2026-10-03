// Story Pulse colors, shared by the planner lane and the editor's Pulse gutter.

export const NEUTRAL_BAND = 0.2;   // |valence| below this counts as neutral: HU sign agreement is ~0.55

// Plutchik hues; the positive family rises above the baseline, the negative hangs below
export const EMOTION_COLORS = {
    joy: "#d4a052", trust: "#5c9e6e", anticipation: "#c9b458", surprise: "#5cb3c4",
    fear: "#8b6ec4", anger: "#c45c5c", sadness: "#6f86a6", disgust: "#8a8f4a",
};
export const NEUTRAL_COLOR = "#7d7a72";
export const NEGATIVE_COLOR = "#c45c5c";
export const BRIGHT_MOOD = "#5c9e6e";
export const DARK_MOOD = "#8b6ec4";
const POSITIVE_EMOTIONS = new Set(["joy", "trust", "anticipation", "surprise"]);

export function dominant(emotions) {
    let best = null;
    for (const [k, v] of Object.entries(emotions || {})) if (!best || v > best[1]) best = [k, v];
    return best ? best[0] : null;
}

export function columnColor(valence, emotions) {
    if (valence === undefined || Math.abs(valence) < NEUTRAL_BAND) return NEUTRAL_COLOR;
    const emo = dominant(emotions);
    if (!emo) return valence < 0 ? NEGATIVE_COLOR : EMOTION_COLORS.joy;
    // an emotion from the other family than the sign falls back to the family color
    if (valence < 0) return POSITIVE_EMOTIONS.has(emo) ? NEGATIVE_COLOR : EMOTION_COLORS[emo];
    return POSITIVE_EMOTIONS.has(emo) ? EMOTION_COLORS[emo] : EMOTION_COLORS.joy;
}

export function moodColor(mood) {
    if (mood >= NEUTRAL_BAND) return BRIGHT_MOOD;
    if (mood <= -NEUTRAL_BAND) return DARK_MOOD;
    return NEUTRAL_COLOR;
}
