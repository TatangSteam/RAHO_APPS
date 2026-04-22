# Requirements Document

## Introduction

Sprint 5 implements the therapy session module for the RAHO clinic management system, covering session creation and the first 5 steps of the 10-step therapy workflow. This module enables staff to create new therapy sessions, record diagnoses, plan therapy dosages, capture vital signs, select booster types (when applicable), and record actual infusion data with automatic stock deduction.

The system enforces sequential locking to ensure data integrity: diagnoses must be recorded before therapy plans, and therapy plans must be completed before subsequent steps can be accessed. All stock deductions are atomic and tracked through audit trails.

## Glossary

- **System**: The RAHO therapy session management backend API
- **Frontend**: The Next.js 14 web application interface
- **Staff**: Users with roles ADMIN_LAYANAN, DOCTOR, NURSE, ADMIN_CABANG, ADMIN_MANAGER, or SUPER_ADMIN
- **Member**: A registered patient in the system
- **Session**: A TreatmentSession record representing one therapy appointment
- **Encounter**: A grouping of related therapy sessions under one diagnosis
- **Basic_Package**: A MemberPackage with packageType BASIC
- **Booster_Package**: A MemberPackage with packageType BOOSTER
- **Therapy_Plan**: The planned dosages for 12 therapy components
- **Infusion_Execution**: The actual administered dosages with physical infusion details
- **Stock_Mutation**: An audit record of inventory quantity changes
- **Vital_Sign**: A recorded vital measurement (systolic, diastolic, HR, saturation, PI)
- **Deviation_Note**: Required explanation when actual dosage differs from planned dosage
- **Branch_Validation**: Verification that memberPackage.branchId equals staff.branchId
- **Sequential_Lock**: Requirement that previous steps must be completed before next steps unlock
- **Atomic_Transaction**: Database operation where all changes succeed or all fail together

## Requirements

### Requirement 1: Create Therapy Session

**User Story:** As a staff member, I want to create a new therapy session for a member, so that I can begin recording therapy data.

#### Acceptance Criteria

1. THE System SHALL provide endpoint POST /treatment-sessions accepting memberId, memberPackageId, adminLayananId, doctorId, nurseId, treatmentDate, pelaksanaan, and optional boosterPackageId
2. WHEN a session creation request is received, THE System SHALL validate that memberPackage.branchId equals staff.branchId
3. IF memberPackage.branchId does not equal staff.branchId, THEN THE System SHALL return HTTP 403 with message "Paket ini hanya bisa digunakan di cabang pembelian."
4. WHEN a session creation request is received, THE System SHALL validate that the Basic_Package has status ACTIVE
5. IF the Basic_Package status is not ACTIVE, THEN THE System SHALL return HTTP 422 with message "Member belum memiliki paket aktif."
6. WHEN a session creation request is received, THE System SHALL validate that Basic_Package has remaining sessions greater than zero
7. IF Basic_Package remaining sessions equals zero, THEN THE System SHALL return HTTP 422 with message "Sesi paket basic sudah habis terpakai."
8. WHEN a session creation request is received, THE System SHALL validate that member.voucherCount is greater than zero
9. IF member.voucherCount equals zero, THEN THE System SHALL return HTTP 422 with message "Voucher habis, tidak bisa menambah sesi."
10. WHEN a session creation request includes boosterPackageId, THE System SHALL validate that boosterPackage.branchId equals staff.branchId
11. IF boosterPackage.branchId does not equal staff.branchId, THEN THE System SHALL return HTTP 403 with message "Paket booster hanya bisa digunakan di cabang pembelian."
12. WHEN a session creation request includes boosterPackageId, THE System SHALL validate that Booster_Package has remaining sessions greater than zero
13. IF Booster_Package remaining sessions equals zero, THEN THE System SHALL return HTTP 422 with message "Sesi booster sudah habis terpakai."
14. WHEN a session creation request is received, THE System SHALL validate that doctorId references a user with role DOCTOR and isActive true
15. IF doctorId validation fails, THEN THE System SHALL return HTTP 403 with message "User yang dipilih bukan dokter."
16. WHEN a session creation request is received, THE System SHALL validate that nurseId references a user with role NURSE and isActive true
17. IF nurseId validation fails, THEN THE System SHALL return HTTP 403 with message "User yang dipilih bukan nakes."
18. WHEN creating a session, THE System SHALL search for an existing Encounter with status ONGOING and matching memberPackageId
19. IF no matching Encounter exists, THEN THE System SHALL create a new Encounter with generated encounterCode format "ENC-{branchCode}-{YYMM}-{5chars}"
20. IF a matching Encounter exists, THEN THE System SHALL reuse the existing Encounter
21. WHEN creating a session, THE System SHALL calculate infusKe as the maximum infusKe value in the Encounter plus one
22. WHEN creating a session, THE System SHALL generate sessionCode with format "SES-{branchCode}-{infusKe}-{YYMM}-{5chars}"
23. WHEN creating a session, THE System SHALL create TreatmentSession record with all provided fields and boosterType set to null
24. WHEN creating a session, THE System SHALL increment Basic_Package.usedSessions by one
25. WHEN creating a session, THE System SHALL decrement member.voucherCount by one
26. WHEN creating a session with boosterPackageId, THE System SHALL increment Booster_Package.usedSessions by one
27. WHEN creating a session, THE System SHALL execute all database changes within a single Atomic_Transaction
28. WHEN a session is created successfully, THE System SHALL create an audit log entry with action CREATE for resource TreatmentSession
29. WHEN a session is created successfully, THE System SHALL return HTTP 201 with the created session data including sessionCode and sessionId

