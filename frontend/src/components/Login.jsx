import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Container, Paper, TextField, Button, Typography, Box, Alert } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  if (user) return <Navigate to="/" />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(username, password)
    if (result.success) navigate('/')
    else setError(result.message)
    setLoading(false)
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Face Recognition Admin Portal</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="Username" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} />
          <TextField fullWidth type="password" label="Password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 2 }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
        </Box>
      </Paper>
    </Container>
  )
}


