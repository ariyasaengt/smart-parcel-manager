export function normalizeThaiName(value = '') {
  return String(value).replace(/[่้๊๋์]/g, '').trim().toLowerCase();
}

export function isSamePerson(a = '', b = '') {
  if (!a || !b) return false;
  if (a === b) return true;

  const x = normalizeThaiName(a);
  const y = normalizeThaiName(b);
  if (x === y) return true;

  const pa = x.split(/\s+/);
  const pb = y.split(/\s+/);

  if (pa.length > 1 && pb.length > 1 && pa[pa.length - 1] === pb[pb.length - 1]) return true;

  if (Math.abs(x.length - y.length) <= 2) {
    let diff = 0;
    const minLen = Math.min(x.length, y.length);
    for (let i = 0; i < minLen; i++) {
      if (x[i] !== y[i]) diff++;
    }
    diff += Math.abs(x.length - y.length);
    if (diff <= 2) return true;
  }

  return false;
}

export function createLineMessage(rows, header, footer) {
  const grouped = [];

  rows.forEach(item => {
    const target = String(item.target || '').trim();
    if (!target || target === 'ไม่ระบุ') return;

    let foundIndex = -1;
    for (let i = 0; i < grouped.length; i++) {
      if (isSamePerson(grouped[i].displayName, target)) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex >= 0) {
      grouped[foundIndex].count += 1;
      if (target.length > grouped[foundIndex].displayName.length) {
        grouped[foundIndex].displayName = target;
      }
    } else {
      grouped.push({ displayName: target, count: 1 });
    }
  });

  const lines = [];
  if (header) lines.push(header);
  lines.push(`(รวมทั้งหมด ${rows.length} ชิ้น)`);
  lines.push('');

  grouped.forEach(g => {
    lines.push(g.count > 1 ? `ห้อง/ผู้รับ: ${g.displayName} ( ${g.count} ชิ้น )` : `ห้อง/ผู้รับ: ${g.displayName}`);
  });

  if (footer) {
    lines.push('');
    lines.push(footer);
  }

  return lines.join('\n');
}
