/**
 * WhatsApp linkləri.
 * waAppUrl — birbaşa tətbiqi açır (kompüterdə WhatsApp Desktop, telefonda WhatsApp).
 * waWebUrl — brauzerdə WhatsApp Web (tətbiq quraşdırılmayıbsa ehtiyat).
 * num: 994XXXXXXXXX formatında (boş ola bilər), text: hazır mesaj (istəyə görə).
 */
export function waAppUrl(num, text = '') {
  const q = []
  if (num) q.push(`phone=${encodeURIComponent(num)}`)
  if (text) q.push(`text=${encodeURIComponent(text)}`)
  return `whatsapp://send${q.length ? `?${q.join('&')}` : ''}`
}

export function waWebUrl(num, text = '') {
  return `https://wa.me/${num || ''}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** WhatsApp tətbiqini açır (səhifə yerində qalır) */
export function openWhatsApp(num, text = '') {
  window.location.href = waAppUrl(num, text)
}
