import { describe, expect, it } from 'vitest';
import { createEmptyDashboardData } from '../dashboardData';
describe('CRM dashboard data',()=>{it('starts empty and never injects sample collections',()=>{const data=createEmptyDashboardData();expect(data.leads).toEqual([]);expect(data.orders).toEqual([]);expect(data.users).toEqual([]);expect(data.sampleCollections).toEqual([])})});
