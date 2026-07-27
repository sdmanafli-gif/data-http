import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import MusteriList from './MusteriList'
import MusteriForm from './MusteriForm'
import ColumnManager from './ColumnManager'
import ExcelImport from './ExcelImport'
import GeriQaytarmaPage from './GeriQaytarmaPage'
import { ChangeHistoryPage, MODULE_TABLES } from '../change-history'
import '../../styles/shared.css'

export default function MusteriBazasi() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideHeader =
    location.pathname.includes('/sutunlar') ||
    location.pathname.includes('/idxal') ||
    location.pathname.includes('/tarixce') ||
    location.pathname.includes('/geri-qaytarma') ||
    (/\/musteri-bazasi\/[^/]+$/.test(location.pathname) &&
      !location.pathname.endsWith('/yeni'))

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h1>Müştəri Bazası</h1>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/musteri-bazasi/tarixce')}>
              Tarixçə
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/musteri-bazasi/idxal')}>
              Excel idxal
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/musteri-bazasi/yeni')}>
              Yeni qeyd
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<MusteriList />} />
        <Route path="sutunlar" element={<ColumnManager />} />
        <Route path="idxal" element={<ExcelImport />} />
        <Route
          path="tarixce"
          element={
            <ChangeHistoryPage
              tableName={MODULE_TABLES.musteri}
              title="Müştəri Bazası"
              backTo="/musteri-bazasi"
              recordPath={(id) => `/musteri-bazasi/${id}`}
            />
          }
        />
        <Route path="yeni" element={<MusteriForm />} />
        <Route path=":id/geri-qaytarma" element={<GeriQaytarmaPage />} />
        <Route path=":id" element={<MusteriForm />} />
      </Routes>
    </>
  )
}
