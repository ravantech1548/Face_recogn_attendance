#!/usr/bin/env node

/**
 * Test script for password reset functionality
 * Run this script to test the password reset endpoints
 */

const API_BASE_URL = 'https://192.168.18.2:5000';

async function testPasswordReset() {
  console.log('🧪 Testing Password Reset Functionality\n');

  try {
    // Test 1: Request password reset
    console.log('1. Testing password reset request...');
    const resetRequest = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'admin' }),
    });

    const resetData = await resetRequest.json();
    console.log('Reset request response:', resetData);

    if (resetRequest.ok && resetData.resetToken) {
      console.log('✅ Password reset token generated successfully');
      
      // Test 2: Reset password with token
      console.log('\n2. Testing password reset with token...');
      const resetPassword = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resetToken: resetData.resetToken,
          newPassword: 'newpassword123'
        }),
      });

      const resetPasswordData = await resetPassword.json();
      console.log('Reset password response:', resetPasswordData);

      if (resetPassword.ok) {
        console.log('✅ Password reset successfully');
        
        // Test 3: Login with new password
        console.log('\n3. Testing login with new password...');
        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'admin',
            password: 'newpassword123'
          }),
        });

        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);

        if (loginResponse.ok) {
          console.log('✅ Login with new password successful');
          
          // Test 4: Admin reset password
          console.log('\n4. Testing admin password reset...');
          const adminResetResponse = await fetch(`${API_BASE_URL}/api/auth/admin-reset-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${loginData.token}`
            },
            body: JSON.stringify({
              username: 'admin',
              newPassword: 'admin123'
            }),
          });

          const adminResetData = await adminResetResponse.json();
          console.log('Admin reset response:', adminResetData);

          if (adminResetResponse.ok) {
            console.log('✅ Admin password reset successful');
            console.log('\n🎉 All password reset tests passed!');
          } else {
            console.log('❌ Admin password reset failed:', adminResetData.message);
          }
        } else {
          console.log('❌ Login with new password failed:', loginData.message);
        }
      } else {
        console.log('❌ Password reset failed:', resetPasswordData.message);
      }
    } else {
      console.log('❌ Password reset request failed:', resetData.message);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testPasswordReset();
