# Stack decision for the teammate ZIP

The supplied teammate ZIP is a static HTML/CSS/vanilla-JavaScript PWA. Replacing all 17 screens with a new React Native + TypeScript app immediately would discard much of the existing design and increase the time needed to reach a demonstrable prototype.

For this first integration step we therefore preserve that UI, connect it to Python/FastAPI, and add SQLAlchemy with SQLite for the first local run plus a PostgreSQL driver/configuration path. The UI is responsive and installable as a PWA; this phase is not yet a native APK and the inherited UI files are not yet TypeScript.

Next engineering phases:

1. Finish and field-test the core ledger and outbox sync.
2. Add a Capacitor Android shell so the preserved UI can be built as an Android APK; implement Android Kotlin SpeechRecognizer through a native plugin.
3. Add iOS Swift speech bridge if required.
4. Migrate shared frontend modules to TypeScript incrementally, or replace the PWA shell with React Native only if the teacher requires a fully native cross-platform app.
5. Switch development DB from SQLite to PostgreSQL and run PostgreSQL-specific migration, backup and tenant-isolation tests.

This is a deliberate reuse-first sequence, not a claim that the inherited JavaScript UI already satisfies a TypeScript/native-app requirement.
