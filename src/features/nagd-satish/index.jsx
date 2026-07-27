import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import NagdList from './NagdList'
import NagdForm from './NagdForm'
import ColumnManager from './ColumnManager'
import ExcelImport from './ExcelImport'
import { ChangeHistoryPage, MODULE_TABLES } from '../change-history'
import '../../styles/shared.css'

export default function NagdSatishFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideHeader =
    location.pathname.includes('/sutunlar') ||
    location.pathname.includes('/idxal') ||
    location.pathname.includes('/tarixce') ||
    (/\/nagd-satish\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/yeni'))

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h1>Nağd satış</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/nagd-satish/tarixce')}>
              Tarixçə
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/nagd-satish/idxal')}>
              Excel idxal
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/nagd-satish/yeni')}>
              Yeni qeyd
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<NagdList />} />
        <Route path="sutunlar" element={<ColumnManager />} />
        <Route path="idxal" element={<ExcelImport />} />
        <Route
          path="tarixce"
          element={
            <ChangeHistoryPage
              tableName={MODULE_TABLES.nagd}
              title="Nağd satış"
              backTo="/nagd-satish"
              recordPath={(id) => `/nagd-satish/${id}`}
            />
          }
        />
        <Route path="yeni" element={<NagdForm />} />
        <Route path=":id" element={<NagdForm />} />
      </Routes>
    </>
  )
}