### Requirement 2: Record Diagnosis (Step 1)

**User Story:** As a staff member, I want to record a diagnosis for an encounter, so that the medical condition is documented before therapy planning.

#### Acceptance Criteria

1. THE System SHALL provide endpoint POST /encounters/:encounterId/diagnoses accepting doktorPemeriksa, diagnosa, kategoriDiagnosa, icdPrimer, icdSekunder, icdTersier, keluhanRiwayatSekarang, riwayatPenyakitTerdahulu, riwayatSosialKebiasaan, riwayatPengobatan, pemeriksaanFisik, and pemeriksaanTambahan
2. WHEN a diagnosis creation request is received, THE System SHALL validate that diagnosa field has minimum length 3 and maximum length 1000
3. WHEN a diagnosis creation request is received, THE System SHALL validate that doktorPemeriksa references a user with role DOCTOR
4. IF doktorPemeriksa validation fails, THEN THE System SHALL return HTTP 403 with message "User yang dipilih bukan dokter."
5. WHEN a diagnosis creation request is received, THE System SHALL check if a diagnosis already exists for the encounterId
6. IF a diagnosis already exists for the encounterId, THEN THE System SHALL return HTTP 409 with message "Diagnosa sudah ada untuk encounter ini."
7. WHEN creating a diagnosis, THE System SHALL generate diagnosisCode with format "DX-{branchCode}-{YYMM}-{5digits}"
8. WHEN creating a diagnosis, THE System SHALL store all provided fields in the Diagnosis table
9. WHEN a diagnosis is created successfully, THE System SHALL create an audit log entry with action CREATE for resource Diagnosis
10. WHEN a diagnosis is created successfully, THE System SHALL return HTTP 201 with the created diagnosis data including diagnosisCode
11. THE System SHALL provide endpoint GET /encounters/:encounterId/diagnoses returning the diagnosis if it exists
12. THE Frontend SHALL disable the therapy plan creation button until a diagnosis exists for the encounter
13. WHEN the therapy plan button is disabled, THE Frontend SHALL display a tooltip message "Diagnosa harus diisi terlebih dahulu"

### Requirement 3: Create Therapy Plan (Step 2)

**User Story:** As a staff member, I want to create a therapy plan with dosage specifications, so that the treatment protocol is documented and subsequent steps can proceed.

#### Acceptance Criteria

