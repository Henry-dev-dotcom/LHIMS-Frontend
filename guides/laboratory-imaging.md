# Laboratory and imaging

## Laboratory

1. **Queue** — requested tests waiting for a sample.
2. **Accept Sample** — check the label and sample type; accept, or reject with a reason (the
   patient is asked for a new sample, see **Rejected / Retest**).
3. **Accepted Samples** — enter results. Values outside the reference range are flagged
   automatically.
4. **Review & Sign-off** — a second, senior person checks and signs off. Only then is the result
   released.
5. **Results** — released results, printable, and sent to the requesting doctor.

Quality control records and lab stock are under the Laboratory menu for authorised staff.

### Letting the analyzers enter results

If the lab has an analyzer — chemistry, haematology, or anything that can export
or send its results — it can fill the result fields itself, so the bench checks
numbers instead of typing them.

1. **Analyzers → Register an analyzer.** Say what it is and how it sends results.
   CurataMed issues it a key, **shown only once** — copy it then.
2. Get the results to CurataMed, whichever suits:
   - **Upload a run.** Export the run from the instrument and bring the file to
     **Analyzers → Upload a run**. Nothing to install.
   - **Run the bridge** on the computer beside the analyzer, so results arrive on
     their own. Ask whoever set CurataMed up; it is a small program with a short guide.
3. **Run one sample**, then open **Test mapping**. Whatever codes the instrument
   used are listed there with an example value. Point each at the right field of
   the right test, then **Analyzer log → Try again** to bring that first run in.

Afterwards, nothing changes about how you work: the values appear on the
patient's result as a **draft**, with the fields the analyzer filled marked as
such, and you check and sign off exactly as before.

Two things worth knowing:

- **The tube's barcode is what ties a reading to a patient.** The analyzer must be
  given the sample code CurataMed printed. Nothing is matched by name.
- **An analyzer never releases a result.** Whatever it sends waits for a person.
  A critical value is notified to the lab at once, while it is still a draft.

**Analyzer log** holds everything the instruments sent, kept exactly as it
arrived. A value that could not be stored — an unmapped code, a sample not yet
accepted, a result already signed off — is there with the reason, and can be tried
again once the cause is fixed. Nothing is ever thrown away, so a run on a sample
you cannot take again is never lost.

## Imaging

1. **Scan Queue** → **Accept Scan** (book the room or machine in **Equipment Booking** if needed).
2. Perform the scan; attach images and write the report.
3. **Review & Sign-off** by the radiologist releases the report.
4. **Rejected / Retake** lists scans that must be repeated, with the reason.

## Results delivery

Released results can be delivered in the app, by email or SMS, or as a PDF. Messages never contain
the result itself — they tell the recipient to sign in or open a secure, expiring link.
