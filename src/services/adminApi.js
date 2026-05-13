import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { encodeActivityDescription, parseActivityDescription } from '../utils/activityArConfig';

const toIso = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};

const startOfDayIsoDaysAgo = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Math.max(0, Number(days) || 0));
  return date.toISOString();
};

const toRoleLabel = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return 'Unknown';
  if (value === 'superadmin') return 'Super Admin';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

const normalizeSubmissionStatus = (submission) => {
  if (submission?.reviewed_at) return 'Reviewed';

  const raw = String(submission?.status || '').trim().toLowerCase();
  if (raw === 'rejected') return 'Rejected';
  if (raw === 'graded') return 'Reviewed';
  if (raw === 'submitted') return 'Pending Review';
  return raw ? toRoleLabel(raw) : 'Pending Review';
};

const safeDivide = (numerator, denominator) => {
  if (!denominator) return 0;
  return numerator / denominator;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const ALLOWED_PLATFORM_ROLES = new Set(['student', 'teacher', 'admin', 'superadmin']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeAuthCreateError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').trim();
  const lowerMessage = message.toLowerCase();

  if (code === 'over_email_send_rate_limit') {
    return 'Signup email rate limit reached. Try again later or increase Supabase Auth email rate limit.';
  }

  if (code === 'validation_failed' && lowerMessage.includes('email')) {
    return 'Email format is invalid. Use a valid email like name@example.com.';
  }

  if (code === 'user_already_exists' || lowerMessage.includes('already registered')) {
    return 'Email is already registered.';
  }

  if (lowerMessage.includes('email address') && lowerMessage.includes('invalid')) {
    return 'Email format is invalid. Use a valid email like name@example.com.';
  }

  return message || 'Failed to create user account.';
};

const getWeekKey = (value) => {
  const date = parseDateSafe(value);
  if (!date) return null;
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
};

const buildRecentWeekLabels = (count = 6) => {
  const labels = [];
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - diffToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(currentMonday);
    date.setDate(currentMonday.getDate() - i * 7);
    labels.push(date.toISOString().slice(0, 10));
  }

  return labels;
};

const createIsolatedAuthClient = () => {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `elikha-admin-create-user-${Date.now()}`,
    },
  });
};

export const fetchAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = (data || []).map((user) => ({
      ...user,
      role_label: toRoleLabel(user.role),
      status: 'Active',
      status_label: 'Active',
    }));

    return { success: true, data: users };
  } catch (error) {
    console.error('Error fetching all users:', error);
    return { success: false, error: error.message };
  }
};

export const updatePlatformUser = async (userId, updates) => {
  try {
    const payload = {};

    if (typeof updates.name === 'string') payload.name = updates.name.trim();
    if (typeof updates.email === 'string') payload.email = updates.email.trim().toLowerCase();
    if (typeof updates.role === 'string') payload.role = updates.role.trim().toLowerCase();

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        ...data,
        role_label: toRoleLabel(data.role),
        status: 'Active',
        status_label: 'Active',
      },
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
};

export const createPlatformUser = async ({ name, email, password, role }) => {
  try {
    const safeName = String(name || '').trim();
    const safeEmail = String(email || '').trim().toLowerCase();
    const safePassword = String(password || '');
    const safeRole = String(role || '').trim().toLowerCase();

    if (!safeName || !safeEmail || !safePassword || !safeRole) {
      return { success: false, error: 'Name, email, password, and role are required.' };
    }

    if (!EMAIL_PATTERN.test(safeEmail)) {
      return { success: false, error: 'Email format is invalid. Use a valid email like name@example.com.' };
    }

    if (!ALLOWED_PLATFORM_ROLES.has(safeRole)) {
      return { success: false, error: 'Invalid user role.' };
    }

    if (safePassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    const authClient = createIsolatedAuthClient();
    const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
      email: safeEmail,
      password: safePassword,
      options: {
        data: {
          name: safeName,
          role: safeRole,
        },
      },
    });

    if (signUpError) {
      return { success: false, error: normalizeAuthCreateError(signUpError) };
    }
    const authUserId = signUpData?.user?.id;

    if (!authUserId) {
      return { success: false, error: 'User account was not created.' };
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        [
          {
            id: authUserId,
            name: safeName,
            email: safeEmail,
            role: safeRole,
          },
        ],
        { onConflict: 'id' }
      )
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        ...data,
        role_label: toRoleLabel(data.role),
        status: 'Active',
        status_label: 'Active',
      },
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
};

