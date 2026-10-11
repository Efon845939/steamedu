// Short display names for the misconception tags in backend/seed_data.py (MISCONCEPTIONS).
// The API sends the tag and a full description; these are the names that fit on a
// specimen label or an X-ray column header. Turkish names are drafts for the class trial.

const NAMES = {
  impetus: ['Impetus', 'İmpetus'],
  'motion-implies-force': ['Motion needs a force', 'Hareket kuvvet ister'],
  'force-proportional-to-velocity': ['Force sets speed', 'Kuvvet hızı belirler'],
  'heavier-falls-faster': ['Heavier falls faster', 'Ağır olan daha hızlı düşer'],
  'greater-mass-greater-force': ['Greater mass, greater force', 'Büyük kütle, büyük kuvvet'],
  'only-active-objects-push': ['Only the mover pushes', 'Sadece çarpan iter'],
  'damage-shows-force': ['Damage shows force', 'Hasar kuvveti gösterir'],
  'zero-velocity-zero-force': ['Zero velocity, zero force', 'Sıfır hız, sıfır kuvvet'],
  'no-gravity-in-space': ['No gravity in space', 'Uzayda yer çekimi yok'],
  'gravity-needs-air': ['Gravity needs air', 'Yer çekimi havaya bağlı'],
  'mass-weight-confusion': ['Mass and weight mixed up', 'Kütle ile ağırlık karışıyor'],
  'assignment-links-variables': ['Assignment links variables', 'Atama değişkenleri bağlar'],
  'bits-bytes-confusion': ['Bits and bytes mixed up', 'Bit ile bayt karışıyor'],
  'current-consumed': ['Current gets used up', 'Akım tükenir'],
  'machines-reduce-work': ['Machines reduce work', 'Makineler işi azaltır'],
  'style-from-single-feature': ['Style from one feature', 'Tek özellikten akım'],
  'additive-subtractive-mixing': ['Paint mixes like light', 'Boya ışık gibi karışır'],
  'add-numerators-and-denominators': ['Adding tops and bottoms', 'Payları ve paydaları toplamak'],
  'percent-change-symmetric': ['Percent change is symmetric', 'Yüzde değişim simetriktir'],
};

const humanize = (tag) => {
  const s = String(tag || '').replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

// misconceptionName('impetus') -> 'Impetus'; misconceptionName('impetus', 'tr') -> 'İmpetus'
export const misconceptionName = (tag, lang = 'en') => {
  const entry = NAMES[tag];
  if (!entry) return humanize(tag);
  return lang === 'tr' ? entry[1] : entry[0];
};
