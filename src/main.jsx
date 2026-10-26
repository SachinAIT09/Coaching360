import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles/app.css';
import { AppProvider, useApp, HOME } from './state/AppContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import ReviewQueue from './pages/ReviewQueue';
import AgentPerformance from './pages/AgentPerformance';
import AgentRoster from './pages/AgentRoster';
import CallGrading from './pages/CallGrading';
import Coaching from './pages/Coaching';
import CoachingWorkspace from './pages/CoachingWorkspace';
import GoalsProgress from './pages/GoalsProgress';
import Reports from './pages/Reports';
import CallLibrary from './pages/CallLibrary';
import TeamAnalytics from './pages/TeamAnalytics';
import QaTemplateSettings from './pages/QaTemplateSettings';
import Login from './pages/Login';

// Everything except the sign-in page needs a signed-in account; after signing in the user returns where they were
function RequireAuth({ children }) {
  const { state } = useApp();
  const location = useLocation();
  return state.user ? children : <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
}

// Pages are only reachable in the role they belong to; anything else goes to that role's home
function Only({ role, children }) {
  const { state } = useApp();
  return state.role === role ? children : <Navigate to={HOME[state.role]} replace />;
}

function RoleHome() {
  const { state } = useApp();
  return <Navigate to={HOME[state.role]} replace />;
}

const sup = (el) => <Only role="supervisor">{el}</Only>;
const agt = (el) => <Only role="agent">{el}</Only>;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<RoleHome />} />
            <Route path="/home" element={sup(<Home />)} />
            <Route path="/queue" element={sup(<ReviewQueue />)} />
            <Route path="/performance" element={sup(<AgentRoster />)} />
            <Route path="/performance/:agentId" element={sup(<AgentPerformance />)} />
            <Route path="/grading" element={sup(<AgentRoster base="/grading" title="Call Grading" description="Pick an agent to review and grade their calls. Flagged calls and open alerts show what needs a human first." />)} />
            <Route path="/grading/:agentId" element={sup(<CallGrading />)} />
            <Route path="/coaching" element={sup(<Coaching />)} />
            <Route path="/coaching/workspace" element={sup(<CoachingWorkspace />)} />
            <Route path="/goals" element={sup(<GoalsProgress />)} />
            <Route path="/reports" element={sup(<Reports />)} />
            <Route path="/library" element={sup(<CallLibrary />)} />
            <Route path="/analytics" element={sup(<TeamAnalytics />)} />
            <Route path="/settings" element={sup(<QaTemplateSettings />)} />
            <Route path="/me" element={agt(<AgentPerformance mine />)} />
            <Route path="/me/calls" element={agt(<CallLibrary mine />)} />
            <Route path="/me/coaching" element={agt(<Coaching mine />)} />
            <Route path="/me/goals" element={agt(<GoalsProgress mine />)} />
            <Route path="*" element={<RoleHome />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  </StrictMode>,
);
