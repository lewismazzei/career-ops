ALTER TABLE candidate_judgements ADD COLUMN reason TEXT NOT NULL DEFAULT '';

ALTER TABLE candidate_judgement_events ADD COLUMN reason TEXT;
