import React, { useEffect, useRef, useState } from 'react'
import { 
  Container, 
  Paper, 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Alert, 
  LinearProgress,
  Chip,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel
} from '@mui/material'
import { useAuth } from '../context/AuthContext'
import API_BASE_URL from '../config/api'

export default function AdminFaceAttendance() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const intervalRef = useRef(null)
  
  const [error, setError] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [livenessMode, setLivenessMode] = useState(false)
  const [capturedFrames, setCapturedFrames] = useState([])
  const [livenessStatus, setLivenessStatus] = useState({
    blinking_detected: false,
    head_movement_detected: false,
    face_quality: {}
  })
  const [activeStep, setActiveStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const steps = [
    'Start Camera',
    'Capture Multiple Frames',
    'Liveness Detection',
    'Face Recognition',
    'Attendance Marked'
  ]

  useEffect(() => {
    return () => {
      stopStream()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  async function startStream() {
    setError('')
    setActiveStep(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStreaming(true)
        setActiveStep(1)
      }
    } catch (e) {
      setError('Unable to access camera')
    }
  }

  function stopStream() {
    setStreaming(false)
    setLivenessMode(false)
    setCapturedFrames([])
    setActiveStep(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }

  async function startLivenessDetection() {
    setLivenessMode(true)
    setCapturedFrames([])
    setActiveStep(2)
    
    // Capture frames every 500ms for 3 seconds (6 frames)
    let frameCount = 0
    const maxFrames = 6
    
    intervalRef.current = setInterval(async () => {
      await captureFrame()
      frameCount++
      
      if (frameCount >= maxFrames) {
        clearInterval(intervalRef.current)
        // Wait a bit more to ensure all frames are captured
        setTimeout(async () => {
          await processLivenessDetection()
        }, 200)
        return
      }
    }, 500)
  }

  async function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Ensure video is ready and has valid dimensions
    if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video not ready or invalid dimensions, skipping frame')
      return
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    
    // Clear canvas and draw video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Capture with higher quality
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
    
    if (blob && blob.size > 0) {
      setCapturedFrames(prev => {
        const newFrames = [...prev, blob]
        console.log(`Captured frame ${newFrames.length}/6 (${blob.size} bytes)`)
        return newFrames
      })
    } else {
      console.log('Failed to capture valid frame')
    }
  }

  async function processLivenessDetection() {
    console.log(`Processing liveness detection with ${capturedFrames.length} frames`)
    
    if (capturedFrames.length < 2) {
      setError(`Not enough frames captured for liveness detection. Got ${capturedFrames.length}, need at least 2.`)
      setLivenessMode(false)
      return
    }

    setIsProcessing(true)
    setActiveStep(3)

    try {
      const formData = new FormData()
      capturedFrames.forEach((blob, index) => {
        formData.append('images', blob, `frame_${index}.jpg`)
      })

      console.log('Sending liveness check request...')
      console.log('Request URL: https://192.168.18.2:8001/liveness-check')
      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value.name || value.size || 'blob']))
      
      const res = await fetch('https://192.168.18.2:8001/liveness-check', { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      })
      
      console.log('Liveness check response status:', res.status)
      console.log('Liveness check response headers:', res.headers)
      
      let data
      try {
        const responseText = await res.text()
        console.log('Raw response:', responseText)
        data = JSON.parse(responseText)
        console.log('Parsed response:', data)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        setError('Invalid response from liveness service: ' + parseError.message)
        setLivenessMode(false)
        return
      }
      
      if (res.ok && data.liveness_passed) {
        setLivenessStatus(data.liveness_details)
        await performFaceRecognition()
      } else {
        setError('Liveness check failed: ' + (data.message || 'Unknown error'))
        setLivenessStatus(data.liveness_details || {})
        setLivenessMode(false)
      }
    } catch (e) {
      console.error('Liveness detection error:', e)
      setError('Liveness detection request failed: ' + e.message)
      setLivenessMode(false)
    } finally {
      setIsProcessing(false)
    }
  }

  async function performFaceRecognition() {
    try {
      const formData = new FormData()
      capturedFrames.forEach((blob, index) => {
        formData.append('images', blob, `frame_${index}.jpg`)
      })

      console.log('Sending face recognition request...')
      console.log('Request URL: https://192.168.18.2:8001/recognize')
      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value.name || value.size || 'blob']))
      
      const res = await fetch('https://192.168.18.2:8001/recognize', { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      })
      
      let data
      try {
        const responseText = await res.text()
        console.log('Face recognition raw response:', responseText)
        data = JSON.parse(responseText)
        console.log('Face recognition parsed response:', data)
      } catch (parseError) {
        console.error('Face recognition JSON parse error:', parseError)
        setError('Invalid response from recognition service: ' + parseError.message)
        setLivenessMode(false)
        return
      }
      
      setLastResult(data)

      // If a confident match was found, mark attendance via backend
      const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
      if (best?.staffId) {
        setActiveStep(4)
        try {
          const token = localStorage.getItem('token')
          await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ staffId: best.staffId })
          })
        } catch (e) {
          // ignore UI error; result still shown
        }
      } else {
        setError('No matching face found in database')
      }
    } catch (e) {
      setError('Face recognition request failed')
    }
  }

  async function captureAndRecognize() {
    try {
      if (!videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      await recognizeBlob(blob, 'frame.jpg')
    } catch (e) {
      setError('Recognition request failed')
    }
  }

  async function recognizeBlob(blob, filename) {
    setError('')
    const formData = new FormData()
    formData.append('image', blob, filename)
    const res = await fetch('https://192.168.18.2:8001/recognize', { method: 'POST', body: formData })
    const data = await res.json()
    setLastResult(data)

    // If a confident match was found, mark attendance via backend
    const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
    if (best?.staffId) {
      try {
        const token = localStorage.getItem('token')
        await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ staffId: best.staffId })
        })
      } catch (e) {
        // ignore UI error; result still shown
      }
    }
  }

  async function onSelectFile(e) {
    try {
      setError('')
      const file = e.target.files?.[0]
      if (!file) return
      await recognizeBlob(file, file.name)
      // reset input to allow re-upload same file
      e.target.value = ''
    } catch (err) {
      setError('Upload recognize failed')
    }
  }

  if (!user || user.role !== 'admin') return <Alert severity="warning">Admin only</Alert>

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Face Recognition Attendance with Liveness Detection</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* Progress Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Grid container spacing={3}>
          {/* Video Section */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Camera Feed</Typography>
                <video 
                  ref={videoRef} 
                  style={{ 
                    width: '100%', 
                    maxHeight: 400, 
                    background: '#000',
                    borderRadius: 8
                  }} 
                  muted 
                  playsInline 
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                <Box display="flex" gap={2} flexWrap="wrap" sx={{ mt: 2 }}>
                  {!streaming ? (
                    <Button variant="contained" onClick={startStream} size="large">
                      Start Camera
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="contained" 
                        onClick={startLivenessDetection}
                        disabled={livenessMode || isProcessing}
                        size="large"
                      >
                        Start Liveness Detection
                      </Button>
                      <Button 
                        variant="outlined" 
                        onClick={captureAndRecognize}
                        disabled={livenessMode || isProcessing}
                      >
                        Single Capture
                      </Button>
                      <Button variant="outlined" onClick={stopStream}>
                        Stop
                      </Button>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Liveness Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Liveness Detection Status</Typography>
                
                {livenessMode && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Capturing frames for liveness detection... ({capturedFrames.length}/6)
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(capturedFrames.length / 6) * 100} 
                      sx={{ mt: 1 }}
                    />
                    {capturedFrames.length < 6 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Please keep your face in the camera and blink naturally...
                      </Typography>
                    )}
                  </Box>
                )}

                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label="Blinking Detected" 
                      color={livenessStatus.blinking_detected ? "success" : "default"}
                      size="small"
                    />
                    <Typography variant="body2">
                      {livenessStatus.blinking_detected ? "✓" : "✗"}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label="Head Movement" 
                      color={livenessStatus.head_movement_detected ? "success" : "default"}
                      size="small"
                    />
                    <Typography variant="body2">
                      {livenessStatus.head_movement_detected ? "✓" : "✗"}
                    </Typography>
                  </Box>
                  

                  {livenessStatus.face_quality && Object.keys(livenessStatus.face_quality).length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Face Quality</Typography>
                      <Typography variant="body2">
                        Quality Score: {(livenessStatus.face_quality.quality_score * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="body2">
                        Size OK: {livenessStatus.face_quality.size_ok ? "✓" : "✗"}
                      </Typography>
                      <Typography variant="body2">
                        Symmetry: {(livenessStatus.face_quality.symmetry * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* File Upload */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Alternative: Upload Image</Typography>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={onSelectFile} 
                />
                <Button 
                  variant="outlined" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  Upload Image to Recognize
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Results */}
          <Grid item xs={12}>
            {lastResult && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Recognition Results</Typography>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    backgroundColor: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px'
                  }}>
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}



