import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Array<{ path?: string; message: string }>;
  };
}

export function globalErrorHandler(error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) {
  // 1. Domain / AppError
  if (error instanceof AppError) {
    const response: StandardErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    return reply.status(error.statusCode).send(response);
  }

  // 2. Fastify validation errors (Zod via fastify-type-provider-zod or Fastify schema compiler)
  const fe = error as FastifyError;
  if (fe.validation) {
    const details = Array.isArray(fe.validation)
      ? fe.validation.map((v: any) => ({
          path: v.instancePath || (v.params && (v.params.issue?.path ? v.params.issue.path.join('.') : undefined)),
          message: v.message || 'Validation failed',
        }))
      : [];

    const response: StandardErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: fe.message || 'Validation error in request parameters or body',
        details,
      },
    };
    return reply.status(400).send(response);
  }

  // 3. Fastify JSON parse error
  if (fe.code === 'FST_ERR_CTP_INVALID_JSON' || fe.statusCode === 400) {
    const response: StandardErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed or invalid JSON body',
        details: [],
      },
    };
    return reply.status(400).send(response);
  }

  // 4. PostgreSQL specific error codes (in case any escape Kysely transactions)
  const pgCode = (error as any)?.code;
  if (pgCode === '23505') {
    // Unique violation
    return reply.status(409).send({
      success: false,
      error: {
        code: 'DUPLICATE_REFERENCE',
        message: 'Duplicate reference ID violation',
        details: [],
      },
    });
  }
  if (pgCode === '23514') {
    // Check violation
    return reply.status(422).send({
      success: false,
      error: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Database check constraint violation (balance non-negative or amount positive)',
        details: [],
      },
    });
  }
  if (pgCode === '22003') {
    // Numeric value out of range
    return reply.status(422).send({
      success: false,
      error: {
        code: 'AMOUNT_OUT_OF_RANGE',
        message: 'Numeric value out of range',
        details: [],
      },
    });
  }
  if (pgCode === '40P01' || pgCode === '40001') {
    // Deadlock detected / serialization failure
    return reply.status(503).send({
      success: false,
      error: {
        code: 'CONCURRENCY_CONFLICT',
        message: 'Database concurrency conflict detected; please retry',
        details: [],
      },
    });
  }
  if (pgCode === '55P03' || pgCode === '57014') {
    // Lock not available / query canceled
    return reply.status(503).send({
      success: false,
      error: {
        code: 'SERVICE_BUSY',
        message: 'Database service is busy; lock or query timeout',
        details: [],
      },
    });
  }

  // 5. Default 500
  request.log.error({ err: error }, 'Unhandled server error');
  const response: StandardErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
      details: [],
    },
  };
  return reply.status(500).send(response);
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  const response: StandardErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      details: [],
    },
  };
  return reply.status(404).send(response);
}