1. THE System SHALL provide endpoint POST /treatment-sessions/:sessionId/therapy-plan accepting keterangan, ifa, hho, h2, no, gaso, o2, o3, edta, mb, h2s, kcl, and jmlNb
2. WHEN a therapy plan creation request is received, THE System SHALL validate that a diagnosis exists for the session's encounter
3. IF no diagnosis exists for the encounter, THEN THE System SHALL return HTTP 422 with message "Diagnosa harus diisi sebelum membuat terapi plan."
4. WHEN a therapy plan creation request is received, THE System SHALL check if a therapy plan already exists for the sessionId
5. IF a therapy plan already exists for the sessionId, THEN THE System SHALL return HTTP 409 with message "Terapi plan sudah ada untuk sesi ini."
6. WHEN creating a therapy plan, THE System SHALL generate planCode with format "TP-{branchCode}-{YYMM}-{5digits}"
7. WHEN creating a therapy plan, THE System SHALL store all 12 dosage fields as Decimal values with precision 10 and scale 2
8. WHEN a therapy plan is created successfully, THE System SHALL create an audit log entry with action CREATE for resource TherapyPlan
9. WHEN a therapy plan is created successfully, THE System SHALL return HTTP 201 with the created therapy plan data including planCode
10. THE System SHALL provide endpoint GET /treatment-sessions/:sessionId/therapy-plan returning the therapy plan if it exists
11. THE System SHALL NOT provide any endpoint to update or delete an existing therapy plan
12. THE Frontend SHALL display therapy plan data as read-only after creation
13. THE Frontend SHALL disable all step 3-10 buttons until a therapy plan exists for the session
14. WHEN step 3-10 buttons are disabled, THE Frontend SHALL display a tooltip message "Terapi plan harus diisi terlebih dahulu"

### Requirement 4: Record Vital Signs Before Treatment (Step 3)

**User Story:** As a staff member, I want to record vital signs before treatment begins, so that baseline patient condition is documented.

#### Acceptance Criteria

1. THE System SHALL provide endpoint POST /treatment-sessions/:sessionId/vital-signs accepting pencatatan, waktuCatat, value, unit, and recordedBy
2. WHEN a vital sign creation request is received, THE System SHALL validate that a therapy plan exists for the sessionId
3. IF no therapy plan exists for the sessionId, THEN THE System SHALL return HTTP 422 with message "Terapi plan harus diisi terlebih dahulu."
4. WHEN a vital sign creation request is received with waktuCatat SEBELUM, THE System SHALL validate that pencatatan is one of SISTOL, DIASTOL, HR, SATURASI, or PI
5. WHEN a vital sign creation request is received, THE System SHALL check if a vital sign already exists with the same sessionId, pencatatan, and waktuCatat combination
6. IF a matching vital sign exists, THEN THE System SHALL update the existing record with the new value
7. IF no matching vital sign exists, THEN THE System SHALL create a new VitalSign record
8. WHEN a vital sign is saved successfully, THE System SHALL return HTTP 200 with the saved vital sign data
9. THE System SHALL provide endpoint GET /treatment-sessions/:sessionId/vital-signs returning all vital signs for the session
10. THE Frontend SHALL implement inline editing for each vital sign field
11. WHEN a vital sign field value changes, THE Frontend SHALL automatically submit the change to the API without requiring a save button
12. WHEN a vital sign auto-save is in progress, THE Frontend SHALL display a loading indicator on the specific field
13. WHEN a vital sign auto-save succeeds, THE Frontend SHALL display a success indicator briefly
14. WHEN a vital sign auto-save fails, THE Frontend SHALL display an error message and revert to the previous value

### Requirement 5: Select Booster Type (Step 4 - Conditional)

**User Story:** As a staff member, I want to select the booster type for a session that includes a booster package, so that the correct booster inventory is deducted.

#### Acceptance Criteria

