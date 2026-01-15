import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeAsyncStorage } from '../lib/safeAsyncStorage';

export const useGuestStore = create(
  persist(
    (set) => ({
      guest: null,
      setGuest: (guest) => set({ guest }),
      signOut: () => set({ guest: null })
    }),
    {
      name: 'wedding-guest-profile',
      storage: createJSONStorage(() => safeAsyncStorage)
    }
  )
);
