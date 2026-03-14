import { scoreAllGuesses } from "../solver/entropyEngine.js";
import { renderEntropyHeatmap } from "./entropyHeatmap.js";

/**
 * Integrates entropy heatmap updates into the solver UI flow.
 *
 * Expected usage from existing UI:
 *   onCandidatesChanged(candidates, dictionary)
 * should be called after every guess/feedback update.
 */
export function onCandidatesChanged(candidates, dictionary) {
  const entropyScores = scoreAllGuesses(candidates, dictionary);
  renderEntropyHeatmap(entropyScores);
  return entropyScores;
}

/**
 * Optional helper for UIs that already have a post-guess callback.
 * Wrap your existing handler and keep heatmap updates automatic.
 *
 * @param {(guess: string, feedback: unknown) => Promise<void>|void} applyGuessHandler
 * @param {() => string[]} getCandidates
 * @param {() => string[]} getDictionary
 * @returns {(guess: string, feedback: unknown) => Promise<void>}
 */
export function withEntropyHeatmap(applyGuessHandler, getCandidates, getDictionary) {
  return async (guess, feedback) => {
    await applyGuessHandler(guess, feedback);

    const candidates = getCandidates();
    const dictionary = getDictionary();

    const entropyScores = scoreAllGuesses(candidates, dictionary);
    renderEntropyHeatmap(entropyScores);
  };
}
