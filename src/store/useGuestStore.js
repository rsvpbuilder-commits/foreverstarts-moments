import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useGuestStore = create(
  persist(
    (set) => ({
      guest: null,
      setGuest: (guest) => set({ guest }),
      signOut: () => set({ guest: null })
    }),
    {
      name: 'wedding-guest-profile',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
