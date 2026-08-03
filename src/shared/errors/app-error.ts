/**
 * Erros de dominio. Service lanca, errorHandler traduz para HTTP.
 *
 * Regra: service nunca devolve `null` para significar falha. `null` significa
 * ausencia legitima; falha e excecao.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Detalhe seguro para o cliente. Nunca colocar dado sensivel aqui. */
  readonly details?: unknown;

  constructor(code: ErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados invalidos", details?: unknown) {
    super("VALIDATION_ERROR", 422, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Nao autenticado") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Sem permissao para esta operacao") {
    super("FORBIDDEN", 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Registro nao encontrado") {
    super("NOT_FOUND", 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito com o estado atual do recurso") {
    super("CONFLICT", 409, message);
  }
}

/** Regra de negocio violada: entrada bem formada, operacao ilegal. */
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super("UNPROCESSABLE", 422, message, details);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
