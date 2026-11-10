// Every kind of thing the wiki knows about. Each kind lives in one JSON file in
// content/data, has a default page where it is shown, and an image folder.
//
// shape -> how its image (or placeholder) is framed. See SHAPES below.

export const KINDS = {
  card:     { file: 'cards',      label: 'Card',          plural: 'Cards',          page: '/cards/database/',        folder: 'cards',      shape: 'card',     icon: 'card' },
  pack:     { file: 'packs',      label: 'Card pack',     plural: 'Card packs',     page: '/cards/packs/',           folder: 'packs',      shape: 'pack',     icon: 'pack' },
  border:   { file: 'borders',    label: 'Variant',       plural: 'Variants',       page: '/basics/borders/',        folder: 'borders',    shape: 'icon',     icon: 'card' },
  weather:  { file: 'weathers',   label: 'Weather',       plural: 'Weathers',       page: '/cards/weathers/',        folder: 'weathers',   shape: 'wide',     icon: 'weather' },
  potion:   { file: 'potions',    label: 'Potion',        plural: 'Potions',        page: '/items/potions/',         folder: 'potions',    shape: 'icon',     icon: 'potion' },
  charm:    { file: 'charms',     label: 'Charm',         plural: 'Charms',         page: '/items/charms-relics/',   folder: 'charms',     shape: 'icon',     icon: 'charm' },
  relic:    { file: 'relics',     label: 'Relic',         plural: 'Relics',         page: '/items/charms-relics/',   folder: 'relics',     shape: 'icon',     icon: 'relic' },
  material: { file: 'materials',  label: 'Material',      plural: 'Materials',      page: '/items/materials/',       folder: 'materials',  shape: 'icon',     icon: 'material' },
  currency: { file: 'currencies', label: 'Currency',      plural: 'Currencies',     page: '/economy/currencies/',    folder: 'currencies', shape: 'coin',     icon: 'coin' },
  gamepass: { file: 'gamepasses', label: 'Game pass',     plural: 'Game passes',    page: '/items/game-passes/',     folder: 'gamepasses', shape: 'icon',     icon: 'gamepass' },
  place:    { file: 'places',     label: 'Location',      plural: 'Places & NPCs',  page: '/world/the-hall/',        folder: 'places',     shape: 'wide',     icon: 'place' },
  world:    { file: 'worlds',     label: 'World',         plural: 'Worlds',         page: '/world/worlds/',          folder: 'worlds',     shape: 'wide',     icon: 'world' },
  boss:     { file: 'bosses',     label: 'Boss',          plural: 'Bosses',         page: '/world/secret-bosses/',   folder: 'bosses',     shape: 'portrait', icon: 'boss' },
  zone:     { file: 'zones',      label: 'Echo zone',     plural: 'Echo zones',     page: '/world/echo-depths/',     folder: 'zones',      shape: 'wide',     icon: 'echo' },
  stat:     { file: 'stats',      label: 'Player stat',   plural: 'Player stats',   page: '/basics/player-stats/',   folder: null,         shape: null,       icon: 'stat' },
  trait:    { file: 'traits',     label: 'Trait',         plural: 'Card traits',    page: '/cards/traits/',          folder: null,         shape: null,       icon: 'spark' },
  cosmetic: { file: 'cosmetics',  label: 'Cosmetic',      plural: 'Titles & frames', page: '/progression/victory-road/', folder: 'frames', shape: 'icon',     icon: 'spark' },
};

// Image shapes: placeholder look, the advice given in the image checklist, and
// which widths the build generates.
export const SHAPES = {
  card:     { noun: 'card image',   advice: 'Full card, portrait (5:7), at least 500×700. A clean screenshot of the card is fine.', widths: [240, 480, 720], fit: 'cover' },
  pack:     { noun: 'pack image',   advice: 'Pack art, portrait (3:4), at least 600×800. Transparent background if possible.', widths: [240, 480, 800], fit: 'contain' },
  icon:     { noun: 'icon',         advice: 'Square icon, at least 256×256, transparent background if possible.', widths: [96, 192, 384], fit: 'contain' },
  coin:     { noun: 'icon',         advice: 'Square icon, at least 256×256, transparent background if possible.', widths: [96, 192, 384], fit: 'contain' },
  wide:     { noun: 'screenshot',   advice: 'Wide screenshot (16:9), at least 1600×900, with the game UI hidden if possible.', widths: [480, 960, 1600], fit: 'cover' },
  portrait: { noun: 'image',        advice: 'Portrait screenshot or render (4:5), at least 800×1000.', widths: [320, 640, 960], fit: 'cover' },
  shot:     { noun: 'screenshot',   advice: 'Screenshot at full resolution (any shape). Crop to the relevant part of the screen.', widths: [480, 960, 1600], fit: 'contain' },
  logo:     { noun: 'logo',         advice: 'Game logo, transparent background, at least 1200 px wide.', widths: [400, 800, 1200], fit: 'contain' },
};

export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.tif', '.tiff'];
export const VIDEO_EXTS = ['.mp4', '.webm'];
