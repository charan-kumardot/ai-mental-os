import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from './appwrite';
import { useAuth } from './auth-context';

export type Mode = 'feel_better' | 'perform_better' | 'both';
export type PrivacyMode = 'maximum_privacy' | 'balanced' | 'maximum_intelligence';

export interface Profile {
  $id: string;
  userId: string;
  name?: string;
  ageRange?: string;
  timezone?: string;
  occupation?: string;
  workType?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  sleepScheduleStart?: string;
  sleepScheduleEnd?: string;
  mode?: Mode;
  goals?: string[];
  interactionStyle?: string;
  privacyMode?: PrivacyMode;
  onboardingCompleted?: boolean;
  onboardingStep?: string;
  activeContextMode?: string;
  activeContextLabel?: string;
  activeContextExpiresAt?: string;
}

type ProfileState = {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
};

const ProfileContext = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Wait for auth to fully settle before deciding anything — otherwise
    // there's a render where authLoading just flipped false but this
    // effect hasn't re-run yet with the real user, and profile/loading
    // are still stale from the pre-auth "no user" pass. Consumers (see
    // app/index.tsx) would briefly read "no profile" for an actual user
    // and could act on it (e.g. bounce a fully onboarded user back to
    // onboarding) before the real fetch resolves.
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.profiles, [Query.equal('userId', user.$id)]);
      if (res.documents.length > 0) {
        setProfile(res.documents[0] as unknown as Profile);
      } else {
        const created = await databases.createDocument(
          DB_ID,
          COLLECTIONS.profiles,
          ID.unique(),
          { userId: user.$id, onboardingCompleted: false },
          [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ]
        );
        setProfile(created as unknown as Profile);
      }
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!profile) return;
      const updated = await databases.updateDocument(DB_ID, COLLECTIONS.profiles, profile.$id, patch);
      setProfile(updated as unknown as Profile);
    },
    [profile]
  );

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
