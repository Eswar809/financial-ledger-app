import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TransferPage } from '../pages/TransferPage.tsx';

describe('TransferPage component', () => {
  it('renders the transfer form with required inputs', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TransferPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Transfer Funds/i)).toBeInTheDocument();
    expect(screen.getByText(/Source Account \(From\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Destination Account \(To\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Transfer Amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Execute Transfer/i })).toBeInTheDocument();
  });
});
