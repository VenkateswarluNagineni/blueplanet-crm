/** Base class for expected, operational failures (bad input, no permission) as
 *  opposed to programmer errors / bugs, which should just be plain Errors. */
export class AppError extends Error {
  readonly isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden: insufficient permissions') {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
  }
}
