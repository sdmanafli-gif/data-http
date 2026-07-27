/**
 * Navigation — modules backed by the live Supabase DB.
 */
export const navSections = [
  {
    id: 'bazalar',
    label: 'Bazalar',
    items: [
      { path: '/musteri-bazasi', label: 'Müştəri Bazası' },
      { path: '/yigim', label: 'Yığım' },
      { path: '/mehkeme', label: 'Məhkəmə' },
      { path: '/odenisler', label: 'Ödənişlər' },
      { path: '/depo', label: 'Depo' },
      { path: '/nagd-satish', label: 'Nağd satış' },
      { path: '/borc-nisye', label: 'Borc / Nisyə' },
    ],
  },
]

export const placeholders = navSections.flatMap((s) =>
  s.items.map((item) => ({
    ...item,
    section: s.label,
  }))
)
