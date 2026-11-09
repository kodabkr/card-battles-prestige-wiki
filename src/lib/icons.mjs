// Inline references into the self-hosted SVG icon sprite.
let spriteUrl = '/assets/icons.svg';
export const setSpriteUrl = (u) => (spriteUrl = u);
export const getSpriteUrl = () => spriteUrl;

export function icon(name, cls = '') {
  return `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="${spriteUrl}#i-${name}"></use></svg>`;
}
