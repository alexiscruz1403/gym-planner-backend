import { SetMetadata } from '@nestjs/common';

// Key used to mark a route as public — read by JwtAuthGuard
export const IS_PUBLIC_KEY = 'isPublic';

// Routes decorated with @Public() skip JWT validation entirely.
// Usage: add @Public() to any controller method or class that
// should be accessible without authentication.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