1. THE System SHALL provide endpoint PATCH /treatment-sessions/:sessionId/booster-type accepting boosterType
2. WHEN a booster type selection request is received, THE System SHALL validate that the session has a non-null boosterPackageId
3. IF the session boosterPackageId is null, THEN THE System SHALL return HTTP 422 with message "Sesi ini tidak memiliki paket booster."
4. WHEN a booster type selection request is received, THE System SHALL validate that the session boosterType is currently null
5. IF the session boosterType is not null, THEN THE System SHALL return HTTP 409 with message "Jenis booster sudah dipilih dan tidak dapat diubah."
6. WHEN a booster type selection request is received, THE System SHALL validate that boosterType is either NO or GASSOTRAUS
7. WHEN updating booster type, THE System SHALL update the TreatmentSession.boosterType field
8. WHEN updating booster type, THE System SHALL identify the corresponding InventoryItem for the selected booster at the session's branch
9. WHEN updating booster type, THE System SHALL validate that the InventoryItem stock is greater than or equal to the required quantity
10. IF the InventoryItem stock is insufficient, THEN THE System SHALL return HTTP 409 with message "Stok tidak mencukupi."
11. WHEN updating booster type, THE System SHALL decrement the InventoryItem.stock by the required quantity
12. WHEN updating booster type, THE System SHALL create a Stock_Mutation record with type USED, quantity, stockBefore, and stockAfter
13. WHEN updating booster type, THE System SHALL execute all database changes within a single Atomic_Transaction
14. WHEN booster type is updated successfully, THE System SHALL create an audit log entry with action UPDATE for resource TreatmentSession
15. WHEN booster type is updated successfully, THE System SHALL return HTTP 200 with the updated session data
16. THE Frontend SHALL display step 4 only when the session has a non-null boosterPackageId
17. THE Frontend SHALL hide step 4 when the session boosterPackageId is null
18. THE Frontend SHALL display booster type selection as read-only after a value is saved
19. WHEN booster type is read-only, THE Frontend SHALL display the selected value without edit controls

### Requirement 6: Record Actual Infusion (Step 5)

**User Story:** As a staff member, I want to record the actual infusion dosages and physical details, so that administered treatment is documented and inventory is automatically deducted.

#### Acceptance Criteria

