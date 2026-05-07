import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "http://localhost:5000/api";

// Génération ou récupération de l'ID unique du navigateur
let clientId = localStorage.getItem("client_id");
if (!clientId) {
  clientId = "usr_" + Math.random().toString(36).substring(2, 15);
  localStorage.setItem("client_id", clientId);
}

const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// Fonction fetch améliorée pour injecter l'identifiant client dans les en-têtes
const apiFetch = async (path, method = "GET") => {
  const res = await fetch(`${API_BASE}${path}`, { 
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Client-ID": clientId
    }
  });
  if (!res.ok) throw new Error(`Erreur API : ${res.status}`);
  return res.json();
};

export default function App() {
  const [price, setPrice] = useState(15);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // AJOUTE CES DEUX LIGNES ICI :
  const [error, setError] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const intervalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadInitialState = async () => {
      try {
        const data = await apiFetch("/state");
        if (isMounted) {
          setPrice(data.price);
          setTimeRemaining(data.time_remaining);
          setIsRunning(data.is_running);
          setIsFinished(data.is_finished);
        }
      } catch (e) { console.error("Erreur init"); }
    };

    loadInitialState();

    return () => { isMounted = false; };
  }, []); // Une seule fois au démarrage

  // GESTION DU TIMER (Séparée pour plus de contrôle)
  useEffect(() => {
    // 1. On nettoie TOUJOURS avant de commencer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 2. On ne lance le timer que si nécessaire
    if (isRunning && !isFinished) {
      console.log("Lancement du timer unique");
      intervalRef.current = setInterval(async () => {
        try {
          const data = await apiFetch("/tick", "POST");
          setPrice(data.price);
          setTimeRemaining(data.time_remaining);
          setIsFinished(data.is_finished);
          
          if (data.is_finished) {
            clearInterval(intervalRef.current);
          }
        } catch (e) { console.error("Tick error"); }
      }, 1000);
    }

    // 3. Nettoyage au démontage
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isFinished]); // Se relance seulement si ces états changent

  // GESTION DU MOUVEMENT
  useEffect(() => {
    const handleMove = () => {
      if (!isRunning && !isFinished) {
        apiFetch("/start", "POST").then(() => setIsRunning(true));
      }
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [isRunning, isFinished]);

  const handlePayment = async () => {
    setIsRedirecting(true);
    try {
      const data = await apiFetch("/checkout", "POST");
      window.location.href = data.checkout_url;
    } catch (err) {
      setError("Erreur lors de la création du paiement.");
      setIsRedirecting(false);
    }
  };

  const progress = isFinished ? 0 : timeRemaining / 300;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;500&display=swap');
        :root {
          --bg: #0a0a0f; --surface: #13131c; --border: #1e1e2e;
          --accent: ${isFinished ? "#ff4444" : "#00f2ff"}; --text: #e8e8f0; --muted: #5a5a7a;
        }
        body { background: var(--bg); color: var(--text); font-family: 'DM Mono', monospace; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { display: flex; flex-direction: column; align-items: center; gap: 2rem; padding: 3rem; background: var(--surface); border: 1px solid var(--border); }
        .timer-value { font-family: 'Bebas Neue', sans-serif; font-size: 3.5rem; color: var(--accent); }
        .price-value { font-family: 'Bebas Neue', sans-serif; font-size: 5rem; line-height: 1; }
        .pay-btn {
          margin-top: 1rem; padding: 1rem 2rem;
          background: var(--accent); color: var(--bg);
          border: none; font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem; cursor: pointer; transition: transform 0.2s, opacity 0.2s;
          letter-spacing: 0.1em;
        }
        .pay-btn:hover { transform: scale(1.05); opacity: 0.9; }
        .pay-btn:disabled { background: var(--muted); cursor: not-allowed; }
        .ring-progress {
          fill: none; stroke: var(--accent); stroke-width: 6; stroke-linecap: round;
          stroke-dasharray: ${circumference}; stroke-dashoffset: ${dashOffset};
          transition: stroke-dashoffset 1s linear;
        }
      `}</style>

      <div className="container">
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.4em' }}>SÉCURISATION DES ACTIFS</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--muted)', marginTop: '-1.5rem' }}>ID CLIENT : {clientId}</span>

        <div style={{ position: 'relative', width: '220px', height: '220px' }}>
          <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="110" cy="110" r={radius} stroke="var(--border)" strokeWidth="4" fill="none" />
            <circle className="ring-progress" cx="110" cy="110" r={radius} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="timer-value">{isFinished ? "--:--" : formatTime(timeRemaining)}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="price-value">{price}€</div>
        </div>

        <button 
          className="pay-btn" 
          onClick={handlePayment} 
          disabled={isRedirecting}
        >
          {isRedirecting ? "REDIRECTION..." : "PAYER EN CRYPTOMONNAIE"}
        </button>

        <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textAlign: 'center' }}>
          PAIEMENT SÉCURISÉ VIA GATEWAY SSL<br/>
          CHAQUE SESSION EST INDÉPENDANTE ET SÉCURISÉE
        </div>
      </div>

      {error && <div style={{ position: 'fixed', bottom: '20px', color: '#ff4444' }}>⚠ {error}</div>}
    </>
  );
}