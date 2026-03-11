import { Routes, Route, useNavigate } from 'react-router-dom'
import InventarList from './InventarList'
import InventarDetail from './InventarDetail'
import InventarAdd from './InventarAdd'
import InventarEdit from './InventarEdit'
import SatishFlow from './SatishFlow'
import '../../styles/shared.css'

export default function Inventar() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <h1>İnventar</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/inventar/satish')}>
            Satış et
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/inventar/yeni')}>
            İnventara əlavə et
          </button>
        </div>
      </div>
      <Routes>
        <Route index element={<InventarList />} />
        <Route path="satish" element={<SatishFlow />} />
        <Route path="yeni" element={<InventarAdd />} />
        <Route path=":id" element={<InventarDetail />} />
        <Route path=":id/redakte" element={<InventarEdit />} />
      </Routes>
    </>
  )
}
