import { describe, expect, it } from 'vitest';
import { buildAnalyticsSummary } from '../analyticsModel';
describe('CRM analytics summary',()=>{it('uses exact durable counts and amounts without synthetic multipliers',()=>{const s=buildAnalyticsSummary({users:2,listings:3,transactions:[{amountCents:100},{amountCents:250}],openSupport:4});expect(s).toEqual({users:2,listings:3,transactions:2,gmvCents:350,openSupport:4})})});
