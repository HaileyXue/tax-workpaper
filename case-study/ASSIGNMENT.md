# Case Study: Redesign the Tax Workpaper

## The brief

Build a working, web-native tax workpaper from scratch, with full workpaper capability, for one complex household's return.

At Miraflores, software reads the client's documents and computes the return, and CPAs review it. The workpaper proves the return is right: where every number came from, what was done to it, who checked it, and what is still open. It serves preparers, reviewers, partners, the client, the firm's administrator, next year's preparer, and an IRS examiner years later.

Invent it from the purpose. We give you only what the workpaper must achieve. We do not want a spreadsheet, or traditional workpapers recreated in any form. Picture someone fluent in modern technology who has never seen a workpaper: given these goals, they would not invent a spreadsheet. Design like them.

The bar: a 20-year CPA finds it faster and more trustworthy than anything they've used, and a new hire can use it on day one.

## What it must do

Everything below must work. How is up to you.

### Evidence

Trace any number to its exact source, and any document to everywhere it landed (or why it didn't). Record how each number was verified. Link related items across the return, years and related returns. Attach any file, message or note as evidence.

### Calculation

Show how any number was built. Reconcile figures that should agree. Handle large detail (hundreds of sales, many assets) without swamping the review. Take business books to taxable income. Split income between states. Run checks that don't trust the engine.

When tracing a number, you must display its source document and clearly identify the specific field or location it came from. Since source documents are not provided and you are not building a full extraction and tracing pipeline, create simulated source documents from the JSON data. Structure the document view and tracing links so real source documents could replace the simulated versions seamlessly.

### Change

Adjust without losing the original (who, why, tax effect). See changes live and what changed since I last looked. Compare versions. Try what-ifs. Act on many items at once, with undo.

### Judgment

Flag swings from last year. Record judgment calls, elections, due diligence and penalty decisions. Prove completeness: every document used, every area considered, every outside filing identified.

### People

Questions to the client or colleagues that become evidence. Review notes that can block filing. Sign-offs that reopen when what was signed changes. Enforced roles. Several people at once. Assignments, deadlines, notifications. Client approval and e-file signature.

### Filing and after

Extensions, filing, e-file rejections, the client's copy. Freeze at filing; amend on top. Answer a notice with a self-contained record. Carry everything forward with its history, and plan next year.

### Firm

Firm-wide standards, protection of sensitive data with view logs, time against budget, status and search.

### Records a CPA expects

Return summary vs last year, tax computation, area summaries, document index, depreciation by asset (method, life, bonus, federal vs California vs AMT, disposals and recapture), sales detail, books to tax, rentals and passive losses, K-1 lines, retirement and foreign items, deductions and credits with limits, payments, state split, carryovers, basis by year, and what the prior preparer did vs what we changed.

## The client and the data

The Okafor-Lindqvist household (invented) files jointly for 2025. They moved from California to Texas mid-year and had a different preparer last year. Their return has stock compensation, a one-person business, two brokerages and crypto, a Swedish account, a rental and a rental sold, two K-1s (one late), an S corporation with basis gaps, a backdoor Roth, a college student, and gifts of stock and a car. Figures disagree, documents arrive late or corrected, and some answers only the client knows.

You start where our extraction stops. One JSON packet holds 74 documents as records, about 3,000 extracted values with source and confidence, three computed versions of the return, client answers, prior years, IRS data, firm staff, and a timeline to replay the season. A README defines every field. The packet contains confident mistakes.

You don't need tax law (every result is computed for you) or document reading.

## What to hand in

Sending sooner is better.

1. The working workpaper: a web app run from a link, any stack, loading the packet as delivered, saving everything, with a role switcher.
2. One page on your core idea and your data model.
3. The errors you found, and how your design surfaced them.
4. A video recording of yourself walking through the prototype and explaining the technical decisions you made and the tradeoffs you made while building it. You must submit a video link.

Use any tools you like, including AI; tell us how.
