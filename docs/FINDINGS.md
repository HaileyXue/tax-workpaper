# Findings and how the workspace surfaces them

These observations come from the fictional packet, not external tax-law advice. Findings are review prompts, not silently applied corrections.

| Finding                                                       | Evidence                                                                                                                     | How surfaced                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Bank-sweep interest appears twice                             | D28 / `ev-0492` and D29 / `ev-0538` each report $1,840 for the Northlake Bank sweep; both reach `F1040.2b`                   | Independent reverse-lineage overlap check; open both source pages and trace each contribution                          |
| Wrong-year FX parameter used for Swedish interest             | `SchB.1.6` references `ref:fx.SEK.2024_average` (10.56); D36 reports 2025 SEK interest and the packet supplies 9.86 for 2025 | Independent source-reference year check; parameter references resolve in the explorer                                  |
| Brokerage summary and detail disagree                         | D30 page 1 reports $71,965 proceeds; page 10 reports $71,715 detail total                                                    | Supplied `BROKER_SUMMARY_DETAIL_MISMATCH` diagnostic; document page selector exposes the $250 source-level discrepancy |
| Cryptocurrency basis missing                                  | `DIGITAL_ASSET_BASIS_MISSING` references the C6 lot's source fields                                                          | Engine diagnostic preserved in queue; missing basis is not inferred to be zero by the review app                       |
| Client questionnaire conflicts with sales evidence            | `qa-14` versus brokerage and crypto transactions                                                                             | Supplied `QUESTIONNAIRE_SALES_CONFLICT`; questionnaire resolves as evidence                                            |
| Low-confidence handwritten amount                             | `ev-1049`, confidence 0.41                                                                                                   | Supplied diagnostic and extracted/source comparison                                                                    |
| Duplicate W-2 image requires disposition, not double counting | D09 and D10; `F1040.1a` notes D10 is a second image and uses only D08/D09 wages                                              | Reverse document usage shows no additional wage contribution from D10; do not report this as a double-counting error   |

Additional supplied warnings include contractor information returns, due diligence, and uncomputed California AMT. Informational diagnostics stay distinguishable from warnings.

The independent W-2 box comparison currently finds no mismatch in the delivered W-2s. A regression test introduces a synthetic high-confidence mismatch to prove the check does not trust confidence. That synthetic test condition is **not** reported as an error found in the original packet.

## Limits

The independent overlap and FX checks are household-specific rules with explicit IDs, not a general duplicate detection or tax-rule engine. Broader checks, other high-confidence extraction mistakes, basis gaps, depreciation, carryovers, state allocations, and completeness still require further investigation. Resolving a finding requires a reviewer note; it does not by itself prove that the return is ready to file.
