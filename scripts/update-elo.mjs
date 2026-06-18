// Genereaza elo.json din eloratings.net World.tsv.
// Rulat de GitHub Action (zilnic). Local: `node scripts/update-elo.mjs`.
// Anti parse-error: scrie fisierul DOAR daca toate cele 48 de echipe sunt gasite si in interval valid.
import { writeFileSync, readFileSync } from 'node:fs';

// cod eloratings (2 litere, col 3 din TSV) -> cod intern al dashboardului
export const ELO_CC = {
  ES:'ESP', AR:'ARG', FR:'FRA', EN:'ENG', CO:'COL', BR:'BRA', PT:'POR', NL:'NED', DE:'GER', NO:'NOR',
  JP:'JPN', EC:'ECU', HR:'CRO', MX:'MEX', BE:'BEL', UY:'URU', CH:'SUI', KR:'KOR', CZ:'CZE', BA:'BIH',
  CI:'CIV', SA:'KSA', IQ:'IRQ', DZ:'ALG', CD:'COD', UZ:'UZB', JO:'JOR', GH:'GHA', PA:'PAN', NZ:'NZL',
  SQ:'SCO', QA:'QAT', TN:'TUN', EG:'EGY', IR:'IRN', SN:'SEN', PY:'PAR', AU:'AUS', TR:'TUR', MA:'MAR',
  HT:'HAI', SE:'SWE', AT:'AUT', ZA:'RSA', CW:'CUW', CV:'CPV', CA:'CAN', US:'USA',
};
const NEED = new Set(Object.values(ELO_CC)); // cele 48 coduri interne asteptate

const SOURCES = [
  'https://www.eloratings.net/World.tsv',
  'https://r.jina.ai/https://www.eloratings.net/World.tsv', // proxy de rezerva
];

async function fetchTsv() {
  let lastErr;
  for (const u of SOURCES) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'cm2026-elo-bot' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text();
      if (t.split('\n').length > 100 && /\t/.test(t)) return t;
      throw new Error('continut neasteptat');
    } catch (e) { lastErr = e; console.error('  surse esuata:', u, e.message); }
  }
  throw lastErr || new Error('nicio sursa disponibila');
}

export function parse(tsv) {
  const out = {};
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 4) continue;
    const code = (c[2] || '').trim().toUpperCase();
    const ours = ELO_CC[code];
    if (!ours) continue;
    const rating = Number((c[3] || '').trim());
    if (!Number.isFinite(rating) || rating < 1200 || rating > 2400) continue;
    if (out[ours] == null) out[ours] = Math.round(rating); // prima aparitie a codului
  }
  return out;
}

async function main() {
  const tsv = await fetchTsv();
  const elo = parse(tsv);
  const missing = [...NEED].filter(c => elo[c] == null);
  if (missing.length) {
    console.error('EROARE: lipsesc ' + missing.length + ' echipe:', missing.join(','));
    console.error('Nu scriu elo.json (posibil parse error sau format schimbat).');
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const payload = { updated: today, source: 'eloratings.net', elo };

  // diff fata de fisierul existent (informativ)
  try {
    const prev = JSON.parse(readFileSync('elo.json', 'utf8'));
    const diffs = Object.keys(elo).filter(c => prev.elo?.[c] !== elo[c])
      .map(c => `${c} ${prev.elo?.[c] ?? '?'}->${elo[c]}`);
    console.log(diffs.length ? 'Modificari: ' + diffs.join(', ') : 'Nicio modificare fata de elo.json.');
  } catch { console.log('elo.json nou (fara fisier anterior).'); }

  writeFileSync('elo.json', JSON.stringify(payload) + '\n');
  console.log('Scris elo.json (' + today + ', 48 echipe).');
}

// ruleaza main() doar cand e invocat direct (nu la import in teste)
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g,'/')}`).href) {
  main().catch(e => { console.error('ESEC:', e.message); process.exit(1); });
}
