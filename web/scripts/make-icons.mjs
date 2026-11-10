// Turns the icon set read out of the Penpot design file (scripts/penpot-icons.txt, one icon per line, on a 24 by 24
// grid) into src/components/icons.data.ts. Run again whenever the set changes in the design file: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync(new URL('./penpot-icons.txt', import.meta.url), 'utf8').trim().split('\n');
const key = (name) => name.toLowerCase().replace(/ (\w)/g, (_, c) => c.toUpperCase());
const out = lines.map((line) => {
  const [name, body] = line.split('=');
  const shapes = body.split(';').map((part) => {
    const [, kind, rest] = part.match(/^s2\|([EPR]) (.*)$/);
    const n = rest.split(' ');
    if (kind === 'E') return `<ellipse cx="${n[0]}" cy="${n[1]}" rx="${n[2]}" ry="${n[3]}"/>`;
    if (kind === 'R') return `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" rx="${n[4]}"/>`;
    return `<path d="${rest}"/>`;
  });
  return `  ${key(name)}: '${shapes.join('')}',`;
});
writeFileSync(
  new URL('../src/components/icons.data.ts', import.meta.url),
  `// Made by scripts/make-icons.mjs from the app's own icon set in the design file (decision 68). Do not edit by hand.\n// Outline icons on a 24 by 24 grid, drawn with a stroke of 2.\nexport const ICONS = {\n${out.join('\n')}\n} as const;\n`,
);
console.log(`${lines.length} icons`);
