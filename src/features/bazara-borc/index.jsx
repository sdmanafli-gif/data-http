import { Routes, Route } from 'react-router-dom'
import BazaraBorcList from './BazaraBorcList'
import '../../styles/shared.css'

export default function BazaraBorc() {
  return (
    <>
      <div className="page-header">
        <h1>Bazara borc</h1>
      </div>
      <Routes>
        <Route index element={<BazaraBorcList />} />
      </Routes>
    </>
  )
}
