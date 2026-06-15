# Database Migration Required

## ⚠️ IMPORTANT: Run this migration to add poop/pee tracking fields

Your database needs two new columns to track walks properly.

### Steps:

1. Go to your Supabase SQL Editor:
   https://supabase.com/dashboard/project/qrvhezrapxtnojfdgzeu/sql/new

2. Copy and paste this SQL:

```sql
ALTER TABLE hope_logs
ADD COLUMN IF NOT EXISTS pooped boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS peed boolean DEFAULT false;
```

3. Click "RUN" to execute

4. Refresh your app - the calendar should now save and display properly!

### What this does:

- Adds `pooped` column (boolean) - tracks if Hope pooped outside during walk
- Adds `peed` column (boolean) - tracks if Hope peed outside during walk
- Both default to `false` for existing records

### After migration:

- Click any past walk and you can update what Hope did
- Today's date will save properly when you toggle poop/pee
- Calendar will show 💩 and 💧 icons correctly
