import type { Block } from '@/content/types';

/** Paragraphs and lists of points, as written in the content files. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        typeof b === 'string' ? (
          <p key={i}>{b}</p>
        ) : (
          <ul key={i}>
            {b.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}
