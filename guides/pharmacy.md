# Pharmacy

## Dispensing

**Pharmacy → Dispensing** lists prescriptions waiting.

1. Open the prescription. LHIMS picks the batch that expires first (and never an expired one).
2. Dispense all items, or part of them if stock is short; the rest stays outstanding.
3. The pharmacy bill is created for the cashier.

If a prescribed drug matches the patient's recorded allergy, you are warned; continuing needs a
reason, which is recorded.

## Drugs and stock

**Drugs & Stock**:

- the drug list (name, form, strength, class);
- **receive** stock by batch with expiry date and quantity;
- **adjust** for damage, expiry or counting differences (with a reason). Stock can never go below
  zero, and every movement is kept in the stock ledger.
- Batches close to expiry are highlighted.
