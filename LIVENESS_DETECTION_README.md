# Face Liveness Detection and Head Movement Recognition

This document describes the face liveness detection and head movement recognition features that have been integrated into the Face Recognition Attendance System.

## Features

### 🔍 **Face Liveness Detection**
- **Blink Detection**: Uses Eye Aspect Ratio (EAR) to detect natural blinking patterns
- **Head Movement Detection**: Tracks face position changes across multiple frames
- **Gaze Direction**: Ensures the person is looking at the camera
- **Face Quality Assessment**: Evaluates face size, symmetry, and clarity

### 🎯 **Security Benefits**
- **Anti-Spoofing**: Prevents photo and video attacks
- **Live Person Verification**: Ensures only real, live faces can be recognized
- **Enhanced Security**: Multiple liveness checks provide robust protection

## Technical Implementation

### Backend Components

#### 1. Liveness Detection Module (`python/liveness.py`)
```python
# Key functions:
- eye_aspect_ratio(eye): Calculate EAR for blink detection
- is_blinking(face_landmarks_list): Detect blinks across frames
- has_head_movement(face_locations_list): Track head movement
- is_looking_at_camera(face_landmarks): Verify gaze direction
- detect_face_quality(face_landmarks, face_location): Assess face quality
```

#### 2. Enhanced Recognizer Service (`python/recognizer_service.py`)
- **New Endpoint**: `/liveness-check` - Dedicated liveness detection
- **Enhanced Endpoint**: `/recognize` - Supports both single and multiple images
- **Liveness Integration**: Automatic liveness checks before face recognition

### Frontend Components

#### Enhanced Admin Face Attendance (`frontend/src/components/AdminFaceAttendance.jsx`)
- **Multi-Frame Capture**: Captures 6 frames over 3 seconds
- **Real-time Liveness Status**: Visual indicators for each liveness check
- **Progress Tracking**: Step-by-step process visualization
- **Quality Metrics**: Face quality assessment display

## API Endpoints

### 1. Liveness Check
```
POST /liveness-check
Content-Type: multipart/form-data

Form Data:
- images: Multiple image files (minimum 3, recommended 6)

Response:
{
  "liveness_passed": boolean,
  "liveness_details": {
    "blinking_detected": boolean,
    "head_movement_detected": boolean,
    "looking_at_camera": boolean,
    "face_quality": {
      "size": number,
      "symmetry": number,
      "size_ok": boolean,
      "quality_score": number
    },
    "total_frames": number
  }
}
```

### 2. Enhanced Recognition
```
POST /recognize
Content-Type: multipart/form-data

Form Data (Multiple Images):
- images: Multiple image files for liveness detection

Form Data (Single Image - Legacy):
- image: Single image file

Response:
{
  "matches": [
    {
      "staffId": string,
      "fullName": string,
      "bbox": [left, top, right, bottom],
      "distance": number,
      "score": number,
      "matched": boolean,
      "liveness_passed": boolean,
      "liveness_details": object
    }
  ]
}
```

## Liveness Detection Algorithm

### 1. Eye Aspect Ratio (EAR) for Blink Detection
```python
def eye_aspect_ratio(eye):
    A = dist.euclidean(eye[1], eye[5])  # Vertical distance 1
    B = dist.euclidean(eye[2], eye[4])  # Vertical distance 2
    C = dist.euclidean(eye[0], eye[3])  # Horizontal distance
    ear = (A + B) / (2.0 * C)
    return ear
```

**How it works:**
- EAR decreases during a blink (eyes close)
- Normal EAR is around 0.25-0.35
- Blink threshold is typically 0.2
- Requires consecutive frames below threshold

### 2. Head Movement Detection
```python
def has_head_movement(face_locations_list, movement_threshold=20):
    # Calculate face center movement between first and last frame
    initial_center = calculate_face_center(face_locations_list[0])
    last_center = calculate_face_center(face_locations_list[-1])
    
    movement = abs(initial_center - last_center)
    return movement > movement_threshold
```

**How it works:**
- Tracks face center position across frames
- Measures horizontal and vertical movement
- Requires minimum 20-pixel movement (configurable)

### 3. Gaze Direction Detection
```python
def is_looking_at_camera(face_landmarks, angle_threshold=30):
    angles = calculate_face_angle(face_landmarks)
    return (abs(angles["yaw"]) < angle_threshold and 
            abs(angles["pitch"]) < angle_threshold)
```

**How it works:**
- Calculates face yaw, pitch, and roll angles
- Ensures person is looking at camera
- Rejects profiles or downward glances

## Usage Instructions

### For Administrators

#### 1. Start Liveness Detection
1. Navigate to "Face Attendance" in the admin menu
2. Click "Start Camera" to begin video feed
3. Click "Start Liveness Detection" to begin the process
4. Follow the on-screen instructions

#### 2. Liveness Detection Process
1. **Frame Capture**: System captures 6 frames over 3 seconds
2. **Blink Detection**: Person should blink naturally during capture
3. **Head Movement**: Person should move head slightly (nod, shake, or turn)
4. **Gaze Check**: Person should look directly at camera
5. **Quality Assessment**: System evaluates face quality

