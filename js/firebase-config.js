// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { 
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// USERS DATABASE CONFIG (for login - index.html)
const usersFirebaseConfig = {
    apiKey: "AIzaSyAt_HJiP_uuWC7-AqMKlfLwjQFsESjB364",
    authDomain: "my-admin-dashboard-b9c89.firebaseapp.com",
    projectId: "my-admin-dashboard-b9c89",
    storageBucket: "my-admin-dashboard-b9c89.firebasestorage.app",
    messagingSenderId: "1001105953619",
    appId: "1:1001105953619:web:1e2cf52a9ff37aeb5207a6",
    measurementId: "G-DGTX5YCKYF"
};

// WORKPLACE DATABASE CONFIG (for dashboard - dashboard.html)
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
const usersApp = initializeApp(usersFirebaseConfig, "users");
const workplaceApp = initializeApp(workplaceFirebaseConfig, "workplace");

// Initialize databases
const usersDb = getFirestore(usersApp);
const workplaceDb = getFirestore(workplaceApp);

// Constants
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Export everything
export { 
    usersDb,
    workplaceDb,
    DAYS,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot
};

// Make available globally for non-module scripts
window.usersDb = usersDb;
window.workplaceDb = workplaceDb;
window.DAYS = DAYS;
window.collection = collection;
window.doc = doc;
window.getDocs = getDocs;
window.getDoc = getDoc;
window.addDoc = addDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.limit = limit;
window.onSnapshot = onSnapshot;

console.log('✅ Firebase config loaded - Users and Workplace databases ready');