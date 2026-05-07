"""
app.py - Backend Flask mis à jour
- Déclenchement unique (ne s'arrête plus après lancement)
- Doublement du prix toutes les 5 minutes
- Arrêt de sécurité à 10 000€
"""

from flask import Flask, jsonify
from flask_cors import CORS
import json
import os
import time

app = Flask(__name__)
CORS(app)

STATE_FILE = "state.json"
MAX_PRICE = 10000

DEFAULT_STATE = {
    "price": 15,
    "time_remaining": 300,
    "is_running": False,
    "is_finished": False  # État si on a atteint les 10 000€
}

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                state = json.load(f)
            
            # Calcul du temps écoulé hors ligne si le compteur était actif
            if state.get("is_running") and not state.get("is_finished") and state.get("last_saved_at"):
                elapsed = time.time() - state["last_saved_at"]
                total_time_left = state["time_remaining"] - elapsed
                
                while total_time_left <= 0 and state["price"] < MAX_PRICE:
                    state["price"] *= 2
                    if state["price"] >= MAX_PRICE:
                        state["price"] = MAX_PRICE
                        state["is_finished"] = True
                        state["time_remaining"] = 0
                        break
                    total_time_left += 300
                
                if not state["is_finished"]:
                    state["time_remaining"] = total_time_left
                    
            return state
        except Exception:
            return DEFAULT_STATE.copy()
    return DEFAULT_STATE.copy()

def save_state(state):
    state["last_saved_at"] = time.time()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

current_state = load_state()

@app.route("/api/state", methods=["GET"])
def get_state():
    return jsonify(current_state)

@app.route("/api/tick", methods=["POST"])
def tick():
    global current_state
    
    if current_state["is_running"] and not current_state["is_finished"]:
        current_state["time_remaining"] -= 1

        # Logique de boucle et doublement
        if current_state["time_remaining"] <= 0:
            new_price = current_state["price"] * 2
            
            if new_price >= MAX_PRICE:
                current_state["price"] = MAX_PRICE
                current_state["is_finished"] = True
                current_state["time_remaining"] = 0
                print("[ALERT] Seuil de 10 000€ atteint. Arrêt du compteur.")
            else:
                current_state["price"] = new_price
                current_state["time_remaining"] = 300
                print(f"[INFO] Boucle ! Nouveau prix : {current_state['price']}€")

        save_state(current_state)

    return jsonify(current_state)

@app.route("/api/start", methods=["POST"])
def start():
    global current_state
    # Une fois lancé, on ne peut plus l'arrêter (is_running reste True)
    if not current_state["is_running"]:
        current_state["is_running"] = True
        save_state(current_state)
        print("[INFO] Compteur démarré définitivement.")
    return jsonify({"status": "started"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)