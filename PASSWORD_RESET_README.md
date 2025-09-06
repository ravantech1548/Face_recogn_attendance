# Password Reset Functionality

This document describes the password reset functionality that has been integrated into the Face Recognition Admin Portal's Staff Management system.

## Features

### 1. Self-Service Password Reset
- Users can request a password reset token by providing their username
- A secure token is generated and stored in the database with an expiration time (1 hour)
- Users can use the token to reset their password through the UI

### 2. Admin Password Management (Integrated with Staff Management)
- Administrators can create user accounts for staff members
- Administrators can reset passwords for any staff member's user account
- Administrators can delete user accounts for staff members
- All user management is integrated into the existing Staff Management interface

### 3. Database Schema Updates
- Added `reset_token` and `reset_token_expires` columns to the `users` table
- Added index on `reset_token` for better performance

## API Endpoints

### 1. Request Password Reset
```
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "username": "admin"
}
```

**Response:**
```json
{
  "message": "Password reset token generated successfully",
  "resetToken": "abc123...",
  "expiresAt": "2024-01-01T12:00:00.000Z"
}
```

### 2. Reset Password with Token
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "resetToken": "abc123...",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully",
  "username": "admin"
}
```

### 3. Create User Account for Staff
```
POST /api/staff/:staffId/create-user
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123",
  "role": "user"
}
```

**Response:**
```json
{
  "message": "User account created successfully",
  "user": {
    "user_id": 2,
    "username": "john_doe",
    "role": "user",
    "staff_id": "EMP001"
  }
}
```

### 4. Reset Password for Staff User Account
```
POST /api/staff/:staffId/reset-password
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully",
  "username": "john_doe"
}
```

### 5. Delete User Account for Staff
```
DELETE /api/staff/:staffId/user-account
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "message": "User account deleted successfully",
  "username": "john_doe"
}
```

### 6. Get Staff with User Information
```
GET /api/staff
Authorization: Bearer <admin_token>
```

**Response:**
```json
[
  {
    "staff_id": "EMP001",
    "full_name": "John Doe",
    "email": "john@example.com",
    "designation": "Developer",
    "department": "IT",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "user_id": 2,
    "username": "john_doe",
    "role": "user"
  }
]
```

## Frontend Components

### 1. Enhanced Login Component
- Added "Forgot Password?" button
- Modal dialog with two tabs:
  - **Request Reset**: Enter username to generate reset token
  - **Reset Password**: Enter token and new password
- Form validation and error handling
- Success notifications

### 2. Enhanced Staff Management Component
- **User Account Column**: Shows whether staff member has a user account
- **Actions Menu**: Three-dot menu for each staff member with user account options:
  - **Create User Account**: For staff without user accounts
  - **Reset Password**: For staff with existing user accounts
  - **Delete User Account**: Remove user account for staff member
- **Modal Dialogs**: Clean interfaces for creating accounts and resetting passwords
- **Real-time Updates**: Staff list updates immediately after user account changes

## Database Migration

### For New Installations
The schema has been updated to include password reset fields automatically.

### For Existing Installations
Run the migration script:
```sql
-- Add password reset columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- Create index for better performance on reset token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
```

## Security Features

1. **Token Expiration**: Reset tokens expire after 1 hour
2. **Secure Token Generation**: Uses crypto.randomBytes for secure token generation
3. **Password Hashing**: All passwords are hashed using bcrypt
4. **Admin Authentication**: Admin password reset requires valid admin token
5. **Input Validation**: All inputs are validated on both frontend and backend

## Testing

A test script is provided to verify the functionality:
```bash
node test_password_reset.js
```

## Usage Instructions

### For Users (Self-Service Reset)
1. Go to the login page
2. Click "Forgot Password?"
3. Enter your username and click "Generate Token"
4. Copy the generated token
5. Switch to "Reset Password" tab
6. Enter the token and your new password
7. Click "Reset Password"

### For Administrators (Staff Management)
1. Login as admin
2. Navigate to "Staff" in the navigation menu
3. For staff without user accounts:
   - Click the three-dot menu (⋮) next to the staff member
   - Select "Create User Account"
   - Enter username, password, and role
   - Click "Create Account"
4. For staff with user accounts:
   - Click the three-dot menu (⋮) next to the staff member
   - Select "Reset Password" to change password
   - Select "Delete User Account" to remove the account

## Files Modified/Added

### Backend
- `backend/sql/schema.sql` - Updated with password reset fields
- `backend/sql/migration_add_password_reset.sql` - Migration script
- `backend/src/routes/auth.js` - Added password reset endpoints
- `backend/src/routes/staff.js` - Enhanced with user account management endpoints
- `backend/src/setup/initDb.js` - Updated to include password reset fields

### Frontend
- `frontend/src/components/Login.jsx` - Enhanced with password reset UI
- `frontend/src/components/StaffManagement.jsx` - Enhanced with user account management
- `frontend/src/App.jsx` - Routes remain the same (integrated into staff management)
- `frontend/src/components/Navbar.jsx` - Navigation remains clean and simple

### Testing
- `test_password_reset.js` - Test script for password reset functionality
- `PASSWORD_RESET_README.md` - This documentation file
