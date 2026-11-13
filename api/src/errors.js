/** Error con mensaje para mostrar en la app (en español) y código HTTP. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m) => new ApiError(400, m);
export const forbidden = (m) => new ApiError(403, m);
export const notFound = (m) => new ApiError(404, m);
export const conflict = (m) => new ApiError(409, m);
