import { Routes, Route } from 'react-router-dom'
import TelefonNomreleriList from './TelefonNomreleriList'
import '../../styles/shared.css'

export default function TelefonNomreleri() {
  return (
    <>
      <div className="page-header">
        <h1>Telefon nömrələri</h1>
      </div>
      <Routes>
        <Route index element={<TelefonNomreleriList />} />
      </Routes>
    </>
  )
}
