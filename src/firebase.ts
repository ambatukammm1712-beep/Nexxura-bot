/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dynamically and safely initialize Firebase to prevent compilation errors when config is not yet provisioned.
export interface FirebaseServices {
  db: any;
  auth: any;
  isFirebaseConnected: boolean;
}

let services: FirebaseServices = {
  db: null,
  auth: null,
  isFirebaseConnected: false
};

export async function getFirebase(): Promise<FirebaseServices> {
  if (services.isFirebaseConnected) {
    return services;
  }

  try {
    // Try to dynamically load firebase-applet-config.json
    // We use a query parameter or dynamic resolution so the bundler handles optional inclusion.
    // @ts-ignore
    const configModule = await import("../firebase-applet-config.json");
    const config = configModule.default || configModule;

    if (!config || !config.apiKey) {
      throw new Error("Missing api keys inside firebase config");
    }

    const { initializeApp } = await import("firebase/app");
    const { getFirestore } = await import("firebase/firestore");
    const { getAuth } = await import("firebase/auth");

    const app = initializeApp(config);
    const db = getFirestore(app, config.firestoreDatabaseId);
    const auth = getAuth(app);

    services = {
      db,
      auth,
      isFirebaseConnected: true
    };
    
    console.log("Firebase successfully connected real-time snapshot sync enabled!");
    return services;
  } catch (error) {
    console.log("Firebase not configured or not yet initialized in the UI. Running in secure local cache + multi-tab real-time sync mode.");
    
    services = {
      db: null,
      auth: null,
      isFirebaseConnected: false
    };
    return services;
  }
}
