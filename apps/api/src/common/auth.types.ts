import { type Request } from "express";

/** Claims carried in the access JWT. */
export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  username: string | null;
  /** Refresh-token family id — lets logout revoke the current session. */
  fid: string;
}

/** Express request once an auth guard has run. */
export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}
