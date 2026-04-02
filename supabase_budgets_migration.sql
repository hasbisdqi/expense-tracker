-- Envelope Budgets Migration Script

-- 1. Create the new Budgets table
CREATE TABLE IF NOT EXISTS public."budgets" (
    "id" uuid PRIMARY KEY,
    "user_id" uuid,
    "name" text NOT NULL,
    "categoryIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "dailyAmount" numeric,
    "weeklyAmount" numeric,
    "monthlyAmount" numeric,
    "yearlyAmount" numeric,
    "icon" text,
    "color" text,
    "createdAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Drop the old budget columns from the Categories table
-- Note: 'categories' might be 'Categories' or 'categories' depending on your Supabase config
ALTER TABLE public."categories" DROP COLUMN IF EXISTS "budget";
ALTER TABLE public."categories" DROP COLUMN IF EXISTS "budgetPeriod";

-- 3. Enable Row Level Security on the new table
ALTER TABLE public."budgets" ENABLE ROW LEVEL SECURITY;

-- 4. Create policies identical to existing tables
CREATE POLICY "Users can manage their own budgets"
ON public."budgets" FOR ALL
USING (auth.uid() = user_id);
