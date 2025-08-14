-- Create a table for per-lounge digest subscriptions
CREATE TABLE IF NOT EXISTS lounge_digest_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lounge_id UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lounge_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lounge_digest_user ON lounge_digest_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_lounge_digest_lounge ON lounge_digest_subscriptions(lounge_id);
CREATE INDEX IF NOT EXISTS idx_lounge_digest_subscribed ON lounge_digest_subscriptions(subscribed);

-- Enable RLS
ALTER TABLE lounge_digest_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own subscriptions
CREATE POLICY "Users can view own lounge subscriptions" ON lounge_digest_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lounge subscriptions" ON lounge_digest_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lounge subscriptions" ON lounge_digest_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);