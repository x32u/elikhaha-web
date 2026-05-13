import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import logo from '../../assets/images/elikhalogo.png';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="logo-large">
          <img src={logo} alt="Elikha Logo" className="logo-image" />
        </div>
        <h1 className="hero-title">e-Likha</h1>
        <p className="hero-subtitle">AR-Powered Arts & Crafts Simulator</p>
        <p className="hero-description">
          Immerse yourself in Filipino culture through interactive art and craft experiences
        </p>
        <button onClick={() => navigate('/login')} className="cta-button">
          Get Started
        </button>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="container">
          <h2 className="section-title">Why Choose e-Likha?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Interactive Learning</h3>
              <p>Engage with hands-on art activities that bring Filipino culture to life</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>AR Technology</h3>
              <p>Experience augmented reality that makes learning more immersive and fun</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏆</div>
              <h3>Track Progress</h3>
              <p>Monitor your artistic journey and achievements as you create</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Cultural Heritage</h3>
              <p>Learn about traditional Filipino arts and crafts in a modern way</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section" id="about">
        <div className="container">
          <h2 className="section-title">About e-Likha</h2>
          <p className="about-text">
            e-Likha is an innovative educational platform that combines traditional Filipino arts and crafts 
            with cutting-edge AR technology. Our mission is to preserve and promote Filipino cultural heritage 
            through interactive and engaging learning experiences for students of all ages.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>e-Likha</h3>
              <p>Empowering creativity through technology</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <a href="#features">Features</a>
              <a href="#about">About</a>
              <button onClick={() => navigate('/login')}>Login</button>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>info@elikha.com</p>
              <p>© 2026 e-Likha. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
