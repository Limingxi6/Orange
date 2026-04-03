import { SetMetadata } from '@nestjs/common';

export const SELF_OR_ADMIN_KEY = 'self_or_admin';
export const SelfOrAdmin = () => SetMetadata(SELF_OR_ADMIN_KEY, true);
