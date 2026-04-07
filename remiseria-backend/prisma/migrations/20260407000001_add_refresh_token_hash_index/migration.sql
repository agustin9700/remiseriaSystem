-- AddIndex: RefreshToken.tokenHash para acelerar búsquedas de refresh
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