1. THE System SHALL provide endpoint POST /treatment-sessions/:sessionId/infusion accepting ifa, hho, h2, no, gaso, o2, o3, edta, mb, h2s, kcl, jmlNb, deviationNotes, bottleType, jenisCairan, volumeCarrier, jumlahJarum, and tanggalProduksi
2. WHEN an infusion creation request is received, THE System SHALL validate that a therapy plan exists for the sessionId
3. IF no therapy plan exists for the sessionId, THEN THE System SHALL return HTTP 422 with message "Terapi plan harus diisi terlebih dahulu."
4. WHEN an infusion creation request is received, THE System SHALL validate that at least one vital sign with waktuCatat SEBELUM exists for the sessionId
5. IF no SEBELUM vital signs exist, THEN THE System SHALL return HTTP 422 with message "Tanda vital sebelum harus diisi terlebih dahulu."
6. WHEN an infusion creation request is received, THE System SHALL check if an infusion execution already exists for the sessionId
7. IF an infusion execution already exists for the sessionId, THEN THE System SHALL return HTTP 409 with message "Infus aktual sudah dicatat untuk sesi ini."
8. WHEN an infusion creation request is received, THE System SHALL validate that bottleType is either IFA or EDTA
9. WHEN an infusion creation request is received, THE System SHALL retrieve the therapy plan for comparison
10. WHEN an infusion creation request is received, THE System SHALL compare each actual dosage field with the corresponding therapy plan field
11. IF any actual dosage differs from the planned dosage, THEN THE System SHALL validate that deviationNotes is not null and not empty
12. IF any actual dosage differs from planned dosage and deviationNotes is empty, THEN THE System SHALL return HTTP 400 with message "Catatan deviasi wajib diisi jika dosis aktual berbeda dari rencana."
13. WHEN creating an infusion execution, THE System SHALL iterate through all 12 dosage components
14. FOR EACH dosage component with a non-zero actual value, THE System SHALL identify the corresponding InventoryItem at the session's branch
15. FOR EACH dosage component with a non-zero actual value, THE System SHALL validate that InventoryItem stock is greater than or equal to the actual dosage quantity
16. IF any InventoryItem stock is insufficient, THEN THE System SHALL return HTTP 409 with message "Stok tidak mencukupi untuk {componentName}."
17. FOR EACH dosage component with a non-zero actual value, THE System SHALL decrement the InventoryItem.stock by the actual dosage quantity
18. FOR EACH dosage component with a non-zero actual value, THE System SHALL create a Stock_Mutation record with type USED, quantity equal to actual dosage, stockBefore, and stockAfter
19. WHEN creating an infusion execution, THE System SHALL create an InfusionExecution record with all provided fields
20. WHEN creating an infusion execution, THE System SHALL execute all database changes within a single Atomic_Transaction
21. WHEN an infusion execution is created successfully, THE System SHALL create an audit log entry with action CREATE for resource InfusionExecution
22. WHEN an infusion execution is created successfully, THE System SHALL return HTTP 201 with the created infusion execution data
23. THE System SHALL provide endpoint GET /treatment-sessions/:sessionId/infusion returning the infusion execution if it exists
24. THE Frontend SHALL display therapy plan dosages in a read-only left column
25. THE Frontend SHALL display editable actual dosage fields in a right column
26. WHEN an actual dosage value differs from the planned dosage value, THE Frontend SHALL highlight the field in red
27. WHEN any actual dosage field is highlighted in red, THE Frontend SHALL display a required deviationNotes textarea
28. WHEN any actual dosage field is highlighted in red and deviationNotes is empty, THE Frontend SHALL disable the save button
29. WHEN all actual dosages match planned dosages or deviationNotes is filled, THE Frontend SHALL enable the save button
30. THE Frontend SHALL validate that bottleType, jenisCairan, volumeCarrier, jumlahJarum, and tanggalProduksi are all provided before allowing save

### Requirement 7: Session List and Detail Pages

**User Story:** As a staff member, I want to view a list of therapy sessions and access detailed session information, so that I can track and manage therapy progress.

#### Acceptance Criteria

1. THE System SHALL provide endpoint GET /treatment-sessions accepting query parameters for branchId, memberId, status, startDate, endDate, page, and limit
2. WHEN a session list request is received, THE System SHALL filter sessions by the staff's branchId from JWT
3. WHEN a session list request includes memberId, THE System SHALL filter sessions for that specific member
4. WHEN a session list request includes status, THE System SHALL filter sessions by isCompleted field
5. WHEN a session list request includes date range, THE System SHALL filter sessions where treatmentDate is between startDate and endDate
6. WHEN a session list request is received, THE System SHALL return paginated results with sessionCode, memberName, treatmentDate, pelaksanaan, infusKe, isCompleted, and step completion status
7. THE System SHALL provide endpoint GET /treatment-sessions/:sessionId returning complete session details including all step data
8. WHEN retrieving session details, THE System SHALL include a steps object indicating completion status for each of the 10 steps
9. THE Frontend SHALL display a session list page at /sessions with columns for Session Code, Member Name, Date, Type, Infus Ke, Status, and Actions
10. THE Frontend SHALL provide filter controls for member search, date range, and completion status
11. THE Frontend SHALL implement pagination controls for the session list
12. THE Frontend SHALL provide a "Create New Session" button that opens a modal form
13. THE Frontend SHALL display a session detail page at /sessions/:sessionId with a 10-step progress bar
14. WHEN displaying the progress bar, THE Frontend SHALL visually indicate which steps are completed, current, and locked
15. WHEN a step is locked, THE Frontend SHALL display a tooltip explaining the prerequisite step that must be completed first
16. THE Frontend SHALL display step 1 (Diagnosa) content when selected, showing the diagnosis form or read-only diagnosis data
17. THE Frontend SHALL display step 2 (Terapi Plan) content when selected, showing the 12 dosage fields
18. THE Frontend SHALL display step 3 (Tanda Vital SEBELUM) content when selected, showing the 5 vital sign fields with inline editing
19. THE Frontend SHALL display step 4 (Pilih Booster) content when selected if boosterPackageId exists, showing booster type selection
20. THE Frontend SHALL display step 5 (Infus Aktual) content when selected, showing planned vs actual dosages side by side

