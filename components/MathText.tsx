import type { ReactNode } from 'react';

const MATH_FONT = '"Cambria Math", "STIX Two Math", "Times New Roman", ui-serif, serif';
const FRACTION_MARKER = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
const SIMPLE_FRACTION = /(\([^()]+\)|[A-Za-z0-9μσπλθωτηζ∂Σ√{}|ᵃ-ᶻ⁰-⁹⁺⁻⁽⁾₀-₉₊₋²³¹′]+(?:\([^()]*\))?)\/(\([^()]+\)|[A-Za-z0-9μσπλθωτηζ∂Σ√{}|ᵃ-ᶻ⁰-⁹⁺⁻⁽⁾₀-₉₊₋²³¹′]+(?:\([^()]*\))?)/g;

interface Props {
  text: string;
}

export default function MathText({ text }: Props) {
  return (
    <span style={{
      fontFamily: MATH_FONT,
      fontVariantNumeric: 'lining-nums tabular-nums',
      letterSpacing: 0,
      wordSpacing: '0.06em',
    }}>
      {renderMath(text)}
    </span>
  );
}

function renderMath(text: string): ReactNode[] {
  const marked = renderMarkedFractions(text);
  const out: ReactNode[] = [];

  marked.forEach((part, i) => {
    if (typeof part !== 'string') {
      out.push(part);
      return;
    }

    let last = 0;
    for (const match of part.matchAll(SIMPLE_FRACTION)) {
      const start = match.index ?? 0;
      const rawNum = match[1];
      const rawDen = match[2];

      if (start > last) out.push(part.slice(last, start));
      out.push(
        <Fraction key={`auto-frac-${i}-${start}`} numerator={cleanParen(rawNum)} denominator={cleanParen(rawDen)} />
      );
      last = start + match[0].length;
    }
    if (last < part.length) out.push(part.slice(last));
  });

  return out;
}

function renderMarkedFractions(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(FRACTION_MARKER)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(<Fraction key={`marked-frac-${start}`} numerator={match[1]} denominator={match[2]} />);
    last = start + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function cleanParen(value: string): string {
  if (value.startsWith('(') && value.endsWith(')')) return value.slice(1, -1);
  return value;
}

function Fraction({ numerator, denominator }: { numerator: string; denominator: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.05,
      margin: '0 0.12em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ display: 'block', padding: '0 0.24em 0.06em', fontSize: '0.86em' }}>{numerator}</span>
      <span style={{ display: 'block', width: '100%', borderTop: '1.5px solid currentColor', padding: '0.08em 0.24em 0', fontSize: '0.86em', textAlign: 'center' }}>{denominator}</span>
    </span>
  );
}
