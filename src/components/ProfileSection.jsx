import React from 'react';
import './ProfileSection.css';
// Import profile image: import profileImg from '../assets/images/profile.png';

const ProfileSection = ({ userName, grade }) => {
  return (
    <section className="profile-section">
      <div className="profile-image">
        {/* <img src={profileImg} alt="Profile" /> */}
        <div className="profile-placeholder">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="profile-info">
        <h1 className="profile-greeting">hi, {userName}!</h1>
        <p className="profile-grade">Grade {grade}</p>
      </div>
    </section>
  );
};

export default ProfileSection;
