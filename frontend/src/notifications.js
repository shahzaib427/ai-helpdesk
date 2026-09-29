// Requests permission once, then a small helper to fire a browser
// notification + sound when a new conversation lands in the queue while
// the agent is looking at another tab or app.
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

let audioCtx;
function playChime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch {
    // Audio can fail silently (autoplay policy, no user gesture yet) — not
    // worth surfacing an error for a "nice to have" chime.
  }
}

export function notifyNewConversation(subject) {
  playChime();

  if (document.visibilityState === "visible") return; // don't nag if they're already looking

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("New chat waiting", {
      body: subject || "A customer needs an agent.",
      icon: "/favicon.ico",
    });
  }
}