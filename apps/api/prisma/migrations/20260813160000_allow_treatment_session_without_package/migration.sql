-- A package-less therapy session consumes physical inventory but does not
-- consume a Basic/Booster voucher or recognize deferred package revenue.
ALTER TABLE "encounters" ALTER COLUMN "memberPackageId" DROP NOT NULL;
