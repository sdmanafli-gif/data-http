import { Routes, Route, useNavigate } from 'react-router-dom'
import MehsulBazasiList from './MehsulBazasiList'
import MehsulBazasiAdd from './MehsulBazasiAdd'
import MehsulBazasiEdit from './MehsulBazasiEdit'
import '../../styles/shared.css'

export default function MehsulBazasi() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <h1>Məhsul Bazası</h1>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/mehsul-bazasi/yeni')}>
          Yeni məhsul
        </button>
      </div>
      <Routes>
        <Route index element={<MehsulBazasiList />} />
        <Route path="yeni" element={<MehsulBazasiAdd />} />
        <Route path=":id/redakte" element={<MehsulBazasiEdit />} />
      </Routes>
    </>
  )
}
