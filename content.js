let isAdActive = false;
let restoreTimer = null;

console.log("[Prime Ad Speedup] Script injected in frame:", window.location.href);

function detectAmazonAd() {
  const timerSpan = document.querySelector(".atvwebplayersdk-ad-timer-remaining-time");
  if (timerSpan && timerSpan.textContent.trim().length > 0) {
    return true;
  }

  const ariaAd = document.querySelector('[aria-label^="Ad playing"]');
  if (ariaAd) {
    return true;
  }

  return false;
}

function getAllVideos() {
  return Array.from(document.querySelectorAll("video")).filter(
    (v) => v.readyState >= 2 || v.src || v.currentSrc
  );
}

function setSafePlaybackRate(video, preferredRates) {
  if (!video || video.readyState < 2) return;

  for (const rate of preferredRates) {
    if (video.playbackRate === rate) return;
    try {
      video.playbackRate = rate;
      if (video.playbackRate === rate) return;
    } catch (_) {
      // Silently skip unsupported rates for DRM/MSE streams
    }
  }
}

function enforceAdPlayback(video) {
  if (!video.muted) {
    video.muted = true;
  }
  setSafePlaybackRate(video, new Array(8, 4, 2));
}

function restoreNormalPlayback() {
  const videos = getAllVideos();
  videos.forEach((v) => {
    v.muted = false;
    if (v.volume === 0) {
      v.volume = 1;
    }
    setSafePlaybackRate(v, new Array(1));
  });
}

document.addEventListener(
  "ratechange",
  (e) => {
    if (isAdActive && e.target instanceof HTMLVideoElement) {
      enforceAdPlayback(e.target);
    }
  },
  true
);

document.addEventListener(
  "volumechange",
  (e) => {
    if (isAdActive && e.target instanceof HTMLVideoElement && !e.target.muted) {
      e.target.muted = true;
    }
  },
  true
);

setInterval(() => {
  const adPlaying = detectAmazonAd();
  const videos = getAllVideos();

  if (adPlaying && !isAdActive) {
    isAdActive = true;
    if (restoreTimer) {
      clearInterval(restoreTimer);
      restoreTimer = null;
    }
    console.log("[Prime Ad Speedup] AD DETECTED! Muting and speeding up.");
  }

  if (adPlaying) {
    videos.forEach(enforceAdPlayback);
  } else if (!adPlaying && isAdActive) {
    isAdActive = false;
    console.log("[Prime Ad Speedup] AD FINISHED! Unmuting and restoring 1x speed.");

    restoreNormalPlayback();
    let attempts = 0;
    restoreTimer = setInterval(() => {
      restoreNormalPlayback();
      attempts += 1;
      if (attempts >= 6) {
        clearInterval(restoreTimer);
        restoreTimer = null;
      }
    }, 250);
  }
}, 200);