// Firebase 초기화. 교사 플랫폼과 학생용 게임이 함께 쓴다.
// 모듈은 한 페이지에서 한 번만 실행되므로 초기화도 한 번만 일어난다. 다른 파일은 여기서 가져다 쓴다.
import { initializeApp, getAuth, getFirestore } from './sdk.js';
import { firebaseConfig } from './config.js';

export const isConfigured = Object.values(firebaseConfig).every((v) => v && !v.includes('[미정]'));

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
