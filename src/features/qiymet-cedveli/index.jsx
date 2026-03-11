import { Routes, Route } from 'react-router-dom'
import QiymetCedveli from './QiymetCedveli'
import '../../styles/shared.css'

export default function QiymetCedveliFeature() {
  return (
    <>
      <div className="page-header">
        <h1>Qiymət cədvəli</h1>
      </div>
      <Routes>
        <Route index element={<QiymetCedveli />} />
      </Routes>
    </>
  )
}
