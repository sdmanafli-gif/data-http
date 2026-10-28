/**
 * Kredit + barter: müştərinin verdiyi cihazın dəyəri ilkin ödənişə sayılır,
 * ilkindən artıq qalan hissə müştəriyə nağd qaytarılır.
 *
 * Məs.: ilkin 1000, barter 1500, nağd 0 → ilkinə 1000 (hamısı barterdən), müştəriyə 500 qaytarılır.
 *       ilkin 1000, barter 600, nağd 400 → ilkinə 1000, qaytarılan 0.
 *
 * @returns {{ cash:number, barter:number, paid:number, qaytar:number, barterIlkin:number, cashOver:boolean }}
 *   paid — ilkin ödənişə sayılan cəmi (müqavilədə «İlkin ödəniş», Ödənişlər tabında yazılan məbləğ)
 *   qaytar — müştəriyə nağd qaytarılan
 *   barterIlkin — barter cihazının dəyərindən ilkinə sayılan hissə
 *   cashOver — nağd ödəniş tək özü ilkindən çoxdur (xəta)
 */
export function barterSplit({ cash, barter, ilkinDue }) {
  const r = (n) => Math.round((Number(n) || 0) * 100) / 100
  const c = Math.max(0, r(cash))
  const b = Math.max(0, r(barter))
  const due = Math.max(0, r(ilkinDue))
  const raw = r(c + b)
  if (b <= 0.009) {
    return { cash: c, barter: 0, paid: c, qaytar: 0, barterIlkin: 0, cashOver: false }
  }
  const qaytar = raw - due > 0.009 ? Math.min(b, r(raw - due)) : 0
  const barterIlkin = r(b - qaytar)
  return {
    cash: c,
    barter: b,
    paid: r(c + barterIlkin),
    qaytar,
    barterIlkin,
    cashOver: c - due > 0.009,
  }
}
