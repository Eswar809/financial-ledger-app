import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { DashboardNavigationProvider } from '@/components/watermelon/bionis-dashboard/components/bionis/navigation'
import { ThemeProvider } from '@/components/watermelon/bionis-dashboard/components/bionis/theme-provider'
import { DashboardContent } from '@/components/watermelon/bionis-dashboard/components/bionis/dashboard-content'
import DashboardLayout from '@/components/watermelon/bionis-dashboard/dashboard-layout'
import { AccountDetail } from '@/pages/AccountDetail.tsx'
import { TransferPage } from '@/pages/TransferPage.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <DashboardNavigationProvider>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardContent />} />
                <Route path="/accounts/:id" element={<AccountDetail />} />
                <Route path="/transfers" element={<TransferPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          </DashboardNavigationProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
