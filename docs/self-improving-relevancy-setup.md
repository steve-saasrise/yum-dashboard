# Self-Improving Relevancy System Setup Guide

## Overview

The self-improving relevancy system learns from curator/admin corrections to automatically suggest improvements to content filtering prompts. When content with low relevancy scores is manually restored, the system tracks these corrections and analyzes patterns weekly to generate specific prompt adjustments.

**Current Status**: ✅ Fully operational with 1 active adjustment for SaaS lounge

## System Components

### 1. Database Tables (Already Created)

- `relevancy_corrections` - Tracks when low-relevancy content is restored
- `prompt_adjustments` - Stores AI-suggested prompt improvements
- `relevancy_analysis_runs` - Logs weekly analysis history

### 2. Modified Services

- **Relevancy Service** (`lib/services/relevancy-service.ts`) - Now loads dynamic prompt adjustments from database
- **Content Hook** (`hooks/use-content.tsx`) - Tracks restorations for learning

### 3. New API Endpoints

- `/api/relevancy/track-restoration` - Records when content is restored
- `/api/cron/analyze-relevancy` - Weekly analysis job (cron)
- `/api/admin/relevancy-suggestions` - Admin management of suggestions

### 4. Admin Interface

- **Component**: `components/admin-relevancy-learning.tsx`
- Shows pending suggestions, active adjustments, and analysis history

## Setup Instructions

### Step 1: Environment Variables

Add to your `.env.local` file:

```env
# For cron job authentication (use a secure random string in production)
CRON_SECRET=your-secure-cron-secret-here
```

### Step 2: Set Up Weekly Cron Job

#### Option A: Railway/Vercel Cron

Add to your deployment platform's cron configuration:

```
Schedule: 0 2 * * 1  # Every Monday at 2 AM
URL: https://yourdomain.com/api/cron/analyze-relevancy
Headers: Authorization: Bearer YOUR_CRON_SECRET
```

#### Option B: External Cron Service (e.g., cron-job.org)

1. Create account at cron-job.org or similar
2. Set up weekly job:
   - URL: `https://yourdomain.com/api/cron/analyze-relevancy`
   - Schedule: Weekly (Mondays recommended)
   - Add header: `Authorization: Bearer YOUR_CRON_SECRET`

#### Option C: Manual Trigger (Development)

For testing, you can trigger manually from the admin panel or via:

```bash
curl -X GET https://yourdomain.com/api/cron/analyze-relevancy \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Step 3: Admin Interface (Already Configured)

✅ **The admin interface is already set up** at `/dashboard/admin`

The `AdminRelevancyLearning` component has been integrated into the admin dashboard and includes:
- **Pending Suggestions**: Review and approve/reject AI-generated adjustments
- **Active Adjustments**: View and manage currently active prompt improvements
- **Analysis History**: Track weekly analysis runs and their results

No additional setup needed for the interface.

### Step 4: Initial Testing

1. **Test Restoration Tracking**:
   - Find content with relevancy_score < 60
   - Click restore/undelete as admin/curator
   - Check `relevancy_corrections` table for new entry

2. **Test Analysis** (without waiting for cron):

   ```bash
   # Trigger analysis manually
   curl -X GET http://localhost:3000/api/cron/analyze-relevancy \
     -H "Authorization: Bearer development"
   ```

3. **Review Suggestions**:
   - Go to admin panel
   - Check "Pending Suggestions" tab
   - Approve/reject suggestions

## How It Works

### Workflow

1. **Content Filtered**: Content scores below threshold (e.g., < 60)
2. **Manual Restoration**: Admin/curator restores incorrectly filtered content
3. **Tracking**: System records restoration with context
4. **Weekly Analysis**: AI analyzes patterns in restorations
5. **Suggestions Generated**: Specific prompt adjustments suggested
6. **Admin Review**: Approve/reject suggestions in admin panel
7. **Active Improvements**: Approved adjustments automatically used

### Example Adjustment

If multiple B2B marketing posts are restored, the system might suggest:

```
Type: keep
Text: "B2B marketing strategies with indirect SaaS applications"
Reason: "3 marketing strategy posts were incorrectly filtered despite having relevant business insights"
```

## Monitoring & Maintenance

### Weekly Tasks (5 minutes)

1. Check admin panel for new suggestions
2. Review each suggestion's reasoning
3. Approve helpful adjustments
4. Reject overly broad suggestions

### Monthly Tasks

1. Review active adjustments effectiveness
2. Deactivate underperforming adjustments
3. Check analysis run history for trends

### Metrics to Track

- Number of restorations per week
- Suggestion approval rate
- Reduction in false negatives over time
- Content relevancy score distribution

## Troubleshooting

### No Suggestions Generated

- Check if restorations are being tracked
- Verify cron job is running
- Ensure OpenAI API key is configured
- Check for errors in `relevancy_analysis_runs` table

### Suggestions Not Applied

- Verify adjustments are approved AND active
- Check relevancy service is loading adjustments
- Review console logs for errors

### Too Many False Positives

- Review and deactivate overly broad adjustments
- Adjust base prompts if needed
- Consider raising threshold temporarily

## Advanced Configuration

### Adjust Analysis Sensitivity

In `/api/cron/analyze-relevancy/route.ts`, modify:

- Minimum corrections for analysis (default: 1)
- Maximum suggestions per lounge (default: 3)
- GPT model temperature (default: 0.3)

### Known Limitations

- **Prompt Accumulation**: Currently appends new adjustments to base prompts without intelligent merging
- **No Conflict Detection**: Doesn't check for contradictory rules
- **No Automatic Pruning**: Inactive or ineffective adjustments must be manually removed
- **Recommendation**: Periodically review and consolidate active adjustments to prevent prompt bloat

### Custom Thresholds

Different lounges can have different thresholds:

```sql
UPDATE lounges
SET relevancy_threshold = 50
WHERE name = 'Biohacking';
```

## Security Notes

- Only admins can approve/reject suggestions
- Only admins/curators can trigger restorations
- Cron endpoint requires secret authentication
- All changes are logged with user IDs

## Support

For issues or questions:

1. Check logs in Supabase dashboard
2. Review `relevancy_analysis_runs` for analysis history
3. Inspect `prompt_adjustments` for suggestion details

The system will gradually improve accuracy over 4-12 weeks as it learns from your corrections.
