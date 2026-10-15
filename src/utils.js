// Generic utilities

export function normalizeThaiName(str = '') {
  // remove Thai tone marks & normalize whitespace, lowercase for comparisons
  return String(str).replace(/[่้๊๋์]/g, '').trim().toLowerCase();
}

export function isSamePerson(nameA = '', nameB = '') {
  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;
  const a = normalizeThaiName(nameA);
  const b = normalizeThaiName(nameB);
  if (a === b) return true;
  if (!isNaN(Number(a)) || !isNaN(Number(b))) return false;
  // compare last tokens
  const pa = a.split(/\s+/), pb = b.split(/\s+/);
  if (pa.length > 1 && pb.length > 1 && pa[pa.length-1] === pb[pb.length-1]) return true;
  // small edit-distance heuristic
  if (Math.abs(a.length - b.length) <= 2) {
    let diff = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i=0;i<minLen;i++) if (a[i]!==b[i]) diff++;
    diff += Math.abs(a.length - b.length);
    if (diff <= 2) return true;
  }
  return false;
}

export function generateId(prefix = 'pkg_') {
  if (crypto?.randomUUID) return prefix + crypto.randomUUID();
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
