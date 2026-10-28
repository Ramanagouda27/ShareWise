import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { HomePage } from '../pages/HomePage';
import { ResourcesPage } from '../pages/ResourcesPage';
import { ResourceDetailsPage } from '../pages/ResourceDetailsPage';
import { MyBookingsPage } from '../pages/MyBookingsPage';
import { BookingDetailsPage } from '../pages/BookingDetailsPage';
import { OwnerRequestsPage } from '../pages/OwnerRequestsPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:id" element={<ResourceDetailsPage />} />
        
        {/* Protected Student Dashboard */}
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />
        
        {/* Protected Booking Details */}
        <Route
          path="/bookings/:id"
          element={
            <ProtectedRoute>
              <BookingDetailsPage />
            </ProtectedRoute>
          }
        />
        
        {/* Equipment Custodian / Owner Dashboard */}
        <Route
          path="/owner/requests"
          element={
            <ProtectedRoute>
              <OwnerRequestsPage />
            </ProtectedRoute>
          }
        />
        
        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Fallback 404 */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
};
