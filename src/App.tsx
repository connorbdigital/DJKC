import { BookingChat } from "./components/BookingChat";
import { BookBar } from "./components/BookBar";
import { UpdatesSignup } from "./components/UpdatesSignup";
import { useCallback, useEffect, useRef, useState } from "react";
import { HouseEngine } from "./audio";
import { TRACKS } from "./data";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SocialProof } from "./components/SocialProof";
import { Marquee } from "./components/Marquee";
import { Experience } from "./components/Experience";
import { Music } from "./components/Music";
import { Benefits } from "./components/Benefits";
import { Shows } from "./components/Shows";
import { Testimonials } from "./components/Testimonials";
import { Pricing } from "./components/Pricing";
import { Faq } from "./components/Faq";
import { Booking } from "./components/Booking";
import { Footer } from "./components/Footer";
import { useThemeColor } from "./utils/themeColor";

const SPY_IDS = ["music", "experience", "shows", "pricing", "faq"];

export default function App() {
  useThemeColor();
  const engineRef = useRef<HouseEngine | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [tier, setTier] = useState("Signature Live");
  const playRequest = useRef(0);
  const [audioError, setAudioError] = useState("");
  const [active, setActive] = useState("");

  const ensureEngine = () => (engineRef.current ??= new HouseEngine());

  useEffect(() => {
    return () => engineRef.current?.dispose();
  }, []);

  // scrollspy
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-38% 0px -55% 0px", threshold: 0 }
    );
    for (const id of SPY_IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  const playTrack = async (i: number, mute = muted) => {
    const request = ++playRequest.current;
    setAudioError("");
    const e = ensureEngine();
    e.setVolume(volume);
    e.setMuted(mute);
    try {
      if (await e.play(i) && request === playRequest.current) {
        setTrackIndex(i);
        setPlaying(true);
      }
    } catch {
      if (request === playRequest.current) {
        setPlaying(false);
        setAudioError("Audio could not start. Try Play again or listen on SoundCloud below.");
      }
    }
  };

  const togglePlay = () => {
    if (playing) {
      playRequest.current++;
      engineRef.current?.stop();
      setPlaying(false);
    } else {
      playTrack(trackIndex);
    }
  };

  const selectTrack = (i: number) => {
    if (playing) {
      playTrack(i);
    } else {
      setTrackIndex(i);
      engineRef.current?.setTrack(i);
    }
  };

  const navSound = () => {
    if (!playing) {
      setMuted(false);
      playTrack(trackIndex, false);
    } else {
      const m = !muted;
      setMuted(m);
      engineRef.current?.setMuted(m);
    }
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
    if (v > 0 && muted) {
      setMuted(false);
      engineRef.current?.setMuted(false);
    }
  };

  const getAnalyser = useCallback(() => engineRef.current?.analyser ?? null, []);
  const getElapsed = useCallback(() => engineRef.current?.getElapsed() ?? 0, []);

  const heroListen = () => {
    if (playing) {
      togglePlay();
    } else {
      playTrack(trackIndex);
      document.getElementById("music")?.scrollIntoView();
    }
  };

  const chooseTier = (name: string) => {
    setTier(name);
    document.getElementById("book")?.scrollIntoView();
  };

  const track = TRACKS[trackIndex];

  return (
    <div className="noise relative min-h-screen">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-magenta focus:px-5 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <Navbar active={active} playing={playing} muted={muted} onSound={navSound} />

      <main id="content" tabIndex={-1}>
        <Hero onListen={heroListen} playing={playing} trackTitle={`${track.title} — ${track.mix}`} bpm={track.bpm} />
        <SocialProof />
        <Marquee />
        <Experience />
        <Music
          trackIndex={trackIndex}
          playing={playing}
          muted={muted}
          volume={volume}
          onSelect={selectTrack}
          onPlay={playTrack}
          audioError={audioError}
          onToggle={togglePlay}
          onVolume={changeVolume}
          getAnalyser={getAnalyser}
          getElapsed={getElapsed}
        />
        <Benefits />
        <Shows />
        <Testimonials />
        <Pricing onChoose={chooseTier} />
        <Faq />
        <Booking tier={tier} onTier={setTier} />
      </main>

      <Footer />
      <BookingChat />
      <UpdatesSignup />
      <BookBar />
    </div>
  );
}