// Google Drive sync using Google Identity Services (token flow) + Drive REST API.
// Data is stored in the private appDataFolder as a single JSON backup file.
//
// Because a Google OAuth Client ID is tied to the deploying origin, the user
// supplies their own Client ID in Settings (stored locally). Without one, the
// UI guides the user and local export/import still works as a fallback.
import { getSettings, setSetting, serialize, importData } from "./store.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "momentum-backup.json";

let gisReady = null;
let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let driveFileId = null;
let onStatusChange = () => {};
let toastFn = () => {};
let syncTimer = null;
let syncing = false;

export function initDrive(toast, onChange) {
  toastFn = toast || (() => {});
  onStatusChange = onChange || (() => {});
}

export function driveStatus() {
  const s = getSettings();
  return {
    clientIdSet: !!s.driveClientId,
    connected: !!accessToken && Date.now() < tokenExpiry,
    autoSync: !!s.driveAutoSync,
    lastSync: s.driveLastSync,
  };
}

function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve();
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in (check your connection)."));
    document.head.appendChild(script);
  });
  return gisReady;
}

function ensureTokenClient() {
  const clientId = getSettings().driveClientId;
  if (!clientId) throw new Error("Add your Google OAuth Client ID first.");
  if (tokenClient) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {}, // set per-request
  });
  return tokenClient;
}

function requestToken(interactive) {
  return new Promise((resolve, reject) => {
    let client;
    try { client = ensureTokenClient(); } catch (e) { return reject(e); }
    client.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3300 * 1000) - 60000;
      onStatusChange();
      resolve(accessToken);
    };
    try {
      client.requestAccessToken({ prompt: interactive ? "consent" : "" });
    } catch (e) { reject(e); }
  });
}

async function validToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  return requestToken(false);
}

export async function connectDrive() {
  await loadGis();
  await requestToken(true);
  await findFile().catch(() => {});
  toastFn("Google Drive connected");
  onStatusChange();
}

export function disconnectDrive() {
  const token = accessToken;
  if (token && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch (e) { /* ignore */ }
  }
  accessToken = null;
  tokenExpiry = 0;
  driveFileId = null;
  onStatusChange();
}

async function driveFetch(url, opts = {}) {
  const token = await validToken();
  const resp = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Drive error ${resp.status}: ${txt.slice(0, 120)}`);
  }
  return resp;
}

async function findFile() {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`;
  const resp = await driveFetch(url);
  const data = await resp.json();
  driveFileId = data.files && data.files.length ? data.files[0].id : null;
  return driveFileId;
}

export async function saveToDrive(silent = false) {
  if (syncing) return;
  syncing = true;
  try {
    await loadGis();
    await validToken();
    if (driveFileId == null) await findFile();
    const body = serialize();
    if (driveFileId) {
      await driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body },
      );
    } else {
      const boundary = "momentumBoundary" + Date.now();
      const metadata = { name: FILE_NAME, parents: ["appDataFolder"] };
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        `${body}\r\n--${boundary}--`;
      const resp = await driveFetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart },
      );
      const data = await resp.json();
      driveFileId = data.id;
    }
    setSetting("driveLastSync", new Date().toISOString());
    if (!silent) toastFn("Saved to Google Drive");
    onStatusChange();
    return true;
  } catch (e) {
    toastFn(e.message || "Drive save failed");
    return false;
  } finally {
    syncing = false;
  }
}

export async function restoreFromDrive() {
  try {
    await loadGis();
    await validToken();
    if (driveFileId == null) await findFile();
    if (!driveFileId) { toastFn("No backup found in Drive"); return false; }
    const resp = await driveFetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
    const text = await resp.text();
    importData(text);
    toastFn("Restored from Google Drive");
    return true;
  } catch (e) {
    toastFn(e.message || "Drive restore failed");
    return false;
  }
}

// Debounced auto-sync after any data change.
export function scheduleAutoSync() {
  const s = driveStatus();
  if (!s.autoSync || !s.connected) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { saveToDrive(true); }, 2500);
}
