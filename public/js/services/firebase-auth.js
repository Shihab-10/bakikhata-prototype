const FIREBASE_SDK_VERSION = '13.4.0';
const FLOW_KEY = 'bakikhata_firebase_auth_flow';

let runtimePromise = null;

function friendlyFirebaseError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/unauthorized-domain': 'এই website address Firebase Authentication-এ অনুমোদিত নয়। Firebase Console → Authentication → Settings → Authorized domains-এ localhost যোগ করুন।',
    'auth/popup-blocked': 'Browser popup block করেছে। আবার চেষ্টা করুন অথবা browser-এর popup permission চালু করুন।',
    'auth/popup-closed-by-user': 'Google sign-in বাতিল করা হয়েছে।',
    'auth/cancelled-popup-request': 'আগের Google sign-in request বাতিল হয়েছে। আবার চেষ্টা করুন।',
    'auth/network-request-failed': 'Internet connection পরীক্ষা করে আবার চেষ্টা করুন।',
    'auth/operation-not-allowed': 'Firebase Console-এ Google sign-in provider enable করা হয়নি।',
    'auth/invalid-api-key': 'Firebase API key ভুল। Firebase Web App configuration আবার পরীক্ষা করুন।',
    'auth/invalid-oauth-client-id': 'Firebase Console-এর Google provider configuration পরীক্ষা করুন।',
    'auth/operation-not-supported-in-this-environment': 'এই browser-এ popup সমর্থিত নয়। Redirect flow ব্যবহার করে আবার চেষ্টা করুন।',
  };
  return messages[code] || error?.message || 'Google sign-in সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।';
}

export async function initializeFirebaseAuth(config) {
  if (!config?.apiKey || !config?.authDomain || !config?.projectId || !config?.appId) {
    throw new Error('Firebase Web App configuration অসম্পূর্ণ। Firebase Console থেকে apiKey, authDomain, projectId ও appId যোগ করুন।');
  }
  if (runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    const appUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
    const authUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`;
    const [appSdk, authSdk] = await Promise.all([import(appUrl), import(authUrl)]);
    const existing = appSdk.getApps().find((item) => item.name === '[DEFAULT]');
    const app = existing || appSdk.initializeApp(config);
    const auth = authSdk.getAuth(app);

    try {
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    } catch {
      await authSdk.setPersistence(auth, authSdk.inMemoryPersistence);
    }

    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    provider.addScope('email');
    provider.addScope('profile');
    return { appSdk, authSdk, auth, provider };
  })().catch((error) => {
    runtimePromise = null;
    throw new Error(friendlyFirebaseError(error));
  });

  return runtimePromise;
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function resultPayload(result, flow) {
  return {
    flow,
    idToken: null,
    profile: {
      email: result.user?.email || '',
      name: result.user?.displayName || '',
      picture: result.user?.photoURL || '',
    },
    getIdToken: () => result.user.getIdToken(),
  };
}

export async function startGoogleSignIn(config, flow = 'login') {
  const { authSdk, auth, provider } = await initializeFirebaseAuth(config);
  sessionStorage.setItem(FLOW_KEY, flow);

  try {
    // Popup works well on desktop and mobile browsers when started from a user tap.
    // Redirect is a fallback for browsers that explicitly block popup windows.
    const result = await authSdk.signInWithPopup(auth, provider);
    sessionStorage.removeItem(FLOW_KEY);
    const payload = resultPayload(result, flow);
    payload.idToken = await payload.getIdToken();
    delete payload.getIdToken;
    return payload;
  } catch (error) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await authSdk.signInWithRedirect(auth, provider);
      return { redirecting: true };
    }
    sessionStorage.removeItem(FLOW_KEY);
    throw new Error(friendlyFirebaseError(error));
  }
}

export async function completeGoogleRedirect(config) {
  const flow = sessionStorage.getItem(FLOW_KEY);
  const { authSdk, auth } = await initializeFirebaseAuth(config);
  try {
    const result = await authSdk.getRedirectResult(auth);
    if (!result) {
      if (flow) sessionStorage.removeItem(FLOW_KEY);
      return null;
    }
    sessionStorage.removeItem(FLOW_KEY);
    const payload = resultPayload(result, flow || 'login');
    payload.idToken = await payload.getIdToken();
    delete payload.getIdToken;
    return payload;
  } catch (error) {
    sessionStorage.removeItem(FLOW_KEY);
    throw new Error(friendlyFirebaseError(error));
  }
}

export async function signOutFirebase() {
  if (!runtimePromise) return;
  try {
    const { authSdk, auth } = await runtimePromise;
    await authSdk.signOut(auth);
  } catch {
    // Local BakiKhata JWT logout must still complete if Firebase is unreachable.
  }
}
