import { useEffect, useRef, useState } from "react";
import { Play, WifiOff } from "lucide-react";
import type { TrainingVideo } from "../types";

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  return online;
}

/**
 * NASA training video. Nothing loads until the user presses play (no autoplay, no third-party request on page load).
 * Offline or failed media shows an unavailable state; the rest of the page keeps working.
 */
export function VideoPlayer({ video, onWatched }: { video: TrainingVideo; onWatched: () => void }) {
  const online = useOnline();
  // Short silent loops stored in the app play straight away, like the exercise clips; longer videos wait for Play.
  const isLoop = video.kind === "mp4" && !!video.offline && video.duration.includes("loop");
  const [started, setStarted] = useState(isLoop);
  const [failed, setFailed] = useState(false);
  const reported = useRef(false);
  useEffect(() => { setStarted(isLoop); setFailed(false); reported.current = false; }, [video, isLoop]);
  const local = video.kind === "mp4" && !!video.offline;
  const url = (u: string) => (u.startsWith("http") ? u : `${import.meta.env.BASE_URL}${u}`);
  const watched = () => { if (!reported.current) { reported.current = true; onWatched(); } };

  // One short credit line, matching the exercise clips. Details stay in the link and the tooltip.
  const attribution = (
    <p className="video-credit" title={video.shows}>
      Reference: <a href={video.page} target="_blank" rel="noreferrer">{video.credit}</a>
    </p>
  );

  if ((!online && !local) || failed)
    return (
      <figure className="video">
        <div className="video-frame unavailable" role="status">
          <WifiOff size={22} aria-hidden="true" />
          <strong>Video unavailable</strong>
          <span>{!online ? "This video streams from NASA and is not stored for offline use. The checklist and session log still work." : "The video could not be loaded from NASA. Try again later; the checklist and session log still work."}</span>
          {failed && online && <button className="btn btn-secondary sm" onClick={() => { setFailed(false); setStarted(true); }}>Retry</button>}
        </div>
        {attribution}
      </figure>
    );

  return (
    <figure className="video">
      {!started ? (
        <button className="video-frame poster" onClick={() => setStarted(true)} aria-label={`Play video: ${video.title} (${video.duration})`}>
          <span className="play"><Play size={22} aria-hidden="true" /></span>
          <span className="poster-title">{video.title}</span>
          <span className="poster-meta">{video.credit} · {video.duration}</span>
        </button>
      ) : video.kind === "youtube" ? (
        <div className="video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&cc_load_policy=1&rel=0&modestbranding=1`}
            title={`${video.title} (${video.credit})`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="video-frame">
          <video
            controls={!isLoop}
            autoPlay
            loop={isLoop}
            muted={isLoop}
            preload="metadata"
            playsInline
            crossOrigin={video.crossOrigin ? "anonymous" : undefined}
            onError={() => setFailed(true)}
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration && v.currentTime / v.duration >= 0.9) watched(); }}
            onEnded={watched}
            aria-label={`${video.title}, ${video.credit}`}
          >
            <source src={url(video.src)} type="video/mp4" onError={() => setFailed(true)} />
            {video.track && <track kind="captions" srcLang="en" label="English" src={url(video.track)} default />}
          </video>
        </div>
      )}
      {attribution}
      {started && video.kind === "youtube" && (
        <button className="btn btn-link sm" onClick={watched}>I watched this video</button>
      )}
    </figure>
  );
}
