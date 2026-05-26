# Requirements Document

## Introduction

The Equipment Manager is a dedicated tab within Shukra that gives small business owners a clear, real-time view of all physical assets they own. Users can log equipment, track its value over time via depreciation calculations, set maintenance reminders, and generate reports — all using plain-English input consistent with Shukra's "vibe accounting" philosophy.

Goals:
- Allow non-accountant users to manage business equipment without needing to understand accounting standards.
- Automatically compute depreciation using standard methods and surface the results clearly.
- Keep equipment data in sync with the broader general ledger so asset values are always accurate.
- Reduce the time a small business owner spends on asset tracking during tax season.

Out of scope (v1): fixed asset barcoding/QR scanning, multi-entity tracking, external inventory integrations, and lease accounting under ASC 842/IFRS 16.

## Glossary

- **Equipment_Manager**: The dedicated tab within Shukra for tracking physical business assets.
- **Asset**: A piece of physical equipment owned by the business and tracked in the Equipment_Manager.
- **Book_Value**: The current value of an asset on the books, calculated as purchase cost minus accumulated depreciation.
- **Salvage_Value**: The estimated residual value of an asset at the end of its useful life, used as the floor for depreciation calculations.
- **Accumulated_Depreciation**: The total depreciation expense recorded against an asset from its purchase date to the current date.
- **Depreciation**: The systematic allocation of an asset's cost over its useful life, reducing Book_Value each period.
- **Straight_Line**: A depreciation method that allocates an equal expense amount each year: (cost − salvage value) ÷ useful life.
- **Double_Declining_Balance**: An accelerated depreciation method that applies twice the Straight_Line rate to the remaining Book_Value each year.
- **Sum_of_Years_Digits**: An accelerated depreciation method that weights earlier years more heavily using the fraction (remaining life ÷ sum of years digits).
- **Section_179**: An IRS provision allowing a business to fully expense the cost of qualifying equipment in the year of purchase rather than depreciating it over time.
- **Fixed_Asset_Schedule**: A report listing all assets with their original cost, accumulated depreciation, and current Book_Value, formatted for accountant or tax use.
- **Gain_Loss_on_Disposal**: The difference between the sale price of a disposed asset and its Book_Value at the time of disposal; positive is a gain, negative is a loss.
- **General_Ledger**: The master record of all financial transactions in Shukra, to which equipment-related journal entries are posted.
- **AI_Parser**: The natural-language processing component that extracts structured asset data from plain-English user input.

## Requirements

### Requirement 1: Add Equipment via Natural-Language Input

**User Story:** As a business owner, I want to add a piece of equipment in plain English, so that I don't need to know accounting terminology.

#### Acceptance Criteria

1. WHEN a user submits a plain-English description of an equipment purchase, THE AI_Parser SHALL extract and populate the asset name, purchase date, purchase cost, category, and estimated useful life.
2. WHEN the AI_Parser populates fields from user input, THE Equipment_Manager SHALL present the extracted values for user review before saving.
3. WHILE a user is reviewing AI_Parser-populated fields, THE Equipment_Manager SHALL allow the user to manually edit any field.
4. WHEN a user confirms and saves a new asset record, THE Equipment_Manager SHALL store the record with all required fields: name, category, purchase date, purchase cost, estimated useful life, salvage value, depreciation method, computed Book_Value, and status.
5. WHEN a user saves a new asset, THE Equipment_Manager SHALL display the asset in the equipment table within 2 seconds.
6. WHERE a user chooses to attach supporting documentation, THE Equipment_Manager SHALL accept a photo or document file (e.g., receipt, warranty PDF) and associate it with the asset record.

---

### Requirement 2: View Equipment Inventory

**User Story:** As a business owner, I want to see all equipment I own in one place, so that I have a clear picture of my asset inventory.

#### Acceptance Criteria

1. THE Equipment_Manager SHALL display all asset records in a sortable, filterable table with columns: Name, Category, Purchase Date, Cost, Book_Value, YTD Depreciation, and Status.
2. WHEN a user selects a column header, THE Equipment_Manager SHALL sort the table by that column in ascending or descending order.
3. WHEN a user applies a filter by category, status, or date range, THE Equipment_Manager SHALL display only the asset records matching all selected filter criteria.
4. WHEN a user enters a search term in the search bar, THE Equipment_Manager SHALL display only asset records whose name or description contains the search term.
5. THE Equipment_Manager SHALL load the equipment table within 1 second for datasets of up to 500 asset records.
6. THE Equipment_Manager SHALL be fully usable on screens with a viewport width of 375px or greater.

---

### Requirement 3: Track Depreciation per Asset

**User Story:** As a business owner, I want to see how much each item has depreciated, so that I know the current book value for tax and reporting purposes.

#### Acceptance Criteria

1. THE Equipment_Manager SHALL automatically calculate depreciation for each asset from its purchase date using the asset's selected depreciation method.
2. THE Equipment_Manager SHALL display the current-year depreciation expense prominently on each asset record.
3. THE Equipment_Manager SHALL always display the Accumulated_Depreciation and Book_Value for each asset, keeping both values current.
4. WHEN a user views an asset record, THE Equipment_Manager SHALL present a full year-by-year depreciation schedule showing annual depreciation expense, Accumulated_Depreciation, and Book_Value for each year of the asset's useful life.
5. THE Equipment_Manager SHALL calculate depreciation values that match IRS Publication 946 and standard GAAP methods to within $0.01 rounding tolerance.

