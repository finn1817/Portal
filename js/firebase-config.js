// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// User Management Firebase Config
const userFirebaseConfig = {
    apiKey: "AIzaSyAt_HJiP_uuWC7-AqMKlfLwjQFsESjB364",
    authDomain: "my-admin-dashboard-b9c89.firebaseapp.com",
    projectId: "my-admin-dashboard-b9c89",
    storageBucket: "my-admin-dashboard-b9c89.firebasestorage.app",
    messagingSenderId: "1001105953619",
    appId: "1:1001105953619:web:1e2cf52a9ff37aeb5207a6",
    measurementId: "G-DGTX5YCKYF"
};

// Workplace Firebase Config
const workplaceFirebaseConfig = {
    apiKey: "AIzaSyBkkq4nPnmyfSOKtVLsO95rpAUsMDA1o0A",
    authDomain: "workplace-scheduler-ace38.firebaseapp.com",
    projectId: "workplace-scheduler-ace38",
    storageBucket: "workplace-scheduler-ace38.firebasestorage.app",
    messagingSenderId: "153631302747",
    appId: "1:153631302747:web:2c731351893dca19510b7e",
    measurementId: "G-THHV6M3Z88"
};

// Initialize both Firebase apps
export const userApp = initializeApp(userFirebaseConfig, "users");
export const workplaceApp = initializeApp(workplaceFirebaseConfig, "workplace");

// Get database instances
export const userDb = getFirestore(userApp);
export const workplaceDb = getFirestore(workplaceApp);

// Constants
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
