// Turns the app's icon set (web/scripts/penpot-icons.txt, read out of the Penpot design file) into
// lib/src/design/icons.g.dart. Run again whenever the set changes: node tool/make_icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync(new URL('../../web/scripts/penpot-icons.txt', import.meta.url), 'utf8').trim().split('\n');
const key = (name) => name.toLowerCase().replace(/ (\w)/g, (_, c) => c.toUpperCase());
const names = [];
const bodies = lines.map((line) => {
  const [name, body] = line.split('=');
  names.push(key(name));
  // "{c}" is the icon's colour and "{k}" the cut-out colour (the colour behind the icon); both are filled in when drawn.
  const shapes = body.split(';').map((part) => {
    const [, ink, width, filled, kind, rest] = part.match(/^([sw])([\d.]+)(f?)\|([EPR]) (.*)$/);
    const colour = ink === 'w' ? '{k}' : '{c}';
    const paint = `fill="${filled ? colour : 'none'}" ` + (width === '0' ? 'stroke="none"' : `stroke="${colour}" stroke-width="${width}"`);
    const n = rest.split(' ');
    if (kind === 'E') return `<ellipse cx="${n[0]}" cy="${n[1]}" rx="${n[2]}" ry="${n[3]}" ${paint}/>`;
    if (kind === 'R') return `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" rx="${n[4]}" ${paint}/>`;
    return `<path d="${rest}" ${paint}/>`;
  });
  return `  AppIcons.${key(name)}: '${shapes.join('')}',`;
});
writeFileSync(
  new URL('../lib/src/design/icons.g.dart', import.meta.url),
  `// Made by tool/make_icons.mjs from the app's own icon set in the design file (decision 68). Do not edit by hand.
// Icons are drawn on a 24 by 24 grid with a line of 2.

/// Every icon in the set.
enum AppIcons { ${names.join(', ')} }

const Map<AppIcons, String> appIconShapes = {
${bodies.join('\n')}
};
`,
);
console.log(`${lines.length} icons`);
