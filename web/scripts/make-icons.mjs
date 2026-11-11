// Turns the app's icon set (scripts/penpot-icons.txt, one icon per line, on a 24 by 24 grid) into
// src/components/icons.data.ts. The set was read out of the Penpot design file; Money, Image, People and Lock were
// drawn afterwards in the same style and added to the design file's icon set (11 November 2026). Run again whenever the set changes in the design file: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync(new URL('./penpot-icons.txt', import.meta.url), 'utf8').trim().split('\n');
const key = (name) => name.toLowerCase().replace(/ (\w)/g, (_, c) => c.toUpperCase());
const out = lines.map((line) => {
  const [name, body] = line.split('=');
  const shapes = body.split(';').map((part) => {
    // "s2" is a line of width 2 in the icon's colour; "f" after it also fills the shape. "w" is the cut-out colour
    // (white in the design file: the colour behind the icon), with its own line width; "w0f" is a filled cut-out.
    const [, ink, width, filled, kind, rest] = part.match(/^([sw])([\d.]+)(f?)\|([EPR]) (.*)$/);
    const cut = 'var(--icon-cut, #fff)';
    let fill = filled ? ' fill="currentColor"' : '';
    if (ink === 'w') fill = (filled ? ` fill="${cut}"` : '') + (width === '0' ? ' stroke="none"' : ` stroke="${cut}" stroke-width="${width}"`);
    const n = rest.split(' ');
    if (kind === 'E') return `<ellipse cx="${n[0]}" cy="${n[1]}" rx="${n[2]}" ry="${n[3]}"${fill}/>`;
    if (kind === 'R') return `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" rx="${n[4]}"${fill}/>`;
    return `<path d="${rest}"${fill}/>`;
  });
  return `  ${key(name)}: '${shapes.join('')}',`;
});
writeFileSync(
  new URL('../src/components/icons.data.ts', import.meta.url),
  `// Made by scripts/make-icons.mjs from the app's own icon set in the design file (decision 68). Do not edit by hand.\n// Icons on a 24 by 24 grid, drawn with a stroke of 2; the filled ones also fill their shape,\n// and cut details out of it in the colour behind the icon (--icon-cut, white unless set).\nexport const ICONS = {\n${out.join('\n')}\n} as const;\n`,
);
console.log(`${lines.length} icons`);
