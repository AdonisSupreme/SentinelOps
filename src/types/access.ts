import type { MeResponse } from '../contracts/generated/api.types';

export interface EffectiveAccess {
  role: string;
  section: { id: string; name: string; is_active: boolean } | null;
  modules: string[];
}
export type SessionUser = MeResponse & { access?: EffectiveAccess };
export const accessSignature = (access: EffectiveAccess | null | undefined) => access
  ? [access.role, access.section?.id, access.section?.name, access.section?.is_active, ...access.modules].join('|')
  : '';

