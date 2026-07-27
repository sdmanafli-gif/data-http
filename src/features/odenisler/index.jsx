import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import OdenisList from './OdenisList'
import OdenisForm from './OdenisForm'
import ExcelImport from './ExcelImport'
import { ChangeHistoryPage, MODULE_TABLES } from '../change-history'
import '../../styles/shared.css'

export default function OdenislerFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideHeader =
    location.pathname.includes('/idxal') ||
    location.pathname.includes('/tarixce') ||
    location.pathname.endsWith('/yeni') ||
    (/\/odenisler\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith('/yeni'))

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h1>Ödənişlər</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/odenisler/tarixce')}>
              Tarixçə
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/odenisler/idxal')}>
              Excel idxal
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/odenisler/yeni')}>
              Ödəniş et
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<OdenisList />} />
        <Route path="idxal" element={<ExcelImport />} />
        <Route
          path="tarixce"
          element={
            <ChangeHistoryPage
              tableName={MODULE_TABLES.odenisler}
              title="Ödənişlər"
              backTo="/odenisler"
              recordPath={(id) => `/odenisler/${id}`}
            />
          }
        />
        <Route path="yeni" element={<OdenisForm />} />
        <Route path=":id" element={<OdenisForm />} />
      </Routes>
    </>
  )
}
