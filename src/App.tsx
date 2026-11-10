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

const SPY_IDS = ["music", "experience", "shows", "pricing", "faq"];

export default function App() {
  const engineRef = useRef<HouseEngine | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [tier, setTier] = useState("Signature Live");
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

  const playTrack = (i: number) => {
    const e = ensureEngine();
    e.setVolume(volume);
    e.setMuted(false);
    setMuted(false);
    e.play(i);
    setTrackIndex(i);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (playing) {
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
      playTrack(trackIndex);
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
      document.getElementById("music")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const chooseTier = (name: string) => {
    setTier(name);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  };

  const track = TRACKS[trackIndex];

  return (
    <div className="noise relative min-h-screen">
      <a
        href="#music"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-magenta focus:px-5 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <Navbar active={active} playing={playing} muted={muted} onSound={navSound} />

      <main>
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
    </div>
  );
}