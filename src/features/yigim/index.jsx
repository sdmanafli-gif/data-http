import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import YigimPage from './YigimPage'
import ColumnManager from './ColumnManager'
import '../../styles/shared.css'

export default function YigimFeature() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideHeader = location.pathname.includes('/sutunlar')

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <div>
            <h1>Yığım</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Ödəniş qrafikinə görə toplanmalı məbləğlər
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate('/yigim/sutunlar')}
            >
              Sütunlar
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route index element={<YigimPage />} />
        <Route path="sutunlar" element={<ColumnManager />} />
      </Routes>
    </>
  )
}