---

### Requirement 4: Choose Depreciation Method per Asset

**User Story:** As a business owner, I want to choose a depreciation method per asset, so that I can match IRS or GAAP requirements.

#### Acceptance Criteria

1. THE Equipment_Manager SHALL support the following depreciation methods for each asset: Straight_Line, Double_Declining_Balance, Sum_of_Years_Digits, and Section_179.
2. WHEN a user selects a depreciation method for an asset, THE Equipment_Manager SHALL recalculate the depreciation schedule and Book_Value using the selected method.
3. WHEN a user changes the depreciation method on an existing asset, THE Equipment_Manager SHALL recalculate depreciation from the date of the change going forward and record the method change in the asset's audit log.
4. IF a user selects Section_179 for an asset, THEN THE Equipment_Manager SHALL apply full cost expensing in the purchase year and set Book_Value to Salvage_Value thereafter.

---

### Requirement 5: Set Maintenance and Warranty Reminders

**User Story:** As a business owner, I want to set a maintenance or warranty reminder, so that I don't let important dates slip by.

#### Acceptance Criteria

1. WHEN a user creates a reminder on an asset, THE Equipment_Manager SHALL accept a reminder type (warranty expiration, scheduled maintenance, insurance renewal, or loan/lease payment due) and a target date.
2. WHEN a reminder's target date is within 30 days of the current date, THE Equipment_Manager SHALL display a badge on the Equipment_Manager tab icon and highlight the corresponding asset row in the table.
3. WHEN a reminder's target date is reached, THE Equipment_Manager SHALL surface an in-app notification identifying the asset name, reminder type, and due date.
4. WHERE a user has opted into email alerts, THE Equipment_Manager SHALL send an email notification for each reminder when its target date is reached.

---

### Requirement 6: Mark Equipment as Sold or Retired

**User Story:** As a business owner, I want to mark equipment as sold or retired, so that my books stay accurate when I dispose of an asset.

#### Acceptance Criteria

1. WHEN a user marks an asset as Sold and provides a sale date and sale price, THE Equipment_Manager SHALL calculate the Gain_Loss_on_Disposal as the difference between the sale price and the asset's Book_Value on the sale date.
2. WHEN a user confirms a sale, THE Equipment_Manager SHALL post a journal entry to the General_Ledger recording the disposal, removing the asset's cost and Accumulated_Depreciation, and recognizing the Gain_Loss_on_Disposal.
3. WHEN a user marks an asset as Retired or Disposed, THE Equipment_Manager SHALL post a write-off journal entry to the General_Ledger and remove the asset from the active Book_Value totals.
4. WHEN an asset's status changes to Sold or Retired, THE Equipment_Manager SHALL record the status change with a timestamp in the asset's audit log.
5. THE Equipment_Manager SHALL execute all asset mutations atomically so that no partial save can leave the General_Ledger in an inconsistent state.

---

### Requirement 7: Export Equipment Reports

**User Story:** As a business owner, I want to export an equipment schedule, so that I can hand it off to my accountant or attach it to a tax filing.

#### Acceptance Criteria

1. WHEN a user requests a Fixed_Asset_Schedule report, THE Equipment_Manager SHALL generate a report listing all assets with their name, category, purchase date, original cost, Accumulated_Depreciation, and Book_Value.
2. WHEN a user requests a Depreciation Summary report for a selected tax year, THE Equipment_Manager SHALL generate a report showing each asset's depreciation expense for that year.
3. WHEN generating any report, THE Equipment_Manager SHALL include the business name, report generation date, and the selected date range in the report header.
4. WHEN a user exports a report, THE Equipment_Manager SHALL make the report available in both PDF and CSV formats.

---

### Requirement 8: View Asset Value Summary Dashboard

**User Story:** As a business owner, I want to see a summary of total asset value and accumulated depreciation, so that I have a quick financial snapshot.

#### Acceptance Criteria

1. THE Equipment_Manager SHALL display a summary panel showing: total number of active assets, total original cost of all active assets, total Accumulated_Depreciation across all active assets, and total current Book_Value of all active assets.
2. WHEN any asset record is added, updated, or disposed of, THE Equipment_Manager SHALL update the summary panel values to reflect the change.

---

### Requirement 9: Ledger Integration

**User Story:** As a business owner, I want equipment transactions to be reflected in my general ledger automatically, so that my financial records stay accurate without manual journal entries.

#### Acceptance Criteria

1. WHEN a new asset is saved, THE Equipment_Manager SHALL create a journal entry in the General_Ledger debiting the Equipment asset account and crediting Cash or Accounts Payable for the purchase cost.
2. THE Equipment_Manager SHALL automatically generate monthly depreciation journal entries debiting Depreciation Expense and crediting Accumulated_Depreciation for each active asset.
3. WHEN auto-generated ledger entries are pending, THE Equipment_Manager SHALL present the entries to the user for review before committing them to the General_Ledger.
4. WHEN a user approves pending ledger entries, THE Equipment_Manager SHALL commit the entries to the General_Ledger atomically.
5. IF a user rejects a pending ledger entry, THEN THE Equipment_Manager SHALL discard the entry and record the rejection in the asset's audit log.
