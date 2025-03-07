import Store from "electron-store";

// Define the schema type
interface StoreSchema {
  googleToken?: {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    token_type: string;
    expiry_date?: number;
  };
  [key: string]: any;
}

// Define the store interface to match our API
interface StoreInterface {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
  delete: (key: string) => void;
}

// Create the electron-store instance with proper typing
const electronStore = new Store<StoreSchema>();

// Create a wrapper with the same API as our previous SimpleStore
// This allows us to maintain compatibility with existing code
export const store: StoreInterface = {
  get: (key: string): any => electronStore.get(key),
  set: (key: string, value: any): void => electronStore.set(key, value),
  delete: (key: string): void => electronStore.delete(key),
};

// Export the raw electronStore for advanced usage if needed
export const rawStore = electronStore;
