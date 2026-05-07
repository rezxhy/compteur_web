"""
app.py - Backend Flask Optimisé (Hybride RAM + SQLite)
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import time
import collections

app = Flask(__name__)
CORS(app)

DB_FILE = "database.db"
MAX_PRICE = 10000

# Dictionnaire pour gérer les calculs ultra-rapides en RAM
active_sessions = {}

event_log = collections.deque(maxlen=100)
API_TOKEN = "caca123"

def check_token():
    """Vérifie Bearer ou X-API-Key"""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:] == API_TOKEN:
        return True
    if request.headers.get("X-API-Key", "") == API_TOKEN:
        return True
    return False

@app.route("/api/event", methods=["POST"])
def receive_event():
    if API_TOKEN and not check_token():
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json(silent=True) or {}
    data["received_at"] = time.time()
    event_log.append(data)
    print(f"[EVENT] {data.get('type')} | {data.get('payload')}")
    return jsonify({"status": "ok"}), 200

@app.route("/api/events", methods=["GET"])
def list_events():
    return jsonify(list(event_log))

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        # L'utilisation de IF NOT EXISTS est cruciale
        conn.execute("""
            CREATE TABLE IF NOT EXISTS states (
                client_id TEXT PRIMARY KEY,
                price INTEGER DEFAULT 15,
                time_remaining REAL DEFAULT 300,
                is_running INTEGER DEFAULT 0,
                is_finished INTEGER DEFAULT 0,
                last_saved_at REAL
            )
        """)
        conn.commit()
        print("Base de données initialisée.")

def get_db_state(client_id):
    """Récupère l'état depuis SQLite (appelé uniquement au chargement initial)"""
    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM states WHERE client_id = ?", (client_id,))
        row = cursor.fetchone()
        
        if row is None:
            now = time.time()
            cursor.execute("""
                INSERT INTO states (client_id, price, time_remaining, is_running, is_finished, last_saved_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (client_id, 15, 300, 0, 0, now))
            conn.commit()
            return {"price": 15, "time_remaining": 300, "is_running": False, "is_finished": False, "last_saved_at": now}
        
        return {
            "price": row["price"],
            "time_remaining": row["time_remaining"],
            "is_running": bool(row["is_running"]),
            "is_finished": bool(row["is_finished"]),
            "last_saved_at": row["last_saved_at"]
        }

def save_db_state(client_id, state):
    """Sauvegarde l'état actuel en base de données"""
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""
            UPDATE states 
            SET price = ?, time_remaining = ?, is_running = ?, is_finished = ?, last_saved_at = ?
            WHERE client_id = ?
        """, (state["price"], state["time_remaining"], 1 if state["is_running"] else 0, 
              1 if state["is_finished"] else 0, time.time(), client_id))
        conn.commit()

def get_client_id():
    return request.headers.get("X-Client-ID", "default_client")

def get_state_fast(client_id):
    """Récupère l'état depuis la RAM ou charge depuis la DB si absent"""
    if client_id not in active_sessions:
        state = get_db_state(client_id)
        # Calcul du temps écoulé si le serveur a été coupé
        if state["is_running"] and not state["is_finished"]:
            elapsed = time.time() - state["last_saved_at"]
            state["time_remaining"] -= elapsed
            while state["time_remaining"] <= 0 and state["price"] < MAX_PRICE:
                state["price"] *= 2
                state["time_remaining"] += 300
            if state["price"] >= MAX_PRICE:
                state["price"] = MAX_PRICE
                state["is_finished"] = True
                state["time_remaining"] = 0
        
        state["last_saved_at"] = time.time()
        active_sessions[client_id] = state
    return active_sessions[client_id]

@app.route("/api/state", methods=["GET"])
def get_state():
    client_id = get_client_id()
    state = get_state_fast(client_id)
    return jsonify(state)

@app.route("/api/tick", methods=["POST"])
def tick():
    client_id = get_client_id()
    state = get_state_fast(client_id)
    
    if state["is_running"] and not state["is_finished"]:
        now = time.time()
        elapsed = now - state["last_saved_at"]
        
        # On ignore si la requête arrive moins de 0.8s après la précédente
        if elapsed < 0.8:
            return jsonify(state)

        # Mise à jour
        state["time_remaining"] -= elapsed
        state["last_saved_at"] = now

        # Gestion du changement de prix
        if state["time_remaining"] <= 0:
            state["price"] *= 2
            if state["price"] >= MAX_PRICE:
                state["price"] = MAX_PRICE
                state["is_finished"] = True
                state["time_remaining"] = 0
            else:
                state["time_remaining"] = 300
            save_db_state(client_id, state) # Sauvegarde immédiate
        
        # Sauvegarde en DB moins fréquente (toutes les 30s) pour éviter les lags
        elif int(state["time_remaining"]) % 30 == 0:
            # On vérifie qu'on ne sauvegarde pas 10 fois par seconde
            save_db_state(client_id, state)
            
    return jsonify(state)

@app.route("/api/start", methods=["POST"])
def start():
    client_id = get_client_id()
    state = get_state_fast(client_id)
    if not state["is_running"]:
        state["is_running"] = True
        state["last_saved_at"] = time.time()
        save_db_state(client_id, state)
    return jsonify({"status": "started", "state": state})

@app.route("/api/checkout", methods=["POST"])
def create_checkout():
    client_id = get_client_id()
    state = get_state_fast(client_id)
    payment_url = f"https://commerce.coinbase.com/checkout/example?amount={state['price']}"
    return jsonify({"checkout_url": payment_url})

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)