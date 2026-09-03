# Security Specification

## Data Invariants
- A DailyEntry cannot exist without a valid userId.
- Only the BARBER owner or ADMIN can read/write their daily entries and targets.
- Users can only read their own profile, ADMIN can read all profiles.
- Categories, Subcategories, and Catalog items are managed by ADMIN and readable by all.
- Payments are managed by ADMIN and readable by the BARBER owner or ADMIN.

## "Dirty Dozen" Payloads
1. Create Entry with different userId
2. Create User as an ADMIN when not an admin
3. Delete another user's entry
4. Write payment as Barber
5. Overwrite category as Barber
... (mock specification)