export const fetchClassDirectory = async () => {
  try {
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, name, grade, section, subject, teacher_id, created_at')
      .order('name', { ascending: true });

    if (classError) throw classError;

    const teacherIds = [...new Set((classes || []).map((row) => row.teacher_id).filter(Boolean))];

    let teacherMap = new Map();
    if (teacherIds.length > 0) {
      const { data: teachers, error: teacherError } = await supabase
        .from('teachers')
        .select('id, user_id, name')
        .in('id', teacherIds);

      if (teacherError) throw teacherError;

      const userIds = [...new Set((teachers || []).map((row) => row.user_id).filter(Boolean))];
      let userMap = new Map();

      if (userIds.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);

        if (userError) throw userError;
        userMap = new Map((users || []).map((user) => [user.id, user]));
      }

      teacherMap = new Map(
        (teachers || []).map((teacher) => {
          const linkedUser = teacher.user_id ? userMap.get(teacher.user_id) : null;
          return [
            teacher.id,
            {
              id: teacher.id,
              user_id: teacher.user_id,
              name: teacher.name || linkedUser?.name || 'Teacher',
              email: linkedUser?.email || '',
            },
          ];
        })
      );
    }

    const data = (classes || []).map((row) => {
      const teacher = row.teacher_id ? teacherMap.get(row.teacher_id) : null;
      return {
        ...row,
        teacher_name: teacher?.name || 'Unassigned Teacher',
        teacher_email: teacher?.email || '',
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching classes:', error);
    return { success: false, error: error.message };
  }
};

export const createAdminActivity = async ({
  title,
  description,
  classId,
  dueDate,
  imageUrl = '',
  modelId,
  allowedObjectIds,
  puzzlePieces,
}) => {
  try {
    if (!title || !classId) {
      return { success: false, error: 'Title and class are required' };
    }

    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('id, teacher_id, grade, subject')
      .eq('id', classId)
      .single();

    if (classError) throw classError;

    if (!classRow?.teacher_id) {
      return { success: false, error: 'Selected class has no assigned teacher' };
    }

    const encodedDescription = encodeActivityDescription(description || '', {
      allowedObjectIds,
      modelId,
      puzzlePieces,
    });

    const { data: activity, error: createError } = await supabase
      .from('activities')
      .insert([
        {
          teacher_id: classRow.teacher_id,
          title: title.trim(),
          description: encodedDescription,
          class_id: classRow.id,
          grade: classRow.grade || null,
          subject: classRow.subject || null,
          due_date: dueDate ? toIso(dueDate) : null,
          status: 'active',
          image_url: imageUrl || null,
        },
      ])
      .select('*')
      .single();

    if (createError) throw createError;

    const { data: students, error: studentError } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', classRow.id);

    if (studentError) throw studentError;

    const studentIds = [...new Set((students || []).map((row) => row.student_id).filter(Boolean))];

    if (studentIds.length > 0) {
      const assignments = studentIds.map((studentId) => ({
        activity_id: activity.id,
        student_id: studentId,
        status: 'pending',
      }));

      const { error: assignError } = await supabase
        .from('activity_assignments')
        .insert(assignments);

      if (assignError) throw assignError;
    }

    return { success: true, data: activity };
  } catch (error) {
    console.error('Error creating admin activity:', error);
    return { success: false, error: error.message };
  }
};

export const fetchRecentSubmissions = async ({ limit = 50, teacherId = null } = {}) => {
  try {
    let query = supabase
      .from('submissions')
      .select('id, activity_id, student_id, status, submitted_at, reviewed_at, score')
      .order('submitted_at', { ascending: false })
      .limit(limit);

    const { data: submissions, error } = await query;
    if (error) throw error;

    const rows = submissions || [];

    const activityIds = [...new Set(rows.map((row) => row.activity_id).filter(Boolean))];
    const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];

    let activityMap = new Map();
    if (activityIds.length > 0) {
      let activityQuery = supabase
        .from('activities')
        .select('id, title, teacher_id')
        .in('id', activityIds);

      if (teacherId) {
        activityQuery = activityQuery.eq('teacher_id', teacherId);
      }

      const { data: activities, error: activityError } = await activityQuery;
      if (activityError) throw activityError;
      activityMap = new Map((activities || []).map((activity) => [activity.id, activity]));
    }

    let studentMap = new Map();
    if (studentIds.length > 0) {
      const { data: students, error: studentError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', studentIds);

      if (studentError) throw studentError;
      studentMap = new Map((students || []).map((student) => [student.id, student]));
    }

    const filteredRows = teacherId
      ? rows.filter((row) => row.activity_id && activityMap.has(row.activity_id))
      : rows;

    const mapped = filteredRows.map((row) => {
      const activity = row.activity_id ? activityMap.get(row.activity_id) : null;
      const student = row.student_id ? studentMap.get(row.student_id) : null;

      return {
        id: row.id,
        student_id: row.student_id,
        student_name: student?.name || 'Student',
        student_email: student?.email || '',
        activity_id: row.activity_id,
        activity_title: activity?.title || 'Untitled Activity',
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        score: row.score,
        status: normalizeSubmissionStatus(row),
      };
    });

    return { success: true, data: mapped };
  } catch (error) {
    console.error('Error fetching recent submissions:', error);
    return { success: false, error: error.message };
  }
};

export const fetchAdminDashboardData = async () => {
  try {
    const [
      usersCount,
      activitiesCount,
      submissionsCount,
      pendingReviewCount,
      classCount,
      recentSubmissionsResult,
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).is('reviewed_at', null),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      fetchRecentSubmissions({ limit: 12 }),
    ]);

    if (usersCount.error) throw usersCount.error;
    if (activitiesCount.error) throw activitiesCount.error;
    if (submissionsCount.error) throw submissionsCount.error;
    if (pendingReviewCount.error) throw pendingReviewCount.error;
    if (classCount.error) throw classCount.error;

    const submissions = recentSubmissionsResult.success ? recentSubmissionsResult.data : [];

    const weekLabels = buildRecentWeekLabels(6);
    const usersByWeek = new Map(weekLabels.map((key) => [key, 0]));
    const submissionsByWeek = new Map(weekLabels.map((key) => [key, 0]));

    const sinceIso = weekLabels[0] ? `${weekLabels[0]}T00:00:00.000Z` : startOfDayIsoDaysAgo(42);

    const [{ data: users }, { data: activityRows }, { data: submissionRows }] = await Promise.all([
      supabase.from('users').select('created_at').gte('created_at', sinceIso),
      supabase.from('activities').select('created_at').gte('created_at', sinceIso),
      supabase.from('submissions').select('submitted_at').gte('submitted_at', sinceIso),
    ]);

    (users || []).forEach((row) => {
      const key = getWeekKey(row.created_at);
      if (key && usersByWeek.has(key)) {
        usersByWeek.set(key, (usersByWeek.get(key) || 0) + 1);
      }
    });

    (submissionRows || []).forEach((row) => {
      const key = getWeekKey(row.submitted_at);
      if (key && submissionsByWeek.has(key)) {
        submissionsByWeek.set(key, (submissionsByWeek.get(key) || 0) + 1);
      }
    });

    const activitiesCreated = (activityRows || []).length;
    const submissionCount = submissionsCount.count || 0;
    const activeActivities = activitiesCount.count || 0;

    return {
      success: true,
      data: {
        metrics: {
          totalUsers: usersCount.count || 0,
          activeActivities,
          totalSubmissions: submissionCount,
          pendingReview: pendingReviewCount.count || 0,
          totalClasses: classCount.count || 0,
          activitiesCreated,
        },
        trend: {
          weekLabels,
          newUsersByWeek: weekLabels.map((key) => usersByWeek.get(key) || 0),
          submissionsByWeek: weekLabels.map((key) => submissionsByWeek.get(key) || 0),
        },
        recentSubmissions: submissions,
      },
    };
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return { success: false, error: error.message };
  }
};

