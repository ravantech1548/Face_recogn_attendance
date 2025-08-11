import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Container, Typography, TextField, Button, Box, Paper, Grid, Alert, Avatar } from '@mui/material'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

export default function AddStaff() {
  const navigate = useNavigate()
  const { staffId } = useParams()
  const queryClient = useQueryClient()
  const isEditing = Boolean(staffId)

  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)

  const { register, handleSubmit, formState: { errors }, setValue } = useForm()

  const { data: staffData, isLoading } = useQuery(
    ['staff', staffId],
    () => axios.get(`http://localhost:5000/api/staff/${staffId}`).then((r) => r.data),
    { enabled: isEditing }
  )

  useEffect(() => {
    if (staffData && isEditing) {
      setValue('staffId', staffData.staff_id)
      setValue('fullName', staffData.full_name)
      setValue('email', staffData.email)
      setValue('designation', staffData.designation)
      setValue('department', staffData.department)
      if (staffData.face_image_path) setPreview(`http://localhost:5000/${staffData.face_image_path}`)
    }
  }, [staffData, isEditing, setValue])

  const mutation = useMutation(
    (formData) => {
      if (isEditing) return axios.put(`http://localhost:5000/api/staff/${staffId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      return axios.post('http://localhost:5000/api/staff', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('staff')
        toast.success(`Staff ${isEditing ? 'updated' : 'added'} successfully`)
        navigate('/staff')
      },
      onError: (err) => toast.error(err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'add'} staff`),
    }
  )

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    setSelectedFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  function onSubmit(data) {
    const formData = new FormData()
    formData.append('staffId', data.staffId)
    formData.append('fullName', data.fullName)
    formData.append('email', data.email)
    formData.append('designation', data.designation)
    formData.append('department', data.department)
    if (selectedFile) formData.append('faceImage', selectedFile)
    mutation.mutate(formData)
  }

  if (isLoading) return <Typography sx={{ p: 3 }}>Loading...</Typography>

  return (
    <Container maxWidth="md" sx={{ mt: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{isEditing ? 'Edit Staff' : 'Add New Staff'}</Typography>
          <Button onClick={() => navigate('/staff')}>Back</Button>
        </Box>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Staff ID" {...register('staffId', { required: true })} error={Boolean(errors.staffId)} helperText={errors.staffId && 'Required'} disabled={isEditing} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name" {...register('fullName', { required: true })} error={Boolean(errors.fullName)} helperText={errors.fullName && 'Required'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" {...register('email', { required: true })} error={Boolean(errors.email)} helperText={errors.email && 'Required'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Designation" {...register('designation', { required: true })} error={Boolean(errors.designation)} helperText={errors.designation && 'Required'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Department" {...register('department', { required: true })} error={Boolean(errors.department)} helperText={errors.department && 'Required'} />
            </Grid>
            <Grid item xs={12}>
              <Button variant="outlined" component="label">
                Choose Face Image
                <input hidden accept="image/*" type="file" onChange={handleFileChange} />
              </Button>
              {preview && <Avatar src={preview} sx={{ width: 80, height: 80, ml: 2, display: 'inline-flex', verticalAlign: 'middle' }} />}
            </Grid>
          </Grid>
          <Box mt={3} display="flex" gap={2}>
            <Button type="submit" variant="contained" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Saving...' : isEditing ? 'Update Staff' : 'Add Staff'}
            </Button>
            <Button variant="text" onClick={() => navigate('/staff')}>Cancel</Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  )
}


