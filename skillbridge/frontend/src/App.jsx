import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell.jsx'
import { Loader } from './components/UI.jsx'
import { HOME, useAuth } from './lib/auth.jsx'
import SignIn, { SignUp } from './pages/SignIn.jsx'

import StudentOverview from './pages/student/Overview.jsx'
import StudentUpload from './pages/student/Upload.jsx'
import StudentGraph from './pages/student/Graph.jsx'
import StudentGaps from './pages/student/Gaps.jsx'
import StudentRoadmap from './pages/student/Roadmap.jsx'
import StudentOpportunities from './pages/student/Opportunities.jsx'
import StudentPassport from './pages/student/Passport.jsx'
import StudentAssistant from './pages/student/Assistant.jsx'

import InstituteOverview from './pages/institute/Overview.jsx'
import InstituteStudents from './pages/institute/Students.jsx'
import InstituteTraining from './pages/institute/Training.jsx'

import IndustryOverview from './pages/industry/Overview.jsx'
import IndustryDiscover from './pages/industry/Discover.jsx'
import IndustryOpportunities from './pages/industry/Opportunities.jsx'

import AdminOverview from './pages/admin/Overview.jsx'
import AdminManage from './pages/admin/Manage.jsx'

function Guard({ role, children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader label="Checking your session" />
  if (!user) return <Navigate to="/signin" replace />
  if (role && user.role !== role) return <Navigate to={HOME[user.role]} replace />
  return <Shell>{children}</Shell>
}

function Landing() {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return <Navigate to={user ? HOME[user.role] : '/signin'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      <Route path="/student" element={<Guard role="student"><StudentOverview /></Guard>} />
      <Route path="/student/upload" element={<Guard role="student"><StudentUpload /></Guard>} />
      <Route path="/student/graph" element={<Guard role="student"><StudentGraph /></Guard>} />
      <Route path="/student/gaps" element={<Guard role="student"><StudentGaps /></Guard>} />
      <Route path="/student/roadmap" element={<Guard role="student"><StudentRoadmap /></Guard>} />
      <Route path="/student/opportunities" element={<Guard role="student"><StudentOpportunities /></Guard>} />
      <Route path="/student/passport" element={<Guard role="student"><StudentPassport /></Guard>} />
      <Route path="/student/assistant" element={<Guard role="student"><StudentAssistant /></Guard>} />

      <Route path="/institute" element={<Guard role="institute"><InstituteOverview /></Guard>} />
      <Route path="/institute/students" element={<Guard role="institute"><InstituteStudents /></Guard>} />
      <Route path="/institute/training" element={<Guard role="institute"><InstituteTraining /></Guard>} />

      <Route path="/industry" element={<Guard role="industry"><IndustryOverview /></Guard>} />
      <Route path="/industry/discover" element={<Guard role="industry"><IndustryDiscover /></Guard>} />
      <Route path="/industry/opportunities" element={<Guard role="industry"><IndustryOpportunities /></Guard>} />

      <Route path="/admin" element={<Guard role="admin"><AdminOverview /></Guard>} />
      <Route path="/admin/manage" element={<Guard role="admin"><AdminManage /></Guard>} />

      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
