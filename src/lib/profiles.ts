import { supa } from './SupabaseClient';

/** Display names and avatars of the given authors, keyed by user id. */
export async function fetchProfileMaps(authorIds: string[]) {
  let names: Record<string, string> = {};
  let avatars: Record<string, string | null> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supa
      .from('player_profiles')
      .select('user_id,display_name,avatar_url')
      .in('user_id', authorIds);
    if (profiles) {
      names = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.display_name]));
      avatars = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.avatar_url]));
    }
  }
  return { names, avatars };
}
