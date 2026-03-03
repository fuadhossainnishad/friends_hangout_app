// config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAe_-XVcGS4W7phS1r-hfkeKy1yR8PZhbc",
    authDomain: "friends-hangout-app.firebaseapp.com",
    projectId: "friends-hangout-app",
    storageBucket: "friends-hangout-app.firebasestorage.app",
    messagingSenderId: "196910137337",
    appId: "1:196910137337:web:b7cc0236fc4fffc8d78728"
};
// const firebaseConfig = {
//     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
//     authDomain: "your-app.firebaseapp.com",
//     projectId: "friends-hangout-app-5c2bd",
//     storageBucket: "friends-hangout-app-5c2bd.firebasestorage.app",
//     messagingSenderId: "123456789",
//     appId: "1:196910137337:android:7d7fa27fe72ab4ddd78728"
// };

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export default firebaseApp;