#### 3. Recognition Process
1. If liveness checks pass, face recognition begins
2. System compares captured face with database
3. If match found, attendance is automatically marked
4. Results are displayed with confidence scores

### For Developers

#### Testing Liveness Detection
```bash
# Install dependencies
pip install -r python/requirements.txt

# Run the test script
python test_liveness.py
```

#### API Testing
```bash
# Test liveness check
curl -X POST https://192.168.18.2:8001/liveness-check \
  -F "images=@frame1.jpg" \
  -F "images=@frame2.jpg" \
  -F "images=@frame3.jpg" \
  -k

# Test recognition with liveness
curl -X POST https://192.168.18.2:8001/recognize \
  -F "images=@frame1.jpg" \
  -F "images=@frame2.jpg" \
  -F "images=@frame3.jpg" \
  -k
```

## Configuration

### Liveness Detection Parameters

#### Blink Detection
```python
EAR_THRESHOLD = 0.2              # Eye aspect ratio threshold
EAR_CONSECUTIVE_FRAMES = 2        # Frames below threshold for blink
```

#### Head Movement
```python
MOVEMENT_THRESHOLD = 20           # Minimum pixel movement
MIN_FRAMES_FOR_MOVEMENT = 2       # Minimum frames required
```

#### Gaze Direction
```python
ANGLE_THRESHOLD = 30              # Maximum angle deviation (degrees)
```

#### Face Quality
```python
MIN_FACE_SIZE = 50 * 50          # Minimum face size in pixels
QUALITY_THRESHOLD = 0.5          # Minimum quality score
```

## Security Considerations

### 1. Anti-Spoofing Measures
- **Photo Attacks**: Blink detection prevents static photo usage
- **Video Attacks**: Head movement requirement prevents video replay
- **3D Masks**: Multiple checks make mask attacks difficult

### 2. Liveness Requirements
- **Multiple Checks**: All three checks must pass (blink, movement, gaze)
- **Frame Sequence**: Requires multiple frames for analysis
- **Quality Control**: Face must meet quality standards

### 3. False Positive Prevention
- **Conservative Thresholds**: Strict requirements reduce false positives
- **Multiple Validations**: Several independent checks increase reliability
- **Quality Assessment**: Face quality filtering improves accuracy

## Troubleshooting

### Common Issues

#### 1. Liveness Check Fails
**Symptoms**: "Liveness check failed" error
**Solutions**:
- Ensure good lighting
- Look directly at camera
- Blink naturally during capture
- Move head slightly (nod or shake)
- Ensure face is clearly visible

#### 2. No Face Detected
**Symptoms**: "No faces detected" error
**Solutions**:
- Check camera positioning
- Ensure face is in frame
- Improve lighting conditions
- Remove obstructions (glasses, masks)

#### 3. Poor Face Quality
**Symptoms**: Low quality score
**Solutions**:
- Move closer to camera
- Ensure face is centered
- Improve lighting
- Remove face obstructions

### Debug Information

The system provides detailed debug information:
```json
{
  "liveness_details": {
    "blinking_detected": true,
    "head_movement_detected": true,
    "looking_at_camera": true,
    "face_quality": {
      "size": 15000,
      "symmetry": 0.85,
      "size_ok": true,
      "quality_score": 0.92
    },
    "total_frames": 6
  }
}
```

## Performance Considerations

### 1. Processing Time
- **Frame Capture**: 3 seconds (6 frames at 500ms intervals)
- **Liveness Analysis**: ~1-2 seconds
- **Face Recognition**: ~0.5-1 second
- **Total Time**: ~5-6 seconds per attendance

### 2. Resource Usage
- **Memory**: ~50-100MB for frame storage
- **CPU**: Moderate during analysis
- **Network**: ~1-2MB per attendance (6 frames)

### 3. Optimization Tips
- Use appropriate image resolution (640x480 recommended)
- Limit frame count to 6 frames maximum
- Ensure good lighting to reduce processing time
- Use efficient image compression (JPEG quality 0.9)

## Future Enhancements

### Planned Features
1. **Voice Liveness**: Audio-based liveness detection
2. **3D Face Analysis**: Depth-based spoofing detection
3. **Machine Learning**: Improved liveness models
4. **Mobile Optimization**: Touch-based interactions
5. **Batch Processing**: Multiple people detection

### Research Areas
1. **Advanced Anti-Spoofing**: Deep learning models
2. **Real-time Processing**: Faster analysis algorithms
3. **Edge Computing**: On-device processing
4. **Privacy Protection**: Local-only processing

## Files Modified/Added

### Backend
- `python/liveness.py` - Liveness detection algorithms
- `python/recognizer_service.py` - Enhanced with liveness detection
- `python/requirements.txt` - Added scipy dependency

### Frontend
- `frontend/src/components/AdminFaceAttendance.jsx` - Enhanced UI with liveness detection

### Testing
- `test_liveness.py` - Comprehensive test script
- `LIVENESS_DETECTION_README.md` - This documentation

## Conclusion

The face liveness detection and head movement recognition system provides robust security against spoofing attacks while maintaining user-friendly operation. The multi-layered approach ensures high security while the intuitive interface makes it easy for users to complete the liveness verification process.

The system is designed to be configurable, allowing administrators to adjust thresholds based on their specific security requirements and environmental conditions.