### Requirement 8: Create Session Modal Form

**User Story:** As a staff member, I want to use a modal form to create new therapy sessions, so that I can quickly initiate therapy sessions with proper validation.

#### Acceptance Criteria

1. THE Frontend SHALL display a "Create New Session" button on the session list page
2. WHEN the "Create New Session" button is clicked, THE Frontend SHALL open a modal dialog
3. THE Frontend SHALL display a member search field in the modal that queries GET /members/lookup
4. WHEN a member is selected, THE Frontend SHALL auto-populate memberId and display member details
5. THE Frontend SHALL display a dropdown for memberPackageId showing only ACTIVE Basic_Package records for the selected member at the current branch
6. THE Frontend SHALL display a dropdown for boosterPackageId showing only ACTIVE Booster_Package records for the selected member at the current branch
7. THE Frontend SHALL display the boosterPackageId dropdown as optional
8. THE Frontend SHALL display a dropdown for doctorId showing all active users with role DOCTOR across all branches
9. THE Frontend SHALL display a dropdown for nurseId showing all active users with role NURSE across all branches
10. THE Frontend SHALL auto-fill adminLayananId with the current logged-in user's ID
11. THE Frontend SHALL display a date picker for treatmentDate
12. THE Frontend SHALL display radio buttons for pelaksanaan with options ON_SITE and HOME_CARE
13. WHEN the form is submitted, THE Frontend SHALL validate that all required fields are filled
14. WHEN the form is submitted, THE Frontend SHALL call POST /treatment-sessions with the form data
15. IF the API returns an error, THE Frontend SHALL display the error message in the modal
16. IF the API returns success, THE Frontend SHALL close the modal and redirect to the session detail page
17. THE Frontend SHALL display a loading state on the submit button while the request is in progress
18. THE Frontend SHALL disable the submit button while loading

### Requirement 9: Authorization and Branch Access

**User Story:** As the system, I want to enforce authorization and branch access rules, so that staff can only access sessions and data within their authorized scope.

#### Acceptance Criteria

1. THE System SHALL apply authenticate middleware to all session endpoints
2. THE System SHALL apply authorize middleware with ALLSTAFF roles to all session endpoints
3. WHEN any session endpoint is called, THE System SHALL extract branchId from the JWT token
4. WHEN creating or accessing a session, THE System SHALL validate that the member is accessible to the staff's branch
5. IF the member is not accessible to the staff's branch, THEN THE System SHALL return HTTP 403 with message "Anda tidak memiliki akses ke member ini."
6. WHEN creating a session, THE System SHALL validate that memberPackage.branchId equals staff.branchId
7. WHEN creating a session with a booster, THE System SHALL validate that boosterPackage.branchId equals staff.branchId
8. THE System SHALL allow SUPER_ADMIN role to bypass branch access restrictions
9. THE System SHALL allow ADMIN_MANAGER role to bypass branch access restrictions
10. WHEN a diagnosis is created or updated, THE System SHALL record the userId of the staff member in audit logs
11. WHEN a therapy plan is created, THE System SHALL record the userId of the staff member in audit logs
12. WHEN vital signs are recorded, THE System SHALL record the userId in the recordedBy field
13. WHEN booster type is selected, THE System SHALL record the userId of the staff member in audit logs
14. WHEN infusion execution is recorded, THE System SHALL record the userId of the staff member in audit logs

### Requirement 10: Code Generation

**User Story:** As the system, I want to generate unique codes for encounters, sessions, diagnoses, and therapy plans, so that each entity has a human-readable identifier.

