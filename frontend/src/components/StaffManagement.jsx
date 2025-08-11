import React from 'react'
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
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function StaffManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: staff, isLoading, error } = useQuery('staff', async () => {
    const res = await axios.get('http://localhost:5000/api/staff')
    return res.data
  })

  const deleteMutation = useMutation((staffId) => axios.delete(`http://localhost:5000/api/staff/${staffId}`), {
    onSuccess: () => {
      queryClient.invalidateQueries('staff')
      toast.success('Staff deleted successfully')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete staff'),
  })

  function handleDelete(staffId, fullName) {
    if (window.confirm(`Are you sure you want to delete ${fullName}?`)) deleteMutation.mutate(staffId)
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
                  <Chip size="small" label={m.is_active ? 'Active' : 'Inactive'} color={m.is_active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton color="primary" onClick={() => navigate(`/staff/edit/${m.staff_id}`)}>
                    <Edit />
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
    </Container>
  )
}


