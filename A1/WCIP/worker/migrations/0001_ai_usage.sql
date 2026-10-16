-- No prompts, responses, credentials or email addresses are stored here.
CREATE TABLE ai_days (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ai_usage (
  uid TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL,
  last_request INTEGER NOT NULL,
  PRIMARY KEY (uid, day)
);
CREATE INDEX ai_usage_day ON ai_usage(day);
CREATE TRIGGER ai_usage_insert AFTER INSERT ON ai_usage BEGIN
  UPDATE ai_days SET requests = requests + 1 WHERE day = NEW.day;
END;
CREATE TRIGGER ai_usage_update AFTER UPDATE ON ai_usage BEGIN
  UPDATE ai_days SET requests = requests + 1 WHERE day = NEW.day;
END;
