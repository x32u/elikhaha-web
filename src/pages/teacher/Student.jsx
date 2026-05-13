import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import './Student.css';
import { getTeacherStudents, getStudentSubmissions, getStudentArtworks } from '../../services/teacherApi';

const Student = () => {
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('submitted');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [allStudents, setAllStudents] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [studentArtworks, setStudentArtworks] = useState([]);

  const formatDate = (value, fallback = 'No due date') => {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentDetails(selectedStudent.id);
    }
  }, [selectedStudent]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
      console.log('Loading students for teacher:', userInfo.id);
      const result = await getTeacherStudents(userInfo.id);
      
      console.log('Students API result:', result);
      
      if (result.success) {
        // Transform student data
        const transformedStudents = result.data.map(student => {
          console.log('Processing student:', student);
          // Get class info from the classes array if available
          const classInfo = student.classes?.[0] || {};
          
          return {
            id: student.id,
            name: student.name || 'Student',
            grade: classInfo.grade || 'N/A',
            section: classInfo.name || 'N/A',
            avatar: student.name?.charAt(0) || 'S',
            completionRate: student.submittedCount > 0 
              ? Math.round((student.submittedCount / (student.submittedCount + student.pendingCount)) * 100) 
              : 0,
            projectsSubmitted: student.submittedCount || 0,
            pendingCount: student.pendingCount || 0,
            lateCount: 0 // TODO: Calculate from submissions
          };
        });
        console.log('Transformed students:', transformedStudents);
        setAllStudents(transformedStudents);
      } else {
        console.error('Failed to load students:', result.error);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetails = async (studentId) => {
    try {
      const [submissionsResult, artworksResult] = await Promise.all([
        getStudentSubmissions(studentId),
        getStudentArtworks(studentId)
      ]);

      console.log('Submissions result:', submissionsResult);
      console.log('Artworks result:', artworksResult);

      if (submissionsResult.success) {
        setStudentSubmissions(submissionsResult.data || []);
      }
      if (artworksResult.success) {
        setStudentArtworks(artworksResult.data || []);
      }
    } catch (error) {
      console.error('Error loading student details:', error);
    }
  };

  // Get unique grades and sections
  const uniqueGrades = ['all', ...new Set(allStudents.map(s => s.grade))];
  const uniqueSections = ['all', ...new Set(allStudents.map(s => s.section))];

  // Filter and search students
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = allStudents.filter(student => {
      const matchesSearch = 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
      const matchesSection = selectedSection === 'all' || student.section === selectedSection;
      
      return matchesSearch && matchesGrade && matchesSection;
    });

    // Sort students
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'completion':
          return b.completionRate - a.completionRate;
        case 'submitted':
          return b.projectsSubmitted - a.projectsSubmitted;
        case 'late':
          return b.lateCount - a.lateCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [allStudents, searchTerm, selectedGrade, selectedSection, sortBy]);

  // Transform submissions data for tabs
  const projects = useMemo(() => {
    const normalizedSubmissions = studentSubmissions.map((item) => ({
      ...item,
      normalizedStatus: String(item.status || '').toLowerCase()
    }));

    const submitted = normalizedSubmissions.filter((s) => ['submitted', 'reviewed', 'late'].includes(s.normalizedStatus));
    const assigned = normalizedSubmissions.filter((s) => s.normalizedStatus === 'assigned');
    const overdue = normalizedSubmissions.filter((s) => s.normalizedStatus === 'overdue');
    const created = studentArtworks;

    return {
      submitted: submitted.map((s) => ({
        id: s.id,
        title: s.activity_title || 'Untitled',
        status: s.normalizedStatus === 'reviewed'
          ? 'Reviewed'
          : s.normalizedStatus === 'late'
            ? 'Late Submitted'
            : 'Submitted',
        dueDate: s.due_date,
        submittedDate: s.submitted_at
      })),
      assigned: assigned.map((s) => ({
        id: s.id,
        title: s.activity_title || 'Untitled',
        status: 'Assigned',
        dueDate: s.due_date,
        submittedDate: null
      })),
      overdue: overdue.map((s) => ({
        id: s.id,
        title: s.activity_title || 'Untitled',
        status: 'Overdue',
        dueDate: s.due_date,
        submittedDate: null
      })),
      created: created.map(a => ({
        id: a.id,
        title: a.title || 'Untitled',
        status: 'Created',
        dueDate: a.created_at,
        createdDate: a.created_at,
        image: '🎨',
        description: a.description || 'Student artwork'
      }))
    };
  }, [studentSubmissions, studentArtworks]);

  const getTabProjects = () => {
    return projects[activeTab] || [];
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Reviewed': return 'status-completed';
      case 'Submitted': return 'status-review';
      case 'Late Submitted': return 'status-overdue';
      case 'Created': return 'status-progress';
      case 'Overdue': return 'status-overdue';
      case 'Assigned': return 'status-assigned';
      default: return 'status-default';
    }
  };

  if (selectedStudent) {
    return (
      <div className="student-page-container">
        <Navbar />
        <main className="student-page">
          {/* Back Button */}
          <button className="back-btn" onClick={() => setSelectedStudent(null)}>
            ← Back to All Students
          </button>

          {/* Student Header */}
          <section className="student-header-section">
            <div className="student-header-content">
              <div className="student-avatar-large">{selectedStudent.avatar}</div>
              <div className="student-info">
                <h1 className="student-name">{selectedStudent.name}</h1>
                <p className="student-grade">{selectedStudent.grade} - Section {selectedStudent.section}</p>
                <p className="student-id">Student ID: {selectedStudent.id}</p>
              </div>
            </div>
          </section>

          {/* Statistics Cards */}
          <section className="student-stats">
            <div className="stat-card">
              <div className="stat-value">
                {projects.submitted.length > 0 
                  ? Math.round((projects.submitted.length / (projects.submitted.length + projects.assigned.length + projects.overdue.length)) * 100) 
                  : 0}%
              </div>
              <div className="stat-label">Completion Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{projects.submitted.length}</div>
              <div className="stat-label">Projects Submitted</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{projects.assigned.length}</div>
              <div className="stat-label">Assigned</div>
            </div>
            <div className="stat-card status-overdue">
              <div className="stat-value">{projects.overdue.length}</div>
              <div className="stat-label">Overdue</div>
            </div>
          </section>

          {/* Projects Section */}
          <section className="projects-section">
            <h2 className="section-title">Projects</h2>
            
            {/* Project Tabs */}
            <div className="project-tabs">
              <button
                className={`tab-btn ${activeTab === 'submitted' ? 'active' : ''}`}
                onClick={() => setActiveTab('submitted')}
              >
                Submitted
              </button>
              <button
                className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
                onClick={() => setActiveTab('assigned')}
              >
                Assigned
              </button>
              <button
                className={`tab-btn ${activeTab === 'overdue' ? 'active' : ''}`}
                onClick={() => setActiveTab('overdue')}
              >
                Overdue
              </button>
              <button
                className={`tab-btn ${activeTab === 'created' ? 'active' : ''}`}
                onClick={() => setActiveTab('created')}
              >
                Created
              </button>
            </div>

            {/* Projects List */}
            <div className="projects-list">
              {activeTab === 'created' ? (
                // Gallery View for Created Projects
                <div className="projects-gallery">
                  {getTabProjects().length === 0 ? (
                    <p className="no-projects">No projects in this category</p>
                  ) : (
                    getTabProjects().map((project) => (
                      <div key={project.id} className="gallery-card">
                        <div className="gallery-image">{project.image}</div>
                        <div className="gallery-info">
                          <h3 className="gallery-title">{project.title}</h3>
                          <p className="gallery-description">{project.description}</p>
                          <div className="gallery-meta">
                            <span className="gallery-due">Created: {formatDate(project.createdDate, 'Unknown date')}</span>
                            <span className={`project-status ${getStatusColor(project.status)}`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // List View for Other Tabs
                <>
                  {getTabProjects().length === 0 ? (
                    <p className="no-projects">No projects in this category</p>
                  ) : (
                    getTabProjects().map((project) => (
                      <div key={project.id} className="project-card">
                        <div className="project-icon">📋</div>
                        <div className="project-content">
                          <h3 className="project-title">{project.title}</h3>
                          <div className="project-meta">
                            <span className="project-due">Due: {formatDate(project.dueDate)}</span>
                            {project.submittedDate && (
                              <span className="project-submitted">Submitted: {formatDate(project.submittedDate, 'Unknown date')}</span>
                            )}
                          </div>
                        </div>
                        <span className={`project-status ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="student-page-container">
      <Navbar />
      <main className="student-page">
        <section className="students-header">
          <h1 className="students-title">My Students</h1>
          <p className="students-subtitle">Manage and track {filteredAndSortedStudents.length} of {allStudents.length} students</p>
        </section>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B5A4D' }}>
            Loading students...
          </div>
        ) : (
          <>
            {/* Search and Filter Section */}
            <section className="search-filter-section">
          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by name or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="filters-container">
            {/* Grade Filter */}
            <div className="filter-group">
              <label className="filter-label">Grade:</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="filter-select"
              >
                {uniqueGrades.map(grade => (
                  <option key={grade} value={grade}>
                    {grade === 'all' ? 'All Grades' : grade}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="filter-group">
              <label className="filter-label">Section:</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="filter-select"
              >
                {uniqueSections.map(section => (
                  <option key={section} value={section}>
                    {section === 'all' ? 'All Sections' : `Section ${section}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div className="filter-group">
              <label className="filter-label">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="name">Name (A-Z)</option>
                <option value="completion">Completion Rate (High to Low)</option>
                <option value="submitted">Projects Submitted (High to Low)</option>
                <option value="late">Late Projects (High to Low)</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || selectedGrade !== 'all' || selectedSection !== 'all' || sortBy !== 'name') && (
              <button
                className="reset-filters-btn"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedGrade('all');
                  setSelectedSection('all');
                  setSortBy('name');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </section>

        {/* Students Grid */}
        <section className="students-grid">
          {filteredAndSortedStudents.length === 0 ? (
            <div className="no-results">
              <p className="no-results-text">No students found matching your criteria</p>
            </div>
          ) : (
            filteredAndSortedStudents.map((student) => (
              <div
                key={student.id}
                className="student-card"
                onClick={() => setSelectedStudent(student)}
              >
                <div className="student-card-avatar">{student.avatar}</div>
                <div className="student-card-header">
                  <h3 className="student-card-name">{student.name}</h3>
                  <p className="student-card-grade">{student.grade}</p>
                  <p className="student-card-section">Section {student.section}</p>
                  <p className="student-card-id">{student.id}</p>
                </div>
                <div className="student-card-stats">
                  <div className="card-stat">
                    <span className="card-stat-value">{student.completionRate}%</span>
                    <span className="card-stat-label">Complete</span>
                  </div>
                  <div className="card-stat">
                    <span className="card-stat-value">{student.projectsSubmitted}</span>
                    <span className="card-stat-label">Submitted</span>
                  </div>
                  <div className="card-stat">
                    <span className="card-stat-value">{student.pendingCount}</span>
                    <span className="card-stat-label">Pending</span>
                  </div>
                  {student.lateCount > 0 && (
                    <div className="card-stat status-alert">
                      <span className="card-stat-value">{student.lateCount}</span>
                      <span className="card-stat-label">Late</span>
                    </div>
                  )}
                </div>
                <button className="view-btn">View Details →</button>
              </div>
            ))
          )}
        </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Student;
