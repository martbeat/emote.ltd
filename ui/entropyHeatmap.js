const DEFAULT_CONTAINER_ID = "entropyHeatmap";

function getEntropyColour(entropy) {
  if (entropy < 2) return "entropy-low";
  if (entropy < 3) return "entropy-mid";
  return "entropy-high";
}

/**
 * Render entropy scores as a CSS grid heatmap.
 * @param {{guess: string, entropy: number}[]} entropyScores
 * @param {string|HTMLElement} [target]
 */
export function renderEntropyHeatmap(entropyScores, target = DEFAULT_CONTAINER_ID) {
  const container = typeof target === "string" ? document.getElementById(target) : target;
  if (!container) return;

  container.classList.add("entropy-heatmap-grid");
  container.innerHTML = "";

  if (!Array.isArray(entropyScores) || entropyScores.length === 0) {
    const empty = document.createElement("div");
    empty.className = "entropy-heatmap-empty";
    empty.textContent = "No entropy data available.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < entropyScores.length; i += 1) {
    const { guess, entropy } = entropyScores[i];
    const cell = document.createElement("div");
    cell.className = `entropy-cell ${getEntropyColour(entropy)}`;
    cell.title = `${guess}: ${entropy.toFixed(3)} bits`;

    const word = document.createElement("span");
    word.className = "entropy-word";
    word.textContent = guess;

    const value = document.createElement("span");
    value.className = "entropy-value";
    value.textContent = entropy.toFixed(2);

    cell.append(word, value);
    fragment.appendChild(cell);
  }

  container.appendChild(fragment);
}
