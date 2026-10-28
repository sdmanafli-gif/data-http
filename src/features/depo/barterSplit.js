/**
 * Kredit + barter: müştərinin verdiyi cihazın dəyəri əvvəlcə ilkin ödənişə sayılır,
 * ilkindən artıq qalan hissə müştəriyə nağd qaytarılır. Nağd yalnız barter ilkini
 * tam bağlamayanda (qalan hissə üçün) sayılır.
 *
 * Məs.: ilkin 500, barter 2500 → ilkinə 500 (barterdən), müştəriyə 2000 qaytarılır
 *       («İlkin ödəniş verilib» xanasına 0 və ya 500 yazılsa da nəticə eynidir).
 *       ilkin 1000, barter 600, nağd 400 → ilkinə 1000, qaytarılan 0.
 *
 * @returns {{ cash:number, barter:number, paid:number, qaytar:number, barterIlkin:number, cashOver:boolean }}
 *   cash — ilkinə sayılan nağd hissə
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
  if (b <= 0.009) {
    return { cash: c, barter: 0, paid: c, qaytar: 0, barterIlkin: 0, cashOver: false }
  }
  const barterIlkin = Math.min(b, due)
  const qaytar = r(b - barterIlkin)
  const cashUsed = Math.min(c, r(due - barterIlkin))
  return {
    cash: cashUsed,
    barter: b,
    paid: r(barterIlkin + cashUsed),
    qaytar,
    barterIlkin,
    cashOver: c - due > 0.009,
  }
}
