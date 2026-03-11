import { Routes, Route, useNavigate } from 'react-router-dom'
import MusteriList from './MusteriList'
import MusteriAdd from './MusteriAdd'
import '../../styles/shared.css'

export default function MusteriBazasi() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <h1>Müştəri Bazası</h1>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/musteri-bazasi/yeni')}>
          Yeni müştəri
        </button>
      </div>
      <Routes>
        <Route index element={<MusteriList />} />
        <Route path="yeni" element={<MusteriAdd />} />
      </Routes>
    </>
  )
}
