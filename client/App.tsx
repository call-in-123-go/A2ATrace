// import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.scss'
import Dashboard from './pages/dashboard/dashboard'

function App() {

  return (
   <Router>
    <div className='body-wrapper'>
    <Routes>
      <Route path="/" element={<Dashboard />}/>
    </Routes>
    </div>
   </Router>
  )
}

export default App
