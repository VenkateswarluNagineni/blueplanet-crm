# BluePlanet CRM Development & Verification Guidelines

To ensure the highest level of data integrity, proper UI rendering, and bug-free feature development across the BluePlanet ecosystem, the following rules MUST be strictly adhered to whenever a new feature is added or data tables are linked.

## 1. Data Linkage & Relational Integrity
- **Always Validate Foreign Keys:** When displaying data in a table (e.g., viewing Purchase Orders for a specific Supplier), explicitly verify that the IDs match exactly (`supplierId === currentSupplier.id`).
- **Never Hardcode Disconnected State:** Do not rely on isolated static arrays for interactive features. If an entity is updated in the CRM dashboard, any connected dashboard (like Inventory or Purchases) must reflect that updated data model.
- **Reference Over Duplication:** Ensure that when a user selects a Vendor for a service, the system stores the Vendor ID and pulls the live Vendor data dynamically, rather than duplicating the Vendor's name into the new table.

## 2. Feature Implementation Checklist
Before deploying or confirming a new feature, verify the following:
1. **State Hydration:** Does the data properly load from the initial state into the component?
2. **Interactive Mutability:** If a user edits a field, does it instantly reflect in the UI without requiring a hard refresh?
3. **Cross-Component Synchronization:** If an entity's name is updated in the Drill-Down view, does the main Data Table also show the new name?
4. **Error Boundaries:** Are there checks in place to prevent the app from crashing if a linked ID is missing or undefined (e.g., `supplier?.name || 'Unknown Supplier'`)?

## 3. Comprehensive Functionality Verification (The "All-Ways" Test)
Every new feature must be tested against these specific failure modes:
- **Empty State Test:** What happens if the data table is completely empty? (Ensure fallback text is displayed).
- **Null Reference Test:** What happens if a Purchase Order references a Supplier ID that was deleted? (Ensure soft-delete logic prevents crashes and displays "Archived Entity").
- **Edit & Close Test:** Does the system properly handle a user entering data, closing the form without saving, and reopening it? (Ensure state is reset on close).
- **Filter Collision Test:** Do search filters correctly stack? (e.g., Searching for "Marco" while the "Net 60" filter is active must strictly return intersections, not unions).

*By adhering to these rules, we guarantee that BluePlanet CRM remains a robust, enterprise-grade system capable of handling complex logistics and financial data securely.*
