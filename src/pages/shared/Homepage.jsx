import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import ProfileSection from '../../components/ProfileSection';
import ArtworkCarousel from '../../components/ArtworkCarousel';
import ActivityCard from '../../components/ActivityCard';
import Navbar from '../../components/Navbar';
import { getStudentPendingActivities, getStudentArtworks, getStudentDashboardStats, getStudentActivities } from '../../services/studentApi';
import './Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'Student', grade: 1 });
  const [artworks, setArtworks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userInfo = sessionStorage.getItem('userInfo');
    if (userInfo) {
      const parsedUser = JSON.parse(userInfo);
      setUser({
        id: parsedUser.id,
        name: parsedUser.name || 'Student',
        grade: parsedUser.grade || 1
      });
      loadStudentData(parsedUser.id);
    }
  }, []);

  const loadStudentData = async (studentId) => {
    setLoading(true);
    try {
      const [activitiesResult, artworksResult, statsResult, allActivitiesResult] = await Promise.all([
        getStudentPendingActivities(studentId),
        getStudentArtworks(studentId),
        getStudentDashboardStats(studentId),
        getStudentActivities(studentId)
      ]);

      if (activitiesResult.success) {
        const formattedActivities = activitiesResult.data.map((a, index) => ({
          id: a.id,
          label: `Activity ${index + 1}`,
          title: a.title,
          description: a.description || 'Complete this activity',
          arInstructions: a.ar_instructions || '',
          image: a.image_url,
          dueDate: a.due_date,
          allowedObjectIds: a.allowed_object_ids || [],
          modelId: a.model_id || undefined,
          modelUrl: a.model_url || undefined,
          modelFileType: a.model_file_type || undefined,
          modelConfigs: a.model_configs || [],
          puzzlePieces: a.puzzle_pieces || 0,
        }));
        setActivities(formattedActivities);
      }

      const completedFromActivities = allActivitiesResult.success
        ? (allActivitiesResult.data || [])
          .filter((a) => ['submitted', 'reviewed'].includes(String(a.status || '').toLowerCase()))
          .map((a) => ({
            id: `activity-${a.id}`,
            title: a.title || 'Artwork',
            arInstructions: a.ar_instructions || '',
            image: a.image_url || null,
            activityId: a.id,
            paintState: a.paint_state || [],
            sceneState: a.scene_state || [],
            puzzleState: a.puzzle_state || [],
            allowedObjectIds: a.allowed_object_ids || [],
            modelUrl: a.model_url || undefined,
            modelFileType: a.model_file_type || undefined,
            modelConfigs: a.model_configs || [],
            puzzlePieces: a.puzzle_pieces || 0,
          }))
        : [];

      if (artworksResult.success) {
        const formattedArtworks = (artworksResult.data || []).map(a => ({
          id: a.id,
          title: a.title || 'Artwork',
          arInstructions: a.ar_instructions || '',
          image: a.image_url,
          activityId: a.activity_id,
          paintState: a.paint_state || [],
          sceneState: a.scene_state || [],
          puzzleState: a.puzzle_state || [],
          allowedObjectIds: a.allowed_object_ids || [],
          modelUrl: a.model_url || undefined,
          modelFileType: a.model_file_type || undefined,
          modelConfigs: a.model_configs || [],
          puzzlePieces: a.puzzle_pieces || 0,
        }));
        if (formattedArtworks.length > 0) {
          setArtworks(formattedArtworks);
        } else if (completedFromActivities.length > 0) {
          setArtworks(completedFromActivities);
        } else {
          setArtworks([{ id: 1, title: 'No artworks yet', image: null }]);
        }
      } else if (completedFromActivities.length > 0) {
        setArtworks(completedFromActivities);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivityClick = (activity) => {
    navigate(`/activity/${activity.id}/start`, {
      state: {
        allowedObjectIds: activity.allowedObjectIds || [],
        modelUrl: activity.modelUrl || undefined,
        modelFileType: activity.modelFileType || undefined,
        modelConfigs: activity.modelConfigs || [],
        arInstructions: activity.arInstructions || '',
        puzzlePieces: activity.puzzlePieces || 0,
      },
    });
  };

  const handleArtworkClick = (artwork) => {
    if (!artwork?.activityId) {
      navigate('/profile');
      return;
    }

    navigate(`/activity/${artwork.activityId}/start`, {
      state: {
        mode: 'view',
        artworkUrl: artwork.image,
        paintState: artwork.paintState || [],
        sceneState: artwork.sceneState || [],
        puzzleState: artwork.puzzleState || [],
        allowedObjectIds: artwork.allowedObjectIds || [],
        modelUrl: artwork.modelUrl || undefined,
        modelFileType: artwork.modelFileType || undefined,
        modelConfigs: artwork.modelConfigs || [],
        arInstructions: artwork.arInstructions || '',
        puzzlePieces: artwork.puzzlePieces || 0,
      },
    });
  };

  return (
    <div className="homepage-container">
      <div className="homepage-wrapper">
        <Header />
        
        <main className="main-content">
          {/* Left Sidebar - F Pattern Vertical */}
          <aside className="sidebar">
            <ProfileSection userName={user.name} grade={user.grade} />
            <ArtworkCarousel artworks={artworks} onArtworkClick={handleArtworkClick} />
          </aside>

          {/* Main Content - F Pattern Horizontal */}
          <div className="content-area">
            <section className="activities-section">
              <h2 className="section-title">Pending Activities</h2>
              <div className="activities-container">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onClick={handleActivityClick}
                  />
                ))}
              </div>
            </section>
          </div>
        </main>
        
        <Navbar />
      </div>
    </div>
  );
};

export default Homepage;
