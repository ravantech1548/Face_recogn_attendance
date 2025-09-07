import numpy as np
from scipy.spatial import distance as dist

def eye_aspect_ratio(eye):
    """
    Compute the eye aspect ratio (EAR) for a given eye.
    The EAR is the ratio of the vertical distance between eye landmarks
    to the horizontal distance, which decreases during a blink.
    """
    # Compute the euclidean distances between the two sets of
    # vertical eye landmarks (x, y)-coordinates
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])

    # Compute the euclidean distance between the horizontal
    # eye landmark (x, y)-coordinates
    C = dist.euclidean(eye[0], eye[3])

    # Compute the eye aspect ratio
    ear = (A + B) / (2.0 * C)

    # Return the eye aspect ratio
    return ear

def is_blinking(face_landmarks_list, ear_thresh=0.2, ear_consecutive_frames=2):
    """
    Check for blinks in a sequence of face landmarks.
    A blink is detected if the EAR drops below a threshold for a certain number of consecutive frames.
    
    Args:
        face_landmarks_list: List of face landmarks dictionaries
        ear_thresh: Eye aspect ratio threshold for blink detection
        ear_consecutive_frames: Number of consecutive frames below threshold to consider a blink
    
    Returns:
        bool: True if blinking is detected, False otherwise
    """
    if len(face_landmarks_list) < 2:
        # If we have at least 2 frames, we can still try to detect blinking
        # but with more lenient requirements
        if len(face_landmarks_list) == 1:
            return False
        ear_consecutive_frames = 1  # More lenient for fewer frames

    blink_counter = 0
    total_blinks = 0

    for face_landmarks in face_landmarks_list:
        left_eye = np.array(face_landmarks["left_eye"])
        right_eye = np.array(face_landmarks["right_eye"])

        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)

        ear = (left_ear + right_ear) / 2.0

        if ear < ear_thresh:
            blink_counter += 1
        else:
            if blink_counter >= ear_consecutive_frames:
                total_blinks += 1
            blink_counter = 0

    if blink_counter >= ear_consecutive_frames:
        total_blinks += 1

    return total_blinks > 0

def has_head_movement(face_locations_list, movement_threshold=15):
    """
    Check if there's significant head movement between frames.
    
    Args:
        face_locations_list: List of face location tuples (top, right, bottom, left)
        movement_threshold: Minimum pixel movement to consider as head movement
    
    Returns:
        bool: True if head movement is detected, False otherwise
    """
    if len(face_locations_list) < 2:
        return False

    initial_location = face_locations_list[0]
    last_location = face_locations_list[-1]

    # Simple check for horizontal or vertical movement of the face's center
    initial_center_x = (initial_location[1] + initial_location[3]) / 2
    initial_center_y = (initial_location[0] + initial_location[2]) / 2

    last_center_x = (last_location[1] + last_location[3]) / 2
    last_center_y = (last_location[0] + last_location[2]) / 2

    movement_x = abs(initial_center_x - last_center_x)
    movement_y = abs(initial_center_y - last_center_y)

    return movement_x > movement_threshold or movement_y > movement_threshold


def detect_face_quality(face_landmarks, face_location):
    """
    Assess the quality of the detected face for recognition.
    
    Args:
        face_landmarks: Dictionary containing facial landmarks
        face_location: Tuple of (top, right, bottom, left)
    
    Returns:
        dict: Quality metrics including size, symmetry, and clarity
    """
    try:
        # Calculate face size
        face_width = face_location[1] - face_location[3]  # right - left
        face_height = face_location[2] - face_location[0]  # bottom - top
        face_size = face_width * face_height
        
        # Calculate symmetry (simplified)
        left_eye = np.array(face_landmarks["left_eye"][0])
        right_eye = np.array(face_landmarks["right_eye"][0])
        nose_tip = np.array(face_landmarks["nose_tip"][0])
        
        # Distance from nose to each eye should be similar for symmetry
        left_distance = np.linalg.norm(nose_tip - left_eye)
        right_distance = np.linalg.norm(nose_tip - right_eye)
        symmetry = 1 - abs(left_distance - right_distance) / max(left_distance, right_distance)
        
        # Check if face is too small
        min_face_size = 50 * 50  # Minimum 50x50 pixels
        size_ok = face_size > min_face_size
        
        return {
            "size": int(face_size),
            "symmetry": float(symmetry),
            "size_ok": bool(size_ok),
            "quality_score": float((symmetry + (1 if size_ok else 0)) / 2)
        }
    except Exception:
        return {
            "size": 0,
            "symmetry": 0,
            "size_ok": False,
            "quality_score": 0
        }