export const fetchAdminAnalytics = async ({ days = 30 } = {}) => {
  try {
    const sinceIso = startOfDayIsoDaysAgo(days);

    const [activitiesRes, assignmentsRes, submissionsRes, usersRes, classesRes] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, class_id, teacher_id, created_at, due_date, description')
        .gte('created_at', sinceIso),
      supabase
        .from('activity_assignments')
        .select('activity_id, student_id, status, assigned_at')
        .gte('assigned_at', sinceIso),
      supabase
        .from('submissions')
        .select('id, activity_id, student_id, status, submitted_at, reviewed_at, score, reviewed_by')
        .gte('submitted_at', sinceIso),
      supabase
        .from('users')
        .select('id, role, name, created_at')
        .gte('created_at', sinceIso),
      supabase
        .from('classes')
        .select('id, teacher_id, name')
        .gte('created_at', sinceIso),
    ]);

    if (activitiesRes.error) throw activitiesRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (submissionsRes.error) throw submissionsRes.error;
    if (usersRes.error) throw usersRes.error;
    if (classesRes.error) throw classesRes.error;

    const activities = activitiesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const submissions = submissionsRes.data || [];
    const users = usersRes.data || [];
    const classes = classesRes.data || [];

    const teacherIds = [...new Set(activities.map((activity) => activity.teacher_id).filter(Boolean))];

    let teacherMap = new Map();
    if (teacherIds.length > 0) {
      const { data: teachers, error: teacherError } = await supabase
        .from('teachers')
        .select('id, user_id, name')
        .in('id', teacherIds);

      if (teacherError) throw teacherError;

      const userIds = [...new Set((teachers || []).map((teacher) => teacher.user_id).filter(Boolean))];
      let linkedUsers = new Map();

      if (userIds.length > 0) {
        const { data: teacherUsers, error: teacherUsersError } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);

        if (teacherUsersError) throw teacherUsersError;
        linkedUsers = new Map((teacherUsers || []).map((row) => [row.id, row]));
      }

      teacherMap = new Map(
        (teachers || []).map((teacher) => {
          const linkedUser = teacher.user_id ? linkedUsers.get(teacher.user_id) : null;
          return [
            teacher.id,
            {
              id: teacher.id,
              name: teacher.name || linkedUser?.name || 'Teacher',
            },
          ];
        })
      );
    }

    const assignmentsByActivity = new Map();
    assignments.forEach((assignment) => {
      const current = assignmentsByActivity.get(assignment.activity_id) || 0;
      assignmentsByActivity.set(assignment.activity_id, current + 1);
    });

    const submissionsByActivity = new Map();
    submissions.forEach((submission) => {
      const current = submissionsByActivity.get(submission.activity_id) || 0;
      submissionsByActivity.set(submission.activity_id, current + 1);
    });

    const scoreByActivity = new Map();
    submissions.forEach((submission) => {
      if (typeof submission.score !== 'number') return;
      const current = scoreByActivity.get(submission.activity_id) || { total: 0, count: 0 };
      current.total += submission.score;
      current.count += 1;
      scoreByActivity.set(submission.activity_id, current);
    });

    const activityPerformance = activities.map((activity) => {
      const assigned = assignmentsByActivity.get(activity.id) || 0;
      const submitted = submissionsByActivity.get(activity.id) || 0;
      const completionRate = Math.round(safeDivide(submitted, assigned || submitted || 1) * 100);
      const score = scoreByActivity.get(activity.id);
      const averageScore = score ? Number((score.total / Math.max(1, score.count)).toFixed(1)) : null;
      const model = parseActivityDescription(activity.description);

      return {
        activity_id: activity.id,
        activity_title: activity.title || 'Untitled Activity',
        completion_rate: completionRate,
        submissions: submitted,
        assigned,
        average_score: averageScore,
        model_id: model.modelId,
        model_url: model.modelUrl,
      };
    });

    const submissionsByStudent = new Map();
    submissions.forEach((submission) => {
      const current = submissionsByStudent.get(submission.student_id) || 0;
      submissionsByStudent.set(submission.student_id, current + 1);
    });

    const studentUsers = users.filter((user) => String(user.role || '').toLowerCase() === 'student');
    const studentEngagement = studentUsers
      .map((student) => ({
        student_id: student.id,
        student_name: student.name || 'Student',
        submissions: submissionsByStudent.get(student.id) || 0,
      }))
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 8);

    const activitiesByTeacher = new Map();
    activities.forEach((activity) => {
      if (!activity.teacher_id) return;
      const current = activitiesByTeacher.get(activity.teacher_id) || [];
      current.push(activity.id);
      activitiesByTeacher.set(activity.teacher_id, current);
    });

    const teacherPerformance = Array.from(activitiesByTeacher.entries()).map(([teacherId, activityIds]) => {
      const totals = activityIds.reduce(
        (acc, activityId) => {
          acc.assigned += assignmentsByActivity.get(activityId) || 0;
          acc.submitted += submissionsByActivity.get(activityId) || 0;
          return acc;
        },
        { assigned: 0, submitted: 0 }
      );

      return {
        teacher_id: teacherId,
        teacher_name: teacherMap.get(teacherId)?.name || 'Teacher',
        activities: activityIds.length,
        completion_rate: Math.round(safeDivide(totals.submitted, totals.assigned || totals.submitted || 1) * 100),
      };
    });

    const modelUsage = activityPerformance.reduce((acc, item) => {
      const key = item.model_id || 'mask';
      if (!acc[key]) {
        acc[key] = {
          model_id: key,
          count: 0,
        };
      }
      acc[key].count += 1;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        summary: {
          totalUsers: users.length,
          totalActivities: activities.length,
          totalAssignments: assignments.length,
          totalSubmissions: submissions.length,
          reviewedSubmissions: submissions.filter((row) => !!row.reviewed_at).length,
          averageScore: (() => {
            const scored = submissions.filter((row) => typeof row.score === 'number');
            if (scored.length === 0) return null;
            const total = scored.reduce((acc, row) => acc + row.score, 0);
            return Number((total / scored.length).toFixed(1));
          })(),
          classesCount: classes.length,
        },
        activityPerformance: activityPerformance.sort((a, b) => b.completion_rate - a.completion_rate),
        studentEngagement,
        teacherPerformance: teacherPerformance.sort((a, b) => b.completion_rate - a.completion_rate),
        modelUsage: Object.values(modelUsage).sort((a, b) => b.count - a.count),
      },
    };
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return { success: false, error: error.message };
  }
};

