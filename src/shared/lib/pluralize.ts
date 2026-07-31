// Standard Slavic (BCS: Bosnian/Montenegrin/Serbian/Croatian) count-noun pluralization: singular
// for a count ending in 1 (except 11), paucal for a count ending in 2-4 (except 12-14), plural
// otherwise. Shared so every part of the app that renders a counted noun applies the exact same
// rule instead of each re-deriving (and potentially getting wrong) the modulo logic.
function getBcsPluralForm(count: number, singular: string, paucal: string, plural: string) {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return plural;
  if (last === 1) return singular;
  if (last >= 2 && last <= 4) return paucal;
  return plural;
}

function formatBcsCount(count: number, singular: string, paucal: string, plural = paucal) {
  return `${count} ${getBcsPluralForm(count, singular, paucal, plural)}`;
}

interface BcsNounForms {
  few: string;
  many: string;
  one: string;
}

// Returns just the correctly-declined noun for a count — no digit attached — for UI that shows
// the number and its label as two separate elements (e.g. a large value with a small caption
// underneath) rather than one combined "count noun" phrase.
function formatCountLabel(count: number, forms: BcsNounForms) {
  return getBcsPluralForm(count, forms.one, forms.few, forms.many);
}

export { formatBcsCount, formatCountLabel, getBcsPluralForm };
