// Testira BAS onu odluku koja je pustila jednu recenziju preko dvadeset jedne.
const size = (d) => (d && Array.isArray(d.reviews) ? d.reviews.length : 0);
const better = (candidate, current) => {
  if (!candidate || !candidate.count || !size(candidate)) return false;
  if (size(candidate) !== size(current)) return size(candidate) > size(current);
  return (candidate.fetchedAt || 0) > (current.fetchedAt || 0);
};

const live1   = { count: 1,  fetchedAt: 1787668920662, reviews: [{}] };                    // sweep sa jedne teritorije
const snap21  = { count: 31, fetchedAt: 1786141281236, reviews: Array(21).fill({}) };      // pravi snapshot
const empty   = { count: 0,  fetchedAt: 1787700000000, reviews: [] };
const fresh21 = { count: 31, fetchedAt: 1787700000000, reviews: Array(21).fill({}) };
const rich40  = { count: 55, fetchedAt: 1786000000000, reviews: Array(40).fill({}) };

let fail = 0;
const t = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log(`  ${ok ? 'OK  ' : 'PADA'} ${name}`); };

t('stvarni slucaj: snapshot od 21 pobedjuje sweep od 1 iako je stariji', better(snap21, live1), true);
t('sweep od 1 NE pobedjuje snapshot od 21',                              better(live1, snap21), false);
t('prazan nikad ne pobedjuje',                                           better(empty, snap21), false);
t('prazan ne pobedjuje ni prazan rezultat',                              better(empty, { count: 0, reviews: [] }), false);
t('isti broj, noviji pobedjuje',                                         better(fresh21, snap21), true);
t('isti broj, stariji ne pobedjuje',                                     better(snap21, fresh21), false);
t('vise recenzija pobedjuje i kad je starije',                           better(rich40, fresh21), true);
t('null se ne rusi',                                                     better(null, snap21), false);

// Klijentska strana: isti scenario, redosled dolaska obrnut
let shown = -1;
const offer = (d) => { const n = size(d); if (!n || n < shown) return; shown = n; };
offer(snap21); offer(live1);
t('stranica zadrzava 21 kad posle stigne 1', shown, 21);
shown = -1; offer(live1); offer(snap21);
t('stranica podigne na 21 kad prvo stigne 1', shown, 21);

console.log(fail ? `\nPADA: ${fail}` : '\nsve prolazi');
process.exit(fail ? 1 : 0);
