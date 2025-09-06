import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Tabs,
  Tab,
  Snackbar
} from '@mui/material'
import { useAuth } from '../context/AuthContext'
import API_BASE_URL from '../config/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetTab, setResetTab] = useState(0)
  const [resetUsername, setResetUsername] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
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

  async function handleRequestReset() {
    if (!resetUsername.trim()) {
      setResetError('Username is required')
      return
    }

    setResetLoading(true)
    setResetError('')
    setResetSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: resetUsername }),
      })

      const data = await response.json()

      if (response.ok) {
        setResetSuccess(`Reset token generated: ${data.resetToken}`)
        setSnackbarMessage('Password reset token generated successfully!')
        setSnackbarOpen(true)
      } else {
        setResetError(data.message || 'Failed to generate reset token')
      }
    } catch (error) {
      setResetError('Network error. Please try again.')
    }

    setResetLoading(false)
  }

  async function handleResetPassword() {
    if (!resetToken.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setResetError('All fields are required')
      return
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters')
      return
    }

    setResetLoading(true)
    setResetError('')
    setResetSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          resetToken, 
          newPassword 
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResetSuccess('Password reset successfully! You can now login with your new password.')
        setSnackbarMessage('Password reset successfully!')
        setSnackbarOpen(true)
        setTimeout(() => {
          setResetDialogOpen(false)
          setResetToken('')
          setNewPassword('')
          setConfirmPassword('')
          setResetSuccess('')
        }, 2000)
      } else {
        setResetError(data.message || 'Failed to reset password')
      }
    } catch (error) {
      setResetError('Network error. Please try again.')
    }

    setResetLoading(false)
  }

  const handleResetDialogClose = () => {
    setResetDialogOpen(false)
    setResetTab(0)
    setResetUsername('')
    setResetToken('')
    setNewPassword('')
    setConfirmPassword('')
    setResetError('')
    setResetSuccess('')
  }

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Face Recognition Admin Portal</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField 
            fullWidth 
            label="Username" 
            margin="normal" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required
          />
          <TextField 
            fullWidth 
            type="password" 
            label="Password" 
            margin="normal" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
          />
          <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 2 }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
          <Button 
            fullWidth 
            variant="text" 
            onClick={() => setResetDialogOpen(true)} 
            sx={{ mt: 1 }}
          >
            Forgot Password?
          </Button>
        </Box>
      </Paper>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onClose={handleResetDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Tabs value={resetTab} onChange={(e, newValue) => setResetTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="Request Reset" />
            <Tab label="Reset Password" />
          </Tabs>

          {resetTab === 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your username to receive a password reset token.
              </Typography>
              <TextField
                fullWidth
                label="Username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                margin="normal"
                required
              />
              {resetError && <Alert severity="error" sx={{ mt: 1 }}>{resetError}</Alert>}
              {resetSuccess && <Alert severity="success" sx={{ mt: 1 }}>{resetSuccess}</Alert>}
            </Box>
          )}

          {resetTab === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your reset token and new password.
              </Typography>
              <TextField
                fullWidth
                label="Reset Token"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                type="password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                type="password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
                required
              />
              {resetError && <Alert severity="error" sx={{ mt: 1 }}>{resetError}</Alert>}
              {resetSuccess && <Alert severity="success" sx={{ mt: 1 }}>{resetSuccess}</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetDialogClose}>Cancel</Button>
          {resetTab === 0 && (
            <Button 
              onClick={handleRequestReset} 
              variant="contained" 
              disabled={resetLoading}
            >
              {resetLoading ? 'Generating...' : 'Generate Token'}
            </Button>
          )}
          {resetTab === 1 && (
            <Button 
              onClick={handleResetPassword} 
              variant="contained" 
              disabled={resetLoading}
            >
              {resetLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Container>
  )
}


