import { Routes, Route } from 'react-router-dom'
import IcloudList from './IcloudList'
import '../../styles/shared.css'

export default function Icloud() {
  return (
    <>
      <div className="page-header">
        <h1>iCloud qeydiyyatı</h1>
      </div>
      <Routes>
        <Route index element={<IcloudList />} />
      </Routes>
    </>
  )
}
