import { Routes, Route } from 'react-router'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Monitor from './pages/Monitor'
import Analytics from './pages/Analytics'
import Heatmap from './pages/Heatmap'
import Recommendations from './pages/Recommendations'
import Workers from './pages/Workers'
import Scan from './pages/Scan'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/heatmap" element={<Heatmap />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/scan" element={<Scan />} />
      </Routes>
    </Layout>
  )
}
