import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layout/Layout'
import { placeholders } from './config/nav'
import MehsulBazasi from './features/mehsul-bazasi'
import TechizatciBazasi from './features/techizatci-bazasi'
import Inventar from './features/inventar'
import MusteriBazasi from './features/musteri-bazasi'
import Icloud from './features/icloud'
import MonthlyTracking from './features/monthly-tracking'
import QiymetCedveliFeature from './features/qiymet-cedveli'
import BazaraBorc from './features/bazara-borc'
import TelefonNomreleri from './features/telefon-nomreleri'

function App() {
  return (
    <Layout>
      <Routes>
        {placeholders
          .filter(({ path }) => !['/mehsul-bazasi', '/techizatci-bazasi', '/inventar', '/musteri-bazasi', '/icloud', '/ayliq-yigim', '/qiymet-cedveli', '/bazara-borc', '/telefon-nomreleri'].includes(path))
          .map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        <Route path="/mehsul-bazasi/*" element={<MehsulBazasi />} />
        <Route path="/techizatci-bazasi/*" element={<TechizatciBazasi />} />
        <Route path="/inventar/*" element={<Inventar />} />
        <Route path="/musteri-bazasi/*" element={<MusteriBazasi />} />
        <Route path="/icloud/*" element={<Icloud />} />
        <Route path="/ayliq-yigim/*" element={<MonthlyTracking />} />
        <Route path="/qiymet-cedveli/*" element={<QiymetCedveliFeature />} />
        <Route path="/bazara-borc/*" element={<BazaraBorc />} />
        <Route path="/telefon-nomreleri/*" element={<TelefonNomreleri />} />
        <Route path="/" element={<Navigate to={placeholders[0].path} replace />} />
        <Route path="*" element={<Navigate to={placeholders[0].path} replace />} />
      </Routes>
    </Layout>
  )
}

export default App
