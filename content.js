let isAdPresent = false;
let loggedRateForCurrentAd = false;
let mutedAdVideo = null;

console.log("[Prime Ad Speedup] Script active on:", window.location.href);

function isWebPlayerOpen() {
  const playerRoot = document.querySelector(
    "#dv-web-player, .atvwebplayersdk-overlays-container, [class*='atvwebplayersdk-player']"
  );
  if (!playerRoot) return false;

  const rect = playerRoot.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// Returns remaining ad seconds, or -1 if no ad is present on screen at all
function getRemainingAdSeconds() {
  const timerSpan = document.querySelector(".atvwebplayersdk-ad-timer-remaining-time");
  if (timerSpan) {
    const text = timerSpan.textContent.trim();
    const parts = text.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts.at(0), 10);
      const secs = parseInt(parts.at(1), 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        return mins * 60 + secs;
      }
    }
    return 0;
  }

  const ariaAd = document.querySelector('[aria-label^="Ad playing"]');
  if (ariaAd) {
    const label = ariaAd.getAttribute("aria-label") || "";
    const minMatch = label.match(/(\d+)\s+minute/i);
    const secMatch = label.match(/(\d+)\s+second/i);
    if (minMatch || secMatch) {
      const mins = minMatch ? parseInt(minMatch.at(1), 10) : 0;
      const secs = secMatch ? parseInt(secMatch.at(1), 10) : 0;
      return mins * 60 + secs;
    }
    return 0;
  }

  return -1;
}

function getAllVideos() {
  return Array.from(document.querySelectorAll("video"));
}

function setSpeedToOne(video) {
  if (!video) return;
  if (video.playbackRate !== 1) {
    try {
      video.playbackRate = 1;
    } catch (_) {}
  }
}

function setVideoSpeedUp(video) {
  if (!video || video.readyState < 2) return;

  const targetRates = new Array(16, 12, 10, 8, 6, 4, 2);
  for (const rate of targetRates) {
    if (video.playbackRate === rate) return;
    try {
      video.playbackRate = rate;
      if (video.playbackRate === rate) {
        if (!loggedRateForCurrentAd) {
          loggedRateForCurrentAd = true;
          console.log(`[Prime Ad Speedup] Accelerating ad at ${rate}x`);
        }
        return;
      }
    } catch (_) {
      // Try next lower speed
    }
  }
}

function syncPlaybackState() {
  const remaining = getRemainingAdSeconds();
  const adActiveNow = remaining >= 0;
  const shouldSpeedUp = remaining > 8;
  const videos = getAllVideos();

  if (adActiveNow) {
    if (!isAdPresent) {
      isAdPresent = true;
      loggedRateForCurrentAd = false;
      console.log("[Prime Ad Speedup] Ad started -> Muting until ad disappears.");
    }

    // 1. Keep audio muted for the ENTIRE duration of the ad (down to 0:00)
    videos.forEach((v) => {
      if (v.readyState >= 1) {
        if (!v.muted) v.muted = true;
        mutedAdVideo = v;
      }
    });

    // 2. Speed up at 16x while >8s left, then coast at 1x for the final seconds so the show isn't skipped
    if (shouldSpeedUp) {
      videos.forEach(setVideoSpeedUp);
    } else {
      videos.forEach(setSpeedToOne);
    }
  } else {
    // No ad timer/badge on screen: ensure 1x speed everywhere
    videos.forEach(setSpeedToOne);

    // Unmute only now that the ad badge/timer is completely gone
    if (isAdPresent) {
      isAdPresent = false;

      if (mutedAdVideo && isWebPlayerOpen()) {
        console.log("[Prime Ad Speedup] Ad completely finished -> Unmuting show.");
        mutedAdVideo.muted = false;
        if (mutedAdVideo.volume === 0) {
          mutedAdVideo.volume = 1;
        }
      } else {
        console.log("[Prime Ad Speedup] Player exited -> Keeping preview muted.");
      }

      mutedAdVideo = null;
    }
  }
}

new Array("popstate", "hashchange", "beforeunload").forEach((navEvent) => {
  window.addEventListener(navEvent, () => {
    isAdPresent = false;
    mutedAdVideo = null;
    getAllVideos().forEach(setSpeedToOne);
  });
});

new Array("timeupdate", "play", "playing", "loadedmetadata", "emptied", "ratechange").forEach(
  (eventName) => {
    document.addEventListener(
      eventName,
      (e) => {
        if (!(e.target instanceof HTMLVideoElement)) return;
        syncPlaybackState();
      },
      true
    );
  }
);

document.addEventListener(
  "volumechange",
  (e) => {
    if (getRemainingAdSeconds() >= 0 && e.target instanceof HTMLVideoElement && !e.target.muted) {
      e.target.muted = true;
    }
  },
  true
);

setInterval(syncPlaybackState, 100);