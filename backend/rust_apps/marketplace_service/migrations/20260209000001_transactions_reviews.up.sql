-- Transactions table for managing offers and deals
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  transaction_status TEXT NOT NULL DEFAULT 'pending',
  offer_message TEXT,
  response_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_content ON transactions(content_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(transaction_status);

-- Reviews table for ratings and feedback
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewee_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_transaction ON reviews(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reviews_content ON reviews(content_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- Trigger to update content_items rating when review is added
CREATE OR REPLACE FUNCTION update_content_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE content_items
  SET 
    rating = (SELECT AVG(rating)::REAL FROM reviews WHERE content_id = NEW.content_id),
    review_count = (SELECT COUNT(*)::INT FROM reviews WHERE content_id = NEW.content_id),
    updated_at = NOW()
  WHERE id = NEW.content_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_content_rating();

SELECT 1; -- Migration complete

