import { Routes, Route } from 'react-router-dom'
import MonthlyTrackingList from './MonthlyTrackingList'
import '../../styles/shared.css'

export default function MonthlyTracking() {
  return (
    <>
      <div className="page-header">
        <h1>Aylıq yığım</h1>
      </div>
      <Routes>
        <Route index element={<MonthlyTrackingList />} />
      </Routes>
    </>
  )
}
