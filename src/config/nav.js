/**
 * Navigation structure — all labels in Azerbaijani.
 * Each item has: path, label, section (for grouping in sidebar).
 */
import MusteriBazasi from '../views/placeholders/MusteriBazasi'
import TechizatciBazasi from '../views/placeholders/TechizatciBazasi'
import MehsulBazasi from '../views/placeholders/MehsulBazasi'
import Inventar from '../views/placeholders/Inventar'
import KreditSatisi from '../views/placeholders/KreditSatisi'
import Icloud from '../features/icloud'
import MonthlyTracking from '../features/monthly-tracking'
import BazaraBorc from '../features/bazara-borc'
import TelefonNomreleri from '../features/telefon-nomreleri'
import NiseSatisi from '../views/placeholders/NiseSatisi'
import NagdSatisi from '../views/placeholders/NagdSatisi'
import KreditOdenisi from '../views/placeholders/KreditOdenisi'
import NagdOdenisi from '../views/placeholders/NagdOdenisi'
import NiseOdenisi from '../views/placeholders/NiseOdenisi'

export const navSections = [
  {
    id: 'bazalar',
    label: 'Bazalar',
    items: [
      { path: '/mehsul-bazasi', label: 'Məhsul Bazası' },
      { path: '/musteri-bazasi', label: 'Müştəri Bazası' },
      { path: '/techizatci-bazasi', label: 'Təchizatçı Bazası' },
    ],
  },
  {
    id: 'satis',
    label: 'Satış',
    items: [
      { path: '/inventar', label: 'İnventar' },
      { path: '/kredit-satisi', label: 'Kredit Satışı' },
      { path: '/nise-satisi', label: 'Nisə Satışı' },
      { path: '/nagd-satisi', label: 'Nağd Satışı' },
    ],
  },
  {
    id: 'odenisler',
    label: 'Ödənişlər',
    items: [
      { path: '/kredit-odenisi', label: 'Kredit ödənişi' },
      { path: '/nise-odenisi', label: 'Nisə ödənişi' },
      { path: '/nagd-odenisi', label: 'Nağd ödənişi' },
    ],
  },
  {
    id: 'daxili',
    label: 'Daxili məlumatlar',
    items: [
      { path: '/ayliq-yigim', label: 'Aylıq yığım' },
      { path: '/icloud', label: 'iCloud qeydiyyatı' },
      { path: '/bazara-borc', label: 'Bazara borc' },
      { path: '/telefon-nomreleri', label: 'Telefon nömrələri' },
    ],
  },
]

const componentByPath = {
  '/musteri-bazasi': MusteriBazasi,
  '/techizatci-bazasi': TechizatciBazasi,
  '/mehsul-bazasi': MehsulBazasi,
  '/inventar': Inventar,
  '/kredit-satisi': KreditSatisi,
  '/icloud': Icloud,
  '/ayliq-yigim': MonthlyTracking,
  '/bazara-borc': BazaraBorc,
  '/telefon-nomreleri': TelefonNomreleri,
  '/nise-satisi': NiseSatisi,
  '/nagd-satisi': NagdSatisi,
  '/kredit-odenisi': KreditOdenisi,
  '/nagd-odenisi': NagdOdenisi,
  '/nise-odenisi': NiseOdenisi,
}

export const placeholders = navSections.flatMap((s) =>
  s.items.map((item) => ({
    ...item,
    section: s.label,
    Component: componentByPath[item.path],
  }))
)
