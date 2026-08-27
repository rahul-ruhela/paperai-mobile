Implement only one specification at a time.

Before coding:

1. Read related docs.
2. Inspect existing code.
3. Explain files that will change.
4. Explain database changes.
5. Explain API changes.
6. Wait for approval.

Never:

- rewrite architecture
- create duplicate services
- bypass FeatureMatrix
- hardcode subscription checks
- modify billing without approval
- remove locked features

After implementation:

Run:

- tests
- lint
- build


Provide:

Changed files
Reason
Testing result
Known issues