import React, { useMemo, useState } from 'react'
import {
  Container,
  Paper,
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  MenuItem,
  Divider,
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function AttendanceReport() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [staffIdFilter, setStaffIdFilter] = useState('')
  const [actionStaffId, setActionStaffId] = useState('')

  const { data: staffList } = useQuery('staff', async () => {
    const res = await axios.get('http://localhost:5000/api/staff')
    return res.data
  })

  const queryParams = useMemo(() => {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (staffIdFilter) params.staffId = staffIdFilter
    return params
  }, [startDate, endDate, staffIdFilter])

  const { data: attendance, isLoading, refetch } = useQuery(
    ['attendance', queryParams],
    async () => {
      const res = await axios.get('http://localhost:5000/api/attendance', { params: queryParams })
      return res.data
    }
  )

  const checkIn = useMutation(
    async (staffId) => axios.post('http://localhost:5000/api/attendance/check-in', { staffId }),
    {
      onSuccess: () => {
        toast.success('Check-in recorded')
        queryClient.invalidateQueries('attendance')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Check-in failed'),
    }
  )

  const checkOut = useMutation(
    async (staffId) => axios.post('http://localhost:5000/api/attendance/check-out', { staffId }),
    {
      onSuccess: () => {
        toast.success('Check-out recorded')
        queryClient.invalidateQueries('attendance')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Check-out failed'),
    }
  )

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Attendance Actions</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              fullWidth
              label="Select Staff"
              value={actionStaffId}
              onChange={(e) => setActionStaffId(e.target.value)}
            >
              {staffList?.map((s) => (
                <MenuItem key={s.staff_id} value={s.staff_id}>
                  {s.full_name} ({s.staff_id})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {user?.role === 'admin' && (
            <>
              <Grid item xs={12} sm={'auto'}>
                <Button
                  variant="contained"
                  disabled={!actionStaffId || checkIn.isLoading}
                  onClick={() => checkIn.mutate(actionStaffId)}
                >
                  {checkIn.isLoading ? 'Checking in...' : 'Check In'}
                </Button>
              </Grid>
              <Grid item xs={12} sm={'auto'}>
                <Button
                  variant="outlined"
                  disabled={!actionStaffId || checkOut.isLoading}
                  onClick={() => checkOut.mutate(actionStaffId)}
                >
                  {checkOut.isLoading ? 'Checking out...' : 'Check Out'}
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Attendance Report</Typography>
          <Box display="flex" gap={2}>
            <TextField type="date" label="Start Date" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <TextField type="date" label="End Date" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <TextField select label="Staff" value={staffIdFilter} onChange={(e) => setStaffIdFilter(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">All staff</MenuItem>
              {staffList?.map((s) => (
                <MenuItem key={s.staff_id} value={s.staff_id}>{s.full_name} ({s.staff_id})</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={() => { setStartDate(''); setEndDate(''); setStaffIdFilter(''); refetch() }}>Reset</Button>
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Check In</TableCell>
                <TableCell>Check Out</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
              ) : attendance?.length ? (
                attendance.map((a) => (
                  <TableRow key={`${a.attendance_id}`}>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{a.full_name} ({a.staff_id})</TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{a.status}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6}>No records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  )
}


