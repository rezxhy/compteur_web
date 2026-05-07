/**
 * App.jsx - Frontend React mis à jour
 * - Suppression du bouton et de la fonction de réinitialisation
 * - Déclenchement unique au premier mouvement
 * - Gestion du seuil de 10 000€
 */

import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "http://localhost:5000/api";

const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const apiFetch = async (path, method = "GET") => {
  const res = await fetch(`${API_BASE}${path}`, { method });
  if (!res.ok) throw new Error(`Erreur API : ${res.status}`);
  return res.json();
};

export default function App() {
  const [price, setPrice] = useState(15);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState(null);

  const tickIntervalRef = useRef(null);
  const isRunningRef = useRef(false);
  isRunningRef.current = isRunning;

  // ─── Chargement initial ──────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/state")
      .then((data) => {
        setPrice(data.price);
        setTimeRemaining(data.time_remaining);
        setIsRunning(data.is_running);
        setIsFinished(data.is_finished || false);
      })
      .catch(() => setError("Impossible de joindre le serveur Flask."));
  }, []);

  // ─── Tick (Synchronisation Backend) ──────────────────────────────────────
  const sendTick = useCallback(async () => {
    if (isFinished) return;
    try {
      const data = await apiFetch("/tick", "POST");
      setPrice(data.price);
      setTimeRemaining(data.time_remaining);
      setIsRunning(data.is_running);
      setIsFinished(data.is_finished);
      
      if (data.is_finished) {
        clearInterval(tickIntervalRef.current);
      }
    } catch {
      setError("Erreur lors de la mise à jour du compteur.");
    }
  }, [isFinished]);

  useEffect(() => {
    if (isRunning && !isFinished) {
      tickIntervalRef.current = setInterval(sendTick, 1000);
    } else {
      clearInterval(tickIntervalRef.current);
    }
    return () => clearInterval(tickIntervalRef.current);
  }, [isRunning, isFinished, sendTick]);

  // ─── Gestion du mouvement de souris (Unique) ──────────────────────────────
  useEffect(() => {
    const handleFirstMove = () => {
      if (!isRunningRef.current && !isFinished) {
        apiFetch("/start", "POST")
          .then(() => {
            setIsRunning(true);
            window.removeEventListener("mousemove", handleFirstMove);
          })
          .catch(() => setError("Erreur au démarrage du compteur."));
      }
    };

    if (!isRunning && !isFinished) {
      window.addEventListener("mousemove", handleFirstMove);
    }

    return () => window.removeEventListener("mousemove", handleFirstMove);
  }, [isRunning, isFinished]);

  // ─── Design Logic ────────────────────────────────────────────────────────
  const progress = isFinished ? 0 : timeRemaining / 300;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const hue = isFinished ? 0 : Math.round(progress * 120);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0a0f;
          --surface: #13131c;
          --border: #1e1e2e;
          --accent: ${isFinished ? "#ff4444" : `hsl(${hue}, 85%, 55%)`};
          --text: #e8e8f0;
          --muted: #5a5a7a;
        }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Mono', monospace;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.3;
          pointer-events: none;
        }
        .container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          padding: 3rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .timer-ring { position: relative; width: 220px; height: 220px; }
        .timer-ring svg { transform: rotate(-90deg); }
        .ring-bg { fill: none; stroke: var(--border); stroke-width: 4; }
        .ring-progress {
          fill: none;
          stroke: var(--accent);
          stroke-width: 6;
          stroke-linecap: round;
          stroke-dasharray: ${circumference};
          stroke-dashoffset: ${dashOffset};
          transition: stroke-dashoffset 1s linear, stroke 0.5s ease;
        }
        .timer-inner {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .timer-value { font-family: 'Bebas Neue', sans-serif; font-size: 3.5rem; color: var(--accent); }
        .price-value { font-family: 'Bebas Neue', sans-serif; font-size: 5rem; color: var(--text); line-height: 1; }
        .status { font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 0.5rem; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: ${isRunning && !isFinished ? "pulse 1.5s infinite" : "none"}; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .finished-msg { color: #ff4444; font-weight: bold; font-size: 0.8rem; letter-spacing: 0.1em; margin-top: -1rem; }
      `}</style>

      <div className="container">
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.4em' }}>SYSTÈME DE VALORISATION</span>

        <div className="timer-ring">
          <svg width="220" height="220">
            <circle className="ring-bg" cx="110" cy="110" r={radius} />
            <circle className="ring-progress" cx="110" cy="110" r={radius} />
          </svg>
          <div className="timer-inner">
            <span className="timer-value">{isFinished ? "--:--" : formatTime(timeRemaining)}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="price-value">{price}€</div>
          {isFinished && <div className="finished-msg">SEUIL MAXIMAL ATTEINT (10k€)</div>}
        </div>

        <div className="status">
          <div className="status-dot" />
          {isFinished ? "PROCESSUS TERMINÉ" : isRunning ? "COMPTEUR EN COURS" : "EN ATTENTE DE MOUVEMENT"}
        </div>
      </div>

      {error && <div style={{ position: 'fixed', bottom: '20px', color: '#ff4444' }}>⚠ {error}</div>}
    </>
  );
}