export const fetchSuperAdminAuditEvents = async ({ limit = 200 } = {}) => {
  try {
    const [usersRes, teachersRes, activitiesRes, submissionsRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role, created_at').order('created_at', { ascending: false }).limit(limit),
      supabase.from('teachers').select('id, user_id, name'),
      supabase.from('activities').select('id, title, teacher_id, created_at').order('created_at', { ascending: false }).limit(limit),
      supabase
        .from('submissions')
        .select('id, student_id, activity_id, status, submitted_at, reviewed_at, reviewed_by, score')
        .order('submitted_at', { ascending: false })
        .limit(limit),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (teachersRes.error) throw teachersRes.error;
    if (activitiesRes.error) throw activitiesRes.error;
    if (submissionsRes.error) throw submissionsRes.error;

    const users = usersRes.data || [];
    const teachers = teachersRes.data || [];
    const activities = activitiesRes.data || [];
    const submissions = submissionsRes.data || [];

    const userMap = new Map(users.map((user) => [user.id, user]));
    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    const activityMap = new Map(activities.map((activity) => [activity.id, activity]));

    const events = [];

    users.forEach((user) => {
      if (!user.created_at) return;
      events.push({
        id: `user-created-${user.id}`,
        user: user.name || user.email || 'User',
        role: toRoleLabel(user.role),
        action: 'User account created',
        timestamp: user.created_at,
        details: `${user.email || 'Unknown email'} joined the platform.`,
      });
    });

    activities.forEach((activity) => {
      if (!activity.created_at) return;
      const teacher = activity.teacher_id ? teacherById.get(activity.teacher_id) : null;
      const teacherUser = teacher?.user_id ? userMap.get(teacher.user_id) : null;
      events.push({
        id: `activity-created-${activity.id}`,
        user: teacher?.name || teacherUser?.name || 'Teacher',
        role: 'Teacher',
        action: 'Activity created',
        timestamp: activity.created_at,
        details: `Created activity: ${activity.title || 'Untitled Activity'}`,
      });
    });

    submissions.forEach((submission) => {
      const student = submission.student_id ? userMap.get(submission.student_id) : null;
      const activity = submission.activity_id ? activityMap.get(submission.activity_id) : null;

      if (submission.submitted_at) {
        events.push({
          id: `submission-created-${submission.id}`,
          user: student?.name || student?.email || 'Student',
          role: 'Student',
          action: 'Submission created',
          timestamp: submission.submitted_at,
          details: `Submitted work for ${activity?.title || 'an activity'}`,
        });
      }

      if (submission.reviewed_at) {
        const reviewer = submission.reviewed_by ? userMap.get(submission.reviewed_by) : null;
        events.push({
          id: `submission-reviewed-${submission.id}`,
          user: reviewer?.name || reviewer?.email || 'Teacher',
          role: reviewer ? toRoleLabel(reviewer.role) : 'Teacher',
          action: 'Submission reviewed',
          timestamp: submission.reviewed_at,
          details: `Reviewed ${student?.name || 'student'} on ${activity?.title || 'activity'}${
            typeof submission.score === 'number' ? ` (score: ${submission.score})` : ''
          }`,
        });
      }
    });

    events.sort((a, b) => {
      const aDate = parseDateSafe(a.timestamp)?.getTime() || 0;
      const bDate = parseDateSafe(b.timestamp)?.getTime() || 0;
      return bDate - aDate;
    });

    return { success: true, data: events.slice(0, limit) };
  } catch (error) {
    console.error('Error fetching audit events:', error);
    return { success: false, error: error.message };
  }
};
