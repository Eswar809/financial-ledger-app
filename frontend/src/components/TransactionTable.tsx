import { ArrowDownLeft, ArrowUpRight, Clock, FileText } from 'lucide-react';
import React from 'react';
import type { PaginationMeta, Transaction } from '../api/types.ts';
import { formatMoneyDisplay } from '../lib/utils.ts';

interface TransactionTableProps {
  transactions: Transaction[];
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  meta,
  onPageChange,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Loading ledger transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-slate-600 font-medium">No transactions recorded yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Perform a deposit, withdrawal, or transfer to start the audit log.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Balance After</th>
              <th className="py-3 px-4">Reference ID</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const isCredit = tx.type === 'credit';
              return (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isCredit
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3 text-rose-600" />
                      )}
                      {tx.type.toUpperCase()}
                    </span>
                  </td>
                  <td className={`py-3 px-4 font-mono font-semibold ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {isCredit ? '+' : '-'}{formatMoneyDisplay(tx.amount)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {formatMoneyDisplay(tx.balance_after)}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500 max-w-[140px] truncate" title={tx.reference_id}>
                    {tx.reference_id}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">
                    {tx.description || <span className="text-slate-300">&mdash;</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {meta && meta.total_pages > 1 && (
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing page <span className="font-semibold text-slate-700">{meta.page}</span> of{' '}
            <span className="font-semibold text-slate-700">{meta.total_pages}</span> ({meta.total} total)
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange?.(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-700"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange?.(meta.page + 1)}
              disabled={meta.page >= meta.total_pages}
              className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
