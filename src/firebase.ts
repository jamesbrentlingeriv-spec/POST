import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyCJTOsQZ2rgynHPz3uKv2_VlRsZiYlOId0",
    authDomain: "pal-optical-tool.firebaseapp.com",
    projectId: "pal-optical-tool",
    storageBucket: "pal-optical-tool.firebasestorage.app",
    messagingSenderId: "294632477326",
    appId: "1:294632477326:web:6aca10159254e27a8e2fdf",
    databaseURL: "https://pal-optical-tool-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
