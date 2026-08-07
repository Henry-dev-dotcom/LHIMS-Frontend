# Lab Result Document Import Update

This update adds document import support to the laboratory result-entry workflow.

## Added capabilities

- Lab staff can import result files while entering patient results in **Laboratory → Accepted Samples → Enter Results**.
- Supported file types:
  - PDF
  - DOC
  - DOCX
  - TXT
  - RTF
- Multiple files can be attached to one test result.
- Imported files are shown in the result-entry modal before saving.
- Attached documents are saved with the laboratory result record in demo storage.
- The lab result archive displays imported documents in the result view popup.
- The lab review/sign-off popup displays imported documents for reviewer confirmation.
- Generated lab PDF reports include an imported-document summary table.

## Storage behavior

For the browser demo, small files are stored with preview data. Larger files are registered as metadata to avoid breaking browser localStorage limits. The backend already exposes the compatibility endpoint:

```text
POST /lab/results/:id/files
```

That endpoint can process lab result file metadata and local file bytes when `contentBase64` is provided.

## QA completed

```bash
npm run build
npm run qa
```

Both passed successfully. The normal Vite chunk-size warning is not an error.