#### Acceptance Criteria

1. THE System SHALL provide a generateEncounterCode function accepting branchCode
2. WHEN generateEncounterCode is called, THE System SHALL return a string with format "ENC-{branchCode}-{YYMM}-{5chars}"
3. THE System SHALL generate the {YYMM} component from the current date
4. THE System SHALL generate the {5chars} component as a random alphanumeric string of length 5
5. THE System SHALL provide a generateSessionCode function accepting branchCode and infusKe
6. WHEN generateSessionCode is called, THE System SHALL return a string with format "SES-{branchCode}-{infusKe:02d}-{YYMM}-{5chars}"
7. THE System SHALL format infusKe as a zero-padded 2-digit number
8. THE System SHALL provide a generateDiagnosisCode function accepting branchCode
9. WHEN generateDiagnosisCode is called, THE System SHALL return a string with format "DX-{branchCode}-{YYMM}-{5digits}"
10. THE System SHALL generate the {5digits} component as a sequential number padded to 5 digits
11. THE System SHALL provide a generateTherapyPlanCode function accepting branchCode
12. WHEN generateTherapyPlanCode is called, THE System SHALL return a string with format "TP-{branchCode}-{YYMM}-{5digits}"
13. THE System SHALL ensure all generated codes are unique within their respective tables
14. IF a generated code already exists, THE System SHALL regenerate until a unique code is produced

### Requirement 11: Error Handling and Validation

**User Story:** As a user, I want to receive clear error messages in Indonesian, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. THE System SHALL validate all request payloads using Zod schemas
2. WHEN Zod validation fails, THE System SHALL return HTTP 400 with a structured error response
3. THE System SHALL include field-specific error messages in the error response
4. THE System SHALL return all error messages in Indonesian language
5. WHEN a database constraint violation occurs, THE System SHALL return HTTP 409 with a descriptive message
6. WHEN a resource is not found, THE System SHALL return HTTP 404 with message "{ResourceType} tidak ditemukan."
7. WHEN authorization fails, THE System SHALL return HTTP 403 with a descriptive message
8. WHEN authentication fails, THE System SHALL return HTTP 401 with message "Token tidak valid atau sudah kadaluarsa."
9. WHEN a business rule validation fails, THE System SHALL return HTTP 422 with a descriptive message
10. THE System SHALL log all errors with severity level ERROR or higher
11. THE System SHALL include request ID in error responses for traceability
12. THE Frontend SHALL display API error messages in toast notifications
13. THE Frontend SHALL display field-level validation errors inline below the respective input fields
14. THE Frontend SHALL display a generic error message when the API returns an unexpected error format

### Requirement 12: Performance and Data Integrity

**User Story:** As the system, I want to ensure data integrity and acceptable performance, so that operations are reliable and responsive.

#### Acceptance Criteria

1. THE System SHALL execute all session creation operations within a single database transaction
2. THE System SHALL execute all stock deduction operations within a single database transaction
3. IF any operation within a transaction fails, THEN THE System SHALL roll back all changes
4. THE System SHALL use database indexes on treatmentSessionId for vital signs queries
5. THE System SHALL use database indexes on encounterId for diagnosis queries
6. THE System SHALL use database indexes on branchId and treatmentDate for session list queries
7. THE System SHALL use database indexes on inventoryItemId for stock mutation queries
8. WHEN querying session lists, THE System SHALL limit results to 50 records per page by default
9. THE System SHALL validate that stock quantities never become negative
10. IF a stock deduction would result in negative stock, THEN THE System SHALL reject the operation with HTTP 409
11. THE System SHALL use optimistic locking for vital sign updates to prevent race conditions
12. THE System SHALL complete session creation requests within 2 seconds under normal load
13. THE System SHALL complete vital sign auto-save requests within 500 milliseconds under normal load
14. THE Frontend SHALL implement debouncing for vital sign auto-save with a 1-second delay
15. THE Frontend SHALL display loading indicators for all asynchronous operations exceeding 300 milliseconds
