================================================================================
COMPTEUR WEB
Date    : 10 Mai 2026
Stack   : Python (Flask) + React (JSX) + SQLite
================================================================================
DESCRIPTION
-----------
Application web interactive dont le prix augmente avec le temps.
Le prix démarre à 15€ et double toutes les 5 minutes jusqu'à atteindre
10 000€ (plafond). Le compte à rebours se déclenche dès que l'utilisateur
bouge sa souris sur la page. Le paiement final s'effectue en cryptomonnaie
via Coinbase Commerce.

Chaque utilisateur dispose d'une session indépendante identifiée par un ID
client unique généré côté navigateur et persisté en localStorage.

ARCHITECTURE
------------
Backend  : Flask (Python) — app.py
Frontend : React (JSX)   — App.jsx
Base de données : SQLite  — database.db (créée automatiquement)

FONCTIONNEMENT
--------------
1. L'utilisateur arrive sur la page — son ID client est généré (ou récupéré).
2. Dès qu'il bouge la souris, le timer démarre (appel POST /api/start).
3. Chaque seconde, le frontend envoie un tick (POST /api/tick) :
   - le backend calcule le temps écoulé et met à jour le timer en RAM.
   - si le timer atteint 0, le prix double et repart à 300 secondes.
   - si le prix atteint 10 000€, la session est marquée "terminée".
4. L'utilisateur peut payer à tout moment via le bouton — il est redirigé
   vers la page Coinbase Commerce avec le montant actuel.

Persistance hybride (RAM + SQLite) :
- Les calculs se font en mémoire vive pour la performance.
- Une sauvegarde SQLite est effectuée toutes les 30 secondes,
  et immédiatement à chaque changement de prix.
- En cas de redémarrage du serveur, le temps écoulé est recalculé
  automatiquement depuis la dernière sauvegarde.

ENDPOINTS API
-------------
GET  /api/state      Récupère l'état courant de la session
POST /api/tick       Met à jour le timer (appelé chaque seconde)
POST /api/start      Démarre le compte à rebours
POST /api/checkout   Génère l'URL de paiement Coinbase Commerce
POST /api/event      Enregistre un événement (protégé par token)
GET  /api/events     Liste les 100 derniers événements

SÉCURITÉ
--------
- Authentification par Bearer Token ou header X-API-Key (endpoint /api/event)
- Throttling côté backend : les ticks arrivant en moins de 0.8s sont ignorés
- Sessions isolées par X-Client-ID (un état par navigateur)
- CORS activé via flask-cors

INSTALLATION & LANCEMENT
-------------------------
Prérequis : Python 3.8+, Node.js 18+

-- Backend --
  pip install flask flask-cors
  python app.py
  → Serveur disponible sur http://localhost:5000

-- Frontend --
  npm install
  npm run dev
  → Interface disponible sur http://localhost:5173 (ou port Vite par défaut)

VARIABLES DE CONFIGURATION (app.py)
------------------------------------
  MAX_PRICE  = 10000   Prix maximum en euros
  API_TOKEN  = "..."   Token d'authentification pour /api/event
  DB_FILE    = "database.db"   Chemin de la base SQLite

STRUCTURE DU PROJET
-------------------
  app.py          Backend Flask (API REST + logique métier)
  App.jsx         Frontend React (UI + timer + paiement)
  database.db     Base SQLite (générée automatiquement au premier lancement)

TECHNOLOGIES UTILISÉES
-----------------------
  Python      Flask, flask-cors, sqlite3, collections.deque
  JavaScript  React, hooks (useState, useEffect, useRef, useCallback)
  CSS         Variables CSS, animations SVG (anneau de progression)
  Paiement    Coinbase Commerce (cryptomonnaie)
  Base de données  SQLite (persistance légère, sans serveur)

================================================================================
