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
import ssl

from liveness import is_blinking, has_head_movement, detect_face_quality


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


@app.post('/liveness-check')
def liveness_check():
    """
    Endpoint specifically for liveness detection without face recognition.
    Useful for testing liveness detection separately.
    """
    try:
        print(f"Liveness check request received. Files: {list(request.files.keys())}")
        print(f"Content-Type: {request.content_type}")
        print(f"Form data: {list(request.form.keys())}")
        
        if 'images' not in request.files:
            print("No 'images' field in request files")
            return jsonify({"message": "'images' field with multiple image files required"}), 400

        image_files = request.files.getlist('images')
        if not image_files:
            return jsonify({"message": "No images provided"}), 400

        face_locations_list = []
        face_landmarks_list = []

        for file in image_files:
            try:
                image_bytes = file.read()
                if not image_bytes:
                    continue

                pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                img_array = np.array(pil_image)

                # Face detection
                face_locations = face_recognition.face_locations(img_array)
                if not face_locations:
                    continue
                face_locations_list.append(face_locations[0])

                # Face landmarks for liveness detection
                face_landmarks = face_recognition.face_landmarks(img_array, face_locations)
                if face_landmarks:
                    face_landmarks_list.append(face_landmarks[0])
            except Exception as e:
                print(f"Error processing image: {e}")
                continue

        if not face_landmarks_list:
            return jsonify({"message": "No faces detected in any of the provided images"}), 400

        # Liveness Detection
        liveness_details = {
            "blinking_detected": False,
            "head_movement_detected": False,
            "face_quality": {},
            "total_frames": len(face_landmarks_list)
        }

        try:
            if face_landmarks_list:
                liveness_details["blinking_detected"] = bool(is_blinking(face_landmarks_list))
                liveness_details["face_quality"] = detect_face_quality(face_landmarks_list[0], face_locations_list[0])

            if face_locations_list:
                liveness_details["head_movement_detected"] = bool(has_head_movement(face_locations_list))
        except Exception as e:
            print(f"Error in liveness detection: {e}")
            return jsonify({"message": f"Liveness detection error: {str(e)}"}), 500

        # Overall liveness assessment - require both blinking and head movement
        liveness_passed = (liveness_details["blinking_detected"] and 
                          liveness_details["head_movement_detected"])

        return jsonify({
            "liveness_passed": liveness_passed,
            "liveness_details": liveness_details
        })
    except Exception as e:
        print(f"Unexpected error in liveness_check: {e}")
        return jsonify({"message": f"Internal server error: {str(e)}"}), 500


@app.post('/recognize')
def recognize():
    try:
        store.ensure_loaded()
        
        print(f"Recognize request received. Files: {list(request.files.keys())}")
        print(f"Content-Type: {request.content_type}")
        print(f"Form data: {list(request.form.keys())}")
        
        # Check if single image or multiple images for liveness detection
        if 'images' in request.files:
            # Multiple images for liveness detection
            image_files = request.files.getlist('images')
            if not image_files:
                return jsonify({"message": "No images provided"}), 400
            
            face_locations_list = []
            face_landmarks_list = []
            face_encodings_list = []
            
            for file in image_files:
                image_bytes = file.read()
                if not image_bytes:
                    continue
                    
                pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                img_array = np.array(pil_image)
                
                # Face detection with more lenient parameters
                face_locations = face_recognition.face_locations(img_array, model="hog")  # Use HOG model for better detection
                if not face_locations:
                    print(f"No faces detected in image {len(face_locations_list) + 1}")
                    continue
                
                # Take the largest face if multiple faces detected
                largest_face = max(face_locations, key=lambda face: (face[2] - face[0]) * (face[3] - face[1]))
                face_locations_list.append(largest_face)
                
                # Face landmarks for liveness detection
                face_landmarks = face_recognition.face_landmarks(img_array, [largest_face])
                if face_landmarks:
                    face_landmarks_list.append(face_landmarks[0])
                
                # Face encodings for recognition
                face_encodings = face_recognition.face_encodings(img_array, [largest_face])
                if face_encodings:
                    face_encodings_list.append(face_encodings[0])
            
            if not face_encodings_list:
                return jsonify({"message": "No faces detected in any of the provided images"}), 400
            
            # Liveness Detection
            liveness_passed = False
            liveness_details = {
                "blinking_detected": False,
                "head_movement_detected": False,
                "face_quality": {}
            }
            
            if face_landmarks_list:
                liveness_details["blinking_detected"] = bool(is_blinking(face_landmarks_list))
                liveness_details["face_quality"] = detect_face_quality(face_landmarks_list[0], face_locations_list[0])
            
            if face_locations_list:
                liveness_details["head_movement_detected"] = bool(has_head_movement(face_locations_list))
            
            # Require both blinking and head movement for liveness
            liveness_passed = (liveness_details["blinking_detected"] and 
                              liveness_details["head_movement_detected"])
            
            if not liveness_passed:
                return jsonify({
                    "message": "Liveness check failed",
                    "liveness_details": liveness_details
                }), 403
            
            # Face Recognition (using the first detected face encoding)
            enc = face_encodings_list[0]
            (top, right, bottom, left) = face_locations_list[0]
            
        else:
            # Single image (legacy support)
            if 'image' not in request.files:
                return jsonify({"message": "image field required"}), 400
            file = request.files['image']
            image_bytes = file.read()
            if not image_bytes:
                return jsonify({"message": "empty image"}), 400

            pil = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            img = np.array(pil)
            faces = face_recognition.face_locations(img, model="hog")
            if not faces:
                return jsonify({"matches": []})
            
            encs = face_recognition.face_encodings(img, faces)
            face_landmarks = face_recognition.face_landmarks(img, faces)
            
            # Basic liveness check for single image
            liveness_passed = True
            liveness_details = {
                "blinking_detected": False,
                "head_movement_detected": False,
                "face_quality": {}
            }
            
            if face_landmarks:
                liveness_details["face_quality"] = detect_face_quality(face_landmarks[0], faces[0])
            
            enc = encs[0]
            (top, right, bottom, left) = faces[0]

        results = []
        if store.encodings:
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
                "liveness_passed": liveness_passed,
                "liveness_details": liveness_details
            })

        return jsonify({"matches": results})
    except Exception as e:
        print(f"Unexpected error in recognize: {e}")
        return jsonify({"message": f"Internal server error: {str(e)}"}), 500


if __name__ == '__main__':
    # Lazy load at start
    store.ensure_loaded(force=True)
    
    # Try to run with HTTPS
    try:
        ssl_cert = os.path.join(REPO_ROOT, 'ssl', 'cert.pem')
        ssl_key = os.path.join(REPO_ROOT, 'ssl', 'key.pem')
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(ssl_cert, ssl_key)
        app.run(host='0.0.0.0', port=8001, ssl_context=context)
    except Exception as e:
        print(f"HTTPS failed, falling back to HTTP: {e}")
        app.run(host='0.0.0.0', port=8001)



