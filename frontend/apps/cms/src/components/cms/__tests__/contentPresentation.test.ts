import { describe, expect, it } from 'vitest';
import { getCmsQueueSummary, getContentStatusTone } from '../contentPresentation';
describe('CMS editorial presentation', () => {
  it('builds attention queue only from durable statuses', () => {
    const summary=getCmsQueueSummary({content:[{status:'draft'},{content_status:'active'},{status:'archived'},{content_status:'draft'}],sectors:[{is_active:true},{is_active:false}],banners:[{status:'scheduled'},{status:'active'},{status:'paused'}]});
    expect(summary).toEqual({draftCount:2,scheduledBannerCount:1,activeContentCount:1,activeSectorCount:1,activeBannerCount:1,totalAttentionCount:3});
  });
  it('maps supported content status to semantic tones',()=>{expect(getContentStatusTone('active')).toBe('success');expect(getContentStatusTone('draft')).toBe('warning');expect(getContentStatusTone('archived')).toBe('neutral');expect(getContentStatusTone('deleted')).toBe('danger');expect(getContentStatusTone('unknown')).toBe('neutral')});
});
