import React, { useEffect, useRef, useState } from 'react'
import { Container, Paper, Box, Typography, Button, Grid, Alert } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function AdminFaceAttendance() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [])

  async function startStream() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStreaming(true)
      }
    } catch (e) {
      setError('Unable to access camera')
    }
  }

  function stopStream() {
    setStreaming(false)
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
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
    const res = await fetch('http://localhost:8001/recognize', { method: 'POST', body: formData })
    const data = await res.json()
    setLastResult(data)

    // If a confident match was found, mark attendance via backend
    const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
    if (best?.staffId) {
      try {
        const token = localStorage.getItem('token')
        await fetch('http://localhost:5000/api/attendance/face-event', {
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
    <Container maxWidth="md" sx={{ mt: 3 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Face Recognition Attendance (Admin)</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <video ref={videoRef} style={{ width: '100%', maxHeight: 420, background: '#000' }} muted playsInline />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Grid>
          <Grid item xs={12}>
            <Box display="flex" gap={2} flexWrap="wrap">
              {!streaming ? (
                <Button variant="contained" onClick={startStream}>Start Camera</Button>
              ) : (
                <>
                  <Button variant="contained" onClick={captureAndRecognize}>Capture & Recognize</Button>
                  <Button variant="outlined" onClick={stopStream}>Stop</Button>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onSelectFile} />
              <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>Upload Image to Recognize</Button>
            </Box>
          </Grid>
          <Grid item xs={12}>
            {lastResult && (
              <Box>
                <Typography variant="subtitle1">Last Result</Typography>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(lastResult, null, 2)}</pre>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}



