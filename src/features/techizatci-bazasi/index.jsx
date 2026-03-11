import { Routes, Route, useNavigate } from 'react-router-dom'
import TechizatciList from './TechizatciList'
import TechizatciAdd from './TechizatciAdd'
import TechizatciEdit from './TechizatciEdit'
import '../../styles/shared.css'

export default function TechizatciBazasi() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <h1>Təchizatçı Bazası</h1>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/techizatci-bazasi/yeni')}>
          Yeni təchizatçı
        </button>
      </div>
      <Routes>
        <Route index element={<TechizatciList />} />
        <Route path="yeni" element={<TechizatciAdd />} />
        <Route path=":id/redakte" element={<TechizatciEdit />} />
      </Routes>
    </>
  )
}
