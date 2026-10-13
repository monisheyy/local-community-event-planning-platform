import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { Empty, RequireAuth } from './components/Common.jsx';
import Home from './pages/Home.jsx';
import EventDetail from './pages/EventDetail.jsx';
import EventForm from './pages/EventForm.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/events/new" element={<RequireAuth roles={['organizer', 'admin']}><EventForm /></RequireAuth>} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/edit" element={<RequireAuth roles={['organizer', 'admin']}><EventForm /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
          <Route
            path="*"
            element={
              <div className="page narrow">
                <Empty title="Page not found" action={<Link className="btn btn-primary" to="/">Go to events</Link>}>
                  The link may be broken or the page may have moved.
                </Empty>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Gather, a local community event planning platform.</span>
          <span className="muted">Built with React and Microsoft Azure.</span>
        </div>
      </footer>
    </>
  );
}
