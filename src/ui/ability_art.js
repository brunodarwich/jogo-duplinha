/** Atlas quadrants are Q/W/E/R, row-major. Art never contains live labels or state. */
export const ABILITY_ATLASES = Object.fromEntries(
  ['knight', 'sorceress', 'ranger', 'assassin', 'cleric'].map(id => [id, `assets/ui/abilities/${id}.png`])
);
export const ABILITY_QUADRANTS = { Q: [0, 0], W: [1, 0], E: [0, 1], R: [1, 1] };

export function applyAbilityArt(heroId, root = document) {
  for (const [slot, [column, row]] of Object.entries(ABILITY_QUADRANTS)) {
    const button = root.getElementById(`ability-${slot.toLowerCase()}`);
    if (!button) continue;
    button.querySelector('.ability-art')?.remove();
    const src = ABILITY_ATLASES[heroId];
    if (!src) continue;
    const frame = root.createElement('span');
    frame.className = 'ability-art';
    frame.setAttribute('aria-hidden', 'true');
    const image = root.createElement('img');
    image.alt = '';
    image.draggable = false;
    image.style.left = `${column * -100}%`;
    image.style.top = `${row * -100}%`;
    image.addEventListener('error', () => frame.remove(), { once: true });
    image.src = src;
    frame.appendChild(image);
    button.prepend(frame);
  }
}
