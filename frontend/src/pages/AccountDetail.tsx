import { ArrowLeft, ArrowUpRight, CheckCircle, Clock, DollarSign, Download, Plus, Send } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAccount, useAccountTransactions, useCreateTransaction } from '../api/queries.ts';
import { TransactionTable } from '../components/TransactionTable.tsx';
import { formatMoneyDisplay } from '../lib/utils.ts';

export const AccountDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();

  const { data: account, isLoading: accountLoading } = useAccount(id);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<'credit' | 'debit' | undefined>(undefined);

  const { data: txResponse, isLoading: txLoading } = useAccountTransactions(id, {
    page,
    limit: 15,
    type: filterType,
  });

  const createTxMutation = useCreateTransaction();
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [refId, setRefId] = useState('');
  const [description, setDescription] = useState('');

  const generateRef = () => {
    return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !refId) return;

    try {
      await createTxMutation.mutateAsync({
        account_id: id,
        type: txType,
        amount: amount.trim(),
        reference_id: refId.trim(),
        description: description.trim() || undefined,
      });
      toast.success(`${txType === 'credit' ? 'Deposit' : 'Withdrawal'} executed successfully!`);
      setShowTxModal(false);
      setAmount('');
      setRefId('');
      setDescription('');
    } catch (err: any) {
      toast.error(err.message || 'Transaction failed');
    }
  };

  if (accountLoading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading account...</div>;
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Account not found.</p>
        <Link to="/" className="text-blue-600 text-sm mt-2 inline-block">
          &larr; Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back button & Account Header */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Accounts</span>
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
              <span className="text-xs bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded">
                {account.id}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Created {new Date(account.created_at).toLocaleString()} &bull; Last updated {new Date(account.updated_at).toLocaleString()}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Balance
              </span>
              <span className="text-2xl font-mono font-bold text-slate-900">
                {formatMoneyDisplay(account.balance)}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTxType('credit');
                  setRefId(generateRef());
                  setShowTxModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Deposit
              </button>

              <button
                onClick={() => {
                  setTxType('debit');
                  setRefId(generateRef());
                  setShowTxModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Immutable Audit Trail</h2>
          <p className="text-xs text-slate-500">
            Append-only double-entry ledger rows verifying balance integrity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          {(['all', 'credit', 'debit'] as const).map((t) => {
            const isSelected = (t === 'all' && !filterType) || filterType === t;
            return (
              <button
                key={t}
                onClick={() => {
                  setFilterType(t === 'all' ? undefined : t);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ledger Table */}
      <TransactionTable
        transactions={txResponse?.data || []}
        meta={txResponse?.meta}
        onPageChange={(p) => setPage(p)}
        isLoading={txLoading}
      />

      {/* Modal: New Deposit / Withdrawal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              {txType === 'credit' ? 'Deposit Funds (Credit)' : 'Withdraw Funds (Debit)'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Row-level lock (FOR NO KEY UPDATE) guarantees serialization and concurrency safety.
            </p>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Amount (USD) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    Reference ID (Idempotency Key) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setRefId(generateRef())}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Duplicates within this account are strictly rejected (409 Conflict).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wire deposit, Payroll"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTxMutation.isPending || !amount.trim() || !refId.trim()}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer ${
                    txType === 'credit'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {createTxMutation.isPending ? 'Executing...' : `Confirm ${txType === 'credit' ? 'Deposit' : 'Withdrawal'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
