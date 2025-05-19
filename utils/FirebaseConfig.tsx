import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage"; // añade esto

// ——— CONFIG DEL PROYECTO ———————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyA4MFl4kh8M65TWlX9GpUu19p4W4qEEqCw",
  authDomain: "house-iot-e4af8.firebaseapp.com",
  databaseURL: "https://house-iot-e4af8-default-rtdb.firebaseio.com",
  projectId: "house-iot-e4af8",
  storageBucket: "house-iot-e4af8.firebasestorage.app",
  messagingSenderId: "694245785547",
  appId: "1:694245785547:web:03d6659077420150d6c04e",
  measurementId: "G-81JYCHFGR3"
};
// ——— Inicializar Firebase ———————————————————————————


const app   = initializeApp(firebaseConfig);
const storage = getStorage(app); // añade esto
const db    = getFirestore(app);
const auth  = getAuth(app);
const rtdb  = getDatabase(app);

export { db, auth, rtdb, storage};
