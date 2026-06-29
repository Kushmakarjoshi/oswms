import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Trophy, Users, Calendar, ArrowRight, Bell, Shield, Zap } from 'lucide-react';

function FeatureCard({ icon: Icon, title, description, linkTo, actionText }) {
  return (
    <Link to={linkTo} className="oswms-feature-card text-decoration-none text-dark">
      <div className="oswms-feature-icon">
        <Icon size={22} />
      </div>
      <h3 className="h5 fw-bold mb-2">{title}</h3>
      <p className="text-muted small flex-grow-1 mb-3">{description}</p>
      <span className="text-primary fw-semibold d-inline-flex align-items-center gap-1 small">
        {actionText} <ArrowRight size={16} />
      </span>
    </Link>
  );
}

function Home() {
  return (
    <Layout>
      <section className="oswms-hero">
        <div className="oswms-container oswms-hero-content">
          <span className="oswms-eyebrow" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            NEC Sports Week 2026
          </span>
          <h1>Your campus sports week,<br />beautifully organized</h1>
          <p>
            Digital registration, automated fixtures, live scoring, and role-based dashboards for students, committees, and administrators.
          </p>
          <div className="oswms-hero-actions">
            <Link to="/signup" className="btn btn-light btn-lg">Get started</Link>
            <Link to="/schedule" className="btn btn-outline-light btn-lg">View schedule</Link>
          </div>
        </div>
      </section>

      <section className="oswms-container oswms-page">
        <div className="row g-3 mb-5">
          {[
            { icon: Shield, label: 'Role-based access', desc: 'Admin, committee & student views' },
            { icon: Zap, label: 'Live scores', desc: 'Monotonic updates, no typos' },
            { icon: Trophy, label: 'Smart brackets', desc: 'Knockout + 3rd place playoff' }
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="col-md-4">
              <div className="oswms-card p-3 d-flex align-items-center gap-3 oswms-card-flat">
                <div className="oswms-stat-icon mb-0 flex-shrink-0">
                  <Icon size={20} />
                </div>
                <div>
                  <div className="fw-bold small">{label}</div>
                  <p className="text-muted small mb-0">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-4">
          <span className="oswms-eyebrow">Features</span>
          <h2 className="oswms-page-title h3">Everything you need for Sports Week</h2>
        </div>

        <div className="row g-4 mb-5">
          <div className="col-md-6 col-lg-3">
            <FeatureCard icon={Trophy} title="Games & Events" description="Browse tournaments, rules, and formats." linkTo="/events" actionText="View events" />
          </div>
          <div className="col-md-6 col-lg-3">
            <FeatureCard icon={Calendar} title="Match Schedule" description="Fixtures, venues, and live score sync." linkTo="/schedule" actionText="View schedule" />
          </div>
          <div className="col-md-6 col-lg-3">
            <FeatureCard icon={Users} title="Teams" description="Create a team or request to join as a player." linkTo="/teams" actionText="Teams hub" />
          </div>
          <div className="col-md-6 col-lg-3">
            <FeatureCard icon={Bell} title="Complaints" description="Report issues privately to Major Admin." linkTo="/complaints" actionText="Submit complaint" />
          </div>
        </div>

        <div className="oswms-card overflow-hidden">
          <div id="sportsCarousel" className="carousel slide" data-bs-ride="carousel">
            <div className="carousel-inner">
              <div className="carousel-item active">
                <img
                  src="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1400&q=80"
                  className="d-block w-100"
                  style={{ maxHeight: '400px', objectFit: 'cover' }}
                  alt="Sports action"
                />
              </div>
              <div className="carousel-item">
                <img
                  src="https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=1400&q=80"
                  className="d-block w-100"
                  style={{ maxHeight: '400px', objectFit: 'cover' }}
                  alt="Team sports"
                />
              </div>
            </div>
            <button className="carousel-control-prev" type="button" data-bs-target="#sportsCarousel" data-bs-slide="prev">
              <span className="carousel-control-prev-icon" />
            </button>
            <button className="carousel-control-next" type="button" data-bs-target="#sportsCarousel" data-bs-slide="next">
              <span className="carousel-control-next-icon" />
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default Home;
