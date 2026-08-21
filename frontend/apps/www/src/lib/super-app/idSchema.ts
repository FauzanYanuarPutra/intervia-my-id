import { z } from 'zod';

const SUPER_APP_ENTITY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const superAppEntityIdSchema = z
  .string()
  .regex(SUPER_APP_ENTITY_ID_PATTERN);
