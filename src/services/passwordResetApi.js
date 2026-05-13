import { supabase } from '../lib/supabase';

const RESET_REQUESTS_TABLE = 'password_reset_requests';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_ALLOWED_ROLES = new Set(['student', 'teacher']);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[_\s-]/g, '');

const tableSetupMessage = (error) => {
  const message = String(error?.message || '');
  if (message.includes(RESET_REQUESTS_TABLE) || error?.code === '42P01') {
    return 'Password reset approval table is not configured yet. Apply database/password_reset_requests.sql in Supabase.';
  }
  return message || 'Password reset request failed.';
};

export const createPasswordResetRequest = async (email) => {
  const safeEmail = normalizeEmail(email);

  if (!EMAIL_PATTERN.test(safeEmail)) {
    return { success: false, error: 'Enter a valid email address.' };
  }

  try {
    const { data, error } = await supabase
      .from(RESET_REQUESTS_TABLE)
      .insert([
        {
          email: safeEmail,
          status: 'pending',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      ]);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating password reset request:', error);
    return { success: false, error: tableSetupMessage(error) };
  }
};

export const fetchPasswordResetRequests = async () => {
  try {
    const [{ data: requests, error: requestError }, { data: users, error: usersError }] = await Promise.all([
      supabase
        .from(RESET_REQUESTS_TABLE)
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('id, name, email, role'),
    ]);

    if (requestError) throw requestError;
    if (usersError) throw usersError;

    const userByEmail = new Map(
      (users || []).map((user) => [normalizeEmail(user.email), user])
    );

    const data = (requests || []).map((request) => {
      const account = userByEmail.get(normalizeEmail(request.email)) || null;
      return {
        ...request,
        account,
        account_name: account?.name || 'Unknown account',
        account_role: account?.role || 'unknown',
        is_reset_allowed: RESET_ALLOWED_ROLES.has(normalizeRole(account?.role)),
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching password reset requests:', error);
    return { success: false, error: tableSetupMessage(error) };
  }
};

export const approvePasswordResetRequest = async (request, reviewerId) => {
  const safeEmail = normalizeEmail(request?.email);
  const accountRole = normalizeRole(request?.account?.role || request?.account_role);

  if (!request?.id || !safeEmail) {
    return { success: false, error: 'Missing password reset request.' };
  }

  if (!RESET_ALLOWED_ROLES.has(accountRole)) {
    return { success: false, error: 'Only student and teacher accounts can be approved for password reset.' };
  }

  try {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(safeEmail, {
      redirectTo,
    });

    if (resetError) throw resetError;

    const { data, error } = await supabase
      .from(RESET_REQUESTS_TABLE)
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId || null,
        reset_sent_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', request.id)
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error approving password reset request:', error);
    return { success: false, error: tableSetupMessage(error) };
  }
};

export const rejectPasswordResetRequest = async (requestId, reviewerId, reason = '') => {
  if (!requestId) {
    return { success: false, error: 'Missing password reset request.' };
  }

  try {
    const { data, error } = await supabase
      .from(RESET_REQUESTS_TABLE)
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId || null,
        rejection_reason: String(reason || '').trim() || null,
      })
      .eq('id', requestId)
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error rejecting password reset request:', error);
    return { success: false, error: tableSetupMessage(error) };
  }
};
