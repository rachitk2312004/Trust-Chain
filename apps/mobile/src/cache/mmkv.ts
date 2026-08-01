import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * MMKV-compatible facade over AsyncStorage for Expo-managed builds.
 * Swap implementation for react-native-mmkv in production native builds if desired.
 */
const memory = new Map<string, string>();

export const mmkv = {
  async getString(key: string): Promise<string | undefined> {
    if (memory.has(key)) return memory.get(key);
    const value = await AsyncStorage.getItem(key);
    if (value != null) memory.set(key, value);
    return value ?? undefined;
  },
  async set(key: string, value: string): Promise<void> {
    memory.set(key, value);
    await AsyncStorage.setItem(key, value);
  },
  async delete(key: string): Promise<void> {
    memory.delete(key);
    await AsyncStorage.removeItem(key);
  },
  async getAllKeys(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys];
  },
  async clear(): Promise<void> {
    memory.clear();
    await AsyncStorage.clear();
  },
};
