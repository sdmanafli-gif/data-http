/**
 * Navigation — modules backed by the live Supabase DB.
 * Grouped for daily workflow: stock/sales → collections → legal.
 */
export const navSections = [
  {
    id: 'satis',
    label: null,
    items: [
      { path: '/depo', label: 'Depo' },
      { path: '/musteri-bazasi', label: 'Müştəri Bazası' },
      { path: '/nagd-satish', label: 'Nağd satış' },
    ],
  },
  {
    id: 'yigim',
    label: null,
    items: [
      { path: '/yigim', label: 'Yığım' },
      { path: '/odenisler', label: 'Ödənişlər' },
      { path: '/borc-nisye', label: 'Borc / Nisyə' },
    ],
  },
  {
    id: 'huquq',
    label: null,
    items: [{ path: '/mehkeme', label: 'Məhkəmə' }],
  },
]

export const placeholders = navSections.flatMap((s) =>
  s.items.map((item) => ({
    ...item,
    section: s.label || s.id,
  }))
)
