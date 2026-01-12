import { supabase } from './supabase';
import { initialsAvatar } from '../utils/avatar';

export async function fetchGuestById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data ?? null;
}

export async function upsertGuestProfile({
  id,
  name,
  email,
  avatarUrl,
  role
}) {
  if (!id) throw new Error('Guest id required');
  const safeName = name || 'Guest';
  const payload = {
    id,
    name: safeName,
    email,
    avatar_url: avatarUrl || initialsAvatar(safeName)
  };
  if (role && ['guest', 'bride', 'groom'].includes(role)) {
    payload.role = role;
  }
  const { data, error } = await supabase
    .from('guests')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function ensureGuestProfile(user, overrides = {}) {
  if (!user?.id) return null;
  const existing = await fetchGuestById(user.id);
  if (existing) return existing;

  const fallbackName =
    overrides.name ||
    user.user_metadata?.name ||
    user.email?.split('@')?.[0] ||
    'Guest';

  return upsertGuestProfile({
    id: user.id,
    name: fallbackName,
    email: overrides.email || user.email,
    avatarUrl: overrides.avatarUrl,
    role: overrides.role
  });
}
