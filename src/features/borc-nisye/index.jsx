import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import OverviewPage from './OverviewPage'
import CounterpartDetail from './CounterpartDetail'
import LedgerForm from './LedgerForm'
import ExcelImport from './ExcelImport'
import DueCalendarPage from './DueCalendarPage'
import { ChangeHistoryPage, MODULE_TABLES } from '../change-history'
import '../../styles/shared.css'

export default function BorcNisyeFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideHeader =
    location.pathname.includes('/taraf/') ||
    location.pathname.includes('/qeyd/') ||
    location.pathname.includes('/idxal') ||
    location.pathname.includes('/tarixce') ||
    location.pathname.includes('/kalendar') ||
    location.pathname.endsWith('/yeni')

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h1>Borc / Nisyə</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/borc-nisye/kalendar')}>
              Kalendar
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/borc-nisye/tarixce')}>
              Tarixçə
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/borc-nisye/idxal')}>
              Excel idxal
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/borc-nisye/yeni')}>
              Yeni əməliyyat
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="kalendar" element={<DueCalendarPage />} />
        <Route path="idxal" element={<ExcelImport />} />
        <Route
          path="tarixce"
          element={
            <ChangeHistoryPage
              tableName={MODULE_TABLES.borcNisye}
              title="Borc / Nisyə"
              backTo="/borc-nisye"
              recordPath={(id) => `/borc-nisye/qeyd/${id}`}
            />
          }
        />
        <Route path="yeni" element={<LedgerForm />} />
        <Route path="taraf/:kime" element={<CounterpartDetail />} />
        <Route path="qeyd/:id" element={<LedgerForm />} />
      </Routes>
    </>
  )
}
