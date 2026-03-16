import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

// 适配 AI Studio 环境和本地 GitHub 环境
const getFirebaseConfig = () => {
  // Check for global variable injected by some environments
  if (typeof window !== 'undefined' && (window as any).__firebase_config) {
    try {
      return typeof (window as any).__firebase_config === 'string' 
        ? JSON.parse((window as any).__firebase_config) 
        : (window as any).__firebase_config;
    } catch (e) {
      console.error("Failed to parse __firebase_config", e);
    }
  }

  if (config && config.apiKey) {
    return config;
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
};

export const firebaseConfig = getFirebaseConfig();

// 检查是否已配置有效的 API Key
export const isFirebaseConfigured = !!firebaseConfig?.apiKey && firebaseConfig.apiKey !== 'your_firebase_api_key';

export const app = isFirebaseConfigured 
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]) 
  : null;

export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) : null as any;

export const appId = (typeof window !== 'undefined' && (window as any).__app_id) 
  ? (window as any).__app_id 
  : import.meta.env.VITE_APP_ID || 'default-app-id';
