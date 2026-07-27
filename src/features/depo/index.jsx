import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import DepoList from './DepoList'
import DepoForm from './DepoForm'
import ColumnManager from './ColumnManager'
import ExcelImport from './ExcelImport'
import SaleFlow from './SaleFlow'
import { ChangeHistoryPage, MODULE_TABLES } from '../change-history'
import '../../styles/shared.css'

export default function DepoFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideHeader =
    location.pathname.includes('/sutunlar') ||
    location.pathname.includes('/idxal') ||
    location.pathname.includes('/satish') ||
    location.pathname.includes('/tarixce') ||
    (/\/depo\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/yeni'))

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h1>Depo</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/depo/tarixce')}>
              Tarixçə
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/depo/idxal')}>
              Excel idxal
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/depo/yeni')}>
              Yeni qeyd
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<DepoList />} />
        <Route path="sutunlar" element={<ColumnManager />} />
        <Route path="idxal" element={<ExcelImport />} />
        <Route
          path="tarixce"
          element={
            <ChangeHistoryPage
              tableName={MODULE_TABLES.depo}
              title="Depo"
              backTo="/depo"
              recordPath={(id) => `/depo/${id}`}
            />
          }
        />
        <Route path="yeni" element={<DepoForm />} />
        <Route path="satish" element={<SaleFlow />} />
        <Route path=":id/satish" element={<SaleFlow />} />
        <Route path=":id" element={<DepoForm />} />
      </Routes>
    </>
  )
}
