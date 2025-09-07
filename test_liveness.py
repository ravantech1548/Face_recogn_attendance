#!/usr/bin/env python3

"""
Test script for face liveness detection functionality
This script tests the liveness detection endpoints
"""

import requests
import os
import json
from PIL import Image
import numpy as np

# Configuration
RECOGNIZER_URL = 'https://192.168.18.2:8001'
BACKEND_URL = 'https://192.168.18.2:5000'

def test_health():
    """Test if the recognizer service is running"""
    try:
        response = requests.get(f'{RECOGNIZER_URL}/health', verify=False)
        print(f"Health check: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Known faces: {data.get('known', 0)}")
            return True
    except Exception as e:
        print(f"Health check failed: {e}")
    return False

def create_test_images():
    """Create some test images for liveness detection"""
    # Create a simple test image (this would normally be real face images)
    test_images = []
    
    # Create 6 test images with slight variations to simulate head movement
    for i in range(6):
        # Create a simple colored rectangle as a placeholder
        # In real testing, these would be actual face images
        img = Image.new('RGB', (640, 480), color=(100 + i*20, 150, 200))
        test_images.append(img)
    
    return test_images

def test_liveness_check():
    """Test the liveness check endpoint"""
    print("\n=== Testing Liveness Check ===")
    
    try:
        # Create test images
        test_images = create_test_images()
        
        # Prepare multipart form data
        files = []
        for i, img in enumerate(test_images):
            # Convert PIL image to bytes
            import io
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG')
            img_bytes.seek(0)
            files.append(('images', (f'test_frame_{i}.jpg', img_bytes, 'image/jpeg')))
        
        # Make request
        response = requests.post(
            f'{RECOGNIZER_URL}/liveness-check',
            files=files,
            verify=False
        )
        
        print(f"Liveness check status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Liveness check response:")
            print(json.dumps(data, indent=2))
            return data
        else:
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"Liveness check failed: {e}")
        return None

def test_recognize_with_liveness():
    """Test the recognize endpoint with liveness detection"""
    print("\n=== Testing Recognition with Liveness ===")
    
    try:
        # Create test images
        test_images = create_test_images()
        
        # Prepare multipart form data
        files = []
        for i, img in enumerate(test_images):
            # Convert PIL image to bytes
            import io
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG')
            img_bytes.seek(0)
            files.append(('images', (f'test_frame_{i}.jpg', img_bytes, 'image/jpeg')))
        
        # Make request
        response = requests.post(
            f'{RECOGNIZER_URL}/recognize',
            files=files,
            verify=False
        )
        
        print(f"Recognition status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Recognition response:")
            print(json.dumps(data, indent=2))
            return data
        else:
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"Recognition failed: {e}")
        return None

def test_single_image_recognize():
    """Test single image recognition (legacy mode)"""
    print("\n=== Testing Single Image Recognition ===")
    
    try:
        # Create a single test image
        img = Image.new('RGB', (640, 480), color=(150, 200, 100))
        
        # Convert PIL image to bytes
        import io
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        # Prepare form data
        files = {'image': ('test_single.jpg', img_bytes, 'image/jpeg')}
        
        # Make request
        response = requests.post(
            f'{RECOGNIZER_URL}/recognize',
            files=files,
            verify=False
        )
        
        print(f"Single image recognition status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Single image recognition response:")
            print(json.dumps(data, indent=2))
            return data
        else:
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"Single image recognition failed: {e}")
        return None

def main():
    """Run all tests"""
    print("🧪 Testing Face Liveness Detection System")
    print("=" * 50)
    
    # Test 1: Health check
    if not test_health():
        print("❌ Service is not running. Please start the recognizer service first.")
        return
    
    # Test 2: Liveness check
    liveness_result = test_liveness_check()
    
    # Test 3: Recognition with liveness
    recognition_result = test_recognize_with_liveness()
    
    # Test 4: Single image recognition
    single_result = test_single_image_recognize()
    
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"Health Check: {'✅' if test_health() else '❌'}")
    print(f"Liveness Check: {'✅' if liveness_result else '❌'}")
    print(f"Recognition with Liveness: {'✅' if recognition_result else '❌'}")
    print(f"Single Image Recognition: {'✅' if single_result else '❌'}")
    
    if liveness_result:
        print(f"\nLiveness Details:")
        details = liveness_result.get('liveness_details', {})
        print(f"  - Blinking Detected: {details.get('blinking_detected', False)}")
        print(f"  - Head Movement: {details.get('head_movement_detected', False)}")
        print(f"  - Looking at Camera: {details.get('looking_at_camera', False)}")
        print(f"  - Total Frames: {details.get('total_frames', 0)}")

if __name__ == '__main__':
    main()
