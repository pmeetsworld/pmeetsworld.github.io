import { deleteRecord, getRecord, putRecord } from "../state/idb.js?v=1.1.0";

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export async function saveMedia(blob, metadata = {}) {
  const id = createId("media");
  const record = {
    id,
    blob,
    type: metadata.type || blob.type || "application/octet-stream",
    name: metadata.name || id,
    accountId: metadata.accountId || null,
    createdAt: new Date().toISOString()
  };
  await putRecord("media", record);
  return {
    id,
    type: record.type,
    name: record.name,
    accountId: record.accountId,
    createdAt: record.createdAt
  };
}

export function getMedia(id) {
  return getRecord("media", id);
}

export function removeMedia(id) {
  return deleteRecord("media", id);
}

export async function startVoiceCapture() {
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
    throw new Error("Voice recording is not supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  function stopTracks() {
    stream.getTracks().forEach((track) => track.stop());
  }

  const mimeType = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm"
  ].find((type) => MediaRecorder.isTypeSupported?.(type));
  let recorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch (error) {
    stopTracks();
    throw error;
  }
  const chunks = [];
  let canceled = false;

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  try {
    recorder.start(250);
  } catch (error) {
    stopTracks();
    throw error;
  }

  return {
    stop() {
      return new Promise((resolve, reject) => {
        recorder.addEventListener("stop", () => {
          stopTracks();
          if (canceled) return;
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
          if (!blob.size) {
            reject(new Error("The voice note was empty. Please record it again."));
            return;
          }
          resolve(blob);
        }, { once: true });
        recorder.addEventListener("error", (event) => {
          stopTracks();
          reject(event.error || new Error("Voice recording failed."));
        }, { once: true });
        if (recorder.state === "inactive") {
          stopTracks();
          reject(new Error("Voice recording stopped before any audio was captured."));
          return;
        }
        recorder.stop();
      });
    },
    cancel() {
      canceled = true;
      stopTracks();
      if (recorder.state !== "inactive") recorder.stop();
    }
  };
}
