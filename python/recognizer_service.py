import os
import io
import json
import time
from typing import Dict, List, Tuple

from flask import Flask, request, jsonify
from PIL import Image
import numpy as np
import face_recognition
import psycopg2


DB_USER = os.getenv('DB_USER', 'postgres')
DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_NAME = os.getenv('DB_NAME', 'face_recognition_attendance')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'rithu123')
DB_PORT = int(os.getenv('DB_PORT', '5432'))

# Base directory for stored face images relative to repository root
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKEND_ROOT = os.path.join(REPO_ROOT, 'backend')


def get_db_conn():
    return psycopg2.connect(
        user=DB_USER,
        host=DB_HOST,
        dbname=DB_NAME,
        password=DB_PASSWORD,
        port=DB_PORT,
    )


def load_known_faces() -> Tuple[List[np.ndarray], List[str], Dict[str, Dict[str, str]]]:
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT staff_id, full_name, COALESCE(face_encoding, ''), COALESCE(face_image_path, '')
            FROM staff
            WHERE is_active = TRUE
            """
        )
        rows = cur.fetchall()
    finally:
        if conn:
            conn.close()

    encodings: List[np.ndarray] = []
    staff_ids: List[str] = []
    staff_meta: Dict[str, Dict[str, str]] = {}

    for staff_id, full_name, face_encoding_text, face_image_path in rows:
        encoding_loaded = False
        if face_encoding_text:
            try:
                arr = np.array(json.loads(face_encoding_text), dtype='float64')
                if arr.ndim == 1 and arr.shape[0] == 128:
                    encodings.append(arr)
                    staff_ids.append(staff_id)
                    staff_meta[staff_id] = {"full_name": full_name}
                    encoding_loaded = True
            except Exception:
                pass
        if not encoding_loaded and face_image_path:
            # Build absolute path if relative like 'uploads/faces/...'
            img_path = face_image_path
            if not os.path.isabs(img_path):
                img_path = os.path.join(BACKEND_ROOT, img_path)
            if os.path.exists(img_path):
                image = face_recognition.load_image_file(img_path)
                encs = face_recognition.face_encodings(image)
                if encs:
                    encodings.append(encs[0])
                    staff_ids.append(staff_id)
                    staff_meta[staff_id] = {"full_name": full_name}

    return encodings, staff_ids, staff_meta


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@app.route('/recognize', methods=['OPTIONS'])
def recognize_options():
    return ('', 204)


@app.route('/reload', methods=['OPTIONS'])
def reload_options():
    return ('', 204)


@app.route('/health', methods=['OPTIONS'])
def health_options():
    return ('', 204)


class FaceStore:
    def __init__(self):
        self.encodings: List[np.ndarray] = []
        self.staff_ids: List[str] = []
        self.staff_meta: Dict[str, Dict[str, str]] = {}
        self.last_loaded = 0.0

    def ensure_loaded(self, force: bool = False):
        now = time.time()
        if force or (now - self.last_loaded > 60) or not self.encodings:
            self.encodings, self.staff_ids, self.staff_meta = load_known_faces()
            self.last_loaded = now


store = FaceStore()


@app.get('/health')
def health():
    return jsonify({"status": "ok", "known": len(store.staff_ids)})


@app.post('/reload')
def reload_data():
    store.ensure_loaded(force=True)
    return jsonify({"reloaded": True, "known": len(store.staff_ids)})


@app.post('/recognize')
def recognize():
    store.ensure_loaded()
    if 'image' not in request.files:
        return jsonify({"message": "image field required"}), 400
    file = request.files['image']
    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"message": "empty image"}), 400

    pil = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = np.array(pil)
    faces = face_recognition.face_locations(img)
    if not faces:
        return jsonify({"matches": []})
    encs = face_recognition.face_encodings(img, faces)

    results = []
    for enc, (top, right, bottom, left) in zip(encs, faces):
        if not store.encodings:
            continue
        distances = face_recognition.face_distance(store.encodings, enc)
        best_idx = int(np.argmin(distances))
        best_dist = float(distances[best_idx])
        staff_id = store.staff_ids[best_idx]
        meta = store.staff_meta.get(staff_id, {})
        # Convert distance to a rough similarity score
        score = max(0.0, 1.0 - best_dist)
        matched = best_dist < 0.6
        results.append({
            "staffId": staff_id,
            "fullName": meta.get("full_name", staff_id),
            "bbox": [left, top, right, bottom],
            "distance": best_dist,
            "score": score,
            "matched": matched,
        })

    return jsonify({"matches": results})


if __name__ == '__main__':
    # Lazy load at start
    store.ensure_loaded(force=True)
    app.run(host='0.0.0.0', port=8001)



