export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'ACCOUNT_NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  | 'DUPLICATE_REFERENCE'
  | 'INSUFFICIENT_BALANCE'
  | 'SELF_TRANSFER_NOT_ALLOWED'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'CONCURRENCY_CONFLICT'
  | 'SERVICE_BUSY'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  path?: string;
  message: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: ErrorDetail[];

  constructor(code: ErrorCode, message: string, statusCode = 400, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code: ErrorCode = 'ACCOUNT_NOT_FOUND') {
    super(code, message, 404);
  }
}

export class DuplicateReferenceError extends AppError {
  constructor(message = 'Duplicate reference ID detected for this operation') {
    super('DUPLICATE_REFERENCE', message, 409);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message = 'Insufficient funds to complete the requested debit/transfer') {
    super('INSUFFICIENT_BALANCE', message, 422);
  }
}

export class SelfTransferError extends AppError {
  constructor(message = 'Cannot transfer money to the same account') {
    super('SELF_TRANSFER_NOT_ALLOWED', message, 422);
  }
}

export class AmountOutOfRangeError extends AppError {
  constructor(message = 'Amount is outside the valid range') {
    super('AMOUNT_OUT_OF_RANGE', message, 422);
  }
}

export class ConcurrencyConflictError extends AppError {
  constructor(message = 'Operation encountered a concurrent lock conflict and could not complete') {
    super('CONCURRENCY_CONFLICT', message, 503);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: ErrorDetail[] = []) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}
