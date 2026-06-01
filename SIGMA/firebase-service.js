const firebaseConfig = {
  apiKey: "AIzaSyDtNT2f7uLljJ-bXYINPoxwzP5cp5aBC-w",
  authDomain: "i-educar-4758a.firebaseapp.com",
  projectId: "i-educar-4758a",
  storageBucket: "i-educar-4758a.firebasestorage.app",
  messagingSenderId: "344693634302",
  appId: "1:344693634302:web:526834eb443177057661af",
  measurementId: "G-JC2V4T12VK",
};

let firebaseRuntimePromise = null;

async function getFirebaseRuntime() {
  if (!firebaseRuntimePromise) {
    firebaseRuntimePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
    ])
      .then(([appModule, analyticsModule, firestoreModule]) => {
        const app = appModule.initializeApp(firebaseConfig);
        analyticsModule.isSupported()
          .then((supported) => {
            if (supported) analyticsModule.getAnalytics(app);
          })
          .catch(() => {});

        const firestore = firestoreModule.getFirestore(app);
        const stateRef = firestoreModule.doc(firestore, "gestao-escolar", "estado-geral");
        return { firestoreModule, stateRef };
      })
      .catch((error) => {
        firebaseRuntimePromise = null;
        throw error;
      });
  }

  return firebaseRuntimePromise;
}

export async function fetchRemoteState() {
  const { firestoreModule, stateRef } = await getFirebaseRuntime();
  const snapshot = await firestoreModule.getDoc(stateRef);
  if (!snapshot.exists()) return null;
  return snapshot.data().payload || null;
}

export async function persistRemoteState(payload) {
  const { firestoreModule, stateRef } = await getFirebaseRuntime();
  await firestoreModule.setDoc(
    stateRef,
    {
      payload,
      updatedAt: firestoreModule.serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeRemoteState(onChange, onError) {
  let unsubscribe = null;
  getFirebaseRuntime()
    .then(({ firestoreModule, stateRef }) => {
      unsubscribe = firestoreModule.onSnapshot(
        stateRef,
        (snapshot) => {
          if (!snapshot.exists()) return;
          const payload = snapshot.data().payload;
          if (payload) onChange(payload);
        },
        onError,
      );
    })
    .catch(onError);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
