import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import {
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Menu,
  MenuItem,
} from '@mui/material'
import { Add, Edit, Delete, MoreVert, LockReset, PersonAdd, PersonRemove } from '@mui/icons-material'
import axios from 'axios'
import toast from 'react-hot-toast'
import API_BASE_URL from '../config/api'

export default function StaffManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [anchorEl, setAnchorEl] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('user')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const { data: staff, isLoading, error } = useQuery('staff', async () => {
    const res = await axios.get(`${API_BASE_URL}/api/staff`)
    return res.data
  })

  const deleteMutation = useMutation((staffId) => axios.delete(`${API_BASE_URL}/api/staff/${staffId}`), {
    onSuccess: () => {
      queryClient.invalidateQueries('staff')
      toast.success('Staff deleted successfully')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete staff'),
  })

  const createUserMutation = useMutation(
    ({ staffId, username, password, role }) =>
      axios.post(`${API_BASE_URL}/api/staff/${staffId}/create-user`, { username, password, role }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('staff')
        setSnackbarMessage('User account created successfully!')
        setSnackbarOpen(true)
        handleDialogClose()
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to create user account'),
    }
  )

  const resetPasswordMutation = useMutation(
    ({ staffId, newPassword }) =>
      axios.post(`${API_BASE_URL}/api/staff/${staffId}/reset-password`, { newPassword }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('staff')
        setSnackbarMessage('Password reset successfully!')
        setSnackbarOpen(true)
        handleDialogClose()
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to reset password'),
    }
  )

  const deleteUserMutation = useMutation(
    (staffId) => axios.delete(`${API_BASE_URL}/api/staff/${staffId}/user-account`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('staff')
        setSnackbarMessage('User account deleted successfully!')
        setSnackbarOpen(true)
        handleMenuClose()
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete user account'),
    }
  )

  function handleDelete(staffId, fullName) {
    if (window.confirm(`Are you sure you want to delete ${fullName}?`)) deleteMutation.mutate(staffId)
  }

  function handleMenuClick(event, staff) {
    setAnchorEl(event.currentTarget)
    setSelectedStaff(staff)
  }

  function handleMenuClose() {
    setAnchorEl(null)
    setSelectedStaff(null)
  }

  function handleDialogOpen(type) {
    setDialogType(type)
    setDialogOpen(true)
    handleMenuClose()
  }

  function handleDialogClose() {
    setDialogOpen(false)
    setDialogType('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setRole('user')
  }

  function handleCreateUser() {
    if (!username.trim() || !password.trim()) {
      toast.error('Username and password are required')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    createUserMutation.mutate({
      staffId: selectedStaff.staff_id,
      username,
      password,
      role
    })
  }

  function handleResetPassword() {
    if (!password.trim()) {
      toast.error('Password is required')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    resetPasswordMutation.mutate({
      staffId: selectedStaff.staff_id,
      newPassword: password
    })
  }

  function handleDeleteUser() {
    if (window.confirm(`Are you sure you want to delete the user account for ${selectedStaff.full_name}?`)) {
      deleteUserMutation.mutate(selectedStaff.staff_id)
    }
  }

  function handleSnackbarClose() {
    setSnackbarOpen(false)
  }

  if (isLoading) return <Typography sx={{ p: 3 }}>Loading...</Typography>
  if (error) return <Alert severity="error">Failed to load staff data</Alert>

  return (
    <Container sx={{ mt: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Staff Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/staff/add')}>Add New Staff</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Staff ID</TableCell>
              <TableCell>Full Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>User Account</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff?.map((m) => (
              <TableRow key={m.staff_id} hover>
                <TableCell>{m.staff_id}</TableCell>
                <TableCell>{m.full_name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.designation}</TableCell>
                <TableCell>{m.department}</TableCell>
                <TableCell>
                  {m.username ? (
                    <Chip 
                      size="small" 
                      label={`${m.username} (${m.role})`} 
                      color="primary" 
                      variant="outlined"
                    />
                  ) : (
                    <Chip 
                      size="small" 
                      label="No Account" 
                      color="default" 
                      variant="outlined"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={m.is_active ? 'Active' : 'Inactive'} color={m.is_active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton color="primary" onClick={() => navigate(`/staff/edit/${m.staff_id}`)}>
                    <Edit />
                  </IconButton>
                  <IconButton 
                    onClick={(e) => handleMenuClick(e, m)}
                    color="inherit"
                  >
                    <MoreVert />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(m.staff_id, m.full_name)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedStaff?.username ? (
          [
            <MenuItem key="reset" onClick={() => handleDialogOpen('reset')}>
              <LockReset sx={{ mr: 1 }} />
              Reset Password
            </MenuItem>,
            <MenuItem key="delete-user" onClick={handleDeleteUser}>
              <PersonRemove sx={{ mr: 1 }} />
              Delete User Account
            </MenuItem>
          ]
        ) : (
          <MenuItem onClick={() => handleDialogOpen('create')}>
            <PersonAdd sx={{ mr: 1 }} />
            Create User Account
          </MenuItem>
        )}
      </Menu>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen && dialogType === 'create'} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create User Account for {selectedStaff?.full_name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            type="password"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            margin="normal"
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleCreateUser} 
            variant="contained" 
            disabled={createUserMutation.isLoading}
          >
            {createUserMutation.isLoading ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={dialogOpen && dialogType === 'reset'} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password for {selectedStaff?.username}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleResetPassword} 
            variant="contained" 
            disabled={resetPasswordMutation.isLoading}
          >
            {resetPasswordMutation.isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
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


