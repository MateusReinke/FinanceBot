-- Only the hash is stored from now on, matching the rule ApiToken already
-- follows: a database dump must never yield a working reset link.
ALTER TABLE "PasswordReset" RENAME COLUMN "token" TO "tokenHash";
ALTER INDEX "PasswordReset_token_key" RENAME TO "PasswordReset_tokenHash_key";
