import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Toaster } from 'react-hot-toast'

import Login from './components/Login'
import StaffManagement from './components/StaffManagement'
import AddStaff from './components/AddStaff'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import HomeRedirect from './components/HomeRedirect'
import Navbar from './components/Navbar'
import { AuthProvider } from './context/AuthContext'
import AttendanceReport from './components/AttendanceReport'

const queryClient = new QueryClient()

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
})

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Navbar />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute component={HomeRedirect} />} />
              <Route path="/staff" element={<AdminRoute component={StaffManagement} />} />
              <Route path="/staff/add" element={<AdminRoute component={AddStaff} />} />
              <Route path="/staff/edit/:staffId" element={<AdminRoute component={AddStaff} />} />
              <Route
                path="/attendance"
                element={<ProtectedRoute component={AttendanceReport} />}
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <Toaster position="top-right" />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}


