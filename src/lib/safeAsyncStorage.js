import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStorage = new Map();
let warned = false;

const warnOnce = (error) => {
  if (warned) return;
  warned = true;
  console.warn(
    '[safeAsyncStorage] Falling back to in-memory storage. Persisted sessions may reset in private browsing modes.',
    error?.message || error
  );
};

const memoryAdapter = {
  async getItem(key) {
    return memoryStorage.has(key) ? memoryStorage.get(key) : null;
  },
  async setItem(key, value) {
    memoryStorage.set(key, value);
  },
  async removeItem(key) {
    memoryStorage.delete(key);
  }
};

export const safeAsyncStorage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (err) {
      warnOnce(err);
      return memoryAdapter.getItem(key);
    }
  },
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      warnOnce(err);
      await memoryAdapter.setItem(key, value);
    }
  },
  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      warnOnce(err);
      await memoryAdapter.removeItem(key);
    }
  }
};
