# BE integration tests with an isolated PostgreSQL database

`run-it.sh` makes the 54 DB-dependent Spring/PostgreSQL integration tests runnable:

```bash
cd be/fasearch
scripts/it-db/run-it.sh                     # whole suite
scripts/it-db/run-it.sh -Dtest='ImportReceiptMultiLineIntegrationTest'   # a subset
IT_KEEP_DB=1 scripts/it-db/run-it.sh        # keep fasearch_it_be afterwards for inspection
```

What it does and why: see the header of the script. Variables read by the tests:
`PROMOTION_TEST_DB_{NAME,HOST,PORT,USER,PASSWORD}` (promotion/checkout, account search, product search) and
`DEMO_TEST_DB_{NAME,HOST,PORT,USER,PASSWORD}` (inventory receipts, barcode). The database starts empty;
Flyway (`db/migration` + `db/seed`) builds the schema on the first Spring context. Credentials are read from an
env file outside Git (`IT_DB_ENV_FILE`) and never printed.
