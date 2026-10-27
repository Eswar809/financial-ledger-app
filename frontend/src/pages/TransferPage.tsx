import { AlertCircle, ArrowLeftRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAccounts, useCreateTransfer } from '../api/queries.ts';
import { formatMoneyDisplay } from '../lib/utils.ts';

export const TransferPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading } = useAccounts();
  const createTransferMutation = useCreateTransfer();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [refId, setRefId] = useState(`xfer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

  const generateRef = () => {
    setRefId(`xfer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !amount || !refId) return;

    if (fromAccountId === toAccountId) {
      toast.error('Source and destination accounts must be different');
      return;
    }

    try {
      await createTransferMutation.mutateAsync({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: amount.trim(),
        reference_id: refId.trim(),
      });
      toast.success('Atomic transfer completed successfully!');
      navigate(`/accounts/${fromAccountId}`);
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transfer Funds</h1>
        <p className="text-sm text-slate-500 mt-1">
          Execute atomic double-entry money transfers with deadlock-free row locking.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        {/* Architecture Note */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-800">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">ACID Guarantees Active:</span>
            Transfers sort account IDs ascending prior to acquiring <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">FOR NO KEY UPDATE</code> locks, completely preventing deadlocks. Two linked ledger rows are written atomically.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Source Account */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Source Account (From) *
            </label>
            <select
              required
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select source account...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — Balance: {formatMoneyDisplay(acc.balance)}
                </option>
              ))}
            </select>
            {fromAccount && (
              <span className="text-xs text-slate-500 mt-1 block">
                Available to transfer: <span className="font-mono font-semibold text-slate-800">{formatMoneyDisplay(fromAccount.balance)}</span>
              </span>
            )}
          </div>

          {/* Destination Account */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Destination Account (To) *
            </label>
            <select
              required
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select destination account...</option>
              {accounts
                .filter((acc) => acc.id !== fromAccountId)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — Balance: {formatMoneyDisplay(acc.balance)}
                  </option>
                ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Transfer Amount (USD) *
            </label>
            <input
              type="text"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Max 4 decimal places. Source balance will be checked under exclusive lock.
            </span>
          </div>

          {/* Reference ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase text-slate-700">
                Global Idempotency Reference ID *
              </label>
              <button
                type="button"
                onClick={generateRef}
                className="text-[11px] text-blue-600 hover:underline cursor-pointer"
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Anchored globally in the transfers table to ensure strictly at-most-once execution.
            </span>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={createTransferMutation.isPending || !fromAccountId || !toAccountId || !amount.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer text-sm"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{createTransferMutation.isPending ? 'Executing Transfer...' : 'Execute Transfer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